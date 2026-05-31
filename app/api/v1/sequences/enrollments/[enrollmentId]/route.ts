import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/workspace";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const { enrollmentId } = await params;
  const { workspace, supabase } = await getWorkspace();

  const { data: enrollment } = await supabase
    .from("sequence_enrollments")
    .select("id, sequence_id, sequences!inner(workspace_id)")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) {
    return NextResponse.json({ error: "Inscription introuvable" }, { status: 404 });
  }

  const sequence = enrollment.sequences as unknown as { workspace_id: string };
  if (sequence.workspace_id !== workspace.id) {
    return NextResponse.json({ error: "Inscription introuvable" }, { status: 404 });
  }

  const { error } = await supabase
    .from("sequence_enrollments")
    .update({ status: "cancelled" })
    .eq("id", enrollmentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
