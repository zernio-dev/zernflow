"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Users, Crown, Shield, User, Loader2 } from "lucide-react";
import Link from "next/link";

const roleIcons: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3.5 w-3.5" />,
  admin: <Shield className="h-3.5 w-3.5" />,
  member: <User className="h-3.5 w-3.5" />,
};

export function AcceptInviteView({
  inviteId,
  workspaceName,
  inviterName,
  role,
  email,
  isLoggedIn,
  currentUserEmail,
}: {
  inviteId: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  email: string;
  isLoggedIn: boolean;
  currentUserEmail: string | null;
}) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailMismatch =
    isLoggedIn && currentUserEmail && currentUserEmail !== email;

  async function handleAccept() {
    if (accepting) return;
    setAccepting(true);
    setError(null);

    const res = await fetch(`/api/v1/team/invites/${inviteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    const result = await res.json();

    if (!res.ok || result.error) {
      setError(result.error);
      setAccepting(false);
      return;
    }

    // Redirect to dashboard
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Image
            src="/logo.png"
            alt="ZernFlow"
            width={48}
            height={48}
            className="mx-auto mb-3"
          />
          <h1 className="text-2xl font-bold">Vous êtes invité !</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {inviterName} vous invite à rejoindre
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mt-3 text-lg font-semibold">{workspaceName}</h2>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">
              {roleIcons[role] ?? roleIcons.member}
              {role === "owner" ? "propriétaire" : role === "admin" ? "admin" : "membre"}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Invitation envoyée à {email}
          </p>
        </div>

        {isLoggedIn && !emailMismatch && (
          <div className="space-y-3">
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {accepting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Acceptation...
                </>
              ) : (
                "Accepter l'invitation"
              )}
            </button>

            {error && (
              <p className="text-center text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        {isLoggedIn && emailMismatch && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-sm text-amber-800">
              Vous êtes connecté avec{" "}
              <span className="font-medium">{currentUserEmail}</span>, mais cette
              invitation a été envoyée à{" "}
              <span className="font-medium">{email}</span>.
            </p>
            <p className="mt-1 text-xs text-amber-600">
              Connectez-vous avec l'adresse email invitée pour accepter.
            </p>
            <Link
              href={`/login`}
              className="mt-3 inline-flex rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
            >
              Changer de compte
            </Link>
          </div>
        )}

        {!isLoggedIn && (
          <div className="space-y-3">
            <Link
              href={`/login?next=/invite/${inviteId}`}
              className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Se connecter pour accepter
            </Link>
            <p className="text-center text-sm text-muted-foreground">
              Vous n'avez pas de compte ?{" "}
              <Link
                href={`/register?next=/invite/${inviteId}`}
                className="font-medium text-foreground hover:underline"
              >
                Créer un compte
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
