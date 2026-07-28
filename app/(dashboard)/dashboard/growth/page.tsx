import { getWorkspace } from "@/lib/workspace";
import { GrowthView } from "./growth-view";

export default async function GrowthPage() {
  const { workspace, supabase } = await getWorkspace();

  const thirtyDaysAgo = new Date(
    new Date().getTime() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Run ALL queries in parallel - no waterfalls
  const [
    { data: channels },
    { data: allTriggers },
    { data: flows },
    { count: totalComments },
    { count: matchedComments },
    { count: dmsSent },
    { data: recentLogs },
  ] = await Promise.all([
    supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    // Fetch all comment_keyword triggers for this workspace's flows in one query
    supabase
      .from("triggers")
      .select("*, flows!inner(id, name, status, workspace_id)")
      .eq("type", "comment_keyword")
      .eq("flows.workspace_id", workspace.id),
    supabase
      .from("flows")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .eq("status", "published")
      .order("name", { ascending: true }),
    supabase
      .from("comment_logs")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("comment_logs")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .not("matched_trigger_id", "is", null)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("comment_logs")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("dm_sent", true)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("comment_logs")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <GrowthView
      workspaceId={workspace.id}
      channels={channels ?? []}
      triggers={allTriggers ?? []}
      flows={flows ?? []}
      stats={{
        totalComments: totalComments ?? 0,
        matchedComments: matchedComments ?? 0,
        dmsSent: dmsSent ?? 0,
      }}
      recentLogs={recentLogs ?? []}
    />
  );
}
