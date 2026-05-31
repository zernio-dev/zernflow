import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return NextResponse.json({ error: "Aucun espace de travail" }, { status: 404 });

  const { data: broadcasts, error } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("workspace_id", membership.workspace_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(broadcasts);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return NextResponse.json({ error: "Aucun espace de travail" }, { status: 404 });

  const body = await request.json();

  const { data: broadcast, error } = await supabase
    .from("broadcasts")
    .insert({
      workspace_id: membership.workspace_id,
      name: body.name || "Untitled Broadcast",
      message_content: body.messageContent || {},
      segment_filter: body.segmentFilter || null,
      scheduled_for: body.scheduledFor || null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(broadcast, { status: 201 });
}
