import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toActivity } from "@/lib/comment-activity";

/**
 * GET /api/v1/automations/{flowId}/activity
 *
 * The latest 50 comments that ran this comment automation, each with the inbox conversation
 * to open (when the commenter already has one).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ flowId: string }> }) {
  const { flowId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS limits both reads to the user's workspaces; the flow lookup also proves access.
  const { data: flow } = await supabase.from("flows").select("id").eq("id", flowId).maybeSingle();
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: logs, error } = await supabase
    .from("comment_logs")
    .select("id, channel_id, author_id, author_name, author_username, comment_text, dm_sent, reply_sent, error, created_at")
    .eq("flow_id", flowId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!logs?.length) return NextResponse.json([]);

  const authorIds = [...new Set(logs.map((l) => l.author_id).filter((v): v is string => !!v))];
  const channelIds = [...new Set(logs.map((l) => l.channel_id))];

  const { data: links } = authorIds.length
    ? await supabase
        .from("contact_channels")
        .select("channel_id, platform_sender_id, contact_id")
        .in("channel_id", channelIds)
        .in("platform_sender_id", authorIds)
    : { data: [] };

  const contactIds = [...new Set((links ?? []).map((l) => l.contact_id))];
  const { data: conversations } = contactIds.length
    ? await supabase
        .from("conversations")
        .select("id, channel_id, contact_id")
        .in("channel_id", channelIds)
        .in("contact_id", contactIds)
    : { data: [] };

  return NextResponse.json(toActivity(logs, links ?? [], conversations ?? []));
}
