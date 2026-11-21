import { getWorkspace } from "@/lib/workspace";
import { CommentDmWizard } from "./comment-dm-wizard";

export default async function CommentDmPage() {
  const { workspace, supabase } = await getWorkspace();

  const { data: channel } = await supabase
    .from("channels")
    .select("username")
    .eq("workspace_id", workspace.id)
    .eq("platform", "instagram")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return <CommentDmWizard accountHandle={channel?.username ?? ""} hasInstagram={!!channel} />;
}
