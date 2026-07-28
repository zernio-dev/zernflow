"use client";

import { useCallback } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeType } from "@/lib/types/database";
import { EnrollSequencePanel } from "./EnrollSequencePanel";

interface ActionPanelData {
  actionType?: NodeType;
  tagName?: string;
  action?: "add" | "remove";
  fieldSlug?: string;
  value?: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  responseVariable?: string;
  flowId?: string;
  returnAfter?: boolean;
  message?: string;
  paths?: Array<{ name: string; weight: number }>;
  timeout?: number;
  timeoutUnit?: string;
  confirmed?: boolean;
  sequenceId?: string;
  [key: string]: unknown;
}

interface ActionPanelProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

interface ActionSubPanelProps {
  data: ActionPanelData;
  onChange: (data: Record<string, unknown>) => void;
}

export function ActionPanel({ data: rawData, onChange }: ActionPanelProps) {
  const data = rawData as ActionPanelData;
  const actionType = data.actionType || "addTag";

  switch (actionType) {
    case "addTag":
    case "removeTag":
      return <TagConfig data={data} onChange={onChange} />;
    case "setCustomField":
      return <SetFieldConfig data={data} onChange={onChange} />;
    case "httpRequest":
      return <HttpRequestConfig data={data} onChange={onChange} />;
    case "goToFlow":
      return <GoToFlowConfig data={data} onChange={onChange} />;
    case "subscribe":
    case "unsubscribe":
      return <SubscribeConfig data={data} onChange={onChange} />;
    case "humanTakeover":
      return <HumanTakeoverConfig data={data} onChange={onChange} />;
    case "abSplit":
      return <ABSplitConfig data={data} onChange={onChange} />;
    case "smartDelay":
      return <SmartDelayConfig data={data} onChange={onChange} />;
    case "enrollSequence":
      return <EnrollSequencePanel data={rawData} onChange={onChange} />;
    default:
      return (
        <p className="text-sm text-muted-foreground">
          No configuration available for this action type.
        </p>
      );
  }
}

/* ───────── Tag Config ───────── */
function TagConfig({ data, onChange }: ActionSubPanelProps) {
  const isAdd = data.actionType === "addTag";

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-semibold text-foreground">
          Tag Name
        </label>
        <input
          type="text"
          value={data.tagName || ""}
          onChange={(e) => onChange({ ...data, tagName: e.target.value })}
          placeholder="Enter tag name..."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {isAdd
            ? "This tag will be added to the contact when they reach this step."
            : "This tag will be removed from the contact when they reach this step."}
        </p>
      </div>
    </div>
  );
}

/* ───────── Set Custom Field Config ───────── */
function SetFieldConfig({ data, onChange }: ActionSubPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-semibold text-foreground">
          Field Name (slug)
        </label>
        <input
          type="text"
          value={data.fieldSlug || ""}
          onChange={(e) => onChange({ ...data, fieldSlug: e.target.value })}
          placeholder="e.g. favorite_color"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold text-foreground">
          Value
        </label>
        <input
          type="text"
          value={data.value || ""}
          onChange={(e) => onChange({ ...data, value: e.target.value })}
          placeholder="Value or {{variable}}"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground/60">
          Use {"{{variable}}"} for dynamic values
        </p>
      </div>
    </div>
  );
}

/* ───────── HTTP Request Config ───────── */
function HttpRequestConfig({ data, onChange }: ActionSubPanelProps) {
  const headers = data.headers || {};
  const headerEntries = Object.entries(headers);

  const addHeader = useCallback(() => {
    onChange({ ...data, headers: { ...headers, "": "" } });
  }, [data, headers, onChange]);

  const updateHeaderKey = useCallback(
    (oldKey: string, newKey: string) => {
      const newHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        newHeaders[k === oldKey ? newKey : k] = v;
      }
      onChange({ ...data, headers: newHeaders });
    },
    [data, headers, onChange]
  );

  const updateHeaderValue = useCallback(
    (key: string, value: string) => {
      onChange({ ...data, headers: { ...headers, [key]: value } });
    },
    [data, headers, onChange]
  );

  const removeHeader = useCallback(
    (key: string) => {
      const newHeaders = { ...headers };
      delete newHeaders[key];
      onChange({ ...data, headers: Object.keys(newHeaders).length > 0 ? newHeaders : undefined });
    },
    [data, headers, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Method + URL */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-foreground">
          Request
        </label>
        <div className="flex gap-2">
          <select
            value={data.method || "GET"}
            onChange={(e) => onChange({ ...data, method: e.target.value })}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <input
            type="url"
            value={data.url || ""}
            onChange={(e) => onChange({ ...data, url: e.target.value })}
            placeholder="https://api.example.com/webhook"
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Headers */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground">Headers</label>
          <button
            type="button"
            onClick={addHeader}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
        {headerEntries.map(([key, value], i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <input
              type="text"
              value={key}
              onChange={(e) => updateHeaderKey(key, e.target.value)}
              placeholder="Key"
              className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => updateHeaderValue(key, e.target.value)}
              placeholder="Value"
              className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => removeHeader(key)}
              className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Body */}
      {(data.method === "POST" || data.method === "PUT") && (
        <div>
          <label className="mb-2 block text-xs font-semibold text-foreground">
            Request Body (JSON)
          </label>
          <textarea
            value={data.body || ""}
            onChange={(e) => onChange({ ...data, body: e.target.value })}
            placeholder='{"key": "{{variable}}"}'
            rows={4}
            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      {/* Response Variable */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-foreground">
          Save response to variable
        </label>
        <input
          type="text"
          value={data.responseVariable || ""}
          onChange={(e) => onChange({ ...data, responseVariable: e.target.value })}
          placeholder="e.g. api_response"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Optional. Store the response body in a variable for later use.
        </p>
      </div>
    </div>
  );
}

/* ───────── Go To Flow Config ───────── */
function GoToFlowConfig({ data, onChange }: ActionSubPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-semibold text-foreground">
          Target Flow ID
        </label>
        <input
          type="text"
          value={data.flowId || ""}
          onChange={(e) => onChange({ ...data, flowId: e.target.value })}
          placeholder="Enter flow ID..."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          The contact will be redirected to this flow.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={data.returnAfter || false}
            onChange={(e) => onChange({ ...data, returnAfter: e.target.checked })}
            className="peer sr-only"
          />
          <div className="peer h-5 w-9 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-card after:transition-all peer-checked:bg-muted0 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-ring" />
        </label>
        <div>
          <p className="text-sm font-medium text-foreground">Return after</p>
          <p className="text-xs text-muted-foreground">
            Come back to this flow after the target flow completes
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────── Subscribe / Unsubscribe Config ───────── */
function SubscribeConfig({ data, onChange }: ActionSubPanelProps) {
  const isSubscribe = data.actionType === "subscribe";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted p-4">
        <p className="text-sm font-medium text-foreground">
          {isSubscribe ? "Subscribe Contact" : "Unsubscribe Contact"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isSubscribe
            ? "This will mark the contact as subscribed. They will receive broadcasts and automated messages."
            : "This will mark the contact as unsubscribed. They will stop receiving broadcasts and most automated messages."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={data.confirmed || false}
            onChange={(e) => onChange({ ...data, confirmed: e.target.checked })}
            className="peer sr-only"
          />
          <div className="peer h-5 w-9 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-card after:transition-all peer-checked:bg-muted0 peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-ring" />
        </label>
        <div>
          <p className="text-sm font-medium text-foreground">I confirm this action</p>
          <p className="text-xs text-muted-foreground">
            This action will affect the contact&apos;s subscription status
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────── Human Takeover Config ───────── */
function HumanTakeoverConfig({ data, onChange }: ActionSubPanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted p-4">
        <p className="text-sm font-medium text-foreground">Hand off to a human agent</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The flow will pause and the conversation will be marked for human takeover. Automation will stop until an agent resumes it.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-foreground">
          Internal note (optional)
        </label>
        <textarea
          value={data.message || ""}
          onChange={(e) => onChange({ ...data, message: e.target.value })}
          placeholder="Add context for the agent..."
          rows={3}
          className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          This message will be visible to agents as an internal note.
        </p>
      </div>
    </div>
  );
}

/* ───────── A/B Split Config ───────── */
function ABSplitConfig({ data, onChange }: ActionSubPanelProps) {
  const paths = data.paths || [
    { name: "A", weight: 50 },
    { name: "B", weight: 50 },
  ];

  const totalWeight = paths.reduce((sum, p) => sum + p.weight, 0);

  const updatePath = useCallback(
    (index: number, updated: { name: string; weight: number }) => {
      const newPaths = [...paths];
      newPaths[index] = updated;
      onChange({ ...data, paths: newPaths });
    },
    [data, paths, onChange]
  );

  const addPath = useCallback(() => {
    onChange({ ...data, paths: [...paths, { name: String.fromCharCode(65 + paths.length), weight: 0 }] });
  }, [data, paths, onChange]);

  const removePath = useCallback(
    (index: number) => {
      if (paths.length <= 2) return;
      onChange({ ...data, paths: paths.filter((_, i) => i !== index) });
    },
    [data, paths, onChange]
  );

  const distributeEvenly = useCallback(() => {
    const evenWeight = Math.floor(100 / paths.length);
    const remainder = 100 - evenWeight * paths.length;
    const newPaths = paths.map((p, i) => ({
      ...p,
      weight: evenWeight + (i === 0 ? remainder : 0),
    }));
    onChange({ ...data, paths: newPaths });
  }, [data, paths, onChange]);

  return (
    <div className="space-y-4">
      {/* Distribution bar */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground">
            Traffic Distribution
          </label>
          <button
            type="button"
            onClick={distributeEvenly}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Distribute evenly
          </button>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-muted">
          {paths.map((path, i) => {
            const colors = [
              "bg-blue-500",
              "bg-emerald-500",
              "bg-amber-500",
              "bg-purple-500",
              "bg-rose-500",
            ];
            return (
              <div
                key={i}
                className={cn("transition-all", colors[i % colors.length])}
                style={{ width: `${totalWeight > 0 ? (path.weight / totalWeight) * 100 : 0}%` }}
              />
            );
          })}
        </div>
        {totalWeight !== 100 && (
          <p className="mt-1 text-[11px] font-medium text-red-500">
            Total is {totalWeight}% (should be 100%)
          </p>
        )}
      </div>

      {/* Paths */}
      <div className="space-y-2">
        {paths.map((path, index) => {
          const colors = [
            "border-l-blue-500",
            "border-l-emerald-500",
            "border-l-amber-500",
            "border-l-purple-500",
            "border-l-rose-500",
          ];
          return (
            <div
              key={index}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-border border-l-4 bg-card p-3",
                colors[index % colors.length]
              )}
            >
              <input
                type="text"
                value={path.name}
                onChange={(e) => updatePath(index, { ...path, name: e.target.value })}
                className="w-16 rounded border border-border bg-muted px-2 py-1.5 text-xs font-medium text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={path.weight}
                onChange={(e) =>
                  updatePath(index, { ...path, weight: parseInt(e.target.value) })
                }
                className="flex-1 accent-muted-foreground"
              />
              <span className="w-10 text-right text-xs font-semibold text-foreground">
                {path.weight}%
              </span>
              {paths.length > 2 && (
                <button
                  type="button"
                  onClick={() => removePath(index)}
                  className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {paths.length < 5 && (
        <button
          type="button"
          onClick={addPath}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-muted-foreground hover:text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Path
        </button>
      )}
    </div>
  );
}

/* ───────── Smart Delay Config ───────── */
function SmartDelayConfig({ data, onChange }: ActionSubPanelProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted p-4">
        <p className="text-sm font-medium text-foreground">Smart Delay</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pause the flow and wait for a user response. If no response is received within the timeout, continue to the next step.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-foreground">
          Timeout
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={data.timeout || 30}
            onChange={(e) =>
              onChange({ ...data, timeout: Math.max(1, parseInt(e.target.value) || 1) })
            }
            className="w-24 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            value={data.timeoutUnit || "minutes"}
            onChange={(e) => onChange({ ...data, timeoutUnit: e.target.value })}
            className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          If the user does not respond within this time, the flow will continue.
        </p>
      </div>
    </div>
  );
}
