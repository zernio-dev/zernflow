import { getWorkspace } from "@/lib/workspace";
import { readCommentDmConfig } from "@/lib/comment-dm-flow";
import { CommentsView, type Automation } from "./comments-view";

export default async function CommentsPage() {
  const { workspace, supabase } = await getWorkspace();

  const [{ data: channel }, { data: flows }] = await Promise.all([
    supabase
      .from("channels")
      .select("username")
      .eq("workspace_id", workspace.id)
      .eq("platform", "instagram")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("flows")
      .select("id, status, nodes, updated_at")
      .eq("workspace_id", workspace.id)
      .neq("status", "archived")
      .order("updated_at", { ascending: false }),
  ]);

  const handle = channel?.username ?? "";
  const automations = (flows ?? []).flatMap((f) => {
    const config = readCommentDmConfig(f.nodes, handle);
    return config ? [{ id: f.id, live: f.status === "published", updatedAt: f.updated_at, config }] : [];
  });

  // Per-automation counts. shortcut: reads the latest 5000 log rows; move to a SQL count when it grows.
  const ids = automations.map((a) => a.id);
  const { data: logs } = ids.length
    ? await supabase
        .from("comment_logs")
        .select("flow_id, dm_sent, created_at")
        .in("flow_id", ids)
        .order("created_at", { ascending: false })
        .limit(5000)
    : { data: [] };

  const stats = new Map<string, { comments: number; dms: number; lastAt: string | null }>();
  for (const l of logs ?? []) {
    if (!l.flow_id) continue;
    const s = stats.get(l.flow_id) ?? { comments: 0, dms: 0, lastAt: l.created_at };
    s.comments++;
    if (l.dm_sent) s.dms++;
    stats.set(l.flow_id, s);
  }

  const withStats: Automation[] = automations.map((a) => ({
    ...a,
    stats: stats.get(a.id) ?? { comments: 0, dms: 0, lastAt: null },
  }));

  return <CommentsView automations={withStats} accountHandle={handle} hasInstagram={!!channel} />;
}
