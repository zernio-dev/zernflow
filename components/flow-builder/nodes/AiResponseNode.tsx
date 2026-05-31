"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AiResponseNodeProps {
  label?: string;
  systemPrompt?: string;
  model?: string;
}

export function AiResponseNode({ data, selected }: NodeProps) {
  const nodeData = data as AiResponseNodeProps;
  const label = nodeData.label || "Réponse IA";
  const prompt = nodeData.systemPrompt;

  return (
    <div
      className={cn(
        "w-56 rounded-lg border bg-card shadow-sm transition-shadow",
        selected ? "border-violet-500 shadow-md" : "border-border"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-violet-500 !bg-white"
      />
      <div className="flex items-center gap-2 rounded-t-lg bg-violet-500 px-3 py-2 text-white">
        <Sparkles className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">Réponse IA</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium">{label}</p>
        {prompt ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {prompt}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground italic">Aucun prompt configuré</p>
        )}
        {nodeData.model && (
          <div className="mt-2">
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
              {nodeData.model}
            </span>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-violet-500 !bg-white"
      />
    </div>
  );
}
