/** One comment that hit an automation, with the inbox conversation to jump to when there is one. */
export interface ActivityItem {
  id: string;
  who: string;
  comment: string;
  dmSent: boolean;
  repliedPublicly: boolean;
  error: string | null;
  at: string;
  conversationId: string | null;
}

interface LogRow {
  id: string;
  channel_id: string;
  author_id: string | null;
  author_name: string | null;
  author_username: string | null;
  comment_text: string;
  dm_sent: boolean;
  reply_sent: boolean;
  error: string | null;
  created_at: string;
}
interface LinkRow {
  channel_id: string;
  platform_sender_id: string;
  contact_id: string;
}
interface ConversationRow {
  id: string;
  channel_id: string;
  contact_id: string;
}

/** Joins comment logs to conversations: commenter id -> contact (per channel) -> conversation. */
export function toActivity(logs: LogRow[], links: LinkRow[], conversations: ConversationRow[]): ActivityItem[] {
  const contactOf = new Map(links.map((l) => [`${l.channel_id}:${l.platform_sender_id}`, l.contact_id]));
  const conversationOf = new Map(conversations.map((c) => [`${c.channel_id}:${c.contact_id}`, c.id]));

  return logs.map((log) => {
    const contactId = log.author_id ? contactOf.get(`${log.channel_id}:${log.author_id}`) : undefined;
    return {
      id: log.id,
      who: log.author_username ? `@${log.author_username}` : log.author_name || "Someone",
      comment: log.comment_text,
      dmSent: log.dm_sent,
      repliedPublicly: log.reply_sent,
      error: log.error,
      at: log.created_at,
      conversationId: contactId ? conversationOf.get(`${log.channel_id}:${contactId}`) ?? null : null,
    };
  });
}
