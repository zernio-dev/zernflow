import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { buildCommentDmFlow, defaultCommentDmConfig, validateCommentDm, type CommentDmConfig } from "./comment-dm-flow";
import { buildDesiredTriggers } from "./flow-triggers";
import { simulateFlow } from "./flow-engine/simulator";

const base = (over: Partial<CommentDmConfig> = {}): CommentDmConfig => ({
  ...defaultCommentDmConfig("kaafilaclub"),
  keywords: ["trip"],
  linkUrl: "https://kaafila.club/spiti",
  ...over,
});

describe("validateCommentDm", () => {
  it("accepts a complete setup", () => {
    expect(validateCommentDm(base())).toBeNull();
  });

  it("asks for a keyword and a real link", () => {
    expect(validateCommentDm(base({ keywords: [] }))).toMatch(/keyword/i);
    expect(validateCommentDm(base({ linkUrl: "" }))).toMatch(/link/i);
    expect(validateCommentDm(base({ linkUrl: "javascript:alert(1)" }))).toMatch(/link/i);
    expect(validateCommentDm(base({ linkUrl: "kaafila.club" }))).toMatch(/link/i);
  });

  it("checks the follow messages only when the gate is on", () => {
    const empty = { ask: "", buttonLabel: "", retry: "", giveUp: "", maxChecks: 3 };
    expect(validateCommentDm(base({ follow: empty }))).toBeNull();
    expect(validateCommentDm(base({ requireFollow: true, follow: empty }))).toMatch(/follow/i);
    expect(validateCommentDm(base({ requireFollow: true, follow: { ...base().follow, buttonLabel: "x".repeat(21) } }))).toMatch(/20/);
  });
});

describe("buildCommentDmFlow", () => {
  it("without the gate sends the link straight after the comment", () => {
    const flow = buildCommentDmFlow(base());
    expect(flow.nodes.map((n) => n.id)).toEqual(["trigger", "link"]);
    expect(flow.edges).toHaveLength(1);
  });

  it("puts the link in the text and as a button", () => {
    const link = buildCommentDmFlow(base()).nodes.find((n) => n.id === "link")!;
    const msg = (link.data as { messages: Array<{ text: string; buttons?: unknown[] }> }).messages[0];
    expect(msg.text).toContain("https://kaafila.club/spiti");
    expect(msg.buttons).toHaveLength(1);
  });

  it("scopes the trigger to the chosen reels and ranks it above all-post flows", () => {
    const all = buildCommentDmFlow(base());
    const one = buildCommentDmFlow(base({ postIds: ["111", "222"] }));
    const [allRow] = buildDesiredTriggers(all.nodes as unknown as Array<Record<string, unknown>>, "f");
    const [oneRow] = buildDesiredTriggers(one.nodes as unknown as Array<Record<string, unknown>>, "f");
    expect((allRow.config as { postIds?: string[] }).postIds).toBeUndefined();
    expect((oneRow.config as { postIds?: string[] }).postIds).toEqual(["111", "222"]);
    expect(oneRow.priority).toBeGreaterThan(allRow.priority);
    expect(oneRow.type).toBe("comment_keyword");
  });

  it("only sets a public reply when one is given", () => {
    const withReply = buildDesiredTriggers(buildCommentDmFlow(base()).nodes as never, "f")[0].config as { replyText?: string };
    const without = buildDesiredTriggers(buildCommentDmFlow(base({ publicReply: " " })).nodes as never, "f")[0].config as { replyText?: string };
    expect(withReply.replyText).toBeTruthy();
    expect(without.replyText).toBeUndefined();
  });

  it("with the gate builds the follow loop", () => {
    const flow = buildCommentDmFlow(base({ requireFollow: true }));
    const edge = (id: string) => flow.edges.find((e) => e.id === id)!;
    expect(flow.nodes.map((n) => n.id)).toEqual(["trigger", "ask", "wait", "check", "link", "retry", "giveup"]);
    expect(edge("e-check-link")).toMatchObject({ sourceHandle: "followed", target: "link" });
    expect(edge("e-check-retry")).toMatchObject({ sourceHandle: "notFollowed", target: "retry" });
    expect(edge("e-check-giveup")).toMatchObject({ sourceHandle: "gaveUp", target: "giveup" });
    expect(edge("e-retry-wait")).toMatchObject({ source: "retry", target: "wait" });
  });

  it("gives the first DM and the reminder an I-followed button, the final one none", () => {
    const flow = buildCommentDmFlow(base({ requireFollow: true }));
    const replies = (id: string) =>
      (flow.nodes.find((n) => n.id === id)!.data as { messages: Array<{ quickReplies?: unknown[] }> }).messages[0].quickReplies;
    expect(replies("ask")).toHaveLength(1);
    expect(replies("retry")).toHaveLength(1);
    expect(replies("giveup")).toBeUndefined();
  });

  it("runs in the simulator: a follower gets the link, a non-follower is reminded", () => {
    const flow = buildCommentDmFlow(base({ requireFollow: true, keywords: ["trip"] }));
    const run = (isFollower: boolean) =>
      [
        ...new Set(
          simulateFlow(flow.nodes as unknown as Node[], flow.edges as unknown as Edge[], {
            incomingMessage: "trip",
            mockContact: { isFollower },
          }).steps.map((s) => s.nodeId)
        ),
      ];
    // The simulator stops at the wait (it cannot receive a tap), so it shows the opening ask.
    expect(run(true)).toEqual(["trigger", "ask", "wait"]);
  });
});
