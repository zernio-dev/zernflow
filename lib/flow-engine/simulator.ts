/**
 * Client-side flow simulator. Runs a dry-run traversal of flow nodes/edges
 * without any database writes or API calls. Used for the "Test" panel in the
 * flow builder.
 */

import type { Node, Edge } from "@xyflow/react";

// --- Types ---

export interface SimulationStep {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  result: SimulationStepResult;
}

export type SimulationStepResult =
  | {
      type: "trigger";
      matched: boolean;
      triggerType: string;
      keywords?: string[];
    }
  | {
      type: "message";
      texts: string[];
      buttons?: { title: string }[];
      quickReplies?: { title: string }[];
    }
  | { type: "condition"; conditions: string[]; result: boolean; path: string }
  | { type: "delay"; duration: number; unit: string }
  | { type: "action"; actionType: string; detail: string }
  | { type: "ai_response"; mode: "skipped" | "generated"; text?: string }
  | { type: "split"; selectedPath: string; weight: number }
  | { type: "smart_delay" }
  | { type: "human_takeover" }
  | { type: "go_to_flow"; flowId: string }
  | { type: "enroll_sequence"; sequenceId: string }
  | { type: "comment_reply"; text: string }
  | { type: "private_reply"; text: string }
  | { type: "subscribe" | "unsubscribe" }
  | { type: "http_request"; method: string; url: string }
  | { type: "error"; message: string }
  | { type: "flow_end" };

export interface SimulationConfig {
  incomingMessage: string;
  mockContact?: {
    tags?: string[];
    customFields?: Record<string, string>;
    isSubscribed?: boolean;
  };
}

export interface SimulationResult {
  steps: SimulationStep[];
  errors: string[];
  completed: boolean;
}

// --- Helpers ---

function resolvePath(
  variables: Record<string, string>,
  path: string
): unknown {
  let value: unknown = variables;
  for (const key of path.split(".")) {
    if (typeof value !== "object" || value === null) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

// Mirrors interpolateVariables in engine.ts (dot paths, JSON for objects,
// literal token when unresolved) so test-mode previews match production.
function interpolate(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (token, path: string) => {
    const value = resolvePath(variables, path);
    if (value === null || value === undefined) return token;
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

function evaluateCondition(
  actual: string | undefined,
  operator: string,
  expected: string
): boolean {
  switch (operator) {
    case "equals":
      return actual === expected;
    case "not_equals":
      return actual !== expected;
    case "contains":
      return actual?.includes(expected) || false;
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    default:
      return false;
  }
}

// --- Simulator ---

export function simulateFlow(
  nodes: Node[],
  edges: Edge[],
  config: SimulationConfig
): SimulationResult {
  const steps: SimulationStep[] = [];
  const errors: string[] = [];
  const variables: Record<string, string> = {
    message: config.incomingMessage,
  };

  // 1. Find trigger node
  const triggerNode = nodes.find((n) => n.type === "trigger");
  if (!triggerNode) {
    errors.push("No trigger node found");
    return { steps, errors, completed: false };
  }

  // Simulate trigger matching
  const triggerData = triggerNode.data as Record<string, unknown>;
  const triggerType = (triggerData.triggerType as string) || "keyword";
  // Keywords are stored as { value, matchType } objects by the trigger panel, but
  // older flows / templates may store plain strings. Normalize to strings up front
  // so matching, the result payload, and the error log render real keywords instead
  // of "[object Object]".
  const rawKeywords =
    (triggerData.keywords as Array<string | { value: string }>) || [];
  const keywords = rawKeywords
    .map((k) => (typeof k === "string" ? k : k?.value ?? ""))
    .filter((k) => k.length > 0);
  let triggerMatched = false;

  if (triggerType === "keyword") {
    const msg = config.incomingMessage.toLowerCase();
    triggerMatched =
      keywords.length === 0 ||
      keywords.some((k) => msg.includes(k.toLowerCase()));
  } else if (triggerType === "welcome" || triggerType === "default") {
    triggerMatched = true;
  }

  steps.push({
    nodeId: triggerNode.id,
    nodeType: "trigger",
    nodeLabel: (triggerData.label as string) || "Trigger",
    result: {
      type: "trigger",
      matched: triggerMatched,
      triggerType,
      keywords: keywords.length > 0 ? keywords : undefined,
    },
  });

  if (!triggerMatched) {
    errors.push(
      `Trigger did not match. Keywords: [${keywords.join(", ")}], Message: "${config.incomingMessage}"`
    );
    return { steps, errors, completed: false };
  }

  // 2. Follow edges from trigger
  const firstEdge = edges.find((e) => e.source === triggerNode.id);
  if (!firstEdge) {
    errors.push("Trigger has no outgoing connection");
    return { steps, errors, completed: false };
  }

  let currentNodeId: string | undefined = firstEdge.target;
  let stepCount = 0;
  const maxSteps = 50;

  // 3. Traverse
  while (currentNodeId && stepCount < maxSteps) {
    stepCount++;
    const node = nodes.find((n) => n.id === currentNodeId);
    if (!node) {
      errors.push(`Node not found: ${currentNodeId}`);
      break;
    }

    const data = node.data as Record<string, unknown>;
    const label = (data.label as string) || node.type || "Unknown";
    let nextHandle: string | undefined;
    let shouldPause = false;

    switch (node.type) {
      case "sendMessage": {
        const messages = (data.messages as Array<{ type?: string; text?: string; imageUrl?: string }>) || [];
        const texts = messages
          .filter((m) => m.text)
          .map((m) => interpolate(m.text!, variables));
        const buttons = (data.buttons as Array<{ title: string }>) || [];
        const quickReplies = (data.quickReplies as Array<{ title: string }>) || [];
        steps.push({
          nodeId: node.id,
          nodeType: "sendMessage",
          nodeLabel: label,
          result: {
            type: "message",
            texts: texts.length > 0 ? texts : ["(empty message)"],
            buttons: buttons.length > 0 ? buttons : undefined,
            quickReplies: quickReplies.length > 0 ? quickReplies : undefined,
          },
        });
        break;
      }

      case "condition": {
        const conditions = (data.conditions as Array<{
          field: string;
          operator: string;
          value: string;
        }>) || [];
        const logic = (data.logic as string) || "and";

        const results = conditions.map((c) => {
          let fieldValue: string | undefined;

          if (c.field === "platform") {
            fieldValue = "instagram"; // simulated
          } else if (c.field === "is_subscribed") {
            fieldValue = String(config.mockContact?.isSubscribed ?? true);
          } else if (c.field.startsWith("tag:")) {
            const tagName = c.field.replace("tag:", "");
            fieldValue = String(
              config.mockContact?.tags?.includes(tagName) ?? false
            );
          } else if (c.field === "has_tag") {
            // Simple tag check: value is the tag name
            fieldValue = String(
              config.mockContact?.tags?.includes(c.value) ?? false
            );
          } else if (c.field.startsWith("variable:")) {
            const varName = c.field.replace("variable:", "");
            fieldValue = variables[varName];
          } else {
            fieldValue = config.mockContact?.customFields?.[c.field];
          }

          return evaluateCondition(fieldValue, c.operator, c.value);
        });

        const passed =
          logic === "and" ? results.every(Boolean) : results.some(Boolean);

        steps.push({
          nodeId: node.id,
          nodeType: "condition",
          nodeLabel: label,
          result: {
            type: "condition",
            conditions: conditions.map(
              (c) => `${c.field} ${c.operator} "${c.value}"`
            ),
            result: passed,
            path: passed ? "true" : "false",
          },
        });
        nextHandle = passed ? "true" : "false";
        break;
      }

      case "delay": {
        const duration = (data.duration as number) || 5;
        const unit = (data.unit as string) || "minutes";
        steps.push({
          nodeId: node.id,
          nodeType: "delay",
          nodeLabel: label,
          result: { type: "delay", duration, unit },
        });
        break;
      }

      case "addTag":
      case "removeTag": {
        const tagName = (data.tagName as string) || "unknown";
        const actionType =
          node.type === "addTag"
            ? "addTag"
            : (data.actionType as string) || node.type;
        steps.push({
          nodeId: node.id,
          nodeType: node.type,
          nodeLabel: label,
          result: {
            type: "action",
            actionType,
            detail:
              actionType === "addTag" || actionType === "add"
                ? `Add tag: ${tagName}`
                : `Remove tag: ${tagName}`,
          },
        });
        break;
      }

      case "action": {
        const actionType = (data.actionType as string) || "unknown";
        const tagName = (data.tagName as string) || "";
        const fieldSlug = (data.fieldSlug as string) || "";
        const fieldValue = (data.value as string) || "";
        let detail = actionType;
        if (actionType === "addTag") detail = `Add tag: ${tagName}`;
        else if (actionType === "removeTag") detail = `Remove tag: ${tagName}`;
        else if (actionType === "setCustomField")
          detail = `Set ${fieldSlug} = ${fieldValue}`;
        steps.push({
          nodeId: node.id,
          nodeType: "action",
          nodeLabel: label,
          result: { type: "action", actionType, detail },
        });
        break;
      }

      case "setCustomField": {
        const slug = (data.fieldSlug as string) || "unknown";
        const value = interpolate((data.value as string) || "", variables);
        steps.push({
          nodeId: node.id,
          nodeType: "setCustomField",
          nodeLabel: label,
          result: {
            type: "action",
            actionType: "setCustomField",
            detail: `Set ${slug} = ${value}`,
          },
        });
        break;
      }

      case "aiResponse": {
        // Placeholder so downstream {{ai_response}} interpolates in the dry run
        variables.ai_response = "[AI response]";
        steps.push({
          nodeId: node.id,
          nodeType: "aiResponse",
          nodeLabel: label,
          result: { type: "ai_response", mode: "skipped" },
        });
        break;
      }

      case "abSplit": {
        const paths =
          (data.paths as Array<{ name: string; weight: number }>) || [];
        if (paths.length > 0) {
          const totalWeight = paths.reduce((s, p) => s + p.weight, 0);
          const random = Math.random() * totalWeight;
          let cumulative = 0;
          let selected = paths[0];
          for (const p of paths) {
            cumulative += p.weight;
            if (random <= cumulative) {
              selected = p;
              break;
            }
          }
          steps.push({
            nodeId: node.id,
            nodeType: "abSplit",
            nodeLabel: label,
            result: {
              type: "split",
              selectedPath: selected.name,
              weight: selected.weight,
            },
          });
          nextHandle = selected.name;
        }
        break;
      }

      case "smartDelay": {
        steps.push({
          nodeId: node.id,
          nodeType: "smartDelay",
          nodeLabel: label,
          result: { type: "smart_delay" },
        });
        shouldPause = true;
        break;
      }

      case "humanTakeover": {
        steps.push({
          nodeId: node.id,
          nodeType: "humanTakeover",
          nodeLabel: label,
          result: { type: "human_takeover" },
        });
        shouldPause = true;
        break;
      }

      case "goToFlow": {
        const flowId = (data.flowId as string) || "unknown";
        steps.push({
          nodeId: node.id,
          nodeType: "goToFlow",
          nodeLabel: label,
          result: { type: "go_to_flow", flowId },
        });
        shouldPause = true;
        break;
      }

      case "enrollSequence": {
        const sequenceId = (data.sequenceId as string) || "unknown";
        steps.push({
          nodeId: node.id,
          nodeType: "enrollSequence",
          nodeLabel: label,
          result: { type: "enroll_sequence", sequenceId },
        });
        break;
      }

      case "subscribe":
      case "unsubscribe": {
        steps.push({
          nodeId: node.id,
          nodeType: node.type,
          nodeLabel: label,
          result: { type: node.type as "subscribe" | "unsubscribe" },
        });
        break;
      }

      case "commentReply": {
        const text = interpolate((data.text as string) || "", variables);
        steps.push({
          nodeId: node.id,
          nodeType: "commentReply",
          nodeLabel: label,
          result: { type: "comment_reply", text },
        });
        break;
      }

      case "privateReply": {
        const text = interpolate((data.text as string) || "", variables);
        steps.push({
          nodeId: node.id,
          nodeType: "privateReply",
          nodeLabel: label,
          result: { type: "private_reply", text },
        });
        break;
      }

      case "httpRequest": {
        const method = (data.method as string) || "GET";
        const url = interpolate((data.url as string) || "", variables);
        steps.push({
          nodeId: node.id,
          nodeType: "httpRequest",
          nodeLabel: label,
          result: { type: "http_request", method, url },
        });
        break;
      }

      default: {
        steps.push({
          nodeId: node.id,
          nodeType: node.type || "unknown",
          nodeLabel: label,
          result: {
            type: "error",
            message: `Unknown node type: ${node.type}`,
          },
        });
      }
    }

    if (shouldPause) break;

    // Find next edge
    let nextEdge: Edge | undefined;
    if (nextHandle) {
      nextEdge = edges.find(
        (e) => e.source === node.id && e.sourceHandle === nextHandle
      );
    }
    if (!nextEdge) {
      nextEdge = edges.find(
        (e) => e.source === node.id && !e.sourceHandle
      );
    }
    if (!nextEdge) {
      // Try any edge from this source (fallback)
      nextEdge = edges.find((e) => e.source === node.id);
    }

    if (!nextEdge) {
      steps.push({
        nodeId: node.id,
        nodeType: "end",
        nodeLabel: "End",
        result: { type: "flow_end" },
      });
      return { steps, errors, completed: true };
    }

    currentNodeId = nextEdge.target;
  }

  if (stepCount >= maxSteps) {
    errors.push("Simulation stopped: exceeded 50 steps (possible loop)");
  }

  return { steps, errors, completed: stepCount < maxSteps };
}
