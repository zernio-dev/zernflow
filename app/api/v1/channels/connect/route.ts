import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";

async function getWorkspace(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(*)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership?.workspaces) return null;
  return membership.workspaces;
}

/**
 * POST /api/v1/channels/connect
 *
 * Returns Zernio's OAuth/connect URL for the given platform.
 * Zernio handles the entire connection flow (OAuth, page selection, etc.)
 * and redirects back to our callback URL when done.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase);
  if (!workspace)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!workspace.late_api_key_encrypted) {
    return NextResponse.json(
      { error: "La clé API Zernio n'est pas configurée. Allez d'abord dans les paramètres." },
      { status: 400 }
    );
  }

  const { platform } = await request.json();

  const supported = ["facebook", "instagram", "twitter", "telegram", "bluesky", "reddit"];
  if (!platform || !supported.includes(platform)) {
    return NextResponse.json(
      { error: `Plateforme non prise en charge. Elle doit être l'une de celles-ci : ${supported.join(", ")}` },
      { status: 400 }
    );
  }

  const zernio = createZernioClient(workspace.late_api_key_encrypted);

  try {
    // Get profile ID (required by Zernio's connect endpoint)
    const profilesRes = await zernio.profiles.listProfiles();
    const profiles = profilesRes.data?.profiles ?? [];
    if (profiles.length === 0) {
      return NextResponse.json(
        { error: "Aucun profil Zernio trouvé. Créez-en d'abord un dans votre tableau de bord Zernio." },
        { status: 400 }
      );
    }

    const profileId = profiles[0]._id!;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl = `${appUrl}/dashboard/channels/callback`;

    // Zernio handles everything: OAuth, page selection, Bluesky credentials, Telegram code
    const res = await zernio.connect.getConnectUrl({
      path: { platform },
      query: { profileId, redirect_url: callbackUrl },
    });

    if (!res.data?.authUrl) {
      return NextResponse.json({ error: "Impossible d'obtenir l'URL de connexion" }, { status: 500 });
    }

    return NextResponse.json({ authUrl: res.data.authUrl });
  } catch (error) {
    console.error("Failed to get connect URL:", error);
    return NextResponse.json(
      { error: `Échec de la connexion : ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
