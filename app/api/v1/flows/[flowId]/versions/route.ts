import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
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

  // Verify workspace membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Aucun espace de travail" }, { status: 404 });
  }

  // Verify the flow belongs to the user's workspace
  const { data: flow } = await supabase
    .from("flows")
    .select("id")
    .eq("id", flowId)
    .eq("workspace_id", membership.workspace_id)
    .single();

  if (!flow) {
    return NextResponse.json({ error: "Flux introuvable" }, { status: 404 });
  }

  const { data: versions, error } = await supabase
    .from("flow_versions")
    .select("id, version, name, published_by, created_at")
    .eq("flow_id", flowId)
    .order("version", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(versions || []);
}
