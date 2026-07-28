"use client";

import { useCallback, useEffect } from "react";
import { X, Trash2, Zap, MessageSquare, GitBranch, Clock, Cog, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Edge, Node } from "@xyflow/react";

import { TriggerPanel } from "./TriggerPanel";
import { SendMessagePanel } from "./SendMessagePanel";
import { ConditionPanel } from "./ConditionPanel";
import { DelayPanel } from "./DelayPanel";
import { ActionPanel } from "./ActionPanel";
import { AiResponsePanel } from "./AiResponsePanel";

interface NodeConfigSidebarProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  onChange: (nodeId: string, data: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete: (nodeId: string) => void;
}

// BFS backwards over edges; the visited set makes cycles terminate.
function getUpstreamNodeIds(nodeId: string, edges: Edge[]): Set<string> {
  const upstream = new Set<string>();
  const queue = [nodeId];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const edge of edges) {
      if (edge.target !== current || upstream.has(edge.source)) continue;
      upstream.add(edge.source);
      queue.push(edge.source);
    }
  }
  return upstream;
}

function getFlowVariables({
  node,
  nodes,
  edges,
}: {
  node: Node;
  nodes: Node[];
  edges: Edge[];
}): string[] {
  const variables = ["message"];

  const triggerNode = nodes.find((n) => n.type === "trigger");
  const triggerType = (triggerNode?.data as Record<string, unknown> | undefined)
    ?.triggerType as string | undefined;
  if (triggerType === "comment_keyword") {
    variables.push("comment_id", "comment_text", "commenter_name", "post_id");
  }

  // Producer-derived variables are only offered when the producing node runs before this one.
  const upstreamIds = getUpstreamNodeIds(node.id, edges);

  if (nodes.some((n) => n.type === "aiResponse" && upstreamIds.has(n.id))) {
    variables.push("ai_response");
  }

  for (const n of nodes) {
    if (n.type !== "httpRequest" || !upstreamIds.has(n.id)) continue;
    const responseVariable = (n.data as Record<string, unknown>)
      .responseVariable as string | undefined;
    if (responseVariable && !variables.includes(responseVariable)) {
      variables.push(responseVariable);
    }
  }

  return variables;
}

const nodeTypeConfig: Record<string, { label: string; icon: typeof Cog; color: string; borderColor: string }> = {
  trigger: {
    label: "Trigger",
    icon: Zap,
    color: "bg-emerald-500",
    borderColor: "border-emerald-500",
  },
  sendMessage: {
    label: "Send Message",
    icon: MessageSquare,
    color: "bg-blue-500",
    borderColor: "border-blue-500",
  },
  condition: {
    label: "Condition",
    icon: GitBranch,
    color: "bg-amber-500",
    borderColor: "border-amber-500",
  },
  delay: {
    label: "Delay",
    icon: Clock,
    color: "bg-purple-500",
    borderColor: "border-purple-500",
  },
  aiResponse: {
    label: "AI Response",
    icon: Sparkles,
    color: "bg-violet-500",
    borderColor: "border-violet-500",
  },
  action: {
    label: "Action",
    icon: Cog,
    color: "bg-muted0",
    borderColor: "border-muted-foreground",
  },
};

export function NodeConfigSidebar({ node, nodes, edges, onChange, onClose, onDelete }: NodeConfigSidebarProps) {
  const nodeType = node.type || "action";
  const config = nodeTypeConfig[nodeType] || nodeTypeConfig.action;
  const Icon = config.icon;

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleChange = useCallback(
    (data: Record<string, unknown>) => {
      onChange(node.id, data);
    },
    [node.id, onChange]
  );

  const handleLabelChange = useCallback(
    (label: string) => {
      onChange(node.id, { ...node.data, label });
    },
    [node.id, node.data, onChange]
  );

  function renderPanel() {
    const data = node.data as Record<string, unknown>;
    switch (nodeType) {
      case "trigger":
        return <TriggerPanel data={data} onChange={handleChange} />;
      case "sendMessage":
        return (
          <SendMessagePanel
            data={data}
            onChange={handleChange}
            availableVariables={getFlowVariables({ node, nodes, edges })}
          />
        );
      case "condition":
        return <ConditionPanel data={data} onChange={handleChange} />;
      case "delay":
        return <DelayPanel data={data} onChange={handleChange} />;
      case "aiResponse":
        return <AiResponsePanel data={data} onChange={handleChange} />;
      case "action":
        return <ActionPanel data={data} onChange={handleChange} />;
      default:
        return (
          <p className="text-sm text-muted-foreground">
            No configuration panel available for this node type.
          </p>
        );
    }
  }

  return (
    <div
      className={cn(
        "flex w-80 flex-col border-l bg-card",
        config.borderColor
      )}
      style={{ borderLeftWidth: "3px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("rounded-md p-1.5 text-white", config.color)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{config.label}</p>
            <p className="text-[11px] text-muted-foreground">
              ID: {node.id.slice(0, 12)}...
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onDelete(node.id)}
            className="rounded-lg p-1.5 text-muted-foreground/60 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500"
            title="Delete node"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Node Label */}
      <div className="border-b border-border px-4 py-3">
        <label className="mb-1.5 block text-xs font-semibold text-foreground">
          Node Name
        </label>
        <input
          type="text"
          value={(node.data as Record<string, unknown>).label as string || ""}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder={config.label}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {renderPanel()}
      </div>

    </div>
  );
}
