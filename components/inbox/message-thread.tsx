"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Paperclip, Bot, User, MessageSquare, CheckCircle, Clock, RotateCcw, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/platform-icon";
import type { Database, ConversationStatus } from "@/lib/types/database";

type Message = Database["public"]["Tables"]["messages"]["Row"];
type Conversation = Database["public"]["Tables"]["conversations"]["Row"] & {
  contacts: Database["public"]["Tables"]["contacts"]["Row"] | null;
};

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function shouldShowDateSeparator(
  current: Message,
  previous: Message | undefined
): boolean {
  if (!previous) return true;
  const currentDate = new Date(current.created_at).toDateString();
  const previousDate = new Date(previous.created_at).toDateString();
  return currentDate !== previousDate;
}

function MessageBubble({ message }: { message: Message }) {
  const isInbound = message.direction === "inbound";
  const isBot = message.sent_by_flow_id !== null;

  return (
    <div
      className={cn(
        "flex gap-2",
        isInbound ? "justify-start" : "justify-end"
      )}
    >
      {isInbound && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}

      <div className="max-w-[70%]">
        <div
          className={cn(
            "rounded-2xl px-4 py-2 text-sm",
            isInbound
              ? "rounded-tl-md bg-muted text-foreground"
              : "rounded-tr-md bg-primary text-primary-foreground"
          )}
        >
          {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
          {message.attachments && (
            <div className="mt-1">
              <Paperclip className="inline h-3 w-3" />
              <span className="ml-1 text-xs opacity-70">Pièce jointe</span>
            </div>
          )}
        </div>
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground",
            isInbound ? "justify-start" : "justify-end"
          )}
        >
          {isBot && (
            <Bot className="h-3 w-3" />
          )}
          <span>{formatMessageTime(message.created_at)}</span>
          {!isInbound && message.status !== "sent" && (
            <span className="capitalize">
              {message.status === "delivered"
                ? "Livré"
                : message.status === "failed"
                ? "Échoué"
                : ""}
            </span>
          )}
        </div>
      </div>

      {!isInbound && !isBot && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <User className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      {!isInbound && isBot && (
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
    </div>
  );
}

export function MessageThread({
  conversation,
  messages: initialMessages,
}: {
  conversation: Conversation | null;
  messages: Message[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateConversationStatus = useCallback(async (status: ConversationStatus) => {
    if (!conversation || statusUpdating) return;
    setStatusUpdating(status);
    try {
      const { error } = await createClient()
        .from("conversations")
        .update({ status })
        .eq("id", conversation.id);
      if (error) throw error;
      router.refresh();
    } catch {
      alert(`Impossible de mettre à jour le statut de la conversation`);
    } finally {
      setStatusUpdating(null);
    }
  }, [conversation, statusUpdating, router]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, []);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for conversation updates AND new message inserts for real-time updates
  useEffect(() => {
    if (!conversation) return;

    const supabase = createClient();

    // Subscribe to conversation updates (e.g., status changes, last_message_at)
    const conversationChannel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversation.id}`,
        },
        async () => {
          try {
            const res = await fetch(
              `/api/v1/messages?conversationId=${conversation.id}`
            );
            if (res.ok) {
              const freshMessages = await res.json();
              setMessages((prev) => {
                const optimistic = prev.filter((m) => m.id.startsWith("optimistic-"));
                return [...freshMessages, ...optimistic];
              });
            }
          } catch (err) {
            console.error("Failed to refresh messages:", err);
          }
        }
      )
      .subscribe();

    // Subscribe to new message inserts for immediate display
    const messageChannel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates (optimistic messages or already received)
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [conversation?.id]);

  async function handleSend() {
    if (!input.trim() || !conversation || sending) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic update: add a temporary message immediately
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: conversation.id,
      direction: "outbound",
      text,
      attachments: null,
      quick_reply_payload: null,
      postback_payload: null,
      callback_data: null,
      platform_message_id: null,
      sent_by_flow_id: null,
      sent_by_node_id: null,
      sent_by_user_id: null,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetch("/api/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversation.id, text }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Échec de l'envoi (${res.status})`);
      }

      const confirmedMessage: Message = await res.json();

      // Replace optimistic message with confirmed one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? confirmedMessage : m))
      );
    } catch (err) {
      console.error("Failed to send message:", err);
      // Mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticId ? { ...m, status: "failed" as const } : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
        <h3 className="mt-4 text-sm font-medium text-muted-foreground">
          Sélectionnez une conversation
        </h3>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Choisissez une conversation dans la liste pour voir les messages
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            {conversation.contacts?.avatar_url ? (
              <img
                src={conversation.contacts.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {conversation.contacts?.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-background">
              <PlatformIcon
                platform={conversation.platform}
                className="h-2.5 w-2.5"
                size={10}
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">
              {conversation.contacts?.display_name ?? "Inconnu"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
              conversation.status === "open"
                ? "bg-green-100 text-green-700"
                : conversation.status === "snoozed"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-muted text-muted-foreground"
            )}
          >
            {conversation.status === "open" ? "Ouverte" : conversation.status === "closed" ? "Fermée" : "En attente"}
          </span>
          {conversation.is_automation_paused && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
              Bot en pause
            </span>
          )}
          <div className="flex items-center gap-1">
            {conversation.status !== "closed" && (
              <button
                onClick={() => updateConversationStatus("closed")}
                disabled={!!statusUpdating}
                title="Fermer la conversation"
                aria-label="Fermer la conversation"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                {statusUpdating === "closed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              </button>
            )}
            {conversation.status !== "snoozed" && (
              <button
                onClick={() => updateConversationStatus("snoozed")}
                disabled={!!statusUpdating}
                title="Mettre la conversation en attente"
                aria-label="Mettre la conversation en attente"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                {statusUpdating === "snoozed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
              </button>
            )}
            {conversation.status !== "open" && (
              <button
                onClick={() => updateConversationStatus("open")}
                disabled={!!statusUpdating}
                title="Rouvrir la conversation"
                aria-label="Rouvrir la conversation"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                {statusUpdating === "open" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((message, i) => (
            <div key={message.id}>
              {shouldShowDateSeparator(message, messages[i - 1]) && (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateSeparator(message.created_at)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <MessageBubble message={message} />
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border p-4">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Saisissez un message..."
              rows={1}
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              style={{ maxHeight: 150 }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            aria-label="Envoyer le message"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              input.trim() && !sending
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
