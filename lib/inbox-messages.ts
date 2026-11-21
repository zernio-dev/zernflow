/**
 * Maps one message from the Zernio inbox API to the row shape the inbox UI renders.
 *
 * Zernio labels direction "incoming" / "outgoing". The UI used to test for "outbound", so every
 * message, ours included, was drawn as the contact's.
 */

export interface InboxAttachment {
  type: string;
  url: string | null;
  previewUrl: string | null;
  filename: string | null;
}

interface ZernioMessage {
  id?: string;
  message?: string | null;
  text?: string | null;
  direction?: string;
  createdAt?: string;
  sentAt?: string;
  platformMessageId?: string | null;
  deliveryStatus?: string | null;
  noRenderableContent?: boolean | null;
  attachments?: Array<{
    type?: string;
    url?: string | null;
    previewUrl?: string | null;
    filename?: string | null;
  }> | null;
}

export function isOutbound(direction: string | undefined): boolean {
  return direction === "outgoing" || direction === "outbound";
}

function messageStatus(deliveryStatus: string | null | undefined): "sent" | "delivered" | "failed" {
  const s = (deliveryStatus ?? "").toLowerCase();
  if (s.includes("fail")) return "failed";
  if (s === "delivered" || s === "read") return "delivered";
  return "sent";
}

export function mapZernioMessage(m: ZernioMessage, conversationId: string) {
  const attachments: InboxAttachment[] = (m.attachments ?? []).map((a) => ({
    type: a.type ?? "file",
    url: a.url ?? null,
    previewUrl: a.previewUrl ?? null,
    filename: a.filename ?? null,
  }));

  return {
    id: m.id ?? `zernio-${m.createdAt ?? m.sentAt ?? Math.random()}`,
    conversation_id: conversationId,
    direction: isOutbound(m.direction) ? ("outbound" as const) : ("inbound" as const),
    text: m.message ?? m.text ?? null,
    attachments: attachments.length ? attachments : null,
    quick_reply_payload: null,
    postback_payload: null,
    callback_data: null,
    platform_message_id: m.platformMessageId ?? null,
    sent_by_flow_id: null,
    sent_by_node_id: null,
    sent_by_user_id: null,
    status: messageStatus(m.deliveryStatus),
    created_at: m.sentAt ?? m.createdAt ?? new Date().toISOString(),
    // Instagram sends some content (shared reels, stickers) the API cannot render.
    unsupported: m.noRenderableContent === true && !m.message && !m.text && attachments.length === 0,
  };
}
