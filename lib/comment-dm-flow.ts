/**
 * Builds a complete comment-to-DM flow from a short form, so nobody has to wire nodes by hand.
 * Without a follow gate:   Trigger -> DM with the link.
 * With a follow gate:      Trigger -> ask to follow (with an "I followed" button) -> wait for the tap
 *                          -> Follow Check -> Following: DM with the link
 *                                          -> Not yet:   remind -> wait again (the loop)
 *                                          -> Gave up:   last message
 * The result is an ordinary flow, so it can still be edited in the builder.
 */

import { DEFAULT_MAX_FOLLOW_CHECKS, clampMaxChecks } from "@/lib/flow-engine/follow-branch";

export interface CommentDmConfig {
  name: string;
  /** Words that start the flow. At least one. */
  keywords: string[];
  /** Instagram post / reel ids. Empty = every post. */
  postIds: string[];
  /** Optional public reply under the comment. */
  publicReply: string;
  /** Our handle, without @, used in the follow messages. */
  accountHandle: string;
  /** The DM that carries the link. */
  message: string;
  linkUrl: string;
  linkLabel: string;
  requireFollow: boolean;
  follow: {
    ask: string;
    buttonLabel: string;
    retry: string;
    giveUp: string;
    maxChecks: number;
  };
}

export function defaultCommentDmConfig(accountHandle = ""): CommentDmConfig {
  const at = accountHandle ? `@${accountHandle}` : "us";
  return {
    name: "Comment to DM",
    keywords: [],
    postIds: [],
    publicReply: "Check your DMs 📩",
    accountHandle,
    message: "Here's the link you asked for:",
    linkUrl: "",
    linkLabel: "Open the link",
    requireFollow: false,
    follow: {
      ask: `Hey! To get the link, please follow ${at} first, then tap the button below. 👇`,
      buttonLabel: "I followed ✅",
      retry: `Hmm, I can't see the follow yet. Follow ${at}, then tap the button again. 🙏`,
      giveUp: `No worries! Follow ${at} and comment again whenever you're ready, and I'll send the link.`,
      maxChecks: DEFAULT_MAX_FOLLOW_CHECKS,
    },
  };
}

export function validateCommentDm(c: CommentDmConfig): string | null {
  if (!c.name.trim()) return "Give the flow a name.";
  if (c.keywords.length === 0) return "Add at least one keyword people will comment.";
  if (!c.message.trim()) return "Write the message that carries the link.";
  try {
    const url = new URL(c.linkUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("scheme");
  } catch {
    return "Add the link people should get (it must start with https://).";
  }
  if (c.requireFollow) {
    if (!c.follow.ask.trim()) return "Write the message that asks them to follow.";
    if (!c.follow.buttonLabel.trim()) return "Name the button they tap after following.";
    if (c.follow.buttonLabel.trim().length > 20) return "The button name can be at most 20 characters.";
    if (!c.follow.retry.trim()) return "Write the reminder for people who have not followed yet.";
    if (!c.follow.giveUp.trim()) return "Write the last message for people who still have not followed.";
  }
  return null;
}

type Pos = { x: number; y: number };
const node = (id: string, type: string, position: Pos, data: Record<string, unknown>) => ({ id, type, position, data });

export function buildCommentDmFlow(c: CommentDmConfig) {
  const keywords = c.keywords.map((k) => k.trim()).filter(Boolean);
  const scoped = c.postIds.length > 0;
  const reply = c.publicReply.trim();
  const linkText = `${c.message.trim()}\n${c.linkUrl.trim()}`;
  const linkButton = c.linkLabel.trim()
    ? [{ title: c.linkLabel.trim().slice(0, 20), type: "url" as const, url: c.linkUrl.trim() }]
    : undefined;

  const trigger = node("trigger", "trigger", { x: 250, y: 0 }, {
    label: "Comment",
    triggerType: "comment_keyword",
    keywords: keywords.map((value) => ({ value, matchType: "contains" })),
    ...(scoped ? { postIds: c.postIds } : {}),
    ...(reply ? { replyText: reply } : {}),
    // A reel-specific flow beats an "all posts" one when both match the same comment.
    config: { priority: scoped ? 10 : 0 },
  });

  const reward = (id: string, position: Pos) =>
    node(id, "sendMessage", position, {
      label: "Send the link",
      messages: [{ text: linkText, ...(linkButton ? { buttons: linkButton } : {}) }],
    });

  const meta = {
    name: c.name.trim(),
    description: scoped
      ? `Comment to DM for ${c.postIds.length} selected ${c.postIds.length === 1 ? "post" : "posts"}`
      : "Comment to DM for every post",
  };

  if (!c.requireFollow) {
    return {
      ...meta,
      nodes: [trigger, reward("link", { x: 250, y: 150 })],
      edges: [{ id: "e-trigger-link", source: "trigger", target: "link" }],
    };
  }

  const reminder = (id: string, label: string, text: string, position: Pos) =>
    node(id, "sendMessage", position, {
      label,
      messages: [{ text, quickReplies: [{ title: c.follow.buttonLabel.trim().slice(0, 20), payload: "followed" }] }],
    });

  return {
    ...meta,
    nodes: [
      trigger,
      reminder("ask", "Ask to follow", c.follow.ask.trim(), { x: 250, y: 150 }),
      node("wait", "action", { x: 250, y: 330 }, { actionType: "smartDelay", label: "Wait for the tap", timeout: 24, timeoutUnit: "hours" }),
      node("check", "followCheck", { x: 250, y: 470 }, { label: "Do they follow us?", maxChecks: clampMaxChecks(c.follow.maxChecks) }),
      reward("link", { x: -30, y: 660 }),
      reminder("retry", "Remind to follow", c.follow.retry.trim(), { x: 250, y: 660 }),
      node("giveup", "sendMessage", { x: 530, y: 660 }, { label: "Give up", messages: [{ text: c.follow.giveUp.trim() }] }),
    ],
    edges: [
      { id: "e-trigger-ask", source: "trigger", target: "ask" },
      { id: "e-ask-wait", source: "ask", target: "wait" },
      { id: "e-wait-check", source: "wait", target: "check" },
      { id: "e-check-link", source: "check", sourceHandle: "followed", target: "link" },
      { id: "e-check-retry", source: "check", sourceHandle: "notFollowed", target: "retry" },
      { id: "e-check-giveup", source: "check", sourceHandle: "gaveUp", target: "giveup" },
      // The loop: after the reminder, wait for the next tap and check again.
      { id: "e-retry-wait", source: "retry", target: "wait" },
    ],
  };
}
