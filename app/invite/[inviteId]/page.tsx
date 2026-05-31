import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AcceptInviteView } from "./accept-invite-view";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ inviteId: string }>;
}) {
  const { inviteId } = await params;
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  // Fetch the invite using service client (public page, user may not be logged in)
  const { data: invite, error } = await serviceClient
    .from("workspace_invites")
    .select("*")
    .eq("id", inviteId)
    .single();

  if (error || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold">Invitation introuvable</h1>
          <p className="text-sm text-muted-foreground">
            Ce lien d'invitation est peut-être invalide ou a été révoqué.
          </p>
          <a
            href="/login"
            className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Aller à la connexion
          </a>
        </div>
      </div>
    );
  }

  const isExpired = new Date(invite.expires_at) < new Date();
  const isAlreadyAccepted = invite.status !== "pending";

  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold">Invitation expirée</h1>
          <p className="text-sm text-muted-foreground">
            Cette invitation a expiré. Demandez au propriétaire de l'espace de
            travail d'en envoyer une nouvelle.
          </p>
          <a
            href="/login"
            className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Aller à la connexion
          </a>
        </div>
      </div>
    );
  }

  if (isAlreadyAccepted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-bold">Invitation déjà utilisée</h1>
          <p className="text-sm text-muted-foreground">
            Cette invitation a déjà été acceptée.
          </p>
          <a
            href="/dashboard"
            className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Aller au tableau de bord
          </a>
        </div>
      </div>
    );
  }

  // Get workspace name
  const { data: workspace } = await serviceClient
    .from("workspaces")
    .select("name")
    .eq("id", invite.workspace_id)
    .single();

  // Get inviter name
  const {
    data: { user: inviter },
  } = await serviceClient.auth.admin.getUserById(invite.invited_by);

  const inviterName =
    inviter?.user_metadata?.full_name ??
    inviter?.user_metadata?.name ??
    inviter?.email ??
    "Quelqu'un";

  // Check if current user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AcceptInviteView
      inviteId={invite.id}
      workspaceName={workspace?.name ?? "un espace de travail"}
      inviterName={inviterName}
      role={invite.role}
      email={invite.email}
      isLoggedIn={!!user}
      currentUserEmail={user?.email ?? null}
    />
  );
}
