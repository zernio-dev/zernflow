import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { simulateFlow } from "./simulator";

const nodes: Node[] = [
  { id: "t", type: "trigger", position: { x: 0, y: 0 }, data: { triggerType: "keyword", keywords: [{ value: "hi", matchType: "contains" }] } },
  { id: "f", type: "followCheck", position: { x: 0, y: 0 }, data: { maxChecks: 2 } },
  { id: "link", type: "sendMessage", position: { x: 0, y: 0 }, data: { messages: [{ text: "link" }] } },
  { id: "ask", type: "sendMessage", position: { x: 0, y: 0 }, data: { messages: [{ text: "follow us" }] } },
  { id: "bye", type: "sendMessage", position: { x: 0, y: 0 }, data: { messages: [{ text: "bye" }] } },
];
// The handle ids are the ones the node component draws.
const edges: Edge[] = [
  { id: "1", source: "t", target: "f" },
  { id: "2", source: "f", sourceHandle: "followed", target: "link" },
  { id: "3", source: "f", sourceHandle: "notFollowed", target: "ask" },
  { id: "4", source: "f", sourceHandle: "gaveUp", target: "bye" },
];

const visited = (isFollower: boolean) =>
  // A message node can report more than one step, so compare the nodes reached, in order.
  [...new Set(simulateFlow(nodes, edges, { incomingMessage: "hi", mockContact: { isFollower } }).steps.map((s) => s.nodeId))];

describe("follow check in the simulator", () => {
  it("sends a follower down the Following exit", () => {
    expect(visited(true)).toEqual(["t", "f", "link"]);
  });

  it("sends a non-follower down Not yet on the first miss", () => {
    expect(visited(false)).toEqual(["t", "f", "ask"]);
  });
});
