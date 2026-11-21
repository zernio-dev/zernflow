import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";
import { messagePreview } from "@/lib/message-preview";
import { mapZernioMessage } from "@/lib/inbox-messages";
import { checkAttachment, type AttachmentKind } from "@/lib/inbox-upload";

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

    // Map Zernio messages to the shape the inbox UI expects
    const messages = zernioMessages.map((m) => mapZernioMessage(m as Parameters<typeof mapZernioMessage>[0], conversationId));

    return NextResponse.json(messages);
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

  // JSON for a plain text reply, multipart when a file is attached.
  let conversationId: string | undefined;
  let text: string | undefined;
  let file: File | null = null;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await request.formData();
    conversationId = form.get("conversationId")?.toString();
    text = form.get("text")?.toString() || undefined;
    const picked = form.get("file");
    file = picked instanceof File && picked.size > 0 ? picked : null;
  } else {
    ({ conversationId, text } = await request.json());
  }

  if (!conversationId || (!text && !file)) {
    return NextResponse.json(
      { error: "conversationId and text or a file required" },
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

  // Check the file before touching the network, so the user gets a plain reason.
  let attachment: { url: string; kind: AttachmentKind; name: string } | null = null;
  if (file) {
    const check = checkAttachment(file.type, file.size, conversation.platform);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    attachment = { url: "", kind: check.kind, name: file.name };
  }

  // Send via Zernio SDK — Zernio stores the message, no local insert needed
  try {
    const zernio = createZernioClient(workspace.late_api_key_encrypted);

    if (file && attachment) {
      // Zernio takes a public URL, so park the file in its media storage first.
      const presign = await zernio.media.getMediaPresignedUrl({
        body: {
          filename: file.name,
          contentType: file.type as never,
          size: file.size,
        },
      });
      const { uploadUrl, publicUrl } = (presign.data ?? {}) as { uploadUrl?: string; publicUrl?: string };
      if (!uploadUrl || !publicUrl) throw new Error("Zernio did not return an upload link");
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: Buffer.from(await file.arrayBuffer()),
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      attachment.url = publicUrl;
    }

    const res = await zernio.messages.sendInboxMessage({
      path: { conversationId: conversation.late_conversation_id },
      body: {
        accountId: channel.late_account_id,
        ...(text ? { message: text } : {}),
        ...(attachment
          ? { attachmentUrl: attachment.url, attachmentType: attachment.kind, attachmentName: attachment.name }
          : {}),
      },
    });

    const messageId = (res.data as any)?.data?.messageId ?? null;

    // Update conversation's last message info (ZernFlow-specific metadata)
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text ? messagePreview(text) : `[${attachment?.kind ?? "attachment"}]`,
      })
      .eq("id", conversationId);

    // Return a message-shaped response for the UI's optimistic update
    return NextResponse.json(
      {
        id: messageId ?? `sent-${Date.now()}`,
        conversation_id: conversationId,
        direction: "outbound",
        text: text ?? null,
        attachments: attachment
          ? [{ type: attachment.kind, url: attachment.url, previewUrl: null, filename: attachment.name }]
          : null,
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
