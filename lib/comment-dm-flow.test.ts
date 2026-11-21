import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  buildCommentDmFlow,
  defaultCommentDmConfig,
  readCommentDmConfig,
  validateCommentDm,
  withDefaults,
  type CommentDmConfig,
} from "./comment-dm-flow";
import { buildDesiredTriggers } from "./flow-triggers";
import { simulateFlow } from "./flow-engine/simulator";

const base = (over: Partial<CommentDmConfig> = {}): CommentDmConfig => ({
  ...defaultCommentDmConfig("kaafilaclub"),
  keywords: ["trip"],
  message: "Here's the itinerary",
  linkUrl: "https://kaafila.club/spiti",
  ...over,
});
const image = { url: "https://cdn.example/itinerary.jpg", type: "image" as const, name: "itinerary.jpg" };
const ids = (f: { nodes: Array<{ id: string }> }) => f.nodes.map((n) => n.id);
const messagesOf = (f: ReturnType<typeof buildCommentDmFlow>, id: string) =>
  (f.nodes.find((n) => n.id === id)!.data as { messages: Array<Record<string, unknown>> }).messages;

describe("validateCommentDm", () => {
  it("accepts a message alone, a file alone, or both", () => {
    expect(validateCommentDm(base())).toBeNull();
    expect(validateCommentDm(base({ message: "", linkUrl: "", attachment: image }))).toBeNull();
    expect(validateCommentDm(base({ attachment: image }))).toBeNull();
  });

  it("needs something to send and at least one keyword", () => {
    expect(validateCommentDm(base({ message: "", linkUrl: "" }))).toMatch(/message, a file/);
    expect(validateCommentDm(base({ keywords: [] }))).toMatch(/keyword/i);
  });

  it("makes the link optional but checks it when given", () => {
    expect(validateCommentDm(base({ linkUrl: "" }))).toBeNull();
    expect(validateCommentDm(base({ linkUrl: "javascript:alert(1)" }))).toMatch(/https/);
    expect(validateCommentDm(base({ linkUrl: "kaafila.club" }))).toMatch(/https/);
  });

  it("checks the follow messages only when the gate is on", () => {
    const empty = { ask: "", buttonLabel: "", retry: "", giveUp: "", maxChecks: 3 };
    expect(validateCommentDm(base({ follow: empty }))).toBeNull();
    expect(validateCommentDm(base({ requireFollow: true, follow: empty }))).toMatch(/follow/i);
    expect(validateCommentDm(base({ requireFollow: true, follow: { ...base().follow, buttonLabel: "x".repeat(21) } }))).toMatch(/20/);
  });

  it("checks the opener only when a file needs a tap and there is no follow gate", () => {
    expect(validateCommentDm(base({ opener: { text: "", buttonLabel: "" } }))).toBeNull();
    expect(validateCommentDm(base({ attachment: image, opener: { text: "", buttonLabel: "Go" } }))).toMatch(/first message/);
  });
});

describe("buildCommentDmFlow", () => {
  it("text only: the reward is the first DM", () => {
    const flow = buildCommentDmFlow(base());
    expect(ids(flow)).toEqual(["trigger", "link"]);
    const [msg] = messagesOf(flow, "link");
    expect(msg.text).toContain("https://kaafila.club/spiti");
    expect(msg.buttons).toHaveLength(1);
  });

  it("drops the link button when there is no link", () => {
    expect(messagesOf(buildCommentDmFlow(base({ linkUrl: "" })), "link")[0].buttons).toBeUndefined();
  });

  it("a file without a follow gate: opener with a button, wait, then the reward", () => {
    const flow = buildCommentDmFlow(base({ attachment: image }));
    expect(ids(flow)).toEqual(["trigger", "ask", "wait", "link"]);
    expect(messagesOf(flow, "ask")[0].quickReplies).toHaveLength(1);
    expect(messagesOf(flow, "link")).toEqual([
      expect.objectContaining({ text: expect.stringContaining("itinerary") }),
      { mediaUrl: image.url, mediaType: "image" },
    ]);
  });

  it("a file alone sends just the file", () => {
    expect(messagesOf(buildCommentDmFlow(base({ message: "", linkUrl: "", attachment: image })), "link")).toEqual([
      { mediaUrl: image.url, mediaType: "image" },
    ]);
  });

  it("scopes the trigger to the chosen reels and ranks it above all-post flows", () => {
    const [allRow] = buildDesiredTriggers(buildCommentDmFlow(base()).nodes as never, "f");
    const [oneRow] = buildDesiredTriggers(buildCommentDmFlow(base({ postIds: ["111"] })).nodes as never, "f");
    expect((allRow.config as { postIds?: string[] }).postIds).toBeUndefined();
    expect((oneRow.config as { postIds?: string[] }).postIds).toEqual(["111"]);
    expect(oneRow.priority).toBeGreaterThan(allRow.priority);
  });

  it("with the gate builds the follow loop", () => {
    const flow = buildCommentDmFlow(base({ requireFollow: true }));
    const edge = (id: string) => flow.edges.find((e) => e.id === id)!;
    expect(ids(flow)).toEqual(["trigger", "ask", "wait", "check", "link", "retry", "giveup"]);
    expect(edge("e-check-link")).toMatchObject({ sourceHandle: "followed", target: "link" });
    expect(edge("e-check-retry")).toMatchObject({ sourceHandle: "notFollowed", target: "retry" });
    expect(edge("e-retry-wait")).toMatchObject({ source: "retry", target: "wait" });
  });

  it("stores the form on the trigger so it can be edited again", () => {
    const config = base({ requireFollow: true, attachment: image });
    expect(readCommentDmConfig(buildCommentDmFlow(config).nodes)).toEqual(config);
    expect(readCommentDmConfig([{ type: "trigger", data: {} }])).toBeNull();
    expect(readCommentDmConfig("nope")).toBeNull();
  });

  it("fills keys an older saved form does not have", () => {
    const old = { name: "x", keywords: ["a"], message: "m" } as Partial<CommentDmConfig>;
    const filled = withDefaults(old, "kaafilaclub");
    expect(filled.attachment).toBeNull();
    expect(filled.opener.buttonLabel).toBeTruthy();
  });

  it("runs in the simulator up to the wait", () => {
    const flow = buildCommentDmFlow(base({ requireFollow: true }));
    const steps = simulateFlow(flow.nodes as unknown as Node[], flow.edges as unknown as Edge[], { incomingMessage: "trip", mockContact: { isFollower: true } }).steps;
    expect([...new Set(steps.map((s) => s.nodeId))]).toEqual(["trigger", "ask", "wait"]);
  });
});
