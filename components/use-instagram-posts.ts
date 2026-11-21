"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PickerPost } from "@/lib/instagram-posts";

/** The connected Instagram account's recent posts and reels, from GET /api/v1/posts. */
export function useInstagramPosts(enabled = true) {
  const [posts, setPosts] = useState<PickerPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requested = useRef(false);

  const reload = useCallback(async () => {
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

  // Load once, the first time it is wanted; reload() refreshes on demand.
  useEffect(() => {
    if (enabled && !requested.current) {
      requested.current = true;
      void reload();
    }
  }, [enabled, reload]);

  return { posts, error, loading, reload };
}
