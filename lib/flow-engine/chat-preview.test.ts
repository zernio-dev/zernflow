import { describe, expect, it } from "vitest";
import { startPreview, tapPreview } from "./chat-preview";
import { buildCommentDmFlow, defaultCommentDmConfig } from "../comment-dm-flow";

const config = (over = {}) => ({
  ...defaultCommentDmConfig("kaafilaclub"),
  keywords: ["trip"],
  linkUrl: "https://kaafila.club/spiti",
  ...over,
});
const kinds = (s: { items: Array<{ kind: string }> }) => s.items.map((i) => i.kind);
const noteTexts = (s: { items: Array<{ kind: string; text?: string }> }) => s.items.filter((i) => i.kind === "note").map((i) => i.text);

describe("chat preview without a follow gate", () => {
  const flow = buildCommentDmFlow(config());

  it("shows the comment, the public reply and the DM with the link", () => {
    const s = startPreview(flow.nodes, flow.edges, "trip please", false);
    expect(kinds(s)).toEqual(["comment", "public_reply", "us"]);
    expect(s.ended).toBe(true);
    const dm = s.items[2] as { text: string; links: string[] };
    expect(dm.text).toContain("https://kaafila.club/spiti");
    expect(dm.links).toHaveLength(1);
  });

  it("sends nothing for a comment without a keyword", () => {
    const s = startPreview(flow.nodes, flow.edges, "nice reel", false);
    expect(kinds(s)).toEqual(["comment", "note"]);
    expect(s.ended).toBe(true);
  });
});

describe("chat preview with a follow gate", () => {
  const flow = buildCommentDmFlow(config({ requireFollow: true }));

  it("pauses on the opening message and waits for the tap", () => {
    const s = startPreview(flow.nodes, flow.edges, "trip", false);
    expect(kinds(s)).toEqual(["comment", "public_reply", "us"]);
    expect(s.waitingNodeId).toBe("wait");
    expect((s.items[2] as { quickReplies: string[] }).quickReplies).toEqual(["I followed ✅"]);
  });

  it("sends the link once they follow and tap", () => {
    const s = tapPreview(flow.nodes, flow.edges, startPreview(flow.nodes, flow.edges, "trip", false), "I followed ✅", true);
    expect(noteTexts(s)).toEqual(["Instagram says they follow you"]);
    expect((s.items.at(-1) as { text: string }).text).toContain("https://kaafila.club/spiti");
    expect(s.ended).toBe(true);
  });

  it("reminds them and waits again when they have not followed (the loop)", () => {
    const first = startPreview(flow.nodes, flow.edges, "trip", false);
    const s = tapPreview(flow.nodes, flow.edges, first, "I followed ✅", false);
    expect(noteTexts(s)).toEqual(["Not following yet (check 1)"]);
    expect(s.waitingNodeId).toBe("wait");
    expect(s.ended).toBe(false);
  });

  it("lets them through after they follow on a later tap", () => {
    let s = startPreview(flow.nodes, flow.edges, "trip", false);
    s = tapPreview(flow.nodes, flow.edges, s, "I followed ✅", false);
    s = tapPreview(flow.nodes, flow.edges, s, "I followed ✅", true);
    expect(s.ended).toBe(true);
    expect((s.items.at(-1) as { text: string }).text).toContain("https://kaafila.club/spiti");
  });

  it("gives up after the allowed number of misses", () => {
    const f = buildCommentDmFlow(config({ requireFollow: true, follow: { ...config().follow, maxChecks: 2 } }));
    let s = startPreview(f.nodes, f.edges, "trip", false);
    s = tapPreview(f.nodes, f.edges, s, "I followed ✅", false);
    s = tapPreview(f.nodes, f.edges, s, "I followed ✅", false);
    expect(s.ended).toBe(true);
    expect(s.waitingNodeId).toBeNull();
    expect(noteTexts(s).at(-1)).toMatch(/stops asking/);
  });

  it("ignores a tap when the flow is not waiting", () => {
    const done = startPreview(buildCommentDmFlow(config()).nodes, buildCommentDmFlow(config()).edges, "trip", false);
    expect(tapPreview([], [], done, "x", true)).toBe(done);
  });
});
