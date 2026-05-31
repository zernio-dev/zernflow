import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ flowId: string; versionId: string }> }
) {
  const { flowId, versionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Verify user has access
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership)
    return NextResponse.json({ error: "Aucun espace de travail" }, { status: 404 });

  // Get the version
  const { data: version, error: vErr } = await supabase
    .from("flow_versions")
    .select("nodes, edges, viewport")
    .eq("id", versionId)
    .eq("flow_id", flowId)
    .single();

  if (vErr || !version)
    return NextResponse.json({ error: "Version introuvable" }, { status: 404 });

  // Restore: copy nodes/edges/viewport back, set status to draft
  const { error } = await supabase
    .from("flows")
    .update({
      nodes: version.nodes,
      edges: version.edges,
      viewport: version.viewport,
      status: "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", flowId)
    .eq("workspace_id", membership.workspace_id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
