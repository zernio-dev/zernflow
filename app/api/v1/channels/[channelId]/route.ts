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
 * DELETE /api/v1/channels/[channelId]
 *
 * Permanently deletes a channel: disconnects the account on Zernio first
 * (otherwise /api/v1/channels/sync would re-create it from listAccounts),
 * then deletes the local row (cascades conversations, contact links, etc.).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase);
  if (!workspace)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: channel } = await supabase
    .from("channels")
    .select("id, late_account_id")
    .eq("id", channelId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!channel)
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  if (workspace.late_api_key_encrypted) {
    const zernio = createZernioClient(workspace.late_api_key_encrypted);
    try {
      const res = await zernio.accounts.deleteAccount({
        path: { accountId: channel.late_account_id },
      });
      // A 404 means the account is already gone from Zernio; that's fine.
      if (res.error && res.response?.status !== 404) {
        return NextResponse.json(
          { error: `Failed to disconnect on Zernio: ${JSON.stringify(res.error)}` },
          { status: 502 }
        );
      }
    } catch (error) {
      console.error("Failed to disconnect Zernio account:", error);
      return NextResponse.json(
        { error: `Failed to disconnect on Zernio: ${error instanceof Error ? error.message : String(error)}` },
        { status: 502 }
      );
    }
  }

  const { error } = await supabase
    .from("channels")
    .delete()
    .eq("id", channelId)
    .eq("workspace_id", workspace.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
