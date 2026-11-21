"use client";

import {
  DEFAULT_MAX_FOLLOW_CHECKS,
  MAX_FOLLOW_CHECKS_LIMIT,
  clampMaxChecks,
} from "@/lib/flow-engine/follow-branch";

interface FollowCheckPanelProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function FollowCheckPanel({ data, onChange }: FollowCheckPanelProps) {
  const maxChecks = clampMaxChecks(data.maxChecks);

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-foreground">Label</label>
        <input
          type="text"
          value={(data.label as string) ?? ""}
          onChange={(e) => onChange({ ...data, label: e.target.value })}
          placeholder="Do they follow us?"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-foreground">
          Give up after how many checks
        </label>
        <input
          type="number"
          min={1}
          max={MAX_FOLLOW_CHECKS_LIMIT}
          value={maxChecks}
          onChange={(e) => onChange({ ...data, maxChecks: clampMaxChecks(e.target.value) })}
          className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Each time someone taps &quot;I followed&quot; and is still not following (or Instagram can&apos;t tell),
          that counts as one check. Default {DEFAULT_MAX_FOLLOW_CHECKS}, at most {MAX_FOLLOW_CHECKS_LIMIT}.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="mb-1.5 font-semibold text-foreground">How to wire it</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>
            <strong>Send Message</strong>: ask them to follow, with a quick reply &quot;I followed&quot;.
          </li>
          <li>
            <strong>Smart Delay</strong>: waits for that tap. Instagram only tells us who follows after the person
            has messaged us.
          </li>
          <li>This node. <strong>Following</strong> goes to the link message.</li>
          <li>
            <strong>Not yet</strong> goes back to step 1 (a new connection to the same message makes the loop).
          </li>
          <li>
            <strong>Gave up</strong> goes to a last message, for example &quot;Follow us and comment again&quot;.
          </li>
        </ol>
      </div>
    </div>
  );
}
