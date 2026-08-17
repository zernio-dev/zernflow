import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { executeFlow } from "@/lib/flow-engine/engine";
import { matchTrigger } from "@/lib/flow-engine/trigger-matcher";
import { resolveWebhookSecret, verifyWebhookSignature } from "@/lib/zernio-webhook";
import { upsertContactForSender } from "@/lib/inbox-sync";
import { processComment } from "@/lib/comment-processor";
import { createZernioClient } from "@/lib/zernio-client";
import type { Database } from "@/lib/types/database";
import { messagePreview } from "@/lib/message-preview";

// ── Zernio API webhook payload ───────────────────────────────────────────────

interface WebhookPayload {
  id?: string;
  event: string;
  message: {
    id: string;
    conversationId: string;
    platform: string;
    platformMessageId: string;
    direction: string;
    text: string | null;
    attachments: Array<{ type: string; url: string; payload?: string }>;
    sender: {
      id: string;
      name: string;
      username: string | null;
      picture: string | null;
    };
    sentAt: string;
    isRead: boolean;
  };
  conversation: {
    id: string;
    platformConversationId: string | null;
    participantId: string;
    participantName: string;
    participantUsername: string | null;
    participantPicture: string | null;
    status: string;
  };
  account: {
    id: string;
    platform: string;
    username: string;
    displayName: string;
  };
  metadata?: {
    quickReplyPayload?: string;
    callbackData?: string;
    postbackPayload?: string;
    postbackTitle?: string;
  };
  timestamp: string;
}

interface CommentWebhookPayload {
  id?: string;
  event: string;
  comment: {
    id: string;
    /** Zernio post ID; null when the comment is on a post not published through Zernio. */
    postId: string | null;
    platformPostId: string;
    platform: string;
    text: string;
    author: { id: string; username?: string; name?: string; picture?: string };
    createdAt: string;
    isReply: boolean;
    parentCommentId: string | null;
  };
  post: { id: string; platformPostId: string };
  account: { id: string; platform: string; username: string };
  timestamp: string;
}

// ── Webhook handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    return await handleWebhook(request);
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Claim an event id for processing. Returns false when another delivery of the
 * same event already claimed it (Zernio retries with the same id), so retries
 * and redeliveries never re-run a flow. Events without an id are processed
 * unconditionally rather than dropped.
 */
async function claimWebhookEvent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  eventId: string | null | undefined
): Promise<boolean> {
  if (!eventId) return true;
  const { error } = await supabase
    .from("webhook_events")
    .insert({ event_id: eventId });
  if (!error) return true;
  if (error.code === "23505") return false;
  // Table missing / transient DB error: fail open so deliveries keep working.
  console.error("webhook_events claim failed:", error);
  return true;
}

async function handleWebhook(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-late-signature");
  const headerEventId = request.headers.get("x-late-event-id");

  let parsed: { event?: string; id?: string };
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = parsed.id || headerEventId;

  if (parsed.event === "comment.received") {
    return handleCommentWebhook(parsed as CommentWebhookPayload, body, signature, eventId);
  }

  // Everything else besides message.received is acknowledged and ignored
  if (parsed.event !== "message.received") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const payload = parsed as WebhookPayload;

  const { message: msg, account } = payload;

  // Ignore outbound messages (sent by the bot itself) to prevent loops.
  // Accept both "outgoing" (Zernio's actual enum value) and the legacy
  // "outbound" spelling for resilience.
  if (msg.direction === "outgoing" || msg.direction === "outbound") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const supabase = await createServiceClient();

  // Look up channel by late_account_id
  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("late_account_id", account.id)
    .eq("is_active", true)
    .single();

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Prevent loops: if the sender is another connected account in this
  // workspace, skip. This happens when both sides of a DM conversation
  // are connected (e.g. during testing).
  // NOTE: Facebook page DMs can arrive with sender.username=null (same bug
  // as comments), so we also check by sender.id against all workspace channels.
  if (msg.sender.username) {
    const { data: senderChannel } = await supabase
      .from("channels")
      .select("id")
      .eq("workspace_id", channel.workspace_id)
      .eq("username", msg.sender.username)
      .eq("is_active", true)
      .maybeSingle();

    if (senderChannel) {
      return NextResponse.json({ ok: true, skipped: true, reason: "sender_is_own_account" });
    }
  }
  // Defense-in-depth: also check by late_account_id in case username is null
  // (Facebook page accounts). Any sender whose account ID matches a connected
  // channel in this workspace is our own bot.
  if (msg.sender.id) {
    const { data: senderChannelById } = await supabase
      .from("channels")
      .select("id")
      .eq("workspace_id", channel.workspace_id)
      .eq("late_account_id", msg.sender.id)
      .eq("is_active", true)
      .maybeSingle();

    if (senderChannelById) {
      return NextResponse.json({ ok: true, skipped: true, reason: "sender_is_own_account" });
    }
  }

  // Verify HMAC-SHA256 signature against the workspace-level secret
  // (falls back to the legacy per-channel secret during transition).
  const secret = await resolveWebhookSecret(supabase, channel);
  if (secret && !verifyWebhookSignature(secret, body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!(await claimWebhookEvent(supabase, eventId))) {
    return NextResponse.json({ ok: true, skipped: true, reason: "duplicate_event" });
  }

  // Ack immediately and process after the response: Zernio aborts deliveries
  // at 5s and retries, so contact upserts + flow execution (Zernio sends, AI
  // nodes) must never run before the 200 goes out.
  after(async () => {
    try {
      await processMessageEvent(supabase, payload, channel);
    } catch (err) {
      console.error("Webhook message processing error:", err);
    }
  });

  return NextResponse.json({ ok: true, queued: true });
}

async function processMessageEvent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  payload: WebhookPayload,
  channel: Database["public"]["Tables"]["channels"]["Row"],
) {
  const { message: msg, conversation: conv, account, metadata } = payload;

  // ── Upsert contact ───────────────────────────────────────────────────────

  const senderId = msg.sender.id;
  const senderName = msg.sender.name || msg.sender.username || senderId;

  const contact = await upsertContactForSender({
    supabase,
    channel,
    senderId,
    senderName,
    senderPicture: msg.sender.picture || null,
    senderUsername: msg.sender.username || null,
    interactionAt: new Date().toISOString(),
  });

  if (!contact) {
    console.error("Failed to create contact for webhook message");
    return;
  }

  const contactId = contact.contactId;

  // ── Upsert conversation ──────────────────────────────────────────────────

  const preview = messagePreview(msg.text);

  // Two-step upsert to avoid overwriting late_conversation_id on existing
  // conversations. The webhook receives Zernio's conversation ID (conv.id),
  // but for comment-triggered flows we set late_conversation_id to the
  // sender's PSID/IGA ID via sendFirstMessageAsPrivateReply. If we blindly
  // overwrite it here on every incoming message, we'd break the inbox link.
  // Step 1: try INSERT (only fires for new contacts).
  const { data: newConversation } = await supabase
    .from("conversations")
    .insert({
      workspace_id: channel.workspace_id,
      channel_id: channel.id,
      contact_id: contactId,
      platform: channel.platform,
      late_conversation_id: conv.id,
      status: "open",
      last_message_at: new Date().toISOString(),
      last_message_preview: preview,
      unread_count: 1,
    })
    .select("id, is_automation_paused")
    .single();

  let conversation = newConversation;

  // Step 2: if INSERT failed (contact already exists), UPDATE without
  // touching late_conversation_id.
  if (!conversation) {
    const { data: existingConversation } = await supabase
      .from("conversations")
      .update({
        status: "open",
        last_message_at: new Date().toISOString(),
        last_message_preview: preview,
      })
      .eq("channel_id", channel.id)
      .eq("contact_id", contactId)
      .select("id, is_automation_paused")
      .single();

    conversation = existingConversation;
  }

  if (!conversation) {
    console.error("Failed to upsert conversation for webhook message");
    return;
  }

  if (contact.existed) {
    await supabase
      .rpc("increment_unread", {
        conv_id: conversation.id,
        preview,
      })
      .then(() => {});
  }

  // Store the incoming DM locally so the inbox has a reliable history even
  // when Zernio's API returns stale or incomplete data. Use platformMessageId
  // (not msg.id which is Zernio's internal id) so it matches what the messages
  // route returns and dedup works when both sources are merged.
  const { data: existingMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversation.id)
    .eq("platform_message_id", msg.platformMessageId || msg.id)
    .maybeSingle();

  if (!existingMsg) {
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      direction: "inbound",
      text: msg.text,
      attachments: msg.attachments?.length ? msg.attachments : null,
      platform_message_id: msg.platformMessageId || msg.id,
      status: "sent",
    });
  }

  // ── Flow engine ───────────────────────────────────────────────────────────

  if (!conversation.is_automation_paused) {
    const incomingMessage = {
      text: msg.text || undefined,
      postbackPayload: metadata?.postbackPayload || undefined,
      quickReplyPayload: metadata?.quickReplyPayload || undefined,
      callbackData: metadata?.callbackData || undefined,
      sender: {
        id: msg.sender.id,
        name: msg.sender.name,
        username: msg.sender.username || undefined,
      },
    };

    // Look up workspace API key for keyword confirmation DMs
    const { data: kwWorkspace } = await supabase
      .from("workspaces")
      .select("late_api_key_encrypted")
      .eq("id", channel.workspace_id)
      .single();

    const handled = await handleGlobalKeywords({
      supabase,
      workspaceId: channel.workspace_id,
      workspaceApiKey: kwWorkspace?.late_api_key_encrypted ?? null,
      lateConversationId: conv.id,
      lateAccountId: account.id,
      contactId,
      text: msg.text || undefined,
    });

    if (!handled) {
      const trigger = await matchTrigger(supabase, {
        channelId: channel.id,
        workspaceId: channel.workspace_id,
        conversationId: conversation.id,
        message: incomingMessage,
        isFirstMessage: !contact.existed,
      });
      if (trigger) {
        try {
          await executeFlow(supabase, {
            triggerId: trigger.id,
            flowId: trigger.flow_id,
            channelId: channel.id,
            contactId,
            conversationId: conversation.id,
            workspaceId: channel.workspace_id,
            incomingMessage,
            lateConversationId: conv.id,
            lateAccountId: account.id,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);

          // Distinguish 24h-window failures from other errors. Meta only
          // allows businesses to message within 24h of the contact's last
          // message; sending after the window fails with a specific error.
          // Logging it distinctly surfaces this operational gap instead of
          // collapsing it into a generic message_failed event.
          const is24hWindowError = /24.*hour|window|outside.*allowed/i.test(errMsg);

          console.error("Flow execution error:", errMsg);

          await supabase.from("analytics_events").insert({
            workspace_id: channel.workspace_id,
            contact_id: contactId,
            flow_id: trigger.flow_id,
            event_type: is24hWindowError
              ? "message_failed_24h_window"
              : "message_failed",
            metadata: {
              error: errMsg,
              triggerId: trigger.id,
              ...(is24hWindowError ? { reason: "24h_messaging_window" } : {}),
            },
          });
        }
      }
    }
  }
}

// ── Comment webhook ─────────────────────────────────────────────────────────

async function handleCommentWebhook(
  payload: CommentWebhookPayload,
  rawBody: string,
  signature: string | null,
  eventId: string | null | undefined
) {
  const supabase = await createServiceClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("late_account_id", payload.account.id)
    .eq("is_active", true)
    .single();

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Prevent loops: our own comments (e.g. the configured public reply) also
  // arrive as comment.received and must never re-trigger a flow.
  // Facebook page comments arrive with username=null (Meta strips author
  // identity from page-owned comments by design — Graph API v26.0 doesn't
  // even list a `from` field in the Comment reference).
  // We check THREE identifiers for defense-in-depth:
  //   1. username (works for Instagram, fails for Facebook)
  //   2. display_name (works for both, but fragile — string match)
  //   3. platform_page_id (works for Facebook — author.id = FB Page ID)
  // NOTE: payload.account.id is the Zernio internal account ID, NOT the FB
  // Page ID. author.id is the FB Page ID. They are DIFFERENT ID SYSTEMS and
  // must never be compared to each other.
  const authorName = payload.comment.author?.name?.trim();
  const authorUsername = payload.comment.author?.username?.trim();
  const authorId = payload.comment.author?.id;
  const isOwnComment =
    (authorUsername && authorUsername === channel.username) ||
    (authorName && channel.display_name && authorName === channel.display_name) ||
    (authorId && channel.platform_page_id && authorId === channel.platform_page_id);
  if (isOwnComment) {
    return NextResponse.json({ ok: true, skipped: true, reason: "own_comment" });
  }

  const secret = await resolveWebhookSecret(supabase, channel);
  if (secret && !verifyWebhookSignature(secret, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!(await claimWebhookEvent(supabase, eventId))) {
    return NextResponse.json({ ok: true, skipped: true, reason: "duplicate_event" });
  }

  // Ack before processing (same 5s delivery budget as messages); processComment
  // additionally dedupes on (channel_id, platform_comment_id) so cross-event
  // redeliveries of the same comment stay one-shot.
  after(async () => {
    try {
      await processComment({
        supabase,
        channel,
        comment: {
          id: payload.comment.id,
          // Native posts (not published through Zernio) have a null postId; fall
          // back to the platform post id so flows still run. Zernio's private-reply
          // endpoint only needs the comment id, so the placeholder is harmless.
          postId: payload.comment.postId || payload.comment.platformPostId,
          text: payload.comment.text,
          author: payload.comment.author,
        },
      });
    } catch (err) {
      console.error("Webhook comment processing error:", err);
    }
  });

  return NextResponse.json({ ok: true, queued: true });
}

// ── Global keywords ─────────────────────────────────────────────────────────

/**
 * Context object for keyword confirmation DMs. Passing a single object avoids
 * the "too many positional parameters" problem where a caller silently passes
 * arguments in the wrong order.
 */
interface KeywordConfirmationParams {
  supabase: Awaited<ReturnType<typeof createServiceClient>>;
  workspaceId: string;
  workspaceApiKey: string | null;
  lateConversationId: string | null;
  lateAccountId: string | null;
  contactId: string;
  text: string | undefined;
}

/**
 * Checks the incoming text against the workspace's global keywords. When a
 * STOP/START keyword matches, updates the contact's subscription and sends a
 * confirmation DM so the contact knows their opt-in/opt-out was received.
 *
 * The confirmation DM is only sent when we have a late_conversation_id (i.e.
 * a DM context). Comment-triggered flows do not have one at keyword-check
 * time, so the confirmation is a no-op there — the early return below guards it.
 */
async function handleGlobalKeywords({
  supabase,
  workspaceId,
  workspaceApiKey,
  lateConversationId,
  lateAccountId,
  contactId,
  text,
}: KeywordConfirmationParams): Promise<boolean> {
  if (!text) return false;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("global_keywords")
    .eq("id", workspaceId)
    .single();

  if (!workspace?.global_keywords) return false;

  const keywords = workspace.global_keywords as Array<{
    keyword: string;
    action?: string;
    flowId?: string;
  }>;

  const normalizedText = text.toLowerCase().trim();

  for (const kw of keywords) {
    if (normalizedText === kw.keyword.toLowerCase()) {
      if (kw.action === "unsubscribe") {
        await supabase
          .from("contacts")
          .update({ is_subscribed: false })
          .eq("id", contactId);

        // Send confirmation DM. No-ops when there is no DM conversation yet
        // (e.g. keyword sent on a comment-triggered flow) or when outside the
        // 24h messaging window.
        await sendKeywordConfirmation({
          workspaceApiKey,
          lateConversationId,
          lateAccountId,
          message: "You've been unsubscribed from our messages. Text START to resubscribe anytime.",
        });

        return true;
      }
      if (kw.action === "subscribe") {
        await supabase
          .from("contacts")
          .update({ is_subscribed: true })
          .eq("id", contactId);

        await sendKeywordConfirmation({
          workspaceApiKey,
          lateConversationId,
          lateAccountId,
          message: "You're subscribed! Reply STOP anytime to opt out.",
        });

        return true;
      }
      return false;
    }
  }

  return false;
}

/**
 * Sends a single confirmation DM. Silently no-ops when the prerequisites for
 * sending (API key, conversation ID, account ID) are missing — this happens
 * for comment-triggered flows where no DM conversation exists yet.
 */
async function sendKeywordConfirmation({
  workspaceApiKey,
  lateConversationId,
  lateAccountId,
  message,
}: {
  workspaceApiKey: string | null;
  lateConversationId: string | null;
  lateAccountId: string | null;
  message: string;
}): Promise<void> {
  if (!workspaceApiKey || !lateConversationId || !lateAccountId) return;

  try {
    const zernio = createZernioClient(workspaceApiKey);
    await zernio.messages.sendInboxMessage({
      path: { conversationId: lateConversationId },
      body: { accountId: lateAccountId, message },
    });
  } catch (err) {
    // Most likely cause is the 24h messaging window having elapsed; log and
    // move on rather than surfacing this as a flow failure.
    console.error("Failed to send keyword confirmation DM:", err);
  }
}
