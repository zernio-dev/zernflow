import type { FlowNode } from "./types";

/**
 * The builder saves every Logic/Action palette item (Smart Delay, Add Tag, HTTP Request, A/B Split,
 * Go To Flow, Human Takeover, Subscribe...) as a node of type "action" with the real kind in
 * `data.actionType`. The engine switches on the real kind, so without this step those nodes fall
 * through to "do nothing" and a Smart Delay does not wait. Flows written by hand or by templates
 * already carry the real type and are left alone.
 */
export function normalizeFlowNodes(nodes: FlowNode[]): FlowNode[] {
  return nodes.map((node) => {
    if ((node.type as string) !== "action") return node;
    const actionType = (node.data as { actionType?: string } | undefined)?.actionType;
    return actionType ? ({ ...node, type: actionType } as FlowNode) : node;
  });
}
