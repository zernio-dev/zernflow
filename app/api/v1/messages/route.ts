import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";
import { messagePreview } from "@/lib/message-preview";

/**
 * GET /api/v1/messages?conversationId=...
 *
 * Fetches messages from the Zernio API (source of truth) instead of a local mirror.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  // Look up the Zernio conversation ID and workspace API key
  const { data: conversation } = await supabase
    .from("conversations")
    .select("late_conversation_id, workspace_id, channels(late_account_id)")
    .eq("id", conversationId)
    .single();

  if (!conversation?.late_conversation_id) {
    return NextResponse.json({ error: "Conversation not found or missing Zernio ID" }, { status: 404 });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("late_api_key_encrypted")
    .eq("id", conversation.workspace_id)
    .single();

  if (!workspace?.late_api_key_encrypted) {
    return NextResponse.json({ error: "API key not configured" }, { status: 400 });
  }

  const channel = conversation.channels as { late_account_id: string } | null;
  if (!channel?.late_account_id) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Fetch messages from Zernio API
  try {
    const zernio = createZernioClient(workspace.late_api_key_encrypted);
    const res = await zernio.messages.getInboxConversationMessages({
      path: { conversationId: conversation.late_conversation_id },
      query: { accountId: channel.late_account_id },
    });

    // The Zernio endpoint returns { success, messages: [...] } — NOT { data }.
    const zernioMessages =
      (res.data as { messages?: unknown[] })?.messages ??
      (res.data as { data?: unknown[] })?.data ??
      [];

    // Map Zernio messages to the shape the inbox UI expects.
    // Accept both "outgoing" (Zernio's actual enum value) and "outbound"
    // (legacy spelling) so our own replies are correctly shown on our side.
    const zernioMapped = zernioMessages.map((m: any) => ({
      id: m.id,
      conversation_id: conversationId,
      direction: m.direction === "outgoing" || m.direction === "outbound" ? "outbound" : "inbound",
      text: m.text ?? m.message ?? null,
      attachments: m.attachments?.length ? m.attachments : null,
      quick_reply_payload: null,
      postback_payload: null,
      callback_data: null,
      platform_message_id: m.platformMessageId ?? null,
      sent_by_flow_id: null,
      sent_by_node_id: null,
      sent_by_user_id: null,
      status: "sent",
      created_at: m.sentAt ?? m.createdAt ?? new Date().toISOString(),
    }));

    // Merge with locally stored messages. Zernio is the source of truth but
    // its API can lag or miss messages (especially outbound sends). The local
    // table has messages the webhook stored (inbound) and flow engine stored
    // (outbound). Dedup on platform_message_id so messages that appear in both
    // don't render twice.
    //
    // IMPORTANT: The flow engine stores outbound DMs WITHOUT platform_message_id
    // (it's NULL), while Zernio returns the same message with its own ID. So
    // deduping on ID alone would show every DM twice. We additionally dedup on
    // (direction, normalized_text, ±60s time window) to catch these.
    const { data: localMessages } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const seenIds = new Set<string>();
    // Track outbound messages by content+time for content-based dedup
    const outboundSignatures: Array<{ text: string; time: number }> = [];
    const merged: Array<Record<string, unknown>> = [];

    const normalize = (s: string | null): string =>
      (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

    for (const m of zernioMapped) {
      const key = (m.platform_message_id || m.id) as string | null;
      if (key && !seenIds.has(key)) {
        seenIds.add(key);
        merged.push(m as unknown as Record<string, unknown>);
        // Record outbound signatures for content-based dedup
        if (m.direction === "outbound" && m.text) {
          outboundSignatures.push({
            text: normalize(m.text as string),
            time: new Date(m.created_at as string).getTime(),
          });
        }
      }
    }

    if (localMessages) {
      for (const m of localMessages) {
        // First try ID-based dedup
        const key = m.platform_message_id || m.id;
        if (key && seenIds.has(key)) continue;

        // For outbound messages without platform_message_id, try content-based dedup.
        // If a Zernio message has the same text within ±60 seconds, it's the same DM.
        if (m.direction === "outbound" && !m.platform_message_id && m.text) {
          const normText = normalize(m.text);
          const localTime = new Date(m.created_at).getTime();
          const isDupe = outboundSignatures.some(
            (sig) =>
              sig.text === normText &&
              Math.abs(sig.time - localTime) < 60_000, // 60-second window
          );
          if (isDupe) continue; // Skip — Zernio already has this message
        }

        if (key) {
          seenIds.add(key);
        }
        merged.push(m as unknown as Record<string, unknown>);
      }
    }

    // Sort merged messages by created_at for consistent chronological display
    merged.sort((a, b) => {
      const aTime = new Date(a.created_at as string).getTime();
      const bTime = new Date(b.created_at as string).getTime();
      return aTime - bTime;
    });

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Failed to fetch messages from Zernio API:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/messages
 *
 * Sends a message via Zernio API. No local message storage — Zernio is the source of truth.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { conversationId, text } = body;

  if (!conversationId || !text) {
    return NextResponse.json(
      { error: "conversationId and text required" },
      { status: 400 }
    );
  }

  // Get conversation with channel info
  const { data: conversation } = await supabase
    .from("conversations")
    .select("*, channels(*)")
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (!conversation.late_conversation_id) {
    return NextResponse.json(
      { error: "No Zernio conversation ID linked to this conversation" },
      { status: 400 }
    );
  }

  const channel = conversation.channels as { late_account_id: string } | null;
  if (!channel?.late_account_id) {
    return NextResponse.json({ error: "Channel not found or missing Zernio account ID" }, { status: 404 });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("late_api_key_encrypted")
    .eq("id", conversation.workspace_id)
    .single();

  if (!workspace?.late_api_key_encrypted) {
    return NextResponse.json({ error: "API key not configured" }, { status: 400 });
  }

  // Send via Zernio SDK — Zernio stores the message, no local insert needed
  try {
    const zernio = createZernioClient(workspace.late_api_key_encrypted);
    const res = await zernio.messages.sendInboxMessage({
      path: { conversationId: conversation.late_conversation_id },
      body: { accountId: channel.late_account_id, message: text },
    });

    const messageId = (res.data as any)?.data?.messageId ?? null;

    // Update conversation's last message info (ZernFlow-specific metadata)
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: messagePreview(text),
      })
      .eq("id", conversationId);

    // Return a message-shaped response for the UI's optimistic update
    return NextResponse.json(
      {
        id: messageId ?? `sent-${Date.now()}`,
        conversation_id: conversationId,
        direction: "outbound",
        text,
        attachments: null,
        quick_reply_payload: null,
        postback_payload: null,
        callback_data: null,
        platform_message_id: messageId,
        sent_by_flow_id: null,
        sent_by_node_id: null,
        sent_by_user_id: user.id,
        status: "sent",
        created_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to send message via Zernio API:", error);
    return NextResponse.json(
      { error: `Failed to send message: ${error}` },
      { status: 500 }
    );
  }
}
