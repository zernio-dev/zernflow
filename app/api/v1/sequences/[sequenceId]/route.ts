import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/workspace";
import type { Database, Json, SequenceStep } from "@/lib/types/database";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  const { sequenceId } = await params;
  const { workspace, supabase } = await getWorkspace();
  const body = await request.json();

  const { data: existing } = await supabase
    .from("sequences")
    .select("id")
    .eq("id", sequenceId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!existing) return NextResponse.json({ error: "Séquence introuvable" }, { status: 404 });

  const update: Database["public"]["Tables"]["sequences"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if (body.name !== undefined) update.name = String(body.name);
  if (body.description !== undefined) update.description = body.description || null;
  if (body.status !== undefined) update.status = body.status;
  if (body.steps !== undefined) {
    update.steps = JSON.parse(JSON.stringify(body.steps as SequenceStep[])) as Json;
  }

  const { data: sequence, error } = await supabase
    .from("sequences")
    .update(update)
    .eq("id", sequenceId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, sequence });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  const { sequenceId } = await params;
  const { workspace, supabase } = await getWorkspace();

  const { error } = await supabase
    .from("sequences")
    .delete()
    .eq("id", sequenceId)
    .eq("workspace_id", workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
