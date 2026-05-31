import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/workspace";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const { workspace, user, supabase } = await getWorkspace();
  const body = await request.json().catch(() => ({}));
  const workspaceId = String(body.workspaceId || workspace.id);

  if (workspace.id !== workspaceId) {
    return NextResponse.json({ error: "Workspace mismatch" }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return NextResponse.json(
      { error: "Only workspace owners can remove members" },
      { status: 403 }
    );
  }

  if (userId === user.id) {
    return NextResponse.json(
      { error: "You cannot remove yourself from the workspace" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
