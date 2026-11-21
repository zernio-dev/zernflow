import { describe, expect, it } from "vitest";
import { normalizeFlowNodes } from "./normalize-nodes";
import type { FlowNode } from "./types";

const node = (type: string, data: Record<string, unknown> = {}): FlowNode =>
  ({ id: "n", type, data, position: { x: 0, y: 0 } }) as FlowNode;

describe("normalizeFlowNodes", () => {
  it("turns a palette action node into its real type", () => {
    expect(normalizeFlowNodes([node("action", { actionType: "smartDelay" })])[0].type).toBe("smartDelay");
    expect(normalizeFlowNodes([node("action", { actionType: "addTag" })])[0].type).toBe("addTag");
  });

  it("keeps the node's data and id", () => {
    const [out] = normalizeFlowNodes([node("action", { actionType: "abSplit", paths: [] })]);
    expect(out.id).toBe("n");
    expect(out.data).toEqual({ actionType: "abSplit", paths: [] });
  });

  it("leaves nodes that already have a real type alone", () => {
    const sm = node("sendMessage");
    expect(normalizeFlowNodes([sm])[0]).toBe(sm);
  });

  it("leaves an action node with no actionType alone", () => {
    expect(normalizeFlowNodes([node("action")])[0].type).toBe("action");
  });
});
