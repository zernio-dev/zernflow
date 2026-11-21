import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database";
import { executeFlow } from "@/lib/flow-engine/engine";
import { createZernioClient } from "@/lib/zernio-client";

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
  replyText?: string;
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
  skipped?: "already_processed";
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

  const triggers = await getActiveCommentTriggers(supabase, {
    channelId: channel.id,
    workspaceId: channel.workspace_id,
  });
  const matchedTrigger = matchCommentTrigger(triggers, comment);

  if (!matchedTrigger) {
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
    if (config.replyText) {
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
              message: config.replyText,
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
              name: comment.author.name,
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
        dmSent = true;
      } catch (err) {
        console.error("Failed to execute comment flow:", err);
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
      flowId: matchedTrigger.flow_id,
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
      flowId: matchedTrigger.flow_id,
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
  flowId = null,
  dmSent = false,
  replySent = false,
  error,
}: {
  supabase: SupabaseClient<Database>;
  channel: Channel;
  comment: IncomingComment;
  triggerId: string | null;
  /** Kept beside the trigger: republishing replaces trigger rows, the flow stays. */
  flowId?: string | null;
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
      flow_id: flowId,
      dm_sent: dmSent,
      reply_sent: replySent,
      ...(error ? { error } : {}),
    },
    { onConflict: "channel_id,platform_comment_id" },
  );
}
