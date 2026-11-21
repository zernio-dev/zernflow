"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronDown, ImagePlus, Loader2, Music, Plus, UserCheck, Video, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPreview } from "@/components/flow-builder/chat-preview";
import {
  buildCommentDmFlow,
  defaultCommentDmConfig,
  validateCommentDm,
  type CommentDmConfig,
} from "@/lib/comment-dm-flow";
import { MAX_FOLLOW_CHECKS_LIMIT } from "@/lib/flow-engine/follow-branch";
import type { PickerPost } from "@/lib/instagram-posts";
import type { Automation } from "./comments-view";

const input =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
          {n}
        </span>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <div className="space-y-3 pl-7">{children}</div>
    </section>
  );
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1 block text-xs font-medium">
      {children} {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
    </span>
  );
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn("flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-primary" : "bg-muted")}
    >
      <span className={cn("h-4 w-4 rounded-full bg-white shadow transition-transform", on && "translate-x-4")} />
    </button>
  );
}

function captionTitle(post: PickerPost | null): string {
  if (!post) return "Every reel";
  const words = post.caption.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  return words ? (words.length > 40 ? `${words.slice(0, 40)}…` : words) : "Reel";
}

const mediaIcon = { image: ImagePlus, video: Video, audio: Music };

/**
 * Set up (or edit) the comment-to-DM automation for one reel: the word people comment, whether
 * they must follow first, and what they get. Saving builds and publishes an ordinary flow.
 */
export function AutomationEditor({
  automation,
  post,
  accountHandle,
  onClose,
  onSaved,
}: {
  automation: Automation | null;
  /** The reel, or null for an "every reel" automation. */
  post: PickerPost | null;
  accountHandle: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [config, setConfig] = useState<CommentDmConfig>(
    () =>
      automation?.config ?? {
        ...defaultCommentDmConfig(accountHandle),
        name: captionTitle(post),
        postIds: post ? [post.id] : [],
      }
  );
  const [live, setLive] = useState(automation?.live ?? true);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof CommentDmConfig>(k: K, v: CommentDmConfig[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setFollow = <K extends keyof CommentDmConfig["follow"]>(k: K, v: CommentDmConfig["follow"][K]) =>
    setConfig((c) => ({ ...c, follow: { ...c.follow, [k]: v } }));
  const setOpener = <K extends keyof CommentDmConfig["opener"]>(k: K, v: CommentDmConfig["opener"][K]) =>
    setConfig((c) => ({ ...c, opener: { ...c.opener, [k]: v } }));

  // The preview runs exactly the flow that Save will create.
  const flow = useMemo(() => buildCommentDmFlow(config), [config]);

  function addKeyword() {
    const word = keyword.trim();
    if (word && !config.keywords.some((k) => k.toLowerCase() === word.toLowerCase())) set("keywords", [...config.keywords, word]);
    setKeyword("");
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("platform", "instagram");
      const res = await fetch("/api/v1/media", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Upload failed.");
      set("attachment", body as CommentDmConfig["attachment"]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const problem = validateCommentDm(config);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify(flow);
      let id = automation?.id;
      if (id) {
        const res = await fetch(`/api/v1/flows/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body });
        if (!res.ok) throw new Error("Could not save.");
      } else {
        const res = await fetch("/api/v1/flows", { method: "POST", headers: { "Content-Type": "application/json" }, body });
        if (!res.ok) throw new Error("Could not save.");
        id = (await res.json()).id as string;
      }
      if (live) {
        // Publishing also re-syncs the trigger (keywords, reel) from what was just saved.
        const res = await fetch(`/api/v1/flows/${id}/publish`, { method: "POST" });
        if (!res.ok) throw new Error("Saved, but it could not go live. Try the switch again.");
      } else if (automation?.live) {
        await fetch(`/api/v1/flows/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "draft" }) });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  const f = config.follow;
  const needsOpener = !!config.attachment && !config.requireFollow;
  const MediaIcon = config.attachment ? mediaIcon[config.attachment.type] : ImagePlus;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div role="dialog" aria-modal="true" aria-label="Comment to DM setup" className="relative flex h-full w-full max-w-5xl flex-col bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <div className="h-12 w-10 flex-shrink-0 overflow-hidden rounded-md bg-muted">
            {post?.picture && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.picture} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <input
              value={config.name}
              onChange={(e) => set("name", e.target.value)}
              aria-label="Name"
              className="w-full truncate bg-transparent text-sm font-semibold focus:outline-none"
            />
            <p className="truncate text-xs text-muted-foreground">{post ? post.caption || "Reel" : "Runs on every reel and post"}</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium">
            {live ? "Live" : "Paused"}
            <Switch on={live} onClick={() => setLive((v) => !v)} label="Live" />
          </label>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
          <div className="space-y-7 p-5 lg:overflow-y-auto">
            <Step n={1} title="When someone comments" hint="Any comment that contains one of these words. Not case sensitive.">
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background p-2">
                {config.keywords.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {k}
                    <button type="button" aria-label={`Remove ${k}`} onClick={() => set("keywords", config.keywords.filter((x) => x !== k))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  onBlur={addKeyword}
                  placeholder={config.keywords.length ? "Add another" : "Type a word and press Enter, e.g. SPITI"}
                  className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm focus:outline-none"
                />
                <button type="button" onClick={addKeyword} disabled={!keyword.trim()} aria-label="Add keyword" className="rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-40">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <label className="block">
                <Label hint="(optional)">Reply under their comment</Label>
                <input className={input} value={config.publicReply} onChange={(e) => set("publicReply", e.target.value)} placeholder="Check your DMs 📩" />
              </label>
            </Step>

            <Step n={2} title="Follow first?" hint="Only people who follow you get it.">
              <div className={cn("flex items-center justify-between rounded-lg border p-3", config.requireFollow ? "border-primary bg-primary/5" : "border-border")}>
                <span className="flex items-center gap-2.5 text-sm">
                  <UserCheck className="h-4 w-4" />
                  {config.requireFollow ? "Yes, they must follow first" : "No, send it straight away"}
                </span>
                <Switch on={config.requireFollow} onClick={() => set("requireFollow", !config.requireFollow)} label="Follow first" />
              </div>
              {config.requireFollow && (
                <>
                  <label className="block">
                    <Label>Message asking them to follow</Label>
                    <textarea className={cn(input, "min-h-[64px] resize-y")} value={f.ask} onChange={(e) => setFollow("ask", e.target.value)} />
                  </label>
                  <label className="block max-w-xs">
                    <Label hint="(max 20 characters)">Button they tap after following</Label>
                    <input className={input} maxLength={20} value={f.buttonLabel} onChange={(e) => setFollow("buttonLabel", e.target.value)} />
                  </label>
                  <details className="group rounded-lg border border-border">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium">
                      If they tap but have not followed yet
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-3 border-t border-border p-3">
                      <label className="block">
                        <Label>Reminder (with the same button)</Label>
                        <textarea className={cn(input, "min-h-[56px] resize-y")} value={f.retry} onChange={(e) => setFollow("retry", e.target.value)} />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                        <label className="block">
                          <Label>Last message, when we stop asking</Label>
                          <textarea className={cn(input, "min-h-[56px] resize-y")} value={f.giveUp} onChange={(e) => setFollow("giveUp", e.target.value)} />
                        </label>
                        <label className="block">
                          <Label>Ask up to</Label>
                          <input type="number" min={1} max={MAX_FOLLOW_CHECKS_LIMIT} className={input} value={f.maxChecks} onChange={(e) => setFollow("maxChecks", Number(e.target.value))} />
                        </label>
                      </div>
                    </div>
                  </details>
                </>
              )}
            </Step>

            <Step n={3} title="What they get" hint="A message, a file, or both.">
              <label className="block">
                <Label>Message</Label>
                <textarea
                  className={cn(input, "min-h-[80px] resize-y")}
                  value={config.message}
                  onChange={(e) => set("message", e.target.value)}
                  placeholder="Here's the itinerary! Links you paste here are clickable."
                />
              </label>

              <div>
                <Label hint="(optional, image, video or audio, max 25 MB)">File</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav"
                  className="hidden"
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {config.attachment ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-2">
                    {config.attachment.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={config.attachment.url} alt="" className="h-12 w-12 rounded object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                        <MediaIcon className="h-5 w-5" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{config.attachment.name}</span>
                    <button type="button" onClick={() => fileRef.current?.click()} className="rounded-md px-2 py-1 text-xs hover:bg-accent">
                      Replace
                    </button>
                    <button type="button" onClick={() => set("attachment", null)} aria-label="Remove file" className="rounded-md p-1 text-muted-foreground hover:bg-accent">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground hover:bg-accent disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {uploading ? "Uploading…" : "Add a file"}
                  </button>
                )}
              </div>

              {needsOpener && (
                <div className="space-y-3 rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    Instagram allows only one text reply to a comment, so a file needs one tap first. This first message carries the button.
                  </p>
                  <label className="block">
                    <Label>First message</Label>
                    <textarea className={cn(input, "min-h-[56px] resize-y")} value={config.opener.text} onChange={(e) => setOpener("text", e.target.value)} />
                  </label>
                  <label className="block max-w-xs">
                    <Label hint="(max 20 characters)">Button</Label>
                    <input className={input} maxLength={20} value={config.opener.buttonLabel} onChange={(e) => setOpener("buttonLabel", e.target.value)} />
                  </label>
                </div>
              )}

              <details className="group rounded-lg border border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium">
                  Add a link button (optional)
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <label className="block">
                    <Label>Link</Label>
                    <input className={input} value={config.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="https://kaafila.club/spiti" inputMode="url" />
                  </label>
                  <label className="block">
                    <Label>Button text</Label>
                    <input className={input} maxLength={20} value={config.linkLabel} onChange={(e) => set("linkLabel", e.target.value)} />
                  </label>
                </div>
              </details>
            </Step>
          </div>

          <div className="border-t border-border p-4 lg:border-l lg:border-t-0">
            <ChatPreview nodes={flow.nodes} edges={flow.edges} accountHandle={accountHandle} className="h-[520px] lg:h-full" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="min-w-0 text-sm text-red-600" role="alert">
            {error && (
              <span className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
              </span>
            )}
          </p>
          <div className="flex flex-shrink-0 gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {live ? "Save and go live" : "Save paused"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
