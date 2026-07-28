/**
 * Inbox backfill from Zernio.
 *
 * The local `conversations` table is otherwise populated only by inbound
 * webhooks, so conversations that predate webhook registration never appear
 * in the Inbox (#12). This module pages through Zernio's inbox conversations
 * per channel and imports the ones missing locally.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Zernio } from "./zernio-client";

/** Cap per channel: 4 pages x 50 conversations. */
const MAX_PAGES_PER_CHANNEL = 4;
const PAGE_SIZE = 50;

export interface BackfillChannel {
  id: string;
  late_account_id: string;
  platform: string;
}

/** Conversation item shape returned by Zernio's listInboxConversations. */
interface ZernioInboxConversation {
  id?: string;
  participantId?: string;
  participantName?: string;
  participantPicture?: string | null;
  lastMessage?: string;
  updatedTime?: string;
  status?: "active" | "archived";
  unreadCount?: number | null;
}

/**
 * Finds or creates the contact behind a platform sender: reuses the mapping in
 * `contact_channels` (channel_id, platform_sender_id); otherwise inserts the
 * contact, its channel mapping, and a `contact_created` analytics event.
 * Returns null when the contact insert fails; `existed` tells whether the
 * sender was already known on this channel.
 * With `stampExisting: false` an existing contact's last_interaction_at is
 * left untouched; the caller stamps it once the interaction is confirmed.
 */
export async function upsertContactForSender({
  supabase,
  channel,
  senderId,
  senderName,
  senderPicture,
  senderUsername,
  interactionAt,
  stampExisting = true,
}: {
  supabase: SupabaseClient;
  channel: { id: string; workspace_id: string };
  senderId: string;
  senderName: string;
  senderPicture: string | null;
  senderUsername?: string | null;
  interactionAt: string;
  stampExisting?: boolean;
}): Promise<{ contactId: string; existed: boolean } | null> {
  const { data: existingContactChannel } = await supabase
    .from("contact_channels")
    .select("contact_id")
    .eq("channel_id", channel.id)
    .eq("platform_sender_id", senderId)
    .single();

  if (existingContactChannel) {
    if (stampExisting) {
      await supabase
        .from("contacts")
        .update({ last_interaction_at: interactionAt })
        .eq("id", existingContactChannel.contact_id);
    }
    return { contactId: existingContactChannel.contact_id, existed: true };
  }

  const { data: newContact } = await supabase
    .from("contacts")
    .insert({
      workspace_id: channel.workspace_id,
      display_name: senderName,
      avatar_url: senderPicture,
      last_interaction_at: interactionAt,
    })
    .select("id")
    .single();

  if (!newContact) return null;

  await supabase.from("contact_channels").insert({
    contact_id: newContact.id,
    channel_id: channel.id,
    platform_sender_id: senderId,
    platform_username: senderUsername ?? null,
  });

  await supabase.from("analytics_events").insert({
    workspace_id: channel.workspace_id,
    contact_id: newContact.id,
    event_type: "contact_created",
  });

  return { contactId: newContact.id, existed: false };
}

/**
 * Imports Zernio inbox conversations missing from the local `conversations`
 * table. Insert-only: conversations already known (by late_conversation_id)
 * are skipped, and a contact whose (channel_id, contact_id) row already exists
 * under a different late_conversation_id is left to the webhook, so the
 * webhook-maintained late_conversation_id / status / last_message_at /
 * unread_count are never clobbered. A failing channel is logged and skipped,
 * not fatal.
 */
export async function backfillInboxConversations({
  supabase,
  zernio,
  workspaceId,
  channels,
}: {
  supabase: SupabaseClient;
  zernio: Zernio;
  workspaceId: string;
  channels: BackfillChannel[];
}): Promise<{ imported: number }> {
  let imported = 0;

  for (const channel of channels) {
    try {
      imported += await backfillChannel({ supabase, zernio, workspaceId, channel });
    } catch (err) {
      console.error(
        `[inbox-sync] backfill failed for channel ${channel.id} (${channel.platform}):`,
        err
      );
    }
  }

  return { imported };
}

async function backfillChannel({
  supabase,
  zernio,
  workspaceId,
  channel,
}: {
  supabase: SupabaseClient;
  zernio: Zernio;
  workspaceId: string;
  channel: BackfillChannel;
}): Promise<number> {
  const { data: existingRows } = await supabase
    .from("conversations")
    .select("late_conversation_id")
    .eq("channel_id", channel.id);

  const known = new Set(
    (existingRows ?? [])
      .map((r: { late_conversation_id: string | null }) => r.late_conversation_id)
      .filter(Boolean)
  );

  let imported = 0;
  let cursor: string | undefined;
  const seenParticipants = new Set<string>();

  for (let page = 0; page < MAX_PAGES_PER_CHANNEL; page++) {
    const res = await zernio.messages.listInboxConversations({
      query: {
        accountId: channel.late_account_id,
        limit: PAGE_SIZE,
        sortOrder: "desc",
        cursor,
      },
    });

    const conversations = (res.data?.data ?? []) as ZernioInboxConversation[];

    for (const conv of conversations) {
      if (!conv.id || !conv.participantId) continue;
      // A participant can have several Zernio conversations but the local
      // table is unique on (channel_id, contact_id). sortOrder desc means the
      // first conversation seen per participant is the most recent one; later
      // ones are dropped so they cannot overwrite it.
      if (seenParticipants.has(conv.participantId)) continue;
      seenParticipants.add(conv.participantId);
      if (known.has(conv.id)) continue;
      if (await importConversation({ supabase, workspaceId, channel, conv })) {
        imported++;
      }
    }

    const pagination = res.data?.pagination;
    if (!pagination?.hasMore || !pagination.nextCursor) break;
    cursor = pagination.nextCursor;
  }

  return imported;
}

async function importConversation({
  supabase,
  workspaceId,
  channel,
  conv,
}: {
  supabase: SupabaseClient;
  workspaceId: string;
  channel: BackfillChannel;
  conv: ZernioInboxConversation;
}): Promise<boolean> {
  const interactionAt = conv.updatedTime ?? new Date().toISOString();
  const contact = await upsertContactForSender({
    supabase,
    channel: { id: channel.id, workspace_id: workspaceId },
    senderId: conv.participantId!,
    senderName: conv.participantName || conv.participantId!,
    senderPicture: conv.participantPicture || null,
    interactionAt,
    stampExisting: false,
  });

  if (!contact) {
    console.error(`[inbox-sync] failed to create contact for conversation ${conv.id}`);
    return false;
  }

  // ignoreDuplicates: an existing (channel_id, contact_id) row is owned by the
  // webhook (possibly under a different late_conversation_id) and must stay
  // untouched; the conflict then returns no rows, so it is not counted as
  // imported either.
  const { data: insertedRows, error } = await supabase
    .from("conversations")
    .upsert(
      {
        workspace_id: workspaceId,
        channel_id: channel.id,
        contact_id: contact.contactId,
        platform: channel.platform,
        late_conversation_id: conv.id,
        status: conv.status === "archived" ? "closed" : "open",
        last_message_at: conv.updatedTime ?? null,
        last_message_preview: (conv.lastMessage ?? "").slice(0, 100),
        unread_count: conv.unreadCount ?? 0,
      },
      { onConflict: "channel_id,contact_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    console.error(`[inbox-sync] failed to upsert conversation ${conv.id}:`, error);
    return false;
  }

  const inserted = (insertedRows ?? []).length > 0;

  // Stamp the existing contact only after the conversation row was actually
  // inserted; a webhook-owned duplicate is not a new interaction.
  if (inserted && contact.existed) {
    await supabase
      .from("contacts")
      .update({ last_interaction_at: interactionAt })
      .eq("id", contact.contactId);
  }

  return inserted;
}
