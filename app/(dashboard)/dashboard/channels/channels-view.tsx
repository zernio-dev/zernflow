"use client";

import { useState, useRef, useEffect } from "react";
import {
  Check,
  Copy,
  Plug,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PlatformIcon } from "@/components/platform-icon";
import type { Database, Platform } from "@/lib/types/database";

type Channel = Database["public"]["Tables"]["channels"]["Row"];

const platformLabels: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X / Twitter",
  telegram: "Telegram",
  bluesky: "Bluesky",
  reddit: "Reddit",
  whatsapp: "WhatsApp",
};

const connectablePlatforms: { id: Platform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "twitter", label: "X / Twitter" },
  { id: "telegram", label: "Telegram" },
  { id: "bluesky", label: "Bluesky" },
  { id: "reddit", label: "Reddit" },
  { id: "whatsapp", label: "WhatsApp" },
];

function getPlatformLabel(platform: string): string {
  return (
    platformLabels[platform as Platform] ||
    platform.charAt(0).toUpperCase() + platform.slice(1)
  );
}

function getDmLink(platform: Platform, username: string | null): { url: string | null; label: string } {
  const handle = username || "";
  switch (platform) {
    case "instagram":
      return handle ? { url: `https://ig.me/m/${handle}`, label: `ig.me/m/${handle}` } : { url: null, label: "" };
    case "facebook":
      return handle ? { url: `https://m.me/${handle}`, label: `m.me/${handle}` } : { url: null, label: "" };
    case "telegram":
      return handle ? { url: `https://t.me/${handle}`, label: `t.me/${handle}` } : { url: null, label: "" };
    case "twitter":
      return handle ? { url: `https://x.com/${handle}`, label: `x.com/${handle}` } : { url: null, label: "" };
    case "reddit":
      return handle ? { url: `https://reddit.com/message/compose/?to=${handle}`, label: `reddit.com/.../to=${handle}` } : { url: null, label: "" };
    case "whatsapp":
      return handle ? { url: `https://wa.me/${handle}`, label: `wa.me/${handle}` } : { url: null, label: "" };
    default:
      return { url: null, label: "" };
  }
}

export function ChannelsView({
  channels: initialChannels,
}: {
  channels: Channel[];
  workspaceId: string;
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPlatformPicker, setShowPlatformPicker] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPlatformPicker(false);
      }
    }
    if (showPlatformPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPlatformPicker]);

  async function handleConnect(platform: Platform) {
    setConnecting(platform);
    try {
      const res = await fetch("/api/v1/channels/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setSyncMessage(data.error || "Failed to connect");
        setTimeout(() => setSyncMessage(null), 4000);
        return;
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      setSyncMessage("Failed to start connection");
      setTimeout(() => setSyncMessage(null), 4000);
    } finally {
      setConnecting(null);
      setShowPlatformPicker(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const res = await fetch("/api/v1/channels/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok || data.error) {
        setSyncMessage(data.error || "Sync failed");
        return;
      }

      setChannels(data.channels ?? []);
      const { created, updated, deactivated, conversationsImported = 0 } = data.synced;
      if (created === 0 && updated === 0 && deactivated === 0 && conversationsImported === 0) {
        setSyncMessage("All channels up to date");
      } else {
        const parts = [];
        if (created > 0) parts.push(`${created} added`);
        if (updated > 0) parts.push(`${updated} updated`);
        if (deactivated > 0) parts.push(`${deactivated} deactivated`);
        if (conversationsImported > 0) parts.push(`${conversationsImported} conversations imported`);
        setSyncMessage(parts.join(", "));
      }
      setTimeout(() => setSyncMessage(null), 4000);
    } catch {
      setSyncMessage("Failed to sync. Check your connection.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggleActive(channel: Channel) {
    setTogglingId(channel.id);
    const supabase = createClient();

    const { error } = await supabase
      .from("channels")
      .update({ is_active: !channel.is_active })
      .eq("id", channel.id);

    if (!error) {
      setChannels((prev) =>
        prev.map((c) =>
          c.id === channel.id ? { ...c, is_active: !c.is_active } : c
        )
      );
    }
    setTogglingId(null);
  }

  async function handleDelete() {
    if (!channelToDelete) return;
    const id = channelToDelete.id;
    setChannelToDelete(null);
    setDeletingId(id);

    try {
      const res = await fetch(`/api/v1/channels/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok || data.error) {
        setSyncMessage(data.error || "Failed to delete channel");
        setTimeout(() => setSyncMessage(null), 4000);
        return;
      }

      setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setSyncMessage("Failed to delete channel. Check your connection.");
      setTimeout(() => setSyncMessage(null), 4000);
    } finally {
      setDeletingId(null);
      setChannelToDelete(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Channels</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your connected social media accounts from Zernio
            </p>
          </div>
          <div className="flex items-center gap-3">
            {syncMessage && (
              <span className="text-xs text-muted-foreground">
                {syncMessage}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw
                className={cn("h-4 w-4", syncing && "animate-spin")}
              />
              {syncing ? "Syncing..." : "Sync"}
            </button>
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => setShowPlatformPicker(!showPlatformPicker)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                Connect Channel
              </button>
              {showPlatformPicker && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
                  {connectablePlatforms.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleConnect(p.id)}
                      disabled={connecting === p.id}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      {connecting === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlatformIcon platform={p.id} className="h-4 w-4" size={16} />
                      )}
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Channel cards */}
      <div className="flex-1 overflow-auto p-8">
        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Plug className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No channels yet
            </p>
            <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground/70">
              Connect a social media account to start building flows and
              automating conversations.
            </p>
            <button
              onClick={() => setShowPlatformPicker(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Connect Channel
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => {
              const label = getPlatformLabel(channel.platform);
              return (
                <div
                  key={channel.id}
                  className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Avatar with platform badge */}
                      <div className="relative">
                        {channel.profile_picture ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={channel.profile_picture}
                              alt={channel.display_name ?? channel.username ?? label}
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-background">
                              <PlatformIcon
                                platform={channel.platform}
                                className="h-3 w-3"
                                size={12}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                            <PlatformIcon
                              platform={channel.platform}
                              className="h-5 w-5"
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          {channel.display_name ??
                            channel.username ??
                            label}
                        </p>
                        {channel.username && (
                          <p className="text-xs text-muted-foreground">
                            @{channel.username}
                          </p>
                        )}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {label}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleActive(channel)}
                        disabled={togglingId === channel.id}
                        className={cn(
                          "rounded-lg p-2 transition-colors",
                          channel.is_active
                            ? "text-green-600 hover:bg-green-100"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                        title={
                          channel.is_active
                            ? "Channel is active. Click to deactivate."
                            : "Channel is inactive. Click to activate."
                        }
                      >
                        {channel.is_active ? (
                          <Power className="h-4 w-4" />
                        ) : (
                          <PowerOff className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setChannelToDelete(channel)}
                        disabled={deletingId === channel.id}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-red-100 hover:text-red-600 transition-colors"
                        title="Delete channel"
                      >
                        {deletingId === channel.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        channel.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          channel.is_active
                            ? "bg-green-500"
                            : "bg-muted-foreground"
                        )}
                      />
                      {channel.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Connected{" "}
                      {new Date(channel.created_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  {(() => {
                    const dm = getDmLink(channel.platform as Platform, channel.username);
                    if (!dm.url) return null;
                    return (
                      <div className="mt-3 flex items-center gap-1.5">
                        <a
                          href={dm.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1 text-[11px] font-mono text-primary hover:underline"
                          title={dm.url}
                        >
                          {dm.label}
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(dm.url!);
                            setCopiedId(channel.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                            copiedId === channel.id
                              ? "border-green-200 bg-green-50 text-green-600"
                              : "border-border bg-card text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
                          )}
                          title={copiedId === channel.id ? "Copied!" : "Copy DM link"}
                        >
                          {copiedId === channel.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!channelToDelete}
        title="Delete channel?"
        message={`This disconnects ${
          channelToDelete?.display_name ??
          channelToDelete?.username ??
          (channelToDelete ? getPlatformLabel(channelToDelete.platform) : "this channel")
        } from Zernio and permanently deletes its conversations, contact links, and stats in Zernflow. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setChannelToDelete(null)}
      />
    </div>
  );
}
