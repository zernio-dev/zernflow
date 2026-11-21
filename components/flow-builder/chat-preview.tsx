"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, CircleX, Info, Link2, Paperclip, RotateCcw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  startPreview,
  tapPreview,
  type PreviewEdge,
  type PreviewItem,
  type PreviewNode,
  type PreviewState,
} from "@/lib/flow-engine/chat-preview";

const noteStyle = {
  good: { icon: CheckCircle2, classes: "text-emerald-600" },
  warn: { icon: CircleAlert, classes: "text-amber-600" },
  bad: { icon: CircleX, classes: "text-red-500" },
  info: { icon: Info, classes: "text-muted-foreground" },
} as const;

function firstKeyword(nodes: PreviewNode[]): string {
  const trigger = nodes.find((n) => n.type === "trigger");
  const k = ((trigger?.data ?? {}) as { keywords?: Array<string | { value: string }> }).keywords?.[0];
  return (typeof k === "string" ? k : k?.value) ?? "";
}

/**
 * Try the flow as the person on Instagram would: type a comment, tap the buttons, and switch
 * "they follow us" on or off to see each path. A dry run, nothing is sent.
 */
export function ChatPreview({
  nodes,
  edges,
  accountHandle,
  className,
}: {
  nodes: PreviewNode[];
  edges: PreviewEdge[];
  accountHandle?: string;
  className?: string;
}) {
  // Until the person types their own comment, the box follows the flow's first keyword.
  const [typedComment, setTypedComment] = useState<string | null>(null);
  const comment = typedComment ?? firstKeyword(nodes);
  const [follows, setFollows] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // A run belongs to the flow it was started on: any edit to the flow drops it, so what you
  // see is always the current flow.
  const signature = useMemo(() => JSON.stringify([nodes, edges]), [nodes, edges]);
  const [run, setRun] = useState<{ signature: string; state: PreviewState } | null>(null);
  const state = run && run.signature === signature ? run.state : null;
  const setState = (next: PreviewState | null | ((s: PreviewState | null) => PreviewState | null)) =>
    setRun((prev) => {
      const current = prev && prev.signature === signature ? prev.state : null;
      const resolved = typeof next === "function" ? next(current) : next;
      return resolved ? { signature, state: resolved } : null;
    });

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [state?.items.length]);

  const start = () => setState(startPreview(nodes, edges, comment.trim(), follows));
  const lastUs = state ? state.items.map((i) => i.kind).lastIndexOf("us") : -1;
  const handle = accountHandle ? `@${accountHandle}` : "your account";

  function renderItem(item: PreviewItem, index: number) {
    switch (item.kind) {
      case "comment":
        return (
          <div key={index} className="rounded-lg border border-border bg-background p-2.5 text-xs">
            <span className="font-semibold">them</span> <span className="text-muted-foreground">commented</span>
            <p className="mt-0.5">{item.text || "…"}</p>
          </div>
        );
      case "public_reply":
        return (
          <div key={index} className="ml-4 rounded-lg border border-border bg-background p-2.5 text-xs">
            <span className="font-semibold">{handle}</span> <span className="text-muted-foreground">replied</span>
            <p className="mt-0.5">{item.text}</p>
          </div>
        );
      case "them":
        return (
          <div key={index} className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-3 py-2 text-xs">{item.text}</div>
          </div>
        );
      case "us": {
        const live = !!state?.waitingNodeId && index === lastUs;
        return (
          <div key={index} className="flex flex-col items-end gap-1.5">
            {(item.text || !item.media) && (
              <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-primary px-3 py-2 text-xs text-primary-foreground">
                {item.text || "(empty message)"}
              </div>
            )}
            {item.media &&
              (item.media.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.media.url} alt="" className="max-h-40 max-w-[70%] rounded-xl object-cover" />
              ) : (
                <span className="inline-flex items-center gap-1 rounded-xl bg-primary/15 px-3 py-2 text-[11px] font-medium text-primary">
                  <Paperclip className="h-3 w-3" /> {item.media.type === "video" ? "Video" : "Audio"} attached
                </span>
              ))}
            {item.links.map((title) => (
              <span key={title} className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2.5 py-1 text-[11px] text-primary">
                <Link2 className="h-3 w-3" /> {title}
              </span>
            ))}
            {item.quickReplies.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {item.quickReplies.map((title) => (
                  <button
                    key={title}
                    type="button"
                    disabled={!live}
                    onClick={() => setState((s) => (s ? tapPreview(nodes, edges, s, title, follows) : s))}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                      live ? "border-primary text-primary hover:bg-primary hover:text-primary-foreground" : "border-border text-muted-foreground opacity-60"
                    )}
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      }
      case "note": {
        const { icon: Icon, classes } = noteStyle[item.tone];
        return (
          <p key={index} className={cn("flex items-center justify-center gap-1.5 py-0.5 text-center text-[11px] font-medium", classes)}>
            <Icon className="h-3.5 w-3.5 flex-shrink-0" /> {item.text}
          </p>
        );
      }
    }
  }

  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-card", className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <p className="text-xs font-semibold">Try it</p>
        <button
          type="button"
          onClick={() => setState(null)}
          disabled={!state}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <RotateCcw className="h-3 w-3" /> Restart
        </button>
      </div>

      <div className="space-y-2 border-b border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
          className="flex gap-2"
        >
          <input
            value={comment}
            onChange={(e) => setTypedComment(e.target.value)}
            placeholder="Type a comment, like your keyword"
            aria-label="Their comment"
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <Send className="h-3 w-3" /> Comment
          </button>
        </form>
        <label className="flex cursor-pointer items-center justify-between gap-2 text-xs">
          <span>
            They follow {handle}
            <span className="block text-[10px] text-muted-foreground">Flip it, then tap the button, to see both paths</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={follows}
            onClick={() => setFollows((v) => !v)}
            className={cn("flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors", follows ? "bg-primary" : "bg-muted")}
          >
            <span className={cn("h-4 w-4 rounded-full bg-white shadow transition-transform", follows && "translate-x-4")} />
          </button>
        </label>
      </div>

      <div ref={scroller} className="min-h-[220px] flex-1 space-y-2 overflow-y-auto p-3">
        {state === null ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Press <strong>Comment</strong> to see what the person gets.
          </p>
        ) : (
          state.items.map(renderItem)
        )}
        {state?.waitingNodeId && (
          <p className="pt-1 text-center text-[11px] text-muted-foreground">Waiting for them to tap the button…</p>
        )}
        {state?.ended && <p className="pt-1 text-center text-[11px] text-muted-foreground">End of flow</p>}
      </div>
    </div>
  );
}
