import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database";
import { executeFlow } from "@/lib/flow-engine/engine";
import { createZernioClient } from "@/lib/zernio-client";
import { generateText, createGateway } from "ai";

type Channel = Database["public"]["Tables"]["channels"]["Row"];
type Trigger = Database["public"]["Tables"]["triggers"]["Row"];

export interface IncomingComment {
  id: string;
  postId: string;
  text: string;
  author: { id?: string; name?: string; username?: string };
}

export type CommentForMatching = Pick<IncomingComment, "postId"> & { text: string };

interface CommentKeywordConfig {
  keywords?: Array<{
    value: string;
    matchType?: "exact" | "contains" | "startsWith";
  }>;
  postIds?: string[];
  /** Public comment reply. Can be a single string or an array of variants —
   * when it's an array, one variant is picked at random per comment so the
   * comment section doesn't look like a bot army with identical replies.
   *
   * IMPORTANT: No reply variant should contain any trigger keyword — otherwise
   * our own reply can trigger the automation again, creating an infinite loop.
   */
  replyText?: string | string[];
}

/**
 * Picks one reply from a replyText config value. Supports both legacy single
 * strings and new variant arrays. Returns null if replyText is missing/empty.
 */
function pickReplyText(replyText?: string | string[]): string | null {
  if (!replyText) return null;
  if (typeof replyText === "string") {
    return replyText.trim() || null;
  }
  if (Array.isArray(replyText) && replyText.length > 0) {
    // Pick a random variant
    const variants = replyText.map((r) => r.trim()).filter(Boolean);
    if (variants.length === 0) return null;
    return variants[Math.floor(Math.random() * variants.length)];
  }
  return null;
}

/**
 * Returns all known reply texts across all triggers (flattened from arrays).
 * Used to detect if an incoming comment is actually OUR OWN bot reply —
 * a defense-in-depth guard against infinite self-reply loops.
 *
 * The check is case-insensitive and matches on the first 40 chars of the
 * comment text to handle truncation by the platform.
 */
function isLikelyOurOwnReply(
  commentText: string,
  allReplyTexts: string[],
): boolean {
  const lower = commentText.toLowerCase().trim().slice(0, 60);
  if (!lower) return false;
  return allReplyTexts.some(
    (r) => r.toLowerCase().trim().slice(0, 60) === lower,
  );
}

/**
 * Pre-filter: determines whether an unmatched comment should be skipped
 * WITHOUT calling the AI — saving tokens and preventing useless replies.
 *
 * Patterns from Zernio's official blog on Instagram comment moderation
 * (https://zernio.com/blog/instagram-comment-moderation-api).
 */
function shouldSkipComment(text: string): boolean {
  const lower = text.toLowerCase().trim();

  // Too short to be a meaningful question
  if (lower.length < 4) return true;

  // Contains a URL — likely spam/promo, not a question about Khilta
  if (/https?:\/\//i.test(text)) return true;

  // Just tagging another user ("@username check this")
  if (/^@\w+/.test(lower)) return true;

  // Common spam phrases (Zernio detectSpam patterns)
  if (/\b(dm me|check bio|click here|free money|winner|follow for follow|fff|l4l|c4c)\b/i.test(text)) return true;

  // Pure gratitude/greetings with no question — no useful answer to give
  if (/^(thanks|thank you|ty|tysm|nice|great|good|wow|awesome|amazing|beautiful|love this|congratulations|congrats|good job|well done|keep it up|god bless|blessed|happy|excited)\b/i.test(lower)) return true;

  // Just a name (people tag friends in comments: "Anna Alejo", "Maria Santos")
  if (/^[a-z]+ [a-z]+$/i.test(lower) && lower.split(/\s+/).length === 2) return true;

  return false;
}

// ── AI comment reply system prompt ─────────────────────────────────────────
// Separate from the DM system prompt — shorter, focused on public comment
// replies. Must be SHORT (Instagram public comments), helpful, and willing
// to SKIP when it can't confidently help.
const COMMENT_AI_SYSTEM_PROMPT = `You are Pallavi, creator of Khilta — early learning worksheets for ages 2-8.

Someone commented on our Instagram/Facebook post. Your job: decide if you can give a genuinely helpful reply, and if so, write a SHORT public comment reply.

RESPONSE RULES (CRITICAL):
- If you clearly understand the comment AND have a useful answer → reply in 1-2 short sentences
- If you DON'T fully understand, the comment is unclear, or you have nothing useful to add → respond with EXACTLY: SKIP
- Never guess. Never make up information. Never respond when confused.
- When in doubt, SKIP.

WHEN TO REPLY:
- Questions about ages, worksheets, how to get them → give a short helpful answer + mention they can comment a keyword for free worksheets
- Questions about what Khilta is → brief explanation

WHEN TO SKIP:
- Compliments, gratitude, greetings with no question
- Comments in a language you don't fully understand
- Comments that are just names, tags, or emoji
- Anything you're not 100% sure about

FORMAT:
- Reply in the same language as the comment
- Maximum 2 sentences, SHORT (Instagram public comment)
- 1 emoji max
- NO links (Instagram comments don't make links clickable)
- If replying: suggest commenting "FREE" for a free sample worksheet

WHAT KHILTA OFFERS:
- FREE sample worksheets (comment FREE on posts)
- 400+ worksheets, 10,000+ pages, ages 2-8
- All digital PDF, instant download
- Never mention prices

Remember: SKIP is always better than a wrong or useless reply.`;

/**
 * Sends an unmatched comment to the AI for evaluation. Returns a public
 * reply if the AI is confident, or null if the AI decided to SKIP.
 *
 * Uses the same AI Gateway (GPT-4o-mini) as the DM AI Smart Concierge.
 */
async function tryAiCommentReply(
  supabase: SupabaseClient<Database>,
  channel: Channel,
  comment: IncomingComment,
): Promise<string | null> {
  try {
    // Get workspace API keys
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("ai_api_key, late_api_key_encrypted")
      .eq("id", channel.workspace_id)
      .single();

    if (!workspace?.late_api_key_encrypted) return null;

    const aiGatewayKey = workspace.ai_api_key || process.env.AI_GATEWAY_API_KEY;
    if (!aiGatewayKey) return null;

    const model = "openai/gpt-4o-mini";

    const gw = createGateway({ apiKey: aiGatewayKey });
    const result = await generateText({
      model: gw(model),
      system: COMMENT_AI_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Comment from @${comment.author.username || "user"}: "${comment.text}"`,
        },
      ],
      temperature: 0.5, // Lower temp = more conservative, fewer guesses
      maxOutputTokens: 150,
    });

    const reply = result.text.trim();

    // AI decided to skip
    if (reply.toUpperCase() === "SKIP" || reply.length < 2) {
      // Log the skip for monitoring
      await supabase.from("analytics_events").insert({
        workspace_id: channel.workspace_id,
        event_type: "comment_ai_skipped",
        metadata: {
          commentText: comment.text.slice(0, 200),
          author: comment.author.username || comment.author.name,
        },
      });
      return null;
    }

    // Log the successful AI reply for monitoring
    await supabase.from("analytics_events").insert({
      workspace_id: channel.workspace_id,
      event_type: "comment_ai_replied",
      metadata: {
        commentText: comment.text.slice(0, 200),
        aiReply: reply.slice(0, 200),
        author: comment.author.username || comment.author.name,
      },
    });

    return reply;
  } catch (err) {
    console.error("AI comment reply failed:", err);
    return null; // On error, don't reply — fail gracefully
  }
}

/**
 * Returns the first trigger whose keywords match the comment text, honoring
 * per-keyword matchType and optional postIds scoping. Triggers are checked in
 * array order — callers pass them pre-sorted by priority.
 */
export function matchCommentTrigger(
  triggers: Trigger[],
  comment: CommentForMatching,
): Trigger | null {
  const text = comment.text.toLowerCase().trim();
  if (!text) return null;

  for (const trigger of triggers) {
    const config = trigger.config as unknown as CommentKeywordConfig;
    if (!config.keywords?.length) continue;
    if (config.postIds?.length && !config.postIds.includes(comment.postId)) continue;

    for (const kw of config.keywords) {
      const keyword = kw.value.toLowerCase();
      const matchType = kw.matchType || "contains";
      if (matchType === "exact" && text === keyword) return trigger;
      if (matchType === "contains" && text.includes(keyword)) return trigger;
      if (matchType === "startsWith" && text.startsWith(keyword)) return trigger;
    }
  }

  return null;
}

export async function getActiveCommentTriggers(
  supabase: SupabaseClient<Database>,
  { channelId, workspaceId }: { channelId: string; workspaceId: string },
): Promise<Trigger[]> {
  // Null channel_id means workspace-wide, NOT global — pin to the channel's
  // workspace so one tenant's triggers never run on another tenant's channels.
  const { data: triggers } = await supabase
    .from("triggers")
    .select("*, flows!inner(status, workspace_id)")
    .eq("type", "comment_keyword")
    .or(`channel_id.eq.${channelId},channel_id.is.null`)
    .eq("is_active", true)
    .eq("flows.status", "published")
    .eq("flows.workspace_id", workspaceId)
    .order("priority", { ascending: false });

  return (triggers as Trigger[] | null) ?? [];
}

export interface ProcessCommentResult {
  matched: boolean;
  skipped?: "already_processed" | "own_comment" | "rate_limited";
  triggerId?: string;
  error?: string;
}

/**
 * Process one inbound comment against the channel's comment_keyword triggers:
 * upsert the contact, optionally post the configured public reply, and execute
 * the flow (which sends the DM via its privateReply node using the comment_id
 * and post_id variables set here). Idempotent across webhook redeliveries via
 * the (channel_id, platform_comment_id) unique log row.
 */
export async function processComment({
  supabase,
  channel,
  comment,
}: {
  supabase: SupabaseClient<Database>;
  channel: Channel;
  comment: IncomingComment;
}): Promise<ProcessCommentResult> {
  const { data: alreadyLogged } = await supabase
    .from("comment_logs")
    .select("id")
    .eq("channel_id", channel.id)
    .eq("platform_comment_id", comment.id)
    .maybeSingle();

  if (alreadyLogged) return { matched: false, skipped: "already_processed" };

  // Defense-in-depth: skip comments authored by our own account.
  // The webhook handler does this check first, but we also check here so that
  // even if the webhook guard is bypassed (e.g., different author field shape),
  // we never process our own bot replies. This prevents infinite self-reply loops.
  if (comment.author.username && comment.author.username === channel.username) {
    return { matched: false, skipped: "own_comment" };
  }
  if (comment.author.name && channel.display_name &&
      comment.author.name.trim() === channel.display_name.trim()) {
    return { matched: false, skipped: "own_comment" };
  }
  // Check by platform Page ID — Facebook sends author.id = FB Page ID for
  // page-owned comments. This is the most reliable check (unlike username
  // which is null, or display_name which is a fragile string match).
  if (comment.author.id && channel.platform_page_id &&
      comment.author.id === channel.platform_page_id) {
    return { matched: false, skipped: "own_comment" };
  }

  // ── One-DM-per-user-per-post rule ──────────────────────────────────────────
  // Industry standard (Meta, ManyChat, Spur): a user should receive at most ONE
  // automated DM and ONE public reply per post, no matter how many comments they
  // leave. Without this, commenting the same keyword twice (or commenting two
  // different matching keywords) sends duplicate worksheet DMs — which looks
  // spammy and can hurt account reputation.
  //
  // We block in TWO cases:
  //  1. dm_sent=true → DM already delivered successfully
  //  2. matched_trigger_id IS NOT NULL AND created <5min ago → flow in progress
  //     (prevents race condition when two comments arrive seconds apart)
  // Case 2 has a 5-minute TTL so a permanently failed DM (dm_sent stays false)
  // can be retried after the flow finishes.
  if (comment.author.id) {
    const { data: existingLogs } = await supabase
      .from("comment_logs")
      .select("dm_sent, reply_sent, created_at, matched_trigger_id")
      .eq("channel_id", channel.id)
      .eq("post_id", comment.postId)
      .eq("author_id", comment.author.id)
      .not("matched_trigger_id", "is", null);
    if (existingLogs && existingLogs.length > 0) {
      const hasDelivered = existingLogs.some((l) => l.dm_sent);
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const hasInProgress = existingLogs.some(
        (l) => !l.dm_sent && l.created_at > fiveMinAgo
      );
      if (hasDelivered || hasInProgress) {
        console.log(
          `[dedup] Author ${comment.author.id} on post ${comment.postId}: ` +
          `${hasDelivered ? "DM already sent" : "flow in progress"} — skipping`,
        );
        return { matched: false, skipped: "rate_limited" };
      }
    }
  }

  const triggers = await getActiveCommentTriggers(supabase, {
    channelId: channel.id,
    workspaceId: channel.workspace_id,
  });
  const matchedTrigger = matchCommentTrigger(triggers, comment);

  // ── Self-reply loop guard: check if this comment matches any of our own
  // configured replyTexts. If the bot's own reply happens to contain a trigger
  // keyword (e.g. replying "Fun rainbow challenge" which still matches COLOR
  // via partial match), the webhook may fire again for our own reply.
  // The existing author checks (username/display_name/platform_page_id) are the
  // primary defense, but Meta sometimes sends different author field shapes,
  // so this content-based check is a safety net.
  const allReplyTexts = triggers.flatMap((t) => {
    const cfg = t.config as unknown as CommentKeywordConfig;
    if (!cfg.replyText) return [];
    return Array.isArray(cfg.replyText) ? cfg.replyText : [cfg.replyText];
  });
  if (isLikelyOurOwnReply(comment.text, allReplyTexts)) {
    console.log(
      `[loop-guard] Comment "${comment.text.slice(0, 40)}..." matches our own reply text — skipping`,
    );
    return { matched: false, skipped: "own_comment" };
  }

  if (!matchedTrigger) {
    // ── AI comment reply for unmatched comments ────────────────────────────
    // Pre-filter: skip spam, greetings, tags, links without wasting AI tokens
    if (!shouldSkipComment(comment.text)) {
      // Send to AI — it will decide whether to reply or SKIP
      const aiReply = await tryAiCommentReply(supabase, channel, comment);

      if (aiReply) {
        // AI had a confident answer — post it as a public reply
        const { data: workspace } = await supabase
          .from("workspaces")
          .select("late_api_key_encrypted")
          .eq("id", channel.workspace_id)
          .single();

        if (workspace?.late_api_key_encrypted) {
          try {
            const zernio = createZernioClient(workspace.late_api_key_encrypted);
            await zernio.comments.replyToInboxPost({
              path: { postId: comment.postId },
              body: {
                accountId: channel.late_account_id,
                message: aiReply,
                commentId: comment.id,
              },
            });
          } catch (err) {
            console.error("Failed to post AI comment reply:", err);
          }
        }
      }
    }

    await logComment({ supabase, channel, comment, triggerId: null });
    return { matched: false };
  }

  const config = matchedTrigger.config as unknown as CommentKeywordConfig;

  try {
    const senderId = comment.author.id || `comment_${comment.id}`;
    const senderName =
      comment.author.name || comment.author.username || "Unknown commenter";

    let contactId: string;
    const { data: existingContactChannel } = await supabase
      .from("contact_channels")
      .select("contact_id")
      .eq("channel_id", channel.id)
      .eq("platform_sender_id", senderId)
      .maybeSingle();

    if (existingContactChannel) {
      contactId = existingContactChannel.contact_id;
      await supabase
        .from("contacts")
        .update({ last_interaction_at: new Date().toISOString() })
        .eq("id", contactId);
    } else {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          workspace_id: channel.workspace_id,
          display_name: senderName,
          last_interaction_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (!newContact) {
        return { matched: true, triggerId: matchedTrigger.id, error: "Failed to create contact" };
      }

      contactId = newContact.id;

      await supabase.from("contact_channels").insert({
        contact_id: contactId,
        channel_id: channel.id,
        platform_sender_id: senderId,
        platform_username: comment.author.username || null,
      });

      await supabase.from("analytics_events").insert({
        workspace_id: channel.workspace_id,
        contact_id: contactId,
        event_type: "contact_created",
      });
    }

    let replySent = false;
    const replyMessage = pickReplyText(config.replyText);
    if (replyMessage) {
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("late_api_key_encrypted")
        .eq("id", channel.workspace_id)
        .single();

      if (workspace?.late_api_key_encrypted) {
        try {
          const zernio = createZernioClient(workspace.late_api_key_encrypted);
          await zernio.comments.replyToInboxPost({
            path: { postId: comment.postId },
            body: {
              accountId: channel.late_account_id,
              message: replyMessage,
              commentId: comment.id,
            },
          });
          replySent = true;
        } catch (err) {
          console.error("Failed to post comment reply:", err);
        }
      }
    }

    // Local conversation only — there is no Zernio DM conversation until the
    // flow's privateReply node creates one, so late_conversation_id stays null
    // and sendMessage nodes in comment flows are no-ops until the contact replies.
    const { data: conversation } = await supabase
      .from("conversations")
      .upsert(
        {
          workspace_id: channel.workspace_id,
          channel_id: channel.id,
          contact_id: contactId,
          platform: channel.platform,
          status: "open",
          last_message_at: new Date().toISOString(),
          last_message_preview: `[Comment] ${comment.text.slice(0, 80)}`,
        },
        { onConflict: "channel_id,contact_id" },
      )
      .select("id")
      .single();

    let dmSent = false;
    if (conversation) {
      // Store the triggering comment as an inbound message so the inbox
      // shows what the contact commented, not just the DM flow that followed.
      await supabase.from("messages").insert({
        conversation_id: conversation.id,
        direction: "inbound",
        text: comment.text,
        platform_message_id: `comment_${comment.id}`,
        status: "sent",
      });

      // Claim the comment log BEFORE the flow runs. This closes a race condition
      // where two comments from the same user arrive in quick succession (seconds
      // apart), both pass the dedup check above (because neither log is written
      // yet), and both trigger a DM. We write dm_sent=false initially — the dedup
      // above already checks dm_sent=true, so a concurrent comment from a DIFFERENT
      // post will pass correctly. For the same post, the reply_sent guard prevents
      // duplicate public replies.
      await logComment({
        supabase, channel, comment,
        triggerId: matchedTrigger.id,
        dmSent: false,  // Will be updated to true ONLY if DM actually succeeds
        replySent,
      });

      try {
        await executeFlow(supabase, {
          triggerId: matchedTrigger.id,
          flowId: matchedTrigger.flow_id,
          channelId: channel.id,
          contactId,
          conversationId: conversation.id,
          workspaceId: channel.workspace_id,
          lateAccountId: channel.late_account_id,
          incomingMessage: {
            text: comment.text,
            sender: {
              id: senderId,
              name: senderName, // Use senderName (falls back to username) — comment.author.name is often empty for IG comments
              username: comment.author.username,
            },
          },
          variables: {
            comment_id: comment.id,
            comment_text: comment.text,
            commenter_name: senderName,
            post_id: comment.postId,
          },
        });

        // Verify the DM was actually sent. executeSendMessage now re-throws on
        // failure, so reaching here means the first message was sent. But we
        // still verify via the messages table to handle edge cases (partial
        // multi-message sends where the first succeeds but a later one fails).
        const { data: recentMessages } = await supabase
          .from("messages")
          .select("status")
          .eq("conversation_id", conversation.id)
          .eq("direction", "outbound")
          .eq("sent_by_flow_id", matchedTrigger.flow_id)
          .gte("created_at", new Date(Date.now() - 60000).toISOString()) // last 60s
          .order("created_at", { ascending: false })
          .limit(1);

        dmSent = recentMessages?.[0]?.status === "sent";
      } catch (err) {
        console.error("Failed to execute comment flow:", err);
        dmSent = false;
      }
    }

    await supabase.from("analytics_events").insert({
      workspace_id: channel.workspace_id,
      flow_id: matchedTrigger.flow_id,
      contact_id: contactId,
      event_type: "comment_matched",
      metadata: {
        triggerId: matchedTrigger.id,
        postId: comment.postId,
        commentId: comment.id,
        dmSent,
        replySent,
      } as unknown as Json,
    });

    await logComment({
      supabase,
      channel,
      comment,
      triggerId: matchedTrigger.id,
      dmSent,
      replySent,
    });

    return { matched: true, triggerId: matchedTrigger.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logComment({
      supabase,
      channel,
      comment,
      triggerId: matchedTrigger.id,
      error: errorMessage,
    });
    return { matched: true, triggerId: matchedTrigger.id, error: errorMessage };
  }
}

async function logComment({
  supabase,
  channel,
  comment,
  triggerId,
  dmSent = false,
  replySent = false,
  error,
}: {
  supabase: SupabaseClient<Database>;
  channel: Channel;
  comment: IncomingComment;
  triggerId: string | null;
  dmSent?: boolean;
  replySent?: boolean;
  error?: string;
}): Promise<void> {
  await supabase.from("comment_logs").upsert(
    {
      channel_id: channel.id,
      workspace_id: channel.workspace_id,
      post_id: comment.postId,
      platform_comment_id: comment.id,
      author_id: comment.author.id || null,
      author_name: comment.author.name || null,
      author_username: comment.author.username || null,
      comment_text: comment.text,
      matched_trigger_id: triggerId,
      dm_sent: dmSent,
      reply_sent: replySent,
      ...(error ? { error } : {}),
    },
    { onConflict: "channel_id,platform_comment_id" },
  );
}
