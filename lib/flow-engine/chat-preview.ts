/**
 * An interactive dry run of a flow, shown as a chat. Unlike the Test panel's step list, this
 * pauses where the real flow pauses (a Smart Delay waits for a tap), so the person building the
 * flow can tap the buttons themselves and switch "they follow us" on and off.
 * Nothing here talks to Instagram.
 */

import { decideFollowBranch, followCheckVariable } from "./follow-branch";
import { handleMatches } from "./branch-handle";
import { normalizeFlowNodes } from "./normalize-nodes";

export interface PreviewNode {
  id: string;
  type?: string;
  data?: unknown;
}
export interface PreviewEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export type PreviewItem =
  | { kind: "comment"; text: string }
  | { kind: "public_reply"; text: string }
  | { kind: "us"; nodeId: string; text: string; links: string[]; quickReplies: string[] }
  | { kind: "them"; text: string }
  | { kind: "note"; tone: "good" | "warn" | "bad" | "info"; text: string };

export interface PreviewState {
  items: PreviewItem[];
  /** The node the flow is paused on, waiting for the person to tap. */
  waitingNodeId: string | null;
  ended: boolean;
  /** Follow-check misses per node, like the session variables of a real run. */
  misses: Record<string, number>;
}

const MAX_STEPS = 60;

type MessageData = {
  messages?: Array<{
    text?: string;
    quickReplies?: Array<{ title: string }>;
    buttons?: Array<{ title: string; type?: string }>;
  }>;
  keywords?: Array<string | { value: string; matchType?: string }>;
  replyText?: string;
  maxChecks?: number;
  actionType?: string;
};

function keywordList(data: MessageData): Array<{ value: string; matchType: string }> {
  return (data.keywords ?? [])
    .map((k) => (typeof k === "string" ? { value: k, matchType: "contains" } : { value: k?.value ?? "", matchType: k?.matchType ?? "contains" }))
    .filter((k) => k.value);
}

function matchesComment(data: MessageData, comment: string): boolean {
  const text = comment.toLowerCase().trim();
  if (!text) return false;
  return keywordList(data).some((k) => {
    const word = k.value.toLowerCase();
    if (k.matchType === "exact") return text === word;
    if (k.matchType === "startsWith") return text.startsWith(word);
    return text.includes(word);
  });
}

function nextNodeId(edges: PreviewEdge[], from: string, handle?: string): string | null {
  const edge =
    (handle ? edges.find((e) => e.source === from && handleMatches(e.sourceHandle, handle)) : undefined) ??
    (handle ? undefined : edges.find((e) => e.source === from));
  return edge?.target ?? null;
}

function run(
  nodes: PreviewNode[],
  edges: PreviewEdge[],
  startAt: string | null,
  state: PreviewState,
  isFollower: boolean
): PreviewState {
  const items = [...state.items];
  const misses = { ...state.misses };
  let current = startAt;
  let steps = 0;

  while (current && steps++ < MAX_STEPS) {
    const node = nodes.find((n) => n.id === current);
    if (!node) break;
    const data = (node.data ?? {}) as MessageData;

    switch (node.type) {
      case "sendMessage": {
        for (const m of data.messages ?? []) {
          items.push({
            kind: "us",
            nodeId: node.id,
            text: m.text ?? "",
            links: (m.buttons ?? []).map((b) => b.title),
            quickReplies: (m.quickReplies ?? []).map((q) => q.title),
          });
        }
        current = nextNodeId(edges, node.id);
        break;
      }
      case "smartDelay":
        return { items, waitingNodeId: node.id, ended: false, misses };
      case "followCheck": {
        const counter = followCheckVariable(node.id);
        const { branch, misses: n } = decideFollowBranch(isFollower, misses[counter] ?? 0, Number(data.maxChecks ?? 0));
        misses[counter] = n;
        items.push(
          branch === "followed"
            ? { kind: "note", tone: "good", text: "Instagram says they follow you" }
            : branch === "notFollowed"
              ? { kind: "note", tone: "warn", text: `Not following yet (check ${n})` }
              : { kind: "note", tone: "bad", text: `Still not following after ${n} checks, so the flow stops asking` }
        );
        current = nextNodeId(edges, node.id, branch);
        break;
      }
      default:
        // Tags, delays, HTTP and other nodes do not change what the person sees.
        current = nextNodeId(edges, node.id);
    }
  }
  return { items, waitingNodeId: null, ended: true, misses };
}

export function startPreview(rawNodes: PreviewNode[], edges: PreviewEdge[], comment: string, isFollower: boolean): PreviewState {
  const nodes = normalizeFlowNodes(rawNodes);
  const base: PreviewState = { items: [], waitingNodeId: null, ended: false, misses: {} };
  const trigger = nodes.find((n) => n.type === "trigger");
  if (!trigger) return { ...base, ended: true, items: [{ kind: "note", tone: "bad", text: "This flow has no trigger yet" }] };

  const data = (trigger.data ?? {}) as MessageData;
  const items: PreviewItem[] = [{ kind: "comment", text: comment }];
  if (!matchesComment(data, comment)) {
    items.push({
      kind: "note",
      tone: "info",
      text: keywordList(data).length ? "That comment has none of your keywords, so nothing is sent" : "Add a keyword to see the flow run",
    });
    return { ...base, items, ended: true };
  }
  if (data.replyText?.trim()) items.push({ kind: "public_reply", text: data.replyText.trim() });
  return run(nodes, edges, nextNodeId(edges, trigger.id), { ...base, items }, isFollower);
}

/** The person taps a quick reply while the flow is waiting. `isFollower` is the switch's value at that moment. */
export function tapPreview(
  rawNodes: PreviewNode[],
  edges: PreviewEdge[],
  state: PreviewState,
  label: string,
  isFollower: boolean
): PreviewState {
  if (!state.waitingNodeId) return state;
  const nodes = normalizeFlowNodes(rawNodes);
  const items: PreviewItem[] = [...state.items, { kind: "them", text: label }];
  return run(nodes, edges, nextNodeId(edges, state.waitingNodeId), { ...state, items, waitingNodeId: null }, isFollower);
}
