import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/workspace";

export async function POST(request: NextRequest) {
  const { workspace, supabase } = await getWorkspace();
  const body = await request.json();
  const name = String(body.name || "").trim();

  if (!name) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

  const { data: sequence, error } = await supabase
    .from("sequences")
    .insert({ workspace_id: workspace.id, name })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, sequence }, { status: 201 });
}
