import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scheduleBroadcastDelivery } from "@/lib/scheduler";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/types/database";

interface SegmentRule {
  field: string;
  operator: string;
  value: string;
}

interface SegmentGroup {
  combinator: "and" | "or";
  rules: SegmentRule[];
}

interface SegmentFilter {
  combinator: "and" | "or";
  groups: SegmentGroup[];
}

/**
 * POST /api/v1/broadcasts/:broadcastId/send
 *
 * Resolves the broadcast's segment filter into contacts,
 * creates broadcast_recipients, and schedules delivery jobs.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ broadcastId: string }> }
) {
  const { broadcastId } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Aucun espace de travail" }, { status: 404 });
  }

  // Fetch the broadcast
  const { data: broadcast, error: broadcastErr } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("id", broadcastId)
    .eq("workspace_id", membership.workspace_id)
    .single();

  if (broadcastErr || !broadcast) {
    return NextResponse.json({ error: "Diffusion introuvable" }, { status: 404 });
  }

  if (broadcast.status !== "draft" && broadcast.status !== "scheduled") {
    return NextResponse.json(
      { error: `Cannot send broadcast with status "${broadcast.status}"` },
      { status: 400 }
    );
  }

  // Allow overriding message content from the request body
  let messageContent = broadcast.message_content as { text?: string };
  try {
    const body = await request.json();
    if (body.messageContent) {
      messageContent = body.messageContent;
      // Update the broadcast with the message content
      await supabase
        .from("broadcasts")
        .update({ message_content: messageContent as unknown as Json })
        .eq("id", broadcastId);
    }
  } catch {
    // No body or invalid JSON, use existing message_content
  }

  if (!messageContent?.text?.trim()) {
    return NextResponse.json(
      { error: "Le contenu du message est requis. Définissez message_content.text sur la diffusion." },
      { status: 400 }
    );
  }

  // Resolve contacts from segment filter
  const filter = broadcast.segment_filter as unknown as SegmentFilter | null;
  const contactIds = await resolveContacts(
    supabase,
    membership.workspace_id,
    filter
  );

  if (contactIds.length === 0) {
    return NextResponse.json(
      { error: "Aucun contact ne correspond au filtre de segment" },
      { status: 400 }
    );
  }

  // For each contact, find their first active channel link (via contact_channels)
  const { data: contactChannels } = await supabase
    .from("contact_channels")
    .select("contact_id, channel_id")
    .in("contact_id", contactIds);

  if (!contactChannels?.length) {
    return NextResponse.json(
      { error: "Aucun contact n'a de connexion de canal active" },
      { status: 400 }
    );
  }

  // Deduplicate: one recipient per contact (first channel found)
  const seen = new Set<string>();
  const recipientPairs: { contactId: string; channelId: string }[] = [];
  for (const cc of contactChannels) {
    if (!seen.has(cc.contact_id)) {
      seen.add(cc.contact_id);
      recipientPairs.push({
        contactId: cc.contact_id,
        channelId: cc.channel_id,
      });
    }
  }

  // Create broadcast_recipients
  const recipientRows = recipientPairs.map((r) => ({
    broadcast_id: broadcastId,
    contact_id: r.contactId,
    channel_id: r.channelId,
    status: "pending",
  }));

  // Insert in batches of 500
  const recipientIds: string[] = [];
  for (let i = 0; i < recipientRows.length; i += 500) {
    const batch = recipientRows.slice(i, i + 500);
    const { data: inserted, error: insertErr } = await supabase
      .from("broadcast_recipients")
      .insert(batch)
      .select("id");

    if (insertErr) {
      console.error("Failed to insert broadcast recipients:", insertErr);
      return NextResponse.json(
        { error: `Impossible de créer les destinataires : ${insertErr.message}` },
        { status: 500 }
      );
    }

    if (inserted) {
      recipientIds.push(...inserted.map((r) => r.id));
    }
  }

  if (recipientIds.length === 0) {
    return NextResponse.json(
      { error: "Impossible de créer les destinataires de la diffusion" },
      { status: 500 }
    );
  }

  // Schedule delivery
  await scheduleBroadcastDelivery(supabase, broadcastId, recipientIds);

  return NextResponse.json({
    broadcastId,
    totalRecipients: recipientIds.length,
    status: "sending",
  });
}

/**
 * Resolve segment filter into contact IDs.
 * If no filter, returns all subscribed contacts in the workspace.
 */
async function resolveContacts(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  filter: SegmentFilter | null
): Promise<string[]> {
  // No filter = all subscribed contacts
  if (!filter || !filter.groups?.length) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("is_subscribed", true)
      .limit(10000);
    return (data ?? []).map((c) => c.id);
  }

  // Start with all subscribed contacts
  const { data: allContacts } = await supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("is_subscribed", true)
    .limit(10000);

  if (!allContacts?.length) return [];

  const allIds = new Set(allContacts.map((c) => c.id));

  // Evaluate each group
  const groupResults: Set<string>[] = [];

  for (const group of filter.groups) {
    const ruleResults: Set<string>[] = [];

    for (const rule of group.rules) {
      const ids = await evaluateRule(supabase, workspaceId, rule, allIds);
      ruleResults.push(ids);
    }

    // Combine rules within group
    let groupIds: Set<string>;
    if (group.combinator === "and") {
      groupIds = intersectSets(ruleResults);
    } else {
      groupIds = unionSets(ruleResults);
    }
    groupResults.push(groupIds);
  }

  // Combine groups
  let finalIds: Set<string>;
  if (filter.combinator === "and") {
    finalIds = intersectSets(groupResults);
  } else {
    finalIds = unionSets(groupResults);
  }

  return Array.from(finalIds);
}

async function evaluateRule(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  rule: SegmentRule,
  allContactIds: Set<string>
): Promise<Set<string>> {
  const contactIds = Array.from(allContactIds);

  switch (rule.field) {
    case "has_tag": {
      // The SegmentBuilder stores tag ID as the value — look up by ID first, then fall back to name
      let tagId = rule.value;

      // Check if the value looks like a UUID; if not, look up by name
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rule.value);
      if (!isUuid) {
        const { data: tagByName } = await supabase
          .from("tags")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("name", rule.value)
          .single();
        if (!tagByName) return new Set();
        tagId = tagByName.id;
      }

      const { data: tagged } = await supabase
        .from("contact_tags")
        .select("contact_id")
        .eq("tag_id", tagId)
        .in("contact_id", contactIds);

      return new Set((tagged ?? []).map((t) => t.contact_id));
    }

    case "missing_tag": {
      // Same logic: support both UUID and name
      let tagId = rule.value;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rule.value);
      if (!isUuid) {
        const { data: tagByName } = await supabase
          .from("tags")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("name", rule.value)
          .single();
        if (!tagByName) return new Set(contactIds); // Tag doesn't exist, all contacts "miss" it
        tagId = tagByName.id;
      }

      const { data: tagged } = await supabase
        .from("contact_tags")
        .select("contact_id")
        .eq("tag_id", tagId)
        .in("contact_id", contactIds);

      const taggedSet = new Set((tagged ?? []).map((t) => t.contact_id));
      return new Set(contactIds.filter((id) => !taggedSet.has(id)));
    }

    case "platform": {
      const { data: channels } = await supabase
        .from("channels")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("platform", rule.value as "facebook" | "instagram" | "twitter" | "telegram" | "bluesky" | "reddit");

      if (!channels?.length) {
        return rule.operator === "not_equals" ? new Set(contactIds) : new Set();
      }

      const channelIds = channels.map((c) => c.id);
      const { data: links } = await supabase
        .from("contact_channels")
        .select("contact_id")
        .in("channel_id", channelIds)
        .in("contact_id", contactIds);

      const linkedSet = new Set((links ?? []).map((l) => l.contact_id));
      if (rule.operator === "not_equals") {
        return new Set(contactIds.filter((id) => !linkedSet.has(id)));
      }
      return linkedSet;
    }

    case "is_subscribed": {
      // Already filtered to subscribed, but handle explicit false
      if (rule.value === "false") {
        return new Set(); // We only target subscribed contacts
      }
      return new Set(contactIds);
    }

    case "last_interaction": {
      const date = new Date(rule.value).toISOString();
      let query = supabase
        .from("contacts")
        .select("id")
        .eq("workspace_id", workspaceId)
        .in("id", contactIds);

      if (rule.operator === "before") {
        query = query.lt("last_interaction_at", date);
      } else {
        query = query.gt("last_interaction_at", date);
      }

      const { data } = await query;
      return new Set((data ?? []).map((c) => c.id));
    }

    case "custom_field": {
      // rule.value format: "field_slug::actual_value" (double colon separator from SegmentBuilder)
      const [slug, ...rest] = rule.value.split("::");
      const fieldValue = rest.join("::");

      const { data: fieldDef } = await supabase
        .from("custom_field_definitions")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("slug", slug)
        .single();

      if (!fieldDef) return new Set();

      let cfQuery = supabase
        .from("contact_custom_fields")
        .select("contact_id")
        .eq("field_id", fieldDef.id)
        .in("contact_id", contactIds);

      switch (rule.operator) {
        case "equals":
          cfQuery = cfQuery.eq("value", fieldValue);
          break;
        case "not_equals":
          cfQuery = cfQuery.neq("value", fieldValue);
          break;
        case "contains":
          cfQuery = cfQuery.ilike("value", `%${fieldValue}%`);
          break;
        case "gt":
          cfQuery = cfQuery.gt("value", fieldValue);
          break;
        case "lt":
          cfQuery = cfQuery.lt("value", fieldValue);
          break;
      }

      const { data } = await cfQuery;
      return new Set((data ?? []).map((c) => c.contact_id));
    }

    default:
      return new Set(contactIds);
  }
}

function intersectSets(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set();
  const result = new Set(sets[0]);
  for (let i = 1; i < sets.length; i++) {
    for (const item of result) {
      if (!sets[i].has(item)) result.delete(item);
    }
  }
  return result;
}

function unionSets(sets: Set<string>[]): Set<string> {
  const result = new Set<string>();
  for (const s of sets) {
    for (const item of s) {
      result.add(item);
    }
  }
  return result;
}
