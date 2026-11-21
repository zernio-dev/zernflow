import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { FlowExecutionContext, FollowCheckNodeData } from "../types";
import { createZernioClient } from "@/lib/zernio-client";
import { decideFollowBranch, followCheckVariable } from "../follow-branch";

/**
 * Asks Instagram (through Zernio) whether the contact follows our account.
 * Returns true/false when Instagram says so, or null when it cannot tell, which happens until the
 * person has messaged us recently (consent_required). Never throws: a failed lookup is "unknown".
 */
async function lookupIsFollower(
  supabase: SupabaseClient<Database>,
  context: FlowExecutionContext
): Promise<boolean | null> {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("late_api_key_encrypted")
    .eq("id", context.workspaceId)
    .single();
  if (!workspace?.late_api_key_encrypted) return null;

  let accountId = context.lateAccountId;
  if (!accountId) {
    const { data: channel } = await supabase
      .from("channels")
      .select("late_account_id")
      .eq("id", context.channelId)
      .single();
    accountId = channel?.late_account_id ?? undefined;
  }

  const { data: link } = await supabase
    .from("contact_channels")
    .select("platform_sender_id")
    .eq("contact_id", context.contactId)
    .eq("channel_id", context.channelId)
    .limit(1)
    .maybeSingle();

  if (!accountId || !link?.platform_sender_id) return null;

  try {
    const res = await createZernioClient(workspace.late_api_key_encrypted).accounts.getInstagramFollowStatus({
      path: { accountId, userId: link.platform_sender_id },
      // Bypass the cache: they may have followed seconds ago.
      query: { refresh: true },
    });
    return res.data?.isFollower ?? null;
  } catch (error) {
    console.error("Follow status lookup failed:", error);
    return null;
  }
}

export async function executeFollowCheck(
  supabase: SupabaseClient<Database>,
  data: FollowCheckNodeData,
  nodeId: string,
  context: FlowExecutionContext
): Promise<string> {
  const variables = (context.variables ??= {});

  // Following is an Instagram idea. Other platforms pass straight through so a shared flow still works.
  if (context.platform && context.platform !== "instagram") return "handle:followed";

  const counter = followCheckVariable(nodeId);
  const missesSoFar = Number(variables[counter] ?? 0) || 0;

  const isFollower = await lookupIsFollower(supabase, context);
  const { branch, misses } = decideFollowBranch(isFollower, missesSoFar, data.maxChecks ?? 0);

  variables[counter] = String(misses);
  variables.follow_status = isFollower === true ? "following" : isFollower === false ? "not_following" : "unknown";
  return `handle:${branch}`;
}
