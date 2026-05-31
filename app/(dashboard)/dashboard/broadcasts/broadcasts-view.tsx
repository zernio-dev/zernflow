"use client";

import { useState } from "react";
import {
  Radio,
  Plus,
  Clock,
  CheckCircle2,
  Send,
  Loader2,
  XCircle,
  FileEdit,
  Calendar,
  Filter,
  ChevronDown,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  SegmentBuilder,
  createEmptyFilter,
  type SegmentFilter,
} from "@/components/segment-builder";
import type { Database, BroadcastStatus, Json } from "@/lib/types/database";

type Broadcast = Database["public"]["Tables"]["broadcasts"]["Row"];

const statusConfig: Record<
  BroadcastStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  draft: {
    label: "Brouillon",
    icon: FileEdit,
    className: "bg-muted text-muted-foreground",
  },
  scheduled: {
    label: "Planifiée",
    icon: Clock,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  sending: {
    label: "Envoi",
    icon: Loader2,
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  completed: {
    label: "Terminée",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  cancelled: {
    label: "Annulée",
    icon: XCircle,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Non planifiée";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BroadcastsView({
  broadcasts,
  workspaceId,
}: {
  broadcasts: Broadcast[];
  workspaceId: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [items, setItems] = useState(broadcasts);
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter>(
    createEmptyFilter()
  );
  const [showSegmentFilter, setShowSegmentFilter] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim() || creating) return;
    setCreating(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("broadcasts")
        .insert({
          workspace_id: workspaceId,
          name: newName.trim(),
          status: "draft",
          message_content: {},
          segment_filter: showSegmentFilter
            ? (segmentFilter as unknown as Json)
            : null,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setItems((prev) => [data, ...prev]);
        setNewName("");
        setShowCreate(false);
        setSelectedId(data.id);
      }
    } catch (err) {
      console.error("Failed to create broadcast:", err);
    } finally {
      setCreating(false);
    }
  }

  const selectedBroadcast = selectedId
    ? items.find((b) => b.id === selectedId) ?? null
    : null;

  if (selectedBroadcast) {
    return (
      <BroadcastDetail
        broadcast={selectedBroadcast}
        workspaceId={workspaceId}
        onBack={() => setSelectedId(null)}
        onUpdate={(updated) => {
          setItems((prev) =>
            prev.map((b) => (b.id === updated.id ? updated : b))
          );
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Diffusions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Envoyez des messages à plusieurs contacts en une fois
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Créer une diffusion
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="mt-4 rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Nom de la diffusion..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !showSegmentFilter) handleCreate();
                  if (e.key === "Escape") setShowCreate(false);
                }}
                autoFocus
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "Création..." : "Créer"}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                  setShowSegmentFilter(false);
                  setSegmentFilter(createEmptyFilter());
                }}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
              >
                Annuler
              </button>
            </div>

            {/* Targeting section */}
            <div>
              <button
                type="button"
                onClick={() => setShowSegmentFilter(!showSegmentFilter)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  showSegmentFilter
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                Cibler des contacts précis
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    showSegmentFilter && "rotate-180"
                  )}
                />
              </button>

              {showSegmentFilter && (
                <div className="mt-3">
                  <SegmentBuilder
                    value={segmentFilter}
                    onChange={setSegmentFilter}
                    workspaceId={workspaceId}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Broadcast list */}
      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Radio className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              Aucune diffusion pour le moment
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Créez votre première diffusion pour envoyer des messages à vos contacts
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((broadcast) => {
              const status = statusConfig[broadcast.status];
              const StatusIcon = status.icon;
              const total = broadcast.total_recipients;

              return (
                <button
                  key={broadcast.id}
                  onClick={() => setSelectedId(broadcast.id)}
                  className="flex w-full items-center gap-6 px-8 py-4 text-left transition-colors hover:bg-accent/50"
                >
                  {/* Status + Name */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="truncate text-sm font-medium">
                        {broadcast.name}
                      </h3>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          status.className
                        )}
                      >
                        <StatusIcon
                          className={cn(
                            "h-3 w-3",
                            broadcast.status === "sending" && "animate-spin"
                          )}
                        />
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {broadcast.scheduled_for
                          ? formatDate(broadcast.scheduled_for)
                          : "Non planifiée"}
                      </span>
                      <span>
                        Créée le {formatDate(broadcast.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-lg font-semibold">{total}</p>
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Destinataires
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-green-600">
                        {broadcast.sent}
                      </p>
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Envoyés
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-blue-600">
                        {broadcast.delivered}
                      </p>
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Livrés
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-red-600">
                        {broadcast.failed}
                      </p>
                      <p className="text-[10px] uppercase text-muted-foreground">
                        Échoués
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BroadcastDetail({
  broadcast,
  workspaceId,
  onBack,
  onUpdate,
}: {
  broadcast: Broadcast;
  workspaceId: string;
  onBack: () => void;
  onUpdate: (updated: Broadcast) => void;
}) {
  const messageContent = broadcast.message_content as { text?: string } | null;
  const [messageText, setMessageText] = useState(messageContent?.text || "");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isDraft = broadcast.status === "draft" || broadcast.status === "scheduled";
  const status = statusConfig[broadcast.status];
  const StatusIcon = status.icon;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const newContent = { text: messageText.trim() };
      const { data, error: err } = await supabase
        .from("broadcasts")
        .update({ message_content: newContent as unknown as Json })
        .eq("id", broadcast.id)
        .select()
        .single();

      if (err) throw err;
      if (data) onUpdate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!messageText.trim()) {
      setError("Le message ne peut pas être vide");
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/v1/broadcasts/${broadcast.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageContent: { text: messageText.trim() },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Impossible d'envoyer la diffusion");
      }

      setSuccess(`Envoi à ${data.totalRecipients} destinataire${data.totalRecipients === 1 ? "" : "s"}`);

      // Update the broadcast locally
      onUpdate({
        ...broadcast,
        status: "sending",
        total_recipients: data.totalRecipients,
        message_content: { text: messageText.trim() } as unknown as Json,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{broadcast.name}</h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  status.className
                )}
              >
                <StatusIcon
                  className={cn(
                    "h-3.5 w-3.5",
                    broadcast.status === "sending" && "animate-spin"
                  )}
                />
                {status.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Créée le {formatDate(broadcast.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Stats row for non-draft broadcasts */}
          {broadcast.total_recipients > 0 && (
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold">{broadcast.total_recipients}</p>
                <p className="text-xs text-muted-foreground">Destinataires</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{broadcast.sent}</p>
                <p className="text-xs text-muted-foreground">Envoyés</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{broadcast.delivered}</p>
                <p className="text-xs text-muted-foreground">Livrés</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{broadcast.failed}</p>
                <p className="text-xs text-muted-foreground">Échoués</p>
              </div>
            </div>
          )}

          {/* Message composer */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Message</label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={!isDraft}
              placeholder="Saisissez le message de diffusion ici..."
              rows={6}
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            />
            {isDraft && (
              <p className="text-xs text-muted-foreground">
                Ce message sera envoyé à tous les contacts correspondant à votre
                filtre de segment{broadcast.segment_filter ? "" : " (tous les contacts abonnés)"}.
              </p>
            )}
          </div>

          {/* Segment info */}
          {broadcast.segment_filter && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4 text-muted-foreground" />
                Filtre de segment appliqué
              </div>
              <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-xs text-muted-foreground">
                {JSON.stringify(broadcast.segment_filter, null, 2)}
              </pre>
            </div>
          )}

          {/* Error/Success messages */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {success}
            </div>
          )}

          {/* Actions */}
          {isDraft && (
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSend}
                disabled={sending || !messageText.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {sending ? "Envoi..." : "Envoyer maintenant"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !messageText.trim()}
                className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Enregistrer le brouillon"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
