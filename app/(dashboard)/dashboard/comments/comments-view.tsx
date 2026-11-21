"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCw,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useInstagramPosts } from "@/components/use-instagram-posts";
import type { CommentDmConfig } from "@/lib/comment-dm-flow";
import type { ActivityItem } from "@/lib/comment-activity";
import type { PickerPost } from "@/lib/instagram-posts";
import { AutomationEditor } from "./automation-editor";

export interface Automation {
  id: string;
  live: boolean;
  updatedAt: string;
  config: CommentDmConfig;
  stats: { comments: number; dms: number; lastAt: string | null };
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Thumb({ post, className }: { post: PickerPost | null | undefined; className?: string }) {
  return (
    <div className={cn("flex flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted", className)}>
      {post?.picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.picture} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : post === null ? (
        <Layers className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

function Activity({ flowId }: { flowId: string }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/automations/${flowId}/activity`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not load activity.");
        if (!cancelled) setItems(body as ActivityItem[]);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load activity."));
    return () => {
      cancelled = true;
    };
  }, [flowId]);

  if (error) return <p className="px-4 py-3 text-xs text-red-600">{error}</p>;
  if (!items)
    return (
      <p className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </p>
    );
  if (!items.length)
    return <p className="px-4 py-3 text-xs text-muted-foreground">No comments yet. Comment the keyword from another account to test it.</p>;

  return (
    <ul className="divide-y divide-border">
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
          <span className={cn("flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full", it.dmSent ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600")}>
            {it.dmSent ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-medium">{it.who}</span> <span className="text-muted-foreground">commented</span> &ldquo;{it.comment}&rdquo;
            {!it.dmSent && <span className="block text-red-600">{it.error ? `DM failed: ${it.error}` : "DM not sent"}</span>}
          </span>
          <span className="flex-shrink-0 text-muted-foreground">{ago(it.at)}</span>
          {it.conversationId ? (
            <Link href={`/dashboard/inbox?c=${it.conversationId}`} className="inline-flex flex-shrink-0 items-center gap-1 font-medium text-primary hover:underline">
              Open chat <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            <span className="w-[70px] flex-shrink-0 text-right text-muted-foreground">No chat yet</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function CommentsView({
  automations,
  accountHandle,
  hasInstagram,
}: {
  automations: Automation[];
  accountHandle: string;
  hasInstagram: boolean;
}) {
  const router = useRouter();
  const { posts, error, loading, reload } = useInstagramPosts(hasInstagram);
  const [editing, setEditing] = useState<{ automation: Automation | null; post: PickerPost | null } | null>(null);
  const [openActivity, setOpenActivity] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Automation | null>(null);

  const postById = useMemo(() => new Map((posts ?? []).map((p) => [p.id, p])), [posts]);
  const byPost = useMemo(() => {
    const m = new Map<string, Automation>();
    for (const a of automations) for (const id of a.config.postIds) if (!m.has(id)) m.set(id, a);
    return m;
  }, [automations]);
  const everyReel = automations.find((a) => a.config.postIds.length === 0) ?? null;

  /** The reel an automation is for: a post, null for "every reel", undefined when not loaded. */
  const postOf = (a: Automation): PickerPost | null | undefined =>
    a.config.postIds.length === 0 ? null : postById.get(a.config.postIds[0]);

  async function setLive(a: Automation, live: boolean) {
    setBusy(a.id);
    setActionError(null);
    try {
      const res = live
        ? await fetch(`/api/v1/flows/${a.id}/publish`, { method: "POST" })
        : await fetch(`/api/v1/flows/${a.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "draft" }) });
      if (!res.ok) throw new Error(live ? "Could not go live." : "Could not pause.");
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(a: Automation) {
    setToDelete(null);
    setBusy(a.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/flows/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete.");
      router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-border px-8 py-6">
        <h1 className="text-2xl font-bold">Comment to DM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a reel, choose the word people comment, and what they get in their DMs. You can ask them to follow first.
        </p>
      </div>

      <div className="mx-auto max-w-6xl space-y-10 p-8">
        {!hasInstagram && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Connect your Instagram account in{" "}
              <Link href="/dashboard/channels" className="underline">
                Channels
              </Link>{" "}
              to see your reels here.
            </span>
          </p>
        )}
        {actionError && (
          <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" /> {actionError}
          </p>
        )}

        {automations.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold">Your automations</h2>
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {automations.map((a) => {
                const c = a.config;
                return (
                  <div key={a.id}>
                    <div className="flex flex-wrap items-center gap-4 px-4 py-3">
                      <Thumb post={postOf(a)} className="h-14 w-11" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {c.keywords.map((k) => (
                            <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                              {k}
                            </span>
                          ))}
                          {c.requireFollow && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              <UserCheck className="h-3 w-3" /> Follow first
                            </span>
                          )}
                          {c.attachment && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">+ {c.attachment.type}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>
                          <span className="font-semibold text-foreground">{a.stats.comments}</span> comments ·{" "}
                          <span className="font-semibold text-foreground">{a.stats.dms}</span> DMs
                        </p>
                        <p>last {ago(a.stats.lastAt)}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={a.live}
                        aria-label={a.live ? "Pause" : "Go live"}
                        disabled={busy === a.id}
                        onClick={() => setLive(a, !a.live)}
                        className="flex items-center gap-2 text-xs font-medium disabled:opacity-50"
                      >
                        <span className={cn("w-12 text-right", a.live ? "text-emerald-600" : "text-muted-foreground")}>{a.live ? "Live" : "Paused"}</span>
                        <span className={cn("flex h-5 w-9 items-center rounded-full p-0.5 transition-colors", a.live ? "bg-emerald-500" : "bg-muted")}>
                          <span className={cn("h-4 w-4 rounded-full bg-white shadow transition-transform", a.live && "translate-x-4")} />
                        </span>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setOpenActivity((v) => (v === a.id ? null : a.id))}
                          className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent", openActivity === a.id && "bg-accent")}
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Activity
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing({ automation: a, post: postOf(a) ?? null })}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setToDelete(a)}
                          aria-label={`Delete ${c.name}`}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {openActivity === a.id && (
                      <div className="border-t border-border bg-muted/30">
                        <Activity flowId={a.id} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{automations.length ? "Set up another reel" : "Pick a reel to start"}</h2>
            {hasInstagram && (
              <button type="button" onClick={() => void reload()} disabled={loading} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
              </button>
            )}
          </div>

          {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <button
              type="button"
              onClick={() => setEditing({ automation: everyReel, post: null })}
              className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-center hover:bg-accent"
            >
              <Layers className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Every reel</span>
              <span className="text-[11px] text-muted-foreground">{everyReel ? (everyReel.live ? "Live" : "Paused") : "One setup for all posts"}</span>
            </button>

            {loading && !posts &&
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />)}

            {(posts ?? []).map((post) => {
              const a = byPost.get(post.id);
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setEditing({ automation: a ?? null, post })}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border text-left transition-colors",
                    a ? (a.live ? "border-emerald-500" : "border-border") : "border-border hover:border-primary"
                  )}
                >
                  <div className="aspect-[4/5] bg-muted">
                    {post.picture && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.picture} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2.5 pt-8">
                    <p className="line-clamp-2 text-[11px] leading-snug text-white">{post.caption || "No caption"}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/70">
                      <MessageCircle className="h-3 w-3" /> {post.commentCount}
                    </p>
                  </div>
                  {a ? (
                    <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold", a.live ? "bg-emerald-500 text-white" : "bg-black/60 text-white")}>
                      {a.live ? "Live" : "Paused"} · {a.config.keywords[0] ?? ""}
                    </span>
                  ) : (
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      Set up
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {posts && posts.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">No posts found on your Instagram account yet. Use &ldquo;Every reel&rdquo; to cover new posts.</p>
          )}
        </section>
      </div>

      {editing && (
        <AutomationEditor
          automation={editing.automation}
          post={editing.post}
          accountHandle={accountHandle}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this automation?"
        message="People who comment on this reel will no longer get the DM. Past chats stay in your inbox."
        confirmLabel="Delete"
        destructive
        onConfirm={() => toDelete && remove(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
