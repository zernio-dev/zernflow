"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConditionNodeProps {
  label?: string;
  conditions?: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
  logic?: "and" | "or";
}

const operatorLabels: Record<string, string> = {
  equals: "=",
  not_equals: "!=",
  contains: "contient",
  exists: "existe",
  gt: ">",
  lt: "<",
};

export function ConditionNode({ data, selected }: NodeProps) {
  const nodeData = data as ConditionNodeProps;
  const label = nodeData.label || "Condition";
  const conditions = nodeData.conditions || [];
  const logic = nodeData.logic || "and";

  return (
    <div
      className={cn(
        "w-56 rounded-lg border bg-card shadow-sm transition-shadow",
        selected ? "border-amber-500 shadow-md" : "border-border"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3 !w-3 !border-2 !border-amber-500 !bg-white"
      />
      <div className="flex items-center gap-2 rounded-t-lg bg-amber-500 px-3 py-2 text-white">
        <GitBranch className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">Condition</span>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium">{label}</p>
        {conditions.length > 0 ? (
          <div className="mt-1 space-y-1">
            {conditions.slice(0, 2).map((c, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {i > 0 && (
                  <span className="font-medium uppercase text-amber-600">
                    {logic}{" "}
                  </span>
                )}
                {c.field} {operatorLabels[c.operator] || c.operator} {c.value}
              </p>
            ))}
            {conditions.length > 2 && (
              <p className="text-xs text-muted-foreground">
                +{conditions.length - 2} de plus
              </p>
            )}
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground italic">Aucune condition définie</p>
        )}
      </div>
      <div className="flex justify-between border-t border-border px-3 py-1.5">
        <span className="text-[10px] font-medium text-emerald-600">
          Oui
        </span>
        <span className="text-[10px] font-medium text-red-500">Non</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{ left: "30%" }}
        className="!h-3 !w-3 !border-2 !border-emerald-500 !bg-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{ left: "70%" }}
        className="!h-3 !w-3 !border-2 !border-red-500 !bg-white"
      />
    </div>
  );
}
