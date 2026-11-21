/**
 * Builds a complete comment-to-DM flow from a short form, so nobody wires nodes by hand.
 *
 * Instagram lets us send exactly one DM in answer to a comment (a "private reply"), and nothing
 * more until the person writes back. So anything beyond one text needs a button tap first:
 *
 *   Text only, no follow gate:   Trigger -> reward text
 *   Attachment, no follow gate:  Trigger -> opener with a button -> wait for the tap -> reward
 *   Follow gate:                 Trigger -> ask to follow (button) -> wait -> Follow Check
 *                                  Following -> reward
 *                                  Not yet   -> reminder (button) -> wait again (the loop)
 *                                  Gave up   -> last message
 *
 * The form itself is stored on the trigger node (`automation`), so the Comment to DM page can
 * reopen and edit it. The result is still an ordinary flow.
 */

import { DEFAULT_MAX_FOLLOW_CHECKS, clampMaxChecks } from "@/lib/flow-engine/follow-branch";

export type RewardMediaType = "image" | "video" | "audio";

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
  /** The reward text. Optional when there is an attachment. */
  message: string;
  /** Optional link, added under the text as a button. */
  linkUrl: string;
  linkLabel: string;
  /** Optional file sent with the reward. */
  attachment: { url: string; type: RewardMediaType; name: string } | null;
  /** Without a follow gate, the first DM when the reward needs a tap (it has an attachment). */
  opener: { text: string; buttonLabel: string };
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
    message: "Here you go! 🎉",
    linkUrl: "",
    linkLabel: "Open the link",
    attachment: null,
    opener: { text: "Thanks for your comment! Tap below and I'll send it to you. 👇", buttonLabel: "Send it to me" },
    requireFollow: false,
    follow: {
      ask: `Hey! To get it, please follow ${at} first, then tap the button below. 👇`,
      buttonLabel: "I followed ✅",
      retry: `Hmm, I can't see the follow yet. Follow ${at}, then tap the button again. 🙏`,
      giveUp: `No worries! Follow ${at} and comment again whenever you're ready, and I'll send it.`,
      maxChecks: DEFAULT_MAX_FOLLOW_CHECKS,
    },
  };
}

/** Old saved configs (from before attachments) miss some keys; fill them from the defaults. */
export function withDefaults(saved: Partial<CommentDmConfig>, accountHandle = ""): CommentDmConfig {
  const base = defaultCommentDmConfig(accountHandle);
  return {
    ...base,
    ...saved,
    opener: { ...base.opener, ...(saved.opener ?? {}) },
    follow: { ...base.follow, ...(saved.follow ?? {}) },
    attachment: saved.attachment ?? null,
  };
}

const BUTTON_MAX = 20;

export function validateCommentDm(c: CommentDmConfig): string | null {
  if (!c.name.trim()) return "Give it a name.";
  if (c.keywords.length === 0) return "Add at least one keyword people will comment.";
  if (!c.message.trim() && !c.attachment) return "Add a message, a file, or both, for people to receive.";
  if (c.linkUrl.trim()) {
    try {
      const url = new URL(c.linkUrl.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("scheme");
    } catch {
      return "The link must start with https://";
    }
  }
  const tapNeeded = c.requireFollow || !!c.attachment;
  if (tapNeeded && !c.requireFollow) {
    if (!c.opener.text.trim()) return "Write the first message (it carries the button).";
    if (!c.opener.buttonLabel.trim()) return "Name the button.";
    if (c.opener.buttonLabel.trim().length > BUTTON_MAX) return `The button name can be at most ${BUTTON_MAX} characters.`;
  }
  if (c.requireFollow) {
    if (!c.follow.ask.trim()) return "Write the message that asks them to follow.";
    if (!c.follow.buttonLabel.trim()) return "Name the button they tap after following.";
    if (c.follow.buttonLabel.trim().length > BUTTON_MAX) return `The button name can be at most ${BUTTON_MAX} characters.`;
    if (!c.follow.retry.trim()) return "Write the reminder for people who have not followed yet.";
    if (!c.follow.giveUp.trim()) return "Write the last message for people who still have not followed.";
  }
  return null;
}

type Pos = { x: number; y: number };
const node = (id: string, type: string, position: Pos, data: Record<string, unknown>) => ({ id, type, position, data });

function rewardMessages(c: CommentDmConfig) {
  const text = [c.message.trim(), c.linkUrl.trim()].filter(Boolean).join("\n");
  const button = c.linkUrl.trim() && c.linkLabel.trim()
    ? [{ title: c.linkLabel.trim().slice(0, BUTTON_MAX), type: "url" as const, url: c.linkUrl.trim() }]
    : undefined;
  const messages: Array<Record<string, unknown>> = [];
  if (text) messages.push({ text, ...(button ? { buttons: button } : {}) });
  if (c.attachment) messages.push({ mediaUrl: c.attachment.url, mediaType: c.attachment.type });
  return messages;
}

export function buildCommentDmFlow(c: CommentDmConfig) {
  const keywords = c.keywords.map((k) => k.trim()).filter(Boolean);
  const scoped = c.postIds.length > 0;
  const reply = c.publicReply.trim();

  const trigger = node("trigger", "trigger", { x: 250, y: 0 }, {
    label: "Comment",
    triggerType: "comment_keyword",
    keywords: keywords.map((value) => ({ value, matchType: "contains" })),
    ...(scoped ? { postIds: c.postIds } : {}),
    ...(reply ? { replyText: reply } : {}),
    // A reel-specific flow beats an "all posts" one when both match the same comment.
    config: { priority: scoped ? 10 : 0 },
    automation: c,
  });

  const reward = (position: Pos) => node("link", "sendMessage", position, { label: "What they get", messages: rewardMessages(c) });
  const withButton = (id: string, label: string, text: string, button: string, position: Pos) =>
    node(id, "sendMessage", position, {
      label,
      messages: [{ text, quickReplies: [{ title: button.trim().slice(0, BUTTON_MAX), payload: id }] }],
    });
  const wait = node("wait", "action", { x: 250, y: 330 }, { actionType: "smartDelay", label: "Wait for the tap", timeout: 24, timeoutUnit: "hours" });

  const meta = {
    name: c.name.trim(),
    description: scoped
      ? `Comment to DM for ${c.postIds.length} selected ${c.postIds.length === 1 ? "post" : "posts"}`
      : "Comment to DM for every post",
  };

  if (c.requireFollow) {
    return {
      ...meta,
      nodes: [
        trigger,
        withButton("ask", "Ask to follow", c.follow.ask.trim(), c.follow.buttonLabel, { x: 250, y: 150 }),
        wait,
        node("check", "followCheck", { x: 250, y: 470 }, { label: "Do they follow us?", maxChecks: clampMaxChecks(c.follow.maxChecks) }),
        reward({ x: -30, y: 660 }),
        withButton("retry", "Remind to follow", c.follow.retry.trim(), c.follow.buttonLabel, { x: 250, y: 660 }),
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
        { id: "e-retry-wait", source: "retry", target: "wait", label: "waits for the next tap" },
      ],
    };
  }

  if (c.attachment) {
    return {
      ...meta,
      nodes: [trigger, withButton("ask", "Opener", c.opener.text.trim(), c.opener.buttonLabel, { x: 250, y: 150 }), wait, reward({ x: 250, y: 470 })],
      edges: [
        { id: "e-trigger-ask", source: "trigger", target: "ask" },
        { id: "e-ask-wait", source: "ask", target: "wait" },
        { id: "e-wait-link", source: "wait", target: "link" },
      ],
    };
  }

  return {
    ...meta,
    nodes: [trigger, reward({ x: 250, y: 150 })],
    edges: [{ id: "e-trigger-link", source: "trigger", target: "link" }],
  };
}

/** The saved form of a flow made by this builder, or null for any other flow. */
export function readCommentDmConfig(nodes: unknown, accountHandle = ""): CommentDmConfig | null {
  if (!Array.isArray(nodes)) return null;
  const trigger = nodes.find((n) => (n as { type?: string })?.type === "trigger") as { data?: { automation?: Partial<CommentDmConfig> } } | undefined;
  return trigger?.data?.automation ? withDefaults(trigger.data.automation, accountHandle) : null;
}
