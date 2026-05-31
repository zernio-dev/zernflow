"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Tag,
  FileText,
  Globe,
  ArrowRightLeft,
  UserCheck,
  Bell,
  Shuffle,
  Hourglass,
  Cog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeType } from "@/lib/types/database";

export interface ActionNodeProps {
  label?: string;
  actionType?: NodeType;
  tagName?: string;
  action?: "add" | "remove";
  fieldSlug?: string;
  value?: string;
  method?: string;
  url?: string;
  flowId?: string;
  message?: string;
  paths?: Array<{ name: string; weight: number }>;
  timeout?: number;
  timeoutUnit?: string;
  text?: string;
}

const actionConfig: Record<
  string,
  { icon: typeof Cog; label: string; color: string }
> = {
  addTag: {
    icon: Tag,
    label: "Ajouter une étiquette",
    color: "bg-gray-500",
  },
  removeTag: {
    icon: Tag,
    label: "Retirer une étiquette",
    color: "bg-gray-500",
  },
  setCustomField: {
    icon: FileText,
    label: "Définir un champ",
    color: "bg-gray-500",
  },
  httpRequest: {
    icon: Globe,
    label: "Requête HTTP",
    color: "bg-gray-500",
  },
  goToFlow: {
    icon: ArrowRightLeft,
    label: "Aller au flux",
    color: "bg-gray-500",
  },
  humanTakeover: {
    icon: UserCheck,
    label: "Reprise humaine",
    color: "bg-gray-500",
  },
  subscribe: {
    icon: Bell,
    label: "Abonner",
    color: "bg-gray-500",
  },
  unsubscribe: {
    icon: Bell,
    label: "Désabonner",
    color: "bg-gray-500",
  },
  commentReply: {
    icon: Cog,
    label: "Réponse commentaire",
    color: "bg-gray-500",
  },
  privateReply: {
    icon: Cog,
    label: "Réponse privée",
    color: "bg-gray-500",
  },
  abSplit: {
    icon: Shuffle,
    label: "Test A/B",
    color: "bg-gray-500",
  },
  smartDelay: {
    icon: Hourglass,
    label: "Délai intelligent",
    color: "bg-gray-500",
  },
};

function getSummary(nodeData: ActionNodeProps): string | null {
  const type = nodeData.actionType;
  if (!type) return null;

  switch (type) {
    case "addTag":
      return nodeData.tagName ? `Ajouter "${nodeData.tagName}"` : null;
    case "removeTag":
      return nodeData.tagName ? `Retirer "${nodeData.tagName}"` : null;
    case "setCustomField":
      return nodeData.fieldSlug
        ? `${nodeData.fieldSlug} = ${nodeData.value || "..."}`
        : null;
    case "httpRequest":
      return nodeData.url
        ? `${nodeData.method || "GET"} ${nodeData.url}`
        : null;
    case "goToFlow":
      return nodeData.flowId ? `Flux : ${nodeData.flowId.slice(0, 8)}...` : null;
    case "humanTakeover":
      return nodeData.message || "Transférer à un agent";
    case "subscribe":
      return "Abonner le contact";
    case "unsubscribe":
      return "Désabonner le contact";
    case "commentReply":
    case "privateReply":
      return nodeData.text || null;
    case "abSplit":
      if (nodeData.paths && nodeData.paths.length > 0) {
        return nodeData.paths.map((p) => `${p.name}: ${p.weight}%`).join(", ");
      }
      return null;
    case "smartDelay":
      return nodeData.timeout
        ? `Attendre jusqu'à ${nodeData.timeout} ${nodeData.timeoutUnit || "minutes"}`
        : null;
    default:
      return null;
  }
}

export function ActionNode({ data, selected }: NodeProps) {
  const nodeData = data as ActionNodeProps;
  const actionType = nodeData.actionType || "addTag";
  const config = actionConfig[actionType] || {
    icon: Cog,
    label: "Action",
    color: "bg-gray-500",
  };
  const Icon = config.icon;
  const label = nodeData.label || config.label;
  const summary = getSummary(nodeData);

  const isAbSplit = actionType === "abSplit";
  const paths = isAbSplit ? nodeData.paths || [] : [];

  return (
    <div
      className={cn(
        "w-56 rounded-lg border bg-card shadow-sm transition-shadow",
        selected ? "border-gray-400 shadow-md" : "border-border"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-gray-400 !bg-white"
      />
      <div
        className={cn(
          "flex items-center gap-2 rounded-t-lg px-3 py-2 text-white",
          config.color
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">{config.label}</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium">{label}</p>
        {summary ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">{summary}</p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground italic">Non configuré</p>
        )}
      </div>
      {isAbSplit && paths.length > 0 ? (
        <>
          {paths.map((path, i) => (
            <Handle
              key={path.name}
              type="source"
              position={Position.Bottom}
              id={`split-${i}`}
              style={{ left: `${((i + 1) / (paths.length + 1)) * 100}%` }}
              className="!h-3 !w-3 !border-2 !border-gray-400 !bg-white"
            />
          ))}
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !border-2 !border-gray-400 !bg-white"
        />
      )}
    </div>
  );
}
