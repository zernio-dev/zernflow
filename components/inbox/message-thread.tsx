"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Paperclip, Bot, MessageSquare, CheckCircle, Clock, RotateCcw, Loader2, X, Headset } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/platform-icon";
import { ContactAvatar } from "@/components/inbox/contact-avatar";
import { MessageAttachments } from "@/components/inbox/message-attachments";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_BYTES } from "@/lib/inbox-upload";
import { profileUrl } from "@/lib/profile-link";
import type { InboxAttachment } from "@/lib/inbox-messages";
import type { Database, ConversationStatus } from "@/lib/types/database";

type Message = Database["public"]["Tables"]["messages"]["Row"] & { unsupported?: boolean };
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

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], {
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

function asAttachments(value: Message["attachments"]): InboxAttachment[] {
  return Array.isArray(value) ? (value as unknown as InboxAttachment[]) : [];
}

function MessageBubble({
  message,
  contactName,
  contactAvatar,
  showSender,
}: {
  message: Message;
  contactName: string;
  contactAvatar: string | null;
  showSender: boolean;
}) {
  const isInbound = message.direction === "inbound";
  const isBot = message.sent_by_flow_id !== null;
  const attachments = asAttachments(message.attachments);
  const senderLabel = isInbound ? contactName : isBot ? "Bot" : "Team";

  return (
    <div className={cn("flex flex-col", isInbound ? "items-start" : "items-end")}>
      {showSender && (
        <p className={cn("mb-1 text-[11px] font-medium text-muted-foreground", isInbound ? "ml-9" : "mr-9")}>
          {senderLabel}
        </p>
      )}
      <div className={cn("flex w-full gap-2", isInbound ? "justify-start" : "justify-end")}>
        {isInbound && (
          <ContactAvatar name={contactName} src={contactAvatar} className="h-7 w-7 flex-shrink-0 text-xs" />
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
            {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
            {attachments.length > 0 && <MessageAttachments attachments={attachments} />}
            {message.unsupported && (
              <p className="text-xs italic opacity-70">
                This message type (for example a shared reel or story) can&apos;t be shown here. Open it in Instagram.
              </p>
            )}
          </div>
          <div
            className={cn(
              "mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground",
              isInbound ? "justify-start" : "justify-end"
            )}
          >
            <span>{formatMessageTime(message.created_at)}</span>
            {!isInbound && message.status !== "sent" && (
              <span className="capitalize">
                {message.status === "delivered"
                  ? "Delivered"
                  : message.status === "failed"
                  ? "Failed"
                  : ""}
              </span>
            )}
          </div>
        </div>

        {!isInbound && (
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
            {isBot ? <Bot className="h-3.5 w-3.5 text-primary" /> : <Headset className="h-3.5 w-3.5 text-primary" />}
          </div>
        )}
      </div>
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
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      alert(`Failed to update conversation status`);
    } finally {
      setStatusUpdating(null);
    }
  }, [conversation, statusUpdating, router]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // scrollHeight leaves out the 2px border, so add it back or a one-line box shrinks to 38px.
    el.style.height = `${Math.min(el.scrollHeight + 2, 150)}px`;
  }, []);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // A half-written reply or picked file belongs to one conversation.
  useEffect(() => {
    setFile(null);
    setFileError(null);
  }, [conversation?.id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for conversation updates (last_message_at changes when a new message arrives)
  // and re-fetch messages from Zernio API.
  useEffect(() => {
    if (!conversation) return;

    const supabase = createClient();
    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id]);

  function pickFile(picked: File | undefined) {
    if (!picked) return;
    if (picked.size > MAX_ATTACHMENT_BYTES) {
      setFile(null);
      setFileError("Files can be at most 25 MB.");
      return;
    }
    setFileError(null);
    setFile(picked);
  }

  async function handleSend() {
    if ((!input.trim() && !file) || !conversation || sending) return;

    const text = input.trim();
    const sendingFile = file;
    setInput("");
    setFile(null);
    setFileError(null);
    setSending(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Optimistic update: add a temporary message immediately
    const optimisticId = `optimistic-${Date.now()}`;
    const localUrl = sendingFile ? URL.createObjectURL(sendingFile) : null;
    const kind = sendingFile?.type.startsWith("image/")
      ? "image"
      : sendingFile?.type.startsWith("video/")
      ? "video"
      : sendingFile?.type.startsWith("audio/")
      ? "audio"
      : "file";
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: conversation.id,
      direction: "outbound",
      text: text || null,
      attachments: sendingFile
        ? ([{ type: kind, url: localUrl, previewUrl: null, filename: sendingFile.name }] as unknown as Message["attachments"])
        : null,
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
      let res: Response;
      if (sendingFile) {
        const form = new FormData();
        form.set("conversationId", conversation.id);
        if (text) form.set("text", text);
        form.set("file", sendingFile);
        res = await fetch("/api/v1/messages", { method: "POST", body: form });
      } else {
        res = await fetch("/api/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: conversation.id, text }),
        });
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Send failed (${res.status})`);
      }

      const confirmedMessage: Message = await res.json();

      // Replace optimistic message with confirmed one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? confirmedMessage : m))
      );
    } catch (err) {
      console.error("Failed to send message:", err);
      setFileError(err instanceof Error ? err.message : "Failed to send");
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
          Select a conversation
        </h3>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Choose a conversation from the list to view messages
        </p>
      </div>
    );
  }

  const contactName = conversation.contacts?.display_name ?? "Unknown";
  const contactAvatar = conversation.contacts?.avatar_url ?? null;
  // The plain @handle, loaded with the inbox; display names can be styled (upside-down letters, emoji).
  const handle =
    (conversation.contacts as { contact_channels?: Array<{ platform_username: string | null }> } | null)
      ?.contact_channels?.find((c) => c.platform_username)?.platform_username ?? null;
  const profile = profileUrl(conversation.platform, handle);
  const canSend = (!!input.trim() || !!file) && !sending;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <ContactAvatar name={contactName} src={contactAvatar} className="h-8 w-8 text-sm" />
            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-background">
              <PlatformIcon
                platform={conversation.platform}
                className="h-2.5 w-2.5"
                size={10}
              />
            </div>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium">{contactName}</p>
            {handle &&
              (profile ? (
                <a href={profile} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                  @{handle}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">@{handle}</p>
              ))}
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
            {conversation.status}
          </span>
          {conversation.is_automation_paused && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
              Bot paused
            </span>
          )}
          <div className="flex items-center gap-1">
            {conversation.status !== "closed" && (
              <button
                onClick={() => updateConversationStatus("closed")}
                disabled={!!statusUpdating}
                title="Close conversation"
                aria-label="Close conversation"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                {statusUpdating === "closed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              </button>
            )}
            {conversation.status !== "snoozed" && (
              <button
                onClick={() => updateConversationStatus("snoozed")}
                disabled={!!statusUpdating}
                title="Snooze conversation"
                aria-label="Snooze conversation"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                {statusUpdating === "snoozed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
              </button>
            )}
            {conversation.status !== "open" && (
              <button
                onClick={() => updateConversationStatus("open")}
                disabled={!!statusUpdating}
                title="Reopen conversation"
                aria-label="Reopen conversation"
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
        <div className="mx-auto max-w-2xl space-y-2">
          {messages.map((message, i) => {
            const previous = messages[i - 1];
            const newDay = shouldShowDateSeparator(message, previous);
            return (
              <div key={message.id}>
                {newDay && (
                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateSeparator(message.created_at)}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <MessageBubble
                  message={message}
                  contactName={contactName}
                  contactAvatar={contactAvatar}
                  showSender={newDay || !previous || previous.direction !== message.direction}
                />
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-2xl">
          {(file || fileError) && (
            <div className="mb-2 flex items-center gap-2 text-xs">
              {file && (
                <span className="flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
                  <Paperclip className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <button
                    onClick={() => setFile(null)}
                    aria-label="Remove attachment"
                    className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {fileError && <span className="text-red-600">{fileError}</span>}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              aria-label="Attach a file"
              title="Attach an image, video, audio file or PDF"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4" />
            </button>
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
                placeholder="Type a message..."
                rows={1}
                // block + h-10 so the box is exactly as tall as the 40px buttons beside it (an inline
                // textarea leaves a few pixels of baseline gap, which pushed it above the send button).
                className="block h-10 w-full resize-none rounded-lg border border-input bg-background px-4 py-[9px] text-sm leading-5 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                style={{ maxHeight: 150 }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Send message"
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                canSend
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
