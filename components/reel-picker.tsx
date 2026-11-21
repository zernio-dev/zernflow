"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, MessageCircle, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PickerPost } from "@/lib/instagram-posts";

/**
 * Chooses which Instagram posts or reels a comment trigger listens to.
 * "All posts" is an empty list; picking reels fills `value` with their ids.
 */
export function ReelPicker({
  value,
  onChange,
  compact = false,
}: {
  value: string[];
  onChange: (postIds: string[]) => void;
  /** Smaller thumbnails, for the narrow side panel. */
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"all" | "some">(value.length > 0 ? "some" : "all");
  const [posts, setPosts] = useState<PickerPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/posts");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not load your posts.");
      setPosts(body as PickerPost[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch lazily: only when the user chooses specific reels.
  useEffect(() => {
    if (mode === "some" && posts === null && !loading && !error) void load();
  }, [mode, posts, loading, error, load]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  const known = new Set((posts ?? []).map((p) => p.id));
  const orphans = value.filter((id) => posts !== null && !known.has(id));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["all", "Every post", "Any post or reel you publish"],
            ["some", "Specific reels", "Only the ones you pick"],
          ] as const
        ).map(([key, title, hint]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
              if (key === "all") onChange([]);
            }}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              mode === key ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
            )}
          >
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          </button>
        ))}
      </div>

      {mode === "some" && (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {value.length === 0
                ? "Pick one or more. Until you do, this runs on every post."
                : `${value.length} selected`}
            </span>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
            </button>
          </div>

          {loading && posts === null && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your reels...
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>
          )}

          {posts !== null && posts.length === 0 && !error && (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No posts found on your connected Instagram account yet.
            </p>
          )}

          {posts !== null && posts.length > 0 && (
            <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
              {posts.map((post) => {
                const selected = value.includes(post.id);
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => toggle(post.id)}
                    aria-pressed={selected}
                    className={cn(
                      "group relative overflow-hidden rounded-lg border text-left transition-all",
                      selected ? "border-primary ring-2 ring-primary" : "border-border hover:border-input"
                    )}
                  >
                    <div className="aspect-[4/5] w-full bg-muted">
                      {post.picture && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.picture}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="space-y-0.5 p-2">
                      <p className="line-clamp-2 text-[11px] leading-snug">{post.caption || "No caption"}</p>
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MessageCircle className="h-3 w-3" /> {post.commentCount}
                      </p>
                    </div>
                    {selected && (
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {orphans.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {orphans.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                  Older post {id.slice(-6)}
                  <button type="button" onClick={() => toggle(id)} aria-label="Remove" className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
