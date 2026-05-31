"use client";

import { useState, useEffect } from "react";
import { Search, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/platform-icon";
import type { Database, Platform, ConversationStatus } from "@/lib/types/database";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"] & {
  contacts: Database["public"]["Tables"]["contacts"]["Row"] | null;
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) {
    return date.toLocaleDateString("fr-FR", { weekday: "short" });
  }
  return date.toLocaleDateString("fr-FR", { month: "short", day: "numeric" });
}

export function ConversationList({
  conversations: initialConversations,
  workspaceId,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[];
  workspaceId: string;
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">("open");

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  // Subscribe to conversation updates via Realtime
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("conversations-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Database["public"]["Tables"]["conversations"]["Row"];
            setConversations((prev) =>
              prev
                .map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
                .sort((a, b) => {
                  const aTime = a.last_message_at ?? a.created_at;
                  const bTime = b.last_message_at ?? b.created_at;
                  return new Date(bTime).getTime() - new Date(aTime).getTime();
                })
            );
          } else if (payload.eventType === "INSERT") {
            const inserted = payload.new as Database["public"]["Tables"]["conversations"]["Row"];
            // Fetch full conversation with contact
            const { data } = await supabase
              .from("conversations")
              .select("*, contacts(*)")
              .eq("id", inserted.id)
              .single();
            if (data) {
              setConversations((prev) => [data as Conversation, ...prev]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const filtered = conversations.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (search) {
      const name = c.contacts?.display_name?.toLowerCase() ?? "";
      const preview = c.last_message_preview?.toLowerCase() ?? "";
      const q = search.toLowerCase();
      if (!name.includes(q) && !preview.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="flex h-full flex-col border-r border-border bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-semibold">Boîte de réception</h2>
        <span className="text-xs text-muted-foreground">
          {filtered.length} conversation{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher une conversation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 px-3 pb-2">
        {(["all", "open", "closed", "snoozed"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              statusFilter === status
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {status === "all" ? "Tous" : status === "open" ? "Ouvertes" : status === "closed" ? "Fermées" : "En attente"}
          </button>
        ))}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Aucune conversation trouvée</p>
          </div>
        ) : (
          filtered.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation)}
              className={cn(
                "flex w-full items-start gap-3 border-b border-border p-3 text-left transition-colors hover:bg-accent/50",
                selectedId === conversation.id && "bg-accent"
              )}
            >
              {/* Avatar with platform badge */}
              <div className="relative flex-shrink-0">
                {conversation.contacts?.avatar_url ? (
                  <img
                    src={conversation.contacts.avatar_url}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {conversation.contacts?.display_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-background bg-background">
                  <PlatformIcon
                    platform={conversation.platform}
                    className="h-3 w-3"
                    size={12}
                  />
                </div>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium">
                    {conversation.contacts?.display_name ?? "Inconnu"}
                  </p>
                  <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                    {formatTime(conversation.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {conversation.last_message_preview ?? "Aucun message pour le moment"}
                  </p>
                  {conversation.unread_count > 0 && (
                    <span className="ml-2 flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
