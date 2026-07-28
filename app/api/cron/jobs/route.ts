import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { FlowLoadError, resumeSession } from "@/lib/flow-engine/engine";
import type { Json } from "@/lib/types/database";

// Signals the handler to skip retry/backoff and route straight to the
// failed + settle branch (which performs/re-attempts the session cancel).
// Thrown when (a) a resume failed AND the cancel of its session also failed
// (requeuing would strand the session: the retry hits the stale-node guard
// and completes the job), or (b) a reclaimed job found its session stranded
// by a resume invocation that died mid-traversal (retrying cannot help; the
// session must be cancelled and the job is the only evidence of the crash).
class SessionCancelError extends Error {}

// Thrown when a reclaimed job finds its session moved past the delay node and
// not parked, but WRITTEN TO within the stale window: either a concurrent
// webhook resume is mid-traversal (traverseNodes stamps current_node_id, and
// the updated_at trigger fires, on every node) or a resume crashed moments
// ago. The two are indistinguishable right now, and cancelling would kill a
// live run, so the job is requeued past the window and the next look decides.
class SessionRecheckError extends Error {}

// An invocation that has not written anything for this long is provably dead:
// used both to reclaim stale job claims and to age flow_sessions.updated_at.
const STALE_INVOCATION_MS = 5 * 60 * 1000;

function wasSessionWrittenRecently(updatedAt: string): boolean {
  return new Date(updatedAt).getTime() > Date.now() - STALE_INVOCATION_MS;
}

/**
 * Cron job handler that processes scheduled jobs.
 * Call via Vercel Cron or external cron every 10-30 seconds.
 * GET /api/cron/jobs?key=CRON_SECRET
 */
export async function GET(request: NextRequest) {
  // Simple auth via query param or header
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret =
    request.nextUrl.searchParams.get("key") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Prune the webhook idempotency ledger; ids only matter for Zernio's retry
  // window (hours), so anything older than 48h is dead weight.
  await supabase
    .from("webhook_events")
    .delete()
    .lt("received_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

  // Pick up pending jobs that are due, plus 'processing' jobs whose claim is
  // stale: if the claim UPDATE commits but the response is lost, nothing else
  // ever re-reads that status and the job would be stranded forever. Five
  // minutes is far beyond any real processing time here. The is.null arm
  // covers rows claimed without a claimed_at stamp (strands from before
  // migration 00015's backfill, or claims by a not-yet-redeployed invocation
  // during a deploy; a lt. comparison is NULL-hostile and would skip them
  // forever). Those rows are NOT processed directly, only stamped, see below.
  const staleClaimCutoff = new Date(Date.now() - STALE_INVOCATION_MS).toISOString();
  const { data: jobs, error } = await supabase
    .from("scheduled_jobs")
    .select("*")
    .or(
      `status.eq.pending,and(status.eq.processing,or(claimed_at.lt.${staleClaimCutoff},claimed_at.is.null))`
    )
    .lte("run_at", new Date().toISOString())
    .order("run_at", { ascending: true })
    .limit(20);

  if (error || !jobs) {
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }

  let processed = 0;
  let failed = 0;
  const maxAttempts = 3;

  for (const job of jobs) {
    // A 'processing' row without claimed_at cannot be aged: it is either a
    // pre-backfill strand or a live claim by an old-code invocation that
    // never stamped claimed_at (deploy window). Processing it now could
    // double-process against that live invocation (duplicate sends), so just
    // start the staleness clock; the lt arm reclaims it next run once it is
    // provably stale.
    if (job.status === "processing" && !job.claimed_at) {
      const { error: stampError } = await supabase
        .from("scheduled_jobs")
        .update({ claimed_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("status", "processing")
        .is("claimed_at", null);
      if (stampError) {
        console.error(
          `Failed to stamp claimed_at on unaged job ${job.id}:`,
          stampError
        );
      }
      continue;
    }

    // A hung invocation (e.g. an httpRequest node on a never-responding
    // endpoint) never reaches the catch block, so the attempts cap there
    // cannot fire; without this guard the stale-claim reclaim would re-run
    // such a poison job forever, incrementing attempts unboundedly.
    if (job.attempts >= maxAttempts) {
      await failJobAndSettleSession({
        supabase,
        job,
        errorMessage: `Exceeded ${maxAttempts} attempts (stale claim reclaimed)`,
        onlyIfStuckOnDelayNode: true,
      });
      failed++;
      continue;
    }

    // Mark as processing; .select() returns the updated row so we can verify
    // the claim (overlapping cron runs would otherwise both process the job).
    // Matching attempts too makes this a CAS: once another run bumps attempts,
    // a stale snapshot can never re-claim the job, even after that run
    // requeues it as pending, so backoff and the attempt count are respected.
    const { data: claimed, error: claimError } = await supabase
      .from("scheduled_jobs")
      .update({
        status: "processing",
        attempts: job.attempts + 1,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", job.status) // Optimistic lock (pending, or stale-claim reclaim)
      .eq("attempts", job.attempts)
      .select();

    if (claimError) {
      // Unknown outcome: the UPDATE may have committed with only the response
      // lost. Skip; if it did commit, the stale-claim reclaim above picks the
      // job up again once claimed_at ages past the cutoff.
      console.error(`Failed to claim job ${job.id}:`, claimError);
      continue;
    }
    if (!claimed || claimed.length === 0) continue; // Claim lost to another run

    try {
      await processJob(supabase, job);
      await supabase
        .from("scheduled_jobs")
        .update({ status: "completed" })
        .eq("id", job.id);
      processed++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (err instanceof SessionRecheckError) {
        // Requeue past the recency window and undo the claim's attempts bump:
        // a recheck is not a failure, and letting rechecks exhaust attempts
        // would route a possibly-live session into the terminal cancel below.
        await supabase
          .from("scheduled_jobs")
          .update({
            status: "pending",
            run_at: new Date(Date.now() + STALE_INVOCATION_MS).toISOString(),
            attempts: job.attempts,
            last_error: errorMessage,
          })
          .eq("id", job.id);
      } else if (job.attempts + 1 >= maxAttempts || err instanceof SessionCancelError) {
        await failJobAndSettleSession({ supabase, job, errorMessage });
      } else {
        // Retry with backoff
        const backoffMs = Math.pow(2, job.attempts + 1) * 5000;
        const retryAt = new Date(Date.now() + backoffMs).toISOString();
        await supabase
          .from("scheduled_jobs")
          .update({
            status: "pending",
            run_at: retryAt,
            last_error: errorMessage,
          })
          .eq("id", job.id);
      }
      failed++;
    }
  }

  return NextResponse.json({ processed, failed, total: jobs.length });
}

// Marks a job out of retries as failed. A failed resume_flow job would leave
// its session sitting active forever with no pending job, so settle it too
// (idempotent: non-load failures already cancelled it inside processJob).
// onlyIfStuckOnDelayNode (the attempts-exhausted reclaim path) additionally
// gates the cancel on the session NOT being healthily parked: a reclaimed
// job whose resume actually succeeded before its invocation died (or a
// duplicate from the old restart bug) leaves the session waiting at a later
// node, and cancelling it would kill the run mid-way. 'Moved past the delay
// node' alone is NOT that proof (a resume that died mid-traversal also moved
// past it), so the gate checks the recoverable-parking markers instead. The
// catch path must NOT gate: a SessionCancelError re-attempts a cancel for a
// session whose current_node_id may already have advanced.
async function failJobAndSettleSession({
  supabase,
  job,
  errorMessage,
  onlyIfStuckOnDelayNode = false,
}: {
  supabase: Awaited<ReturnType<typeof createServiceClient>>;
  job: { id: string; type: string; payload: Json };
  errorMessage: string;
  onlyIfStuckOnDelayNode?: boolean;
}) {
  await supabase
    .from("scheduled_jobs")
    .update({ status: "failed", last_error: errorMessage })
    .eq("id", job.id);

  if (job.type === "send_broadcast") {
    await settleBroadcastRecipientAsFailed({ supabase, job, errorMessage });
    return;
  }

  if (job.type !== "resume_flow") return;
  const payload = job.payload as { sessionId?: string; nodeId?: string } | null;
  const sessionId = payload?.sessionId;
  if (!sessionId) return;

  if (onlyIfStuckOnDelayNode) {
    const { data: session, error: sessionError } = await supabase
      .from("flow_sessions")
      .select("current_node_id, waiting_for_input, waiting_until, status, updated_at")
      .eq("id", sessionId)
      .single();
    if (sessionError || !session) {
      // Unknown state: do not cancel blind (the session may be healthily
      // waiting at a later node). Log so a possible strand stays visible.
      console.error(
        `Could not load session ${sessionId} to settle after job ${job.id} exhausted retries; session may be left active:`,
        sessionError
      );
      return;
    }
    if (session.status !== "active") return;
    if (payload?.nodeId && session.current_node_id !== payload.nodeId) {
      try {
        const parked = await isSessionParkedRecoverably({
          supabase,
          session: { id: sessionId, ...session },
          excludeJobId: job.id,
        });
        if (parked) return;
      } catch (err) {
        console.error(
          `Could not verify session ${sessionId} state after job ${job.id} exhausted retries; session may be left active:`,
          err
        );
        return;
      }
      // Written to within the stale window: a concurrent resume may be
      // mid-traversal (see SessionRecheckError). Do not cancel blind; the
      // job is already failed, so log the possible strand instead.
      if (wasSessionWrittenRecently(session.updated_at)) {
        console.error(
          `Session ${sessionId} was written recently after job ${job.id} exhausted retries; skipping cancel, session may be left active`
        );
        return;
      }
    }
  }

  const { error: settleError } = await supabase
    .from("flow_sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionId)
    .eq("status", "active");
  if (settleError) {
    // The job is already 'failed' and never re-fetched, so this session stays
    // active with no pending job. Requeuing would not help: the retry hits the
    // stale-node guard in processJob and completes without cancelling. Log it
    // so the strand is visible.
    console.error(
      `Failed to settle session ${sessionId} after job ${job.id} exhausted retries; session left active:`,
      settleError
    );
  }
}

// A send_broadcast job out of retries would otherwise leave its recipient
// stuck in 'pending'/'sending' forever (no other job touches the row, and
// settleBroadcastIfDone counts both as unfinished, so the broadcast would
// stay 'sending' too). Settle the recipient as failed; best-effort, the job
// is already marked failed.
async function settleBroadcastRecipientAsFailed({
  supabase,
  job,
  errorMessage,
}: {
  supabase: Awaited<ReturnType<typeof createServiceClient>>;
  job: { id: string; payload: Json };
  errorMessage: string;
}) {
  const payload = job.payload as {
    broadcastId?: string;
    recipientId?: string;
  } | null;
  if (!payload?.broadcastId || !payload?.recipientId) return;

  const { data: settled, error } = await supabase
    .from("broadcast_recipients")
    .update({ status: "failed", error_message: errorMessage })
    .eq("id", payload.recipientId)
    .in("status", ["pending", "sending"])
    .select();
  if (error) {
    console.error(
      `Failed to settle broadcast recipient ${payload.recipientId} after job ${job.id} exhausted retries; recipient may be left unfinished:`,
      error
    );
    return;
  }
  if (settled && settled.length > 0) {
    await supabase.rpc("increment_broadcast_failed", {
      b_id: payload.broadcastId,
    });
  }
  // Run even when no row matched: a previous invocation may have settled the
  // recipient but died before settling the broadcast.
  await settleBroadcastIfDone(supabase, payload.broadcastId);
}

// A session that moved past a delay node is healthy only if the resume that
// moved it also parked it somewhere recoverable: waiting on input, stamped
// with a later delay's waiting_until (resumeSession clears it before
// traversing, so non-null means a later delay executed), or covered by
// another scheduled resume job (crash between the job insert and the
// waiting_until stamp in executeDelay). An active session with none of these
// was left by a resume invocation that died mid-traversal.
// Throws on a failed jobs read: unknown state must not be reported as
// unhealthy, or a transient read failure could cancel a live session.
async function isSessionParkedRecoverably({
  supabase,
  session,
  excludeJobId,
}: {
  supabase: Awaited<ReturnType<typeof createServiceClient>>;
  session: { id: string; waiting_for_input: boolean; waiting_until: string | null };
  excludeJobId: string;
}): Promise<boolean> {
  if (session.waiting_for_input || session.waiting_until) return true;

  const { count, error } = await supabase
    .from("scheduled_jobs")
    .select("id", { count: "exact", head: true })
    .eq("type", "resume_flow")
    .in("status", ["pending", "processing"])
    .neq("id", excludeJobId)
    .contains("payload", { sessionId: session.id });
  if (error) {
    throw new Error(
      `could not check scheduled jobs for session ${session.id}: ${error.message}`
    );
  }
  return (count ?? 0) > 0;
}

async function processJob(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  job: { id: string; type: string; payload: Json }
) {
  switch (job.type) {
    case "resume_flow": {
      const payload = job.payload as {
        sessionId: string;
        flowId: string;
        channelId: string;
        contactId: string;
        conversationId: string;
        workspaceId: string;
        nodeId: string;
        lateConversationId?: string | null;
        lateAccountId?: string | null;
        variables?: Record<string, string> | null;
      };

      // Check if session is still active
      const { data: session, error: sessionError } = await supabase
        .from("flow_sessions")
        .select("*")
        .eq("id", payload.sessionId)
        .eq("status", "active")
        .single();

      if (!session) {
        // postgrest-js swallows transient failures into { data: null, error };
        // only PGRST116 (zero rows) means the session is genuinely
        // cancelled/completed. Anything else must throw so the job retries
        // with backoff instead of being marked completed.
        if (sessionError && sessionError.code !== "PGRST116") {
          throw new Error(
            `flow session ${payload.sessionId} could not be loaded: ${sessionError.message}`
          );
        }
        return;
      }

      // The session moved past the delay node. That alone does not mean the
      // resume succeeded (duplicate jobs left by the old restart bug): a
      // resume whose invocation died mid-traversal (maxDuration, hung fetch,
      // OOM) ALSO moved past it, after advancing current_node_id but before
      // parking the session. Disambiguate before treating the job as
      // satisfied; a stranded session would otherwise sit active forever
      // with no job and no log line.
      if (payload.nodeId && session.current_node_id !== payload.nodeId) {
        const parked = await isSessionParkedRecoverably({
          supabase,
          session,
          excludeJobId: job.id,
        });
        if (parked) return;
        // Not parked, but written to within the stale window: a concurrent
        // webhook resume may be mid-traversal (it clears waiting_for_input
        // before traversing, so the snapshot above shows no markers even for
        // a healthy live run). Cancelling now would kill it; look again once
        // the window has passed and the state is decidable.
        if (wasSessionWrittenRecently(session.updated_at)) {
          throw new SessionRecheckError(
            `session ${payload.sessionId} moved past delay node ${payload.nodeId} and is not parked, but was written recently; a concurrent resume may be mid-traversal`
          );
        }
        // This reclaimed job is the only evidence of the crash; route to the
        // failed + settle branch (which cancels the session) instead of
        // completing the job and discarding it.
        throw new SessionCancelError(
          `session ${payload.sessionId} moved past delay node ${payload.nodeId} to ${session.current_node_id} but is not waiting and has no scheduled job; a resume invocation died mid-traversal`
        );
      }

      // Resume from the node after the delay; resumeSession restores
      // variables from the session row and leaves {{message}} untouched
      // because incomingMessage is empty.
      try {
        await resumeSession(supabase, session, {
          triggerId: "",
          flowId: session.flow_id,
          channelId: payload.channelId,
          contactId: payload.contactId,
          conversationId: payload.conversationId,
          workspaceId: payload.workspaceId,
          lateConversationId: payload.lateConversationId || undefined,
          lateAccountId: payload.lateAccountId || undefined,
          variables: payload.variables || undefined,
          incomingMessage: {},
        });
      } catch (err) {
        // A FlowLoadError is thrown before resumeSession advances
        // current_node_id, so the retry cannot hit the stale-node guard
        // above; leave the session active and let the cron backoff retry
        // recover from the transient failure.
        if (err instanceof FlowLoadError) throw err;

        // Any other throw may have advanced current_node_id past the delay
        // node; the retry would then hit the stale-node guard above and
        // complete, stranding the session as active with no pending job.
        // Cancel it so the failure is explicit.
        const { error: cancelError } = await supabase
          .from("flow_sessions")
          .update({ status: "cancelled" })
          .eq("id", payload.sessionId);
        if (cancelError) {
          // postgrest swallows network failures into { error }, so an
          // unchecked cancel can silently no-op; see SessionCancelError.
          throw new SessionCancelError(
            `resume of session ${payload.sessionId} failed (${
              err instanceof Error ? err.message : String(err)
            }) and the session cancel also failed: ${cancelError.message}`
          );
        }
        console.error(
          `Failed to resume flow session ${payload.sessionId} (flow ${session.flow_id}), session cancelled:`,
          err
        );
        throw err;
      }
      break;
    }

    case "send_broadcast": {
      const payload = job.payload as {
        broadcastId: string;
        recipientId: string;
      };

      // Process individual broadcast recipient
      const { data: recipient, error: recipientError } = await supabase
        .from("broadcast_recipients")
        .select("*, contacts(*), channels(*), broadcasts(*)")
        .eq("id", payload.recipientId)
        .single();

      if (!recipient) {
        // Only PGRST116 (zero rows) means the recipient row is genuinely
        // gone; a transient failure must throw so the job retries instead of
        // dropping the send and stranding the broadcast in 'sending'.
        if (recipientError && recipientError.code !== "PGRST116") {
          throw new Error(
            `broadcast recipient ${payload.recipientId} could not be loaded: ${recipientError.message}`
          );
        }
        return;
      }

      // A 'sending' row means a previous invocation of this job died between
      // claiming the recipient and recording the outcome (the stale-claim
      // reclaim resurrects such jobs). The message may or may not have
      // reached the contact, so mark it failed instead of re-sending: a
      // duplicate customer-visible message is worse than a false failure.
      if (recipient.status === "sending") {
        const { data: settled, error: settleError } = await supabase
          .from("broadcast_recipients")
          .update({
            status: "failed",
            error_message: "Interrupted mid-send; delivery outcome unknown",
          })
          .eq("id", payload.recipientId)
          .eq("status", "sending")
          .select();
        if (settleError) {
          // Unknown outcome: throw so the job retries; incrementing the
          // failed counter now could count a recipient still stuck in
          // 'sending', and completing the job would strand it forever.
          throw new Error(
            `failed to settle interrupted broadcast recipient ${payload.recipientId}: ${settleError.message}`
          );
        }
        if (!settled || settled.length === 0) return; // Another run settled it
        await supabase.rpc("increment_broadcast_failed", {
          b_id: payload.broadcastId,
        });
        await settleBroadcastIfDone(supabase, payload.broadcastId);
        return;
      }

      if (recipient.status !== "pending") return;

      // Get workspace API key
      const broadcast = recipient.broadcasts as { workspace_id: string } | null;
      if (!broadcast) return;

      const { data: workspace } = await supabase
        .from("workspaces")
        .select("late_api_key_encrypted")
        .eq("id", broadcast.workspace_id)
        .single();

      if (!workspace?.late_api_key_encrypted) return;

      const { createZernioClient } = await import("@/lib/zernio-client");
      const zernio = createZernioClient(workspace.late_api_key_encrypted);

      const channel = recipient.channels as { late_account_id: string } | null;
      if (!channel) return;

      // Get the conversation for this contact+channel (need late_conversation_id)
      const { data: conv } = await supabase
        .from("conversations")
        .select("late_conversation_id")
        .eq("contact_id", recipient.contact_id)
        .eq("channel_id", recipient.channel_id)
        .single();

      if (!conv?.late_conversation_id) return;

      const broadcastData = recipient.broadcasts as { message_content: { text?: string } } | null;
      const messageContent = broadcastData?.message_content;

      // CAS to 'sending' before the API call so a crash between the send and
      // the 'sent' write cannot cause a re-send when the job is reclaimed
      // (the 'sending' branch above settles it as failed instead).
      const { data: sendClaim, error: sendClaimError } = await supabase
        .from("broadcast_recipients")
        .update({ status: "sending" })
        .eq("id", payload.recipientId)
        .eq("status", "pending")
        .select();
      if (sendClaimError) {
        // Unknown outcome: throw so the job retries; if the CAS committed,
        // the retry finds 'sending' and settles the recipient as failed.
        throw new Error(
          `failed to claim broadcast recipient ${payload.recipientId}: ${sendClaimError.message}`
        );
      }
      if (!sendClaim || sendClaim.length === 0) return;

      try {
        await zernio.messages.sendInboxMessage({
          path: { conversationId: conv.late_conversation_id },
          body: { accountId: channel.late_account_id, message: messageContent?.text || "" },
        });

        await supabase
          .from("broadcast_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", payload.recipientId);

        // Increment broadcast sent count
        await supabase.rpc("increment_broadcast_sent", {
          b_id: payload.broadcastId,
        });
      } catch (err) {
        await supabase
          .from("broadcast_recipients")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message : String(err),
          })
          .eq("id", payload.recipientId);

        await supabase.rpc("increment_broadcast_failed", {
          b_id: payload.broadcastId,
        });
      }

      await settleBroadcastIfDone(supabase, payload.broadcastId);
      break;
    }

    default:
      console.warn(`Unknown job type: ${job.type}`);
  }
}

// Marks the broadcast completed once no recipient is left unfinished.
// 'sending' counts as unfinished: it is an in-flight (or crashed) send that
// will still be settled to sent/failed.
async function settleBroadcastIfDone(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  broadcastId: string
) {
  const { count } = await supabase
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcastId)
    .in("status", ["pending", "sending"]);

  if (count === 0) {
    await supabase
      .from("broadcasts")
      .update({ status: "completed" })
      .eq("id", broadcastId)
      .eq("status", "sending");
  }
}
