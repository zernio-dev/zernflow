"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TriggerNodeProps {
  label?: string;
  triggerType?: string;
  keywords?: Array<{ value: string; matchType: string }>;
}

const triggerLabels: Record<string, string> = {
  keyword: "Mot-clé",
  postback: "Clic bouton",
  quick_reply: "Réponse rapide",
  welcome: "Message de bienvenue",
  default: "Réponse par défaut",
  comment_keyword: "Mot-clé en commentaire",
};

export function TriggerNode({ data, selected }: NodeProps) {
  const nodeData = data as TriggerNodeProps;
  const triggerType = nodeData.triggerType || "keyword";
  const label = nodeData.label || triggerLabels[triggerType] || "Déclencheur";

  return (
    <div
      className={cn(
        "w-56 rounded-lg border bg-card shadow-sm transition-shadow",
        selected ? "border-emerald-500 shadow-md" : "border-border"
      )}
    >
      <div className="flex items-center gap-2 rounded-t-lg bg-emerald-500 px-3 py-2 text-white">
        <Zap className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">Déclencheur</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium">{label}</p>
        {nodeData.keywords && nodeData.keywords.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Mots-clés :{" "}
            {nodeData.keywords
              .slice(0, 3)
              .map((k) => k.value)
              .join(", ")}
            {nodeData.keywords.length > 3 && ` +${nodeData.keywords.length - 3} de plus`}
          </p>
        )}
        {!nodeData.keywords?.length && triggerType !== "keyword" && (
          <p className="mt-1 text-xs text-muted-foreground">
            {triggerLabels[triggerType] || triggerType}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-emerald-500 !bg-white"
      />
    </div>
  );
}
