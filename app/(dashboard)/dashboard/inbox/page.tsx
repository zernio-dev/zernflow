import { getWorkspace } from "@/lib/workspace";
import { InboxView } from "./inbox-view";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { workspace, supabase } = await getWorkspace();
  const { c: openId } = await searchParams;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*, contacts(*, contact_channels(platform_username))")
    .eq("workspace_id", workspace.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  // ?c=<id> opens one conversation (links from Comment to DM activity). Fetch it when it is
  // older than the 50 loaded.
  let list = conversations ?? [];
  if (openId && !list.some((c) => c.id === openId)) {
    const { data: extra } = await supabase
      .from("conversations")
      .select("*, contacts(*, contact_channels(platform_username))")
      .eq("workspace_id", workspace.id)
      .eq("id", openId)
      .maybeSingle();
    if (extra) list = [extra, ...list];
  }

  return (
    <InboxView
      conversations={list}
      workspaceId={workspace.id}
      initialSelectedId={openId ?? null}
    />
  );
}
