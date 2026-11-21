/**
 * Which way a Follow Check node sends the contact.
 *
 * Instagram only says "yes" or "unknown" about a follower (a person who has not messaged us
 * recently comes back as unknown, never as "no"), so anything that is not a confirmed follow
 * counts as a miss. After `maxChecks` misses the flow stops asking and takes the third exit,
 * so nobody is stuck in a loop.
 */
export type FollowBranch = "followed" | "notFollowed" | "gaveUp";

export const DEFAULT_MAX_FOLLOW_CHECKS = 3;
export const MAX_FOLLOW_CHECKS_LIMIT = 10;

export function clampMaxChecks(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_FOLLOW_CHECKS;
  return Math.min(n, MAX_FOLLOW_CHECKS_LIMIT);
}

export function followCheckVariable(nodeId: string): string {
  return `follow_checks_${nodeId}`;
}

export function decideFollowBranch(
  isFollower: boolean | null | undefined,
  missesSoFar: number,
  maxChecks: number
): { branch: FollowBranch; misses: number } {
  if (isFollower === true) return { branch: "followed", misses: missesSoFar };
  const misses = missesSoFar + 1;
  return { branch: misses >= clampMaxChecks(maxChecks) ? "gaveUp" : "notFollowed", misses };
}
