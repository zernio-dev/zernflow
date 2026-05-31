"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  GitBranch,
  Users,
  Send,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// --- Types ---

type TimeRange = "7d" | "30d" | "90d" | "custom";

interface Stats {
  totalFlows: number;
  totalContacts: number;
  messagesSent: number;
  messagesFailed: number;
}

interface FlowPerformance {
  id: string;
  name: string;
  starts: number;
  completions: number;
  dropOffRate: number;
}

interface DailyCount {
  date: string;
  count: number;
}

interface DailyMessages {
  date: string;
  sent: number;
  failed: number;
}

interface AnalyticsData {
  stats: Stats;
  flowPerformance: FlowPerformance[];
  contactGrowth: DailyCount[];
  messageVolume: DailyMessages[];
}

// --- Helpers ---

function getDateRange(range: TimeRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case "7d":
      start.setDate(end.getDate() - 7);
      break;
    case "30d":
      start.setDate(end.getDate() - 30);
      break;
    case "90d":
      start.setDate(end.getDate() - 90);
      break;
    default:
      start.setDate(end.getDate() - 30);
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    month: "short",
    day: "numeric",
  });
}

// --- Simple bar chart with tooltip ---

function MiniBarChart({
  data,
  labels,
  maxVal,
  color,
}: {
  data: number[];
  labels?: string[];
  maxVal: number;
  color: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const safeMax = maxVal || 1;
  return (
    <div className="relative flex items-end gap-[2px] h-16">
      {data.map((val, i) => (
        <div
          key={i}
          className="group relative h-full flex-1 flex items-end cursor-pointer"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <div
            className={cn(
              "w-full rounded-t-sm min-h-[2px] transition-opacity",
              color,
              hovered !== null && hovered !== i && "opacity-40"
            )}
            style={{ height: `${(val / safeMax) * 100}%` }}
          />
          {hovered === i && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-lg pointer-events-none">
              <p className="font-medium">{val}</p>
              {labels?.[i] && <p className="text-background/70">{labels[i]}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Stacked bar chart for message volume ---

function MessageVolumeChart({
  data,
  maxVal,
}: {
  data: DailyMessages[];
  maxVal: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const safeMax = maxVal || 1;

  return (
    <>
      <div className="relative flex items-end gap-[2px] h-16">
        {data.map((d, i) => {
          const sentPct = (d.sent / safeMax) * 100;
          const failedPct = (d.failed / safeMax) * 100;
          return (
            <div
              key={i}
              className="relative h-full flex flex-1 flex-col items-stretch justify-end cursor-pointer"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {failedPct > 0 && (
                <div
                  className={cn(
                    "bg-red-500 rounded-t-sm min-h-[1px] transition-opacity",
                    hovered !== null && hovered !== i && "opacity-40"
                  )}
                  style={{ height: `${failedPct}%` }}
                />
              )}
              {sentPct > 0 && (
                <div
                  className={cn(
                    "bg-green-500 min-h-[1px] transition-opacity",
                    failedPct === 0 && "rounded-t-sm",
                    hovered !== null && hovered !== i && "opacity-40"
                  )}
                  style={{ height: `${sentPct}%` }}
                />
              )}
              {hovered === i && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-lg pointer-events-none">
                  <p className="font-medium">{d.sent} envoyé{d.sent === 1 ? "" : "s"}{d.failed > 0 ? `, ${d.failed} échoué${d.failed === 1 ? "" : "s"}` : ""}</p>
                  <p className="text-background/70">{formatShortDate(d.date)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{formatShortDate(data[0].date)}</span>
        <span>{formatShortDate(data[data.length - 1].date)}</span>
      </div>
    </>
  );
}

// --- Main component ---

export function AnalyticsView({
  workspaceId,
  initialData,
}: {
  workspaceId: string;
  initialData: AnalyticsData;
}) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<Stats>(initialData.stats);
  const [flowPerformance, setFlowPerformance] = useState<FlowPerformance[]>(initialData.flowPerformance);
  const [contactGrowth, setContactGrowth] = useState<DailyCount[]>(initialData.contactGrowth);
  const [messageVolume, setMessageVolume] = useState<DailyMessages[]>(initialData.messageVolume);

  // Only refetch when user changes time range away from the default 30d
  useEffect(() => {
    if (timeRange === "30d") {
      // Reset to server-provided data
      setStats(initialData.stats);
      setFlowPerformance(initialData.flowPerformance);
      setContactGrowth(initialData.contactGrowth);
      setMessageVolume(initialData.messageVolume);
      return;
    }
    fetchAnalytics();
  }, [timeRange]);

  async function fetchAnalytics() {
    setLoading(true);
    const supabase = createClient();

    const range =
      timeRange === "custom" && customStart && customEnd
        ? { start: new Date(customStart).toISOString(), end: new Date(customEnd).toISOString() }
        : getDateRange(timeRange);

    try {
      const [flowsRes, contactsRes, sentRes, failedRes, startsRes, completionsRes, flowsListRes, contactEvents, msgEvents] = await Promise.all([
        supabase
          .from("flows")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId),
        supabase
          .from("contacts")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId),
        supabase
          .from("analytics_events")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("event_type", "message_sent")
          .gte("created_at", range.start)
          .lte("created_at", range.end),
        supabase
          .from("analytics_events")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("event_type", "message_failed")
          .gte("created_at", range.start)
          .lte("created_at", range.end),
        supabase
          .from("analytics_events")
          .select("flow_id")
          .eq("workspace_id", workspaceId)
          .eq("event_type", "flow_started")
          .gte("created_at", range.start)
          .lte("created_at", range.end)
          .not("flow_id", "is", null),
        supabase
          .from("analytics_events")
          .select("flow_id")
          .eq("workspace_id", workspaceId)
          .eq("event_type", "flow_completed")
          .gte("created_at", range.start)
          .lte("created_at", range.end)
          .not("flow_id", "is", null),
        supabase
          .from("flows")
          .select("id, name")
          .eq("workspace_id", workspaceId),
        supabase
          .from("contacts")
          .select("created_at")
          .eq("workspace_id", workspaceId)
          .gte("created_at", range.start)
          .lte("created_at", range.end)
          .order("created_at"),
        supabase
          .from("analytics_events")
          .select("event_type, created_at")
          .eq("workspace_id", workspaceId)
          .in("event_type", ["message_sent", "message_failed"])
          .gte("created_at", range.start)
          .lte("created_at", range.end)
          .order("created_at"),
      ]);

      setStats({
        totalFlows: flowsRes.count ?? 0,
        totalContacts: contactsRes.count ?? 0,
        messagesSent: sentRes.count ?? 0,
        messagesFailed: failedRes.count ?? 0,
      });

      // Flow performance
      const flowNames = new Map(
        (flowsListRes.data ?? []).map((f) => [f.id, f.name])
      );
      const startCounts = new Map<string, number>();
      (startsRes.data ?? []).forEach((e) => {
        if (e.flow_id) startCounts.set(e.flow_id, (startCounts.get(e.flow_id) ?? 0) + 1);
      });
      const completionCounts = new Map<string, number>();
      (completionsRes.data ?? []).forEach((e) => {
        if (e.flow_id) completionCounts.set(e.flow_id, (completionCounts.get(e.flow_id) ?? 0) + 1);
      });
      const allFlowIds = new Set([...startCounts.keys(), ...completionCounts.keys()]);
      const perfData: FlowPerformance[] = Array.from(allFlowIds)
        .map((fid) => {
          const starts = startCounts.get(fid) ?? 0;
          const completions = completionCounts.get(fid) ?? 0;
          const dropOffRate = starts > 0 ? Math.round(((starts - completions) / starts) * 100) : 0;
          return { id: fid, name: flowNames.get(fid) ?? "Flux inconnu", starts, completions, dropOffRate };
        })
        .sort((a, b) => b.starts - a.starts)
        .slice(0, 10);
      setFlowPerformance(perfData);

      // Contact growth by day
      const growthByDay = new Map<string, number>();
      (contactEvents.data ?? []).forEach((e) => {
        const day = e.created_at.split("T")[0];
        growthByDay.set(day, (growthByDay.get(day) ?? 0) + 1);
      });
      const startDate = new Date(range.start);
      const endDate = new Date(range.end);
      const growthData: DailyCount[] = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayStr = d.toISOString().split("T")[0];
        growthData.push({ date: dayStr, count: growthByDay.get(dayStr) ?? 0 });
      }
      setContactGrowth(growthData);

      // Message volume by day
      const sentByDay = new Map<string, number>();
      const failedByDay = new Map<string, number>();
      (msgEvents.data ?? []).forEach((e) => {
        const day = e.created_at.split("T")[0];
        if (e.event_type === "message_sent") {
          sentByDay.set(day, (sentByDay.get(day) ?? 0) + 1);
        } else {
          failedByDay.set(day, (failedByDay.get(day) ?? 0) + 1);
        }
      });
      const msgData: DailyMessages[] = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayStr = d.toISOString().split("T")[0];
        msgData.push({ date: dayStr, sent: sentByDay.get(dayStr) ?? 0, failed: failedByDay.get(dayStr) ?? 0 });
      }
      setMessageVolume(msgData);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: "7d", label: "7 derniers jours" },
    { value: "30d", label: "30 derniers jours" },
    { value: "90d", label: "90 derniers jours" },
    { value: "custom", label: "Personnalisé" },
  ];

  const statCards = [
    {
      label: "Flux au total",
      value: stats.totalFlows,
      icon: GitBranch,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      label: "Contacts au total",
      value: stats.totalContacts,
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
    {
      label: "Messages envoyés",
      value: stats.messagesSent,
      icon: Send,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      label: "Messages échoués",
      value: stats.messagesFailed,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-100",
    },
  ];

  const maxContactGrowth = Math.max(...contactGrowth.map((d) => d.count), 0);
  const maxMessageVolume = Math.max(
    ...messageVolume.map((d) => d.sent + d.failed),
    0
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analyses</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Suivez les performances de votre espace de travail
            </p>
          </div>

          {/* Time range selector */}
          <div className="flex flex-wrap items-center gap-2">
            {timeRangeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  timeRange === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range */}
        {timeRange === "custom" && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <span className="text-sm text-muted-foreground">à</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={fetchAnalytics}
              disabled={!customStart || !customEnd}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Appliquer
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg",
                        card.bg
                      )}
                    >
                      <card.icon className={cn("h-4 w-4", card.color)} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {card.label}
                      </p>
                      <p className="text-2xl font-bold">{card.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Contact growth */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Croissance des contacts</h3>
                  <span className="text-xs text-muted-foreground">
                    Nouveaux contacts par jour
                  </span>
                </div>
                {contactGrowth.length > 0 ? (
                  <>
                    <MiniBarChart
                      data={contactGrowth.map((d) => d.count)}
                      labels={contactGrowth.map((d) => formatShortDate(d.date))}
                      maxVal={maxContactGrowth}
                      color="bg-purple-500"
                    />
                    <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                      <span>{formatShortDate(contactGrowth[0].date)}</span>
                      <span>
                        {formatShortDate(
                          contactGrowth[contactGrowth.length - 1].date
                        )}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Aucune donnée pour cette période
                  </p>
                )}
              </div>

              {/* Message volume */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Volume de messages</h3>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                      Envoyés
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                      Échoués
                    </span>
                  </div>
                </div>
                {messageVolume.length > 0 ? (
                  <MessageVolumeChart data={messageVolume} maxVal={maxMessageVolume} />
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Aucune donnée pour cette période
                  </p>
                )}
              </div>
            </div>

            {/* Flow performance table */}
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-6 py-4">
                <h3 className="text-sm font-semibold">Performance des flux</h3>
              </div>
              {flowPerformance.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <GitBranch className="h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Aucune activité de flux sur cette période
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left">
                      <th className="px-6 py-3 text-xs font-medium uppercase text-muted-foreground">
                        Nom du flux
                      </th>
                      <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground text-right">
                        Démarrages
                      </th>
                      <th className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground text-right">
                        Complétions
                      </th>
                      <th className="px-6 py-3 text-xs font-medium uppercase text-muted-foreground text-right">
                        Taux d'abandon
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {flowPerformance.map((flow) => (
                      <tr
                        key={flow.id}
                        className="border-b border-border last:border-0 transition-colors hover:bg-accent/50"
                      >
                        <td className="px-6 py-3">
                          <span className="text-sm font-medium">
                            {flow.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-muted-foreground">
                            {flow.starts}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-muted-foreground">
                            {flow.completions}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-sm font-medium",
                              flow.dropOffRate > 50
                                ? "text-red-600"
                                : flow.dropOffRate > 25
                                  ? "text-yellow-600"
                                  : "text-green-600"
                            )}
                          >
                            {flow.dropOffRate > 50 ? (
                              <TrendingDown className="h-3.5 w-3.5" />
                            ) : (
                              <TrendingUp className="h-3.5 w-3.5" />
                            )}
                            {flow.dropOffRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
