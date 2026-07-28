"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageCircle,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
  X,
  TrendingUp,
  Send,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Database, Json, Platform } from "@/lib/types/database";

type Channel = Database["public"]["Tables"]["channels"]["Row"];
type CommentLog = Database["public"]["Tables"]["comment_logs"]["Row"];

interface TriggerWithFlow {
  id: string;
  flow_id: string;
  channel_id: string | null;
  type: string;
  config: Json;
  priority: number;
  is_active: boolean;
  created_at: string;
  flows: { id: string; name: string; status: string } | null;
}

interface TriggerConfig {
  keywords: Array<{
    value: string;
    matchType?: "exact" | "contains" | "startsWith";
  }>;
  postIds?: string[];
  replyText?: string;
}

const platformLabels: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X / Twitter",
  telegram: "Telegram",
  bluesky: "Bluesky",
  reddit: "Reddit",
  whatsapp: "WhatsApp",
};

export function GrowthView({
  workspaceId,
  channels,
  triggers: initialTriggers,
  flows,
  stats,
  recentLogs,
}: {
  workspaceId: string;
  channels: Channel[];
  triggers: TriggerWithFlow[];
  flows: Array<{ id: string; name: string }>;
  stats: {
    totalComments: number;
    matchedComments: number;
    dmsSent: number;
  };
  recentLogs: CommentLog[];
}) {
  const [triggers, setTriggers] = useState(initialTriggers);
  const [showCreate, setShowCreate] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const createFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((showCreate || editingId) && createFormRef.current) {
      createFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showCreate, editingId]);

  // New rule form state
  const [form, setForm] = useState({
    channelId: channels[0]?.id || "",
    flowId: flows[0]?.id || "",
    keywords: "",
    matchType: "contains" as "exact" | "contains" | "startsWith",
    replyText: "",
    postIds: "",
  });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const conversionRate =
    stats.totalComments > 0
      ? ((stats.dmsSent / stats.totalComments) * 100).toFixed(1)
      : "0.0";

  async function handleToggle(trigger: TriggerWithFlow) {
    setTogglingId(trigger.id);
    const supabase = createClient();

    const { error } = await supabase
      .from("triggers")
      .update({ is_active: !trigger.is_active })
      .eq("id", trigger.id);

    if (!error) {
      setTriggers((prev) =>
        prev.map((t) =>
          t.id === trigger.id ? { ...t, is_active: !t.is_active } : t
        )
      );
    }
    setTogglingId(null);
  }

  async function handleDelete(triggerId: string) {
    if (!confirm("Delete this comment rule? This cannot be undone.")) return;
    setDeletingId(triggerId);
    const supabase = createClient();

    const { error } = await supabase
      .from("triggers")
      .delete()
      .eq("id", triggerId);

    if (!error) {
      setTriggers((prev) => prev.filter((t) => t.id !== triggerId));
    }
    setDeletingId(null);
  }

  async function handleCreate() {
    if (!form.channelId || !form.flowId || !form.keywords.trim() || creating) {
      return;
    }

    setCreating(true);
    const supabase = createClient();

    const keywords = form.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .map((value) => ({ value, matchType: form.matchType }));

    const config: TriggerConfig = {
      keywords,
      ...(form.replyText.trim() ? { replyText: form.replyText.trim() } : {}),
      ...(form.postIds.trim()
        ? {
            postIds: form.postIds
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean),
          }
        : {}),
    };

    try {
      const { data, error } = await supabase
        .from("triggers")
        .insert({
          flow_id: form.flowId,
          channel_id: form.channelId,
          type: "comment_keyword" as const,
          config: config as unknown as Json,
          is_active: true,
          priority: 10,
        })
        .select("*, flows(id, name, status)")
        .single();

      if (error) throw error;

      if (data) {
        setTriggers((prev) => [
          data as unknown as TriggerWithFlow,
          ...prev,
        ]);
        setShowCreate(false);
        setForm({
          channelId: channels[0]?.id || "",
          flowId: flows[0]?.id || "",
          keywords: "",
          matchType: "contains",
          replyText: "",
          postIds: "",
        });
      }
    } catch (err) {
      console.error("Failed to create comment rule:", err);
    } finally {
      setCreating(false);
    }
  }

  function handleStartEdit(trigger: TriggerWithFlow) {
    const config = trigger.config as unknown as TriggerConfig;
    setEditingId(trigger.id);
    setShowCreate(false);
    setForm({
      channelId: trigger.channel_id || channels[0]?.id || "",
      flowId: trigger.flow_id,
      keywords: (config.keywords || []).map((k) => k.value).join(", "),
      matchType: config.keywords?.[0]?.matchType || "contains",
      replyText: config.replyText || "",
      postIds: (config.postIds || []).join(", "),
    });
  }

  async function handleSaveEdit() {
    if (!editingId || !form.channelId || !form.flowId || !form.keywords.trim() || saving) {
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const keywords = form.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .map((value) => ({ value, matchType: form.matchType }));

    const config: TriggerConfig = {
      keywords,
      ...(form.replyText.trim() ? { replyText: form.replyText.trim() } : {}),
      ...(form.postIds.trim()
        ? {
            postIds: form.postIds
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean),
          }
        : {}),
    };

    try {
      const { data, error } = await supabase
        .from("triggers")
        .update({
          flow_id: form.flowId,
          channel_id: form.channelId,
          config: config as unknown as Json,
        })
        .eq("id", editingId)
        .select("*, flows(id, name, status)")
        .single();

      if (error) throw error;

      if (data) {
        setTriggers((prev) =>
          prev.map((t) =>
            t.id === editingId ? (data as unknown as TriggerWithFlow) : t
          )
        );
        setEditingId(null);
        setForm({
          channelId: channels[0]?.id || "",
          flowId: flows[0]?.id || "",
          keywords: "",
          matchType: "contains",
          replyText: "",
          postIds: "",
        });
      }
    } catch (err) {
      console.error("Failed to update comment rule:", err);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelForm() {
    setShowCreate(false);
    setEditingId(null);
    setForm({
      channelId: channels[0]?.id || "",
      flowId: flows[0]?.id || "",
      keywords: "",
      matchType: "contains",
      replyText: "",
      postIds: "",
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Growth Tools
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Comment-to-DM automation for lead capture and engagement
            </p>
          </div>
          <button
            onClick={() => { setEditingId(null); setShowCreate(true); }}
            disabled={channels.length === 0 || flows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New Comment Rule
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Comments Processed"
            value={stats.totalComments}
            icon={<Eye className="h-4 w-4" />}
            sublabel="Last 30 days"
          />
          <StatCard
            label="Keywords Matched"
            value={stats.matchedComments}
            icon={<MessageCircle className="h-4 w-4" />}
            sublabel="Last 30 days"
          />
          <StatCard
            label="DMs Sent"
            value={stats.dmsSent}
            icon={<Send className="h-4 w-4" />}
            sublabel="Last 30 days"
          />
          <StatCard
            label="Conversion Rate"
            value={`${conversionRate}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            sublabel="Comments to DMs"
          />
        </div>

        {/* Create / Edit form */}
        {(showCreate || editingId) && (
          <div ref={createFormRef} className="mt-6 rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {editingId ? "Edit Comment-to-DM Rule" : "Create Comment-to-DM Rule"}
              </h2>
              <button
                onClick={handleCancelForm}
                className="rounded-md p-1 text-muted-foreground/60 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {/* Channel */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Channel
                </label>
                <select
                  value={form.channelId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, channelId: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.display_name || ch.username || ch.late_account_id} (
                      {platformLabels[ch.platform]})
                    </option>
                  ))}
                </select>
              </div>

              {/* Flow */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Response Flow
                </label>
                <select
                  value={form.flowId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, flowId: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {flows.map((flow) => (
                    <option key={flow.id} value={flow.id}>
                      {flow.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Keywords */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, keywords: e.target.value }))
                  }
                  placeholder="info, price, details"
                  className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Match Type */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Match Type
                </label>
                <select
                  value={form.matchType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      matchType: e.target.value as
                        | "exact"
                        | "contains"
                        | "startsWith",
                    }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="contains">Contains</option>
                  <option value="exact">Exact match</option>
                  <option value="startsWith">Starts with</option>
                </select>
              </div>

              {/* Public reply text (optional) */}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Public Reply (optional)
                </label>
                <input
                  type="text"
                  value={form.replyText}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, replyText: e.target.value }))
                  }
                  placeholder="Check your DMs! We just sent you more info."
                  className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-[11px] text-muted-foreground/60">
                  If set, this will be posted as a public reply to the matching
                  comment before sending the DM.
                </p>
              </div>

              {/* Post IDs (optional) */}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Specific Post IDs (optional, comma-separated)
                </label>
                <input
                  type="text"
                  value={form.postIds}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, postIds: e.target.value }))
                  }
                  placeholder="Leave empty to match comments on all posts"
                  className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-[11px] text-muted-foreground/60">
                  Limit this rule to specific Zernio post IDs. If empty, all posts
                  on this channel are monitored.
                </p>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={handleCancelForm}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              {editingId ? (
                <button
                  onClick={handleSaveEdit}
                  disabled={
                    !form.keywords.trim() || !form.channelId || !form.flowId || saving
                  }
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={
                    !form.keywords.trim() || !form.channelId || !form.flowId || creating
                  }
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Rule"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {channels.length === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-input p-8 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">
              Connect a channel first
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You need at least one active channel to set up comment automation.
            </p>
            <a
              href="/dashboard/channels"
              className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Go to Channels
            </a>
          </div>
        )}

        {flows.length === 0 && channels.length > 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-input p-8 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">
              Create a flow first
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Publish at least one flow to use as the DM response when comments
              match your keywords.
            </p>
            <Link
              href="/dashboard/flows"
              className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Go to Flows
            </Link>
          </div>
        )}

        {/* Active rules */}
        {triggers.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-foreground">
              Active Comment Rules
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              When a comment matches a keyword, the linked flow sends a DM to
              the commenter.
            </p>

            <div className="mt-4 space-y-3">
              {triggers.map((trigger) => {
                const config = trigger.config as unknown as TriggerConfig;
                const channel = channels.find(
                  (c) => c.id === trigger.channel_id
                );
                return (
                  <div
                    key={trigger.id}
                    className={cn(
                      "rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm",
                      trigger.is_active
                        ? "border-border"
                        : "border-border/60 opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                              trigger.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                trigger.is_active
                                  ? "bg-green-500"
                                  : "bg-muted-foreground"
                              )}
                            />
                            {trigger.is_active ? "Active" : "Paused"}
                          </span>

                          {channel && (
                            <span className="text-xs text-muted-foreground">
                              {channel.display_name ||
                                channel.username ||
                                platformLabels[channel.platform]}
                            </span>
                          )}

                          {!trigger.channel_id && (
                            <span className="text-xs text-muted-foreground">
                              All channels
                            </span>
                          )}
                        </div>

                        {/* Keywords */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {config.keywords?.map((kw, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                            >
                              {kw.matchType === "exact" && "= "}
                              {kw.matchType === "startsWith" && "^ "}
                              {kw.value}
                            </span>
                          ))}
                        </div>

                        {/* Flow name */}
                        <p className="mt-2 text-xs text-muted-foreground">
                          Flow:{" "}
                          <span className="font-medium text-foreground">
                            {trigger.flows?.name || "Unknown"}
                          </span>
                        </p>

                        {/* Reply text preview */}
                        {config.replyText && (
                          <p className="mt-1 text-xs text-muted-foreground/60">
                            Public reply: &ldquo;{config.replyText}&rdquo;
                          </p>
                        )}

                        {/* Post IDs */}
                        {config.postIds?.length ? (
                          <p className="mt-1 text-xs text-muted-foreground/60">
                            Limited to {config.postIds.length} post
                            {config.postIds.length !== 1 ? "s" : ""}
                          </p>
                        ) : null}
                      </div>

                      {/* Actions */}
                      <div className="ml-4 flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(trigger)}
                          className="rounded-lg p-2 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
                          title="Edit rule"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(trigger)}
                          disabled={togglingId === trigger.id}
                          className={cn(
                            "rounded-lg p-2 transition-colors",
                            trigger.is_active
                              ? "text-green-600 hover:bg-green-50"
                              : "text-muted-foreground/60 hover:bg-muted"
                          )}
                          title={
                            trigger.is_active ? "Pause rule" : "Activate rule"
                          }
                        >
                          {trigger.is_active ? (
                            <Power className="h-4 w-4" />
                          ) : (
                            <PowerOff className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(trigger.id)}
                          disabled={deletingId === trigger.id}
                          className="rounded-lg p-2 text-muted-foreground/60 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Delete rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent activity log */}
        {recentLogs.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-foreground">
              Recent Activity
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest processed comments and their outcomes.
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Author
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Comment
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Matched
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      DM
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">
                          {log.author_name || log.author_username || "Unknown"}
                        </p>
                        {log.author_username && (
                          <p className="text-xs text-muted-foreground/60">
                            @{log.author_username}
                          </p>
                        )}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-foreground">
                        {log.comment_text}
                      </td>
                      <td className="px-4 py-3">
                        {log.matched_trigger_id ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.dm_sent ? (
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            Sent
                          </span>
                        ) : log.error ? (
                          <span
                            className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700"
                            title={log.error}
                          >
                            Error
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">
                            --
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground/60">
                        {formatRelativeTime(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  sublabel,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  sublabel: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="text-muted-foreground/60">{icon}</div>
      </div>
      <p className="mt-2 text-3xl font-bold text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground/60">
        {sublabel}
      </p>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(dateStr).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}
