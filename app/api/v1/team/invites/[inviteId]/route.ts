import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const { inviteId } = await params;
  const body = await request.json().catch(() => ({}));

  if (body.action !== "accept") {
    return NextResponse.json({ error: "Action non prise en charge" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const serviceClient = await createServiceClient();
  const { data: invite, error: fetchError } = await serviceClient
    .from("workspace_invites")
    .select("*")
    .eq("id", inviteId)
    .single();

  if (fetchError || !invite) {
    return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
  }

  if (invite.status !== "pending") {
    return NextResponse.json({ error: "This invite is no longer valid" }, { status: 400 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
  }

  if (invite.email !== user.email) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  const { data: existingMembership } = await serviceClient
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", user.id)
    .single();

  if (!existingMembership) {
    const { error: insertError } = await serviceClient
      .from("workspace_members")
      .insert({
        workspace_id: invite.workspace_id,
        user_id: user.id,
        role: invite.role,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  await serviceClient
    .from("workspace_invites")
    .update({ status: "accepted" })
    .eq("id", inviteId);

  return NextResponse.json({
    ok: true,
    workspaceId: invite.workspace_id,
    alreadyMember: !!existingMembership,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const { inviteId } = await params;
  const { user, supabase } = await getWorkspace();

  const { data: invite, error: fetchError } = await supabase
    .from("workspace_invites")
    .select("workspace_id")
    .eq("id", inviteId)
    .single();

  if (fetchError || !invite) {
    return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return NextResponse.json(
      { error: "Only workspace owners can revoke invites" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
