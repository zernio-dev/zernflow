import { getWorkspace } from "@/lib/workspace";
import { TeamView } from "@/components/settings/team-view";
import { createServiceClient } from "@/lib/supabase/server";

export default async function TeamPage() {
  const { workspace, user, role, supabase } = await getWorkspace();

  // Fetch workspace members with user details
  // We need service client to read auth.users for email/name
  const serviceClient = await createServiceClient();

  // Use service client to bypass RLS (workspace_members SELECT policy only returns own rows)
  const { data: members } = await serviceClient
    .from("workspace_members")
    .select("workspace_id, user_id, role, created_at")
    .eq("workspace_id", workspace.id);

  // Fetch user details for each member via service client (auth.users is not accessible via RLS)
  const memberDetails = await Promise.all(
    (members ?? []).map(async (member) => {
      const {
        data: { user: memberUser },
      } = await serviceClient.auth.admin.getUserById(member.user_id);

      return {
        userId: member.user_id,
        role: member.role,
        joinedAt: member.created_at,
        email: memberUser?.email ?? "Inconnu",
        name:
          memberUser?.user_metadata?.full_name ??
          memberUser?.user_metadata?.name ??
          memberUser?.email?.split("@")[0] ??
          "Inconnu",
      };
    })
  );

  // Fetch pending invites
  const { data: pendingInvites } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <TeamView
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      currentUserId={user.id}
      currentUserRole={role}
      members={memberDetails}
      pendingInvites={pendingInvites ?? []}
    />
  );
}
