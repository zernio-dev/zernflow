import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { executeFlow } from "@/lib/flow-engine/engine";
import { matchTrigger } from "@/lib/flow-engine/trigger-matcher";
import crypto from "crypto";

// ── Zernio API webhook payload ───────────────────────────────────────────────

interface WebhookPayload {
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

async function handleWebhook(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-late-signature");

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only handle message.received events
  if (payload.event !== "message.received") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { message: msg, conversation: conv, account, metadata } = payload;

  // Ignore outbound messages (sent by the bot itself) to prevent loops
  if (msg.direction === "outbound") {
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

  // Verify HMAC-SHA256 signature
  if (channel.webhook_secret) {
    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    const expected = crypto
      .createHmac("sha256", channel.webhook_secret)
      .update(body)
      .digest("hex");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      )
    ) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }
  }

  // ── Upsert contact ───────────────────────────────────────────────────────

  const senderId = msg.sender.id;
  const senderName = msg.sender.name || msg.sender.username || senderId;

  let contactId: string;
  const { data: existingContactChannel } = await supabase
    .from("contact_channels")
    .select("contact_id")
    .eq("channel_id", channel.id)
    .eq("platform_sender_id", senderId)
    .single();

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
        avatar_url: msg.sender.picture || null,
        last_interaction_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (!newContact) {
      return NextResponse.json(
        { error: "Failed to create contact" },
        { status: 500 }
      );
    }

    contactId = newContact.id;

    await supabase.from("contact_channels").insert({
      contact_id: contactId,
      channel_id: channel.id,
      platform_sender_id: senderId,
      platform_username: msg.sender.username || null,
    });

    await supabase.from("analytics_events").insert({
      workspace_id: channel.workspace_id,
      contact_id: contactId,
      event_type: "contact_created",
    });
  }

  // ── Upsert conversation ──────────────────────────────────────────────────

  const messagePreview = (msg.text || "").slice(0, 100);

  // Check if conversation already exists for this channel+contact
  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id, is_automation_paused, status")
    .eq("channel_id", channel.id)
    .eq("contact_id", contactId)
    .maybeSingle();

  let conversation: { id: string; is_automation_paused: boolean } | null = null;

  if (existingConversation) {
    // Update existing conversation — only update metadata, preserve status if snoozed
    const { data: updated } = await supabase
      .from("conversations")
      .update({
        late_conversation_id: conv.id,
        last_message_at: new Date().toISOString(),
        last_message_preview: messagePreview,
        // Only reopen if currently closed; preserve snoozed status
        ...(existingConversation.status === "closed" ? { status: "open" as const } : {}),
      })
      .eq("id", existingConversation.id)
      .select("id, is_automation_paused")
      .single();

    conversation = updated;

    // Increment unread count for existing conversations
    if (conversation) {
      await supabase.rpc("increment_unread", {
        conv_id: conversation.id,
        preview: messagePreview,
      });
    }
  } else {
    // Create new conversation
    const { data: inserted } = await supabase
      .from("conversations")
      .insert({
        workspace_id: channel.workspace_id,
        channel_id: channel.id,
        contact_id: contactId,
        platform: channel.platform,
        late_conversation_id: conv.id,
        status: "open",
        last_message_at: new Date().toISOString(),
        last_message_preview: messagePreview,
        unread_count: 1,
      })
      .select("id, is_automation_paused")
      .single();

    conversation = inserted;
  }

  if (!conversation) {
    return NextResponse.json(
      { error: "Failed to upsert conversation" },
      { status: 500 }
    );
  }

  // ── Store inbound message locally ──────────────────────────────────────
  // Both Zernio and local DB store messages for consistency.
  // This is critical for: AI context, welcome trigger detection, message history, bot attribution.
  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    text: msg.text || null,
    attachments: msg.attachments?.length ? msg.attachments : null,
    quick_reply_payload: metadata?.quickReplyPayload || null,
    postback_payload: metadata?.postbackPayload || null,
    callback_data: metadata?.callbackData || null,
    platform_message_id: msg.platformMessageId || null,
    status: "sent",
  });

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

    const handled = await handleGlobalKeywords(
      supabase,
      channel.workspace_id,
      contactId,
      msg.text || undefined
    );

    if (!handled) {
      const trigger = await matchTrigger(
        supabase,
        channel.id,
        conversation.id,
        incomingMessage
      );
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
          console.error("Flow execution error:", err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// ── Global keywords ─────────────────────────────────────────────────────────

async function handleGlobalKeywords(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  workspaceId: string,
  contactId: string,
  text: string | undefined
): Promise<boolean> {
  if (!text) return false;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("global_keywords")
    .eq("id", workspaceId)
    .single();

  if (!workspace?.global_keywords) return false;

  // global_keywords is stored as string[] (simple keyword strings)
  // The Settings UI saves them as plain strings like ["stop", "unsubscribe"]
  const keywords = workspace.global_keywords as string[];
  const normalizedText = text.toLowerCase().trim();

  for (const kw of keywords) {
    const keyword = typeof kw === "string" ? kw : (kw as { keyword: string }).keyword;
    if (normalizedText === keyword.toLowerCase()) {
      // Default action for global keywords is unsubscribe
      await supabase
        .from("contacts")
        .update({ is_subscribed: false })
        .eq("id", contactId);
      return true;
    }
  }

  return false;
}
