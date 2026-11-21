import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";
import { toPickerPosts } from "@/lib/instagram-posts";

/**
 * GET /api/v1/posts
 *
 * The workspace's recent Instagram posts and reels (newest first), for the reel picker that scopes a
 * comment trigger to specific posts. Read live from Zernio; nothing is stored.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!membership) return NextResponse.json({ error: "No workspace" }, { status: 404 });

  const [{ data: workspace }, { data: channels }] = await Promise.all([
    supabase.from("workspaces").select("late_api_key_encrypted").eq("id", membership.workspace_id).single(),
    supabase
      .from("channels")
      .select("late_account_id, username")
      .eq("workspace_id", membership.workspace_id)
      .eq("platform", "instagram")
      .eq("is_active", true),
  ]);

  if (!workspace?.late_api_key_encrypted) {
    return NextResponse.json({ error: "Add your Zernio API key in Settings first." }, { status: 400 });
  }
  if (!channels?.length) {
    return NextResponse.json({ error: "Connect an Instagram account in Channels first." }, { status: 400 });
  }

  try {
    const zernio = createZernioClient(workspace.late_api_key_encrypted);
    const pages = await Promise.all(
      channels.map((c) =>
        zernio.comments.listInboxComments({
          query: { accountId: c.late_account_id, platform: "instagram", limit: 30, sortBy: "date", sortOrder: "desc" },
        })
      )
    );
    const posts = toPickerPosts(
      pages.flatMap(
        (page: { data?: { data?: unknown[] } }) => (page.data?.data ?? []) as Parameters<typeof toPickerPosts>[0]
      )
    );
    return NextResponse.json(posts);
  } catch (error) {
    console.error("Failed to list Instagram posts:", error);
    return NextResponse.json({ error: "Could not load your posts from Zernio." }, { status: 502 });
  }
}
