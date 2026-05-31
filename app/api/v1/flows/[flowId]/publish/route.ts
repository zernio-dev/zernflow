import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const { flowId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership)
    return NextResponse.json({ error: "Aucun espace de travail" }, { status: 404 });

  // Get current flow
  const { data: flow, error } = await supabase
    .from("flows")
    .select("*")
    .eq("id", flowId)
    .eq("workspace_id", membership.workspace_id)
    .single();

  if (error || !flow)
    return NextResponse.json(
      { error: error?.message || "Flux introuvable" },
      { status: 404 }
    );

  // Update flow status to published and increment version
  const newVersion = flow.version + 1;
  await supabase
    .from("flows")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      version: newVersion,
    })
    .eq("id", flowId);

  // Save version snapshot
  await supabase.from("flow_versions").insert({
    flow_id: flowId,
    version: newVersion,
    nodes: flow.nodes,
    edges: flow.edges,
    viewport: flow.viewport,
    name: flow.name,
    published_by: user.id,
  });

  // Activate all triggers for this flow
  await supabase
    .from("triggers")
    .update({ is_active: true })
    .eq("flow_id", flowId);

  return NextResponse.json({ ...flow, version: newVersion });
}
