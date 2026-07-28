import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";
import {
  ensureWebhookRegistered,
  getOrCreateWorkspaceWebhookSecret,
} from "@/lib/zernio-webhook";
import { backfillInboxConversations } from "@/lib/inbox-sync";

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
 * POST /api/v1/channels/sync
 *
 * Syncs all Zernio accounts as channels for the current workspace.
 * Creates new channels for accounts not yet in the DB.
 * Deactivates channels whose Zernio accounts no longer exist.
 */
export async function POST() {
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase);
  if (!workspace)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!workspace.late_api_key_encrypted) {
    return NextResponse.json(
      { error: "Zernio API key not configured. Go to Settings first." },
      { status: 400 }
    );
  }

  const zernio = createZernioClient(workspace.late_api_key_encrypted);

  try {
    const res = await zernio.accounts.listAccounts();
    const lateAccounts = res.data?.accounts ?? [];

    // Get existing channels for this workspace
    const { data: existingChannels } = await supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspace.id);

    const existingByZernioId = new Map(
      (existingChannels ?? []).map((c) => [c.late_account_id, c])
    );

    // The SDK type doesn't declare profilePicture but the API returns it
    const lateAccountIds = new Set(lateAccounts.map((a: { _id?: string }) => a._id).filter(Boolean));
    let created = 0;
    let updated = 0;

    for (const account of lateAccounts) {
      if (!account._id) continue;
      const acc = account as typeof account & { profilePicture?: string };
      const profilePic = acc.profilePicture || null;

      const existing = existingByZernioId.get(account._id);

      if (existing) {
        if (
          existing.username !== (account.username || null) ||
          existing.display_name !== (account.displayName || account.username || null) ||
          existing.profile_picture !== profilePic
        ) {
          await supabase
            .from("channels")
            .update({
              username: account.username || null,
              display_name: account.displayName || account.username || null,
              profile_picture: profilePic,
            })
            .eq("id", existing.id);
          updated++;
        }
      } else {
        await supabase.from("channels").insert({
          workspace_id: workspace.id,
          platform: account.platform as "facebook" | "instagram" | "twitter" | "telegram" | "bluesky" | "reddit",
          late_account_id: account._id,
          username: account.username || null,
          display_name: account.displayName || account.username || null,
          profile_picture: profilePic,
          is_active: true,
        });
        created++;
      }
    }

    // Deactivate channels whose Zernio accounts no longer exist
    let deactivated = 0;
    for (const channel of existingChannels ?? []) {
      if (!lateAccountIds.has(channel.late_account_id) && channel.is_active) {
        await supabase
          .from("channels")
          .update({ is_active: false })
          .eq("id", channel.id);
        deactivated++;
      }
    }

    // Re-register the webhook so inbound events reach the Inbox. Both the
    // Channels "Sync" button and the OAuth callback land here, and until now
    // registration only happened in the Settings test-key flow (#12).
    // Best-effort: a failure must not block the channel sync.
    try {
      const secret = await getOrCreateWorkspaceWebhookSecret(supabase, workspace.id);
      await ensureWebhookRegistered(zernio, {
        appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        secret,
        events: ["message.received", "comment.received"],
      });
    } catch (err) {
      console.error("[channels/sync] webhook auto-registration failed:", err);
    }

    // Backfill conversations that predate webhook registration (best-effort).
    let conversationsImported = 0;
    try {
      const { data: activeChannels } = await supabase
        .from("channels")
        .select("id, late_account_id, platform")
        .eq("workspace_id", workspace.id)
        .eq("is_active", true);

      const { imported } = await backfillInboxConversations({
        supabase,
        zernio,
        workspaceId: workspace.id,
        channels: activeChannels ?? [],
      });
      conversationsImported = imported;
    } catch (err) {
      console.error("[channels/sync] inbox backfill failed:", err);
    }

    // Return updated channel list
    const { data: channels } = await supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      channels: channels ?? [],
      synced: { created, updated, deactivated, conversationsImported },
    });
  } catch (error) {
    console.error("Failed to sync channels:", error);
    return NextResponse.json(
      { error: `Failed to sync channels: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
