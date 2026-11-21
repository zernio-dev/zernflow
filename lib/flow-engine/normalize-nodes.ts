/**
 * The builder saves every Logic/Action palette item (Smart Delay, Add Tag, HTTP Request, A/B Split,
 * Go To Flow, Human Takeover, Subscribe...) as a node of type "action" with the real kind in
 * `data.actionType`. The engine and the Test simulator switch on the real kind, so without this
 * step those nodes fall through to "do nothing" (a Smart Delay does not wait). Flows written by
 * hand or by templates already carry the real type and are left alone.
 */
export function normalizeFlowNodes<T extends { type?: string; data?: unknown }>(nodes: T[]): T[] {
  return nodes.map((node) => {
    if (node.type !== "action") return node;
    const actionType = (node.data as { actionType?: string } | undefined)?.actionType;
    return actionType ? { ...node, type: actionType } : node;
  });
}
