import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/workspace";

export async function POST(request: NextRequest) {
  const { workspace, user, supabase } = await getWorkspace();
  const body = await request.json();
  const workspaceId = String(body.workspaceId || "");
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "member");

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
      { error: "Only workspace owners can invite members" },
      { status: 403 }
    );
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Une adresse email valide est requise" },
      { status: 400 }
    );
  }

  if (!["member", "admin"].includes(role)) {
    return NextResponse.json(
      { error: "Rôle invalide. Il doit être membre ou admin." },
      { status: 400 }
    );
  }

  const { data: existingInvite } = await supabase
    .from("workspace_invites")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("email", email)
    .eq("status", "pending")
    .single();

  if (existingInvite) {
    return NextResponse.json(
      { error: "An invite for this email is already pending" },
      { status: 409 }
    );
  }

  const { data: invite, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      email,
      role,
      invited_by: user.id,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, invite });
}
