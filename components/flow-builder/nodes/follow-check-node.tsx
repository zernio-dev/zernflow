"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { clampMaxChecks } from "@/lib/flow-engine/follow-branch";

export interface FollowCheckNodeProps {
  label?: string;
  maxChecks?: number;
}

const exits = [
  { id: "followed", label: "Following", left: "17%", text: "text-emerald-600", border: "!border-emerald-500" },
  { id: "notFollowed", label: "Not yet", left: "50%", text: "text-amber-600", border: "!border-amber-500" },
  { id: "gaveUp", label: "Gave up", left: "83%", text: "text-red-500", border: "!border-red-500" },
];

export function FollowCheckNode({ data, selected }: NodeProps) {
  const nodeData = data as FollowCheckNodeProps;
  const tries = clampMaxChecks(nodeData.maxChecks);

  return (
    <div
      className={cn(
        "w-60 rounded-lg border bg-card shadow-sm transition-shadow",
        selected ? "border-emerald-500 shadow-md" : "border-border"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-emerald-500 !bg-white"
      />
      <div className="flex items-center gap-2 rounded-t-lg bg-emerald-500 px-3 py-2 text-white">
        <UserCheck className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">Follow Check</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium">{nodeData.label || "Do they follow us?"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Checks Instagram. Gives up after {tries} {tries === 1 ? "check" : "checks"}.
        </p>
      </div>
      <div className="relative flex h-7 border-t border-border">
        {exits.map((e) => (
          <span
            key={e.id}
            className={cn("absolute top-1.5 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium", e.text)}
            style={{ left: e.left }}
          >
            {e.label}
          </span>
        ))}
      </div>
      {exits.map((e) => (
        <Handle
          key={e.id}
          type="source"
          position={Position.Bottom}
          id={e.id}
          style={{ left: e.left }}
          className={cn("!h-3 !w-3 !border-2 !bg-white", e.border)}
        />
      ))}
    </div>
  );
}
