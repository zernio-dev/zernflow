"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, MessageCircle, Plus, UserCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReelPicker } from "@/components/reel-picker";
import {
  buildCommentDmFlow,
  defaultCommentDmConfig,
  validateCommentDm,
  type CommentDmConfig,
} from "@/lib/comment-dm-flow";
import { MAX_FOLLOW_CHECKS_LIMIT } from "@/lib/flow-engine/follow-branch";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {step}
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Bubble({ children, from }: { children: React.ReactNode; from: "them" | "us" }) {
  return (
    <div className={cn("flex", from === "us" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-xs",
          from === "us" ? "rounded-tr-md bg-primary text-primary-foreground" : "rounded-tl-md bg-muted"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-primary/40 px-2.5 py-0.5 text-[11px] text-primary">{children}</span>;
}

export function CommentDmWizard({ accountHandle, hasInstagram }: { accountHandle: string; hasInstagram: boolean }) {
  const router = useRouter();
  const [config, setConfig] = useState<CommentDmConfig>(() => defaultCommentDmConfig(accountHandle));
  const [keywordInput, setKeywordInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const pending = useRef(false);

  const set = <K extends keyof CommentDmConfig>(key: K, value: CommentDmConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));
  const setFollow = <K extends keyof CommentDmConfig["follow"]>(key: K, value: CommentDmConfig["follow"][K]) =>
    setConfig((c) => ({ ...c, follow: { ...c.follow, [key]: value } }));

  function addKeyword() {
    const word = keywordInput.trim();
    if (!word) return;
    if (!config.keywords.some((k) => k.toLowerCase() === word.toLowerCase())) set("keywords", [...config.keywords, word]);
    setKeywordInput("");
  }

  async function save(publish: boolean) {
    if (pending.current) return;
    const problem = validateCommentDm(config);
    if (problem) {
      setError(problem);
      return;
    }
    pending.current = true;
    setBusy(publish ? "publish" : "draft");
    setError(null);
    try {
      const res = await fetch("/api/v1/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCommentDmFlow(config)),
      });
      if (!res.ok) throw new Error("Could not save the flow.");
      const flow = await res.json();
      if (publish) {
        const pub = await fetch(`/api/v1/flows/${flow.id}/publish`, { method: "POST" });
        if (!pub.ok) throw new Error("Saved as a draft, but publishing failed. Open it and press Publish.");
      }
      router.push(`/dashboard/flows/${flow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      pending.current = false;
      setBusy(null);
    }
  }

  const f = config.follow;
  const reelText =
    config.postIds.length === 0
      ? "every post"
      : `${config.postIds.length} selected ${config.postIds.length === 1 ? "reel" : "reels"}`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-border px-8 py-6">
        <Link
          href="/dashboard/flows"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Flows
        </Link>
        <h1 className="text-2xl font-bold">Comment to DM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Someone comments a word on your reel and gets a DM with your link. You can ask them to follow first.
        </p>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 p-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {!hasInstagram && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                No Instagram account is connected yet. You can still set this up, but connect one in{" "}
                <Link href="/dashboard/channels" className="underline">
                  Channels
                </Link>{" "}
                before publishing.
              </span>
            </p>
          )}

          <Section step={1} title="Name it">
            <Field label="Flow name">
              <input className={inputClass} value={config.name} onChange={(e) => set("name", e.target.value)} placeholder="Spiti reel: itinerary link" />
            </Field>
          </Section>

          <Section step={2} title="When someone comments" hint="Pick the words that start the DM, and which reels it applies to.">
            <Field label="Keywords" hint="Anyone whose comment contains one of these gets the DM. Not case sensitive.">
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
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  onBlur={addKeyword}
                  placeholder={config.keywords.length ? "Add another" : "Type a word, press Enter (for example SPITI)"}
                  className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm focus:outline-none"
                />
                <button type="button" onClick={addKeyword} disabled={!keywordInput.trim()} aria-label="Add keyword" className="rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-40">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </Field>
            <Field label="Which posts">
              <ReelPicker value={config.postIds} onChange={(ids) => set("postIds", ids)} />
            </Field>
            <Field label="Public reply under the comment (optional)" hint="Leave empty to reply by DM only.">
              <input className={inputClass} value={config.publicReply} onChange={(e) => set("publicReply", e.target.value)} placeholder="Check your DMs 📩" />
            </Field>
          </Section>

          <Section step={3} title="What they get" hint="The DM that carries your link.">
            <Field label="Message">
              <textarea className={cn(inputClass, "min-h-[72px] resize-y")} value={config.message} onChange={(e) => set("message", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
              <Field label="Link">
                <input className={inputClass} value={config.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="https://kaafila.club/spiti" inputMode="url" />
              </Field>
              <Field label="Button text" hint="Max 20 characters">
                <input className={inputClass} value={config.linkLabel} maxLength={20} onChange={(e) => set("linkLabel", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section step={4} title="Ask them to follow first?" hint="They only get the link after they follow your account.">
            <button
              type="button"
              role="switch"
              aria-checked={config.requireFollow}
              onClick={() => set("requireFollow", !config.requireFollow)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                config.requireFollow ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
              )}
            >
              <span className="flex items-center gap-2.5">
                <UserCheck className="h-4 w-4" />
                <span>
                  <span className="block text-sm font-medium">{config.requireFollow ? "Yes, they must follow" : "No, send the link straight away"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {config.requireFollow ? "We check, and ask again if they have not followed." : "Turn on to grow followers with this reel."}
                  </span>
                </span>
              </span>
              <span className={cn("flex h-5 w-9 items-center rounded-full p-0.5 transition-colors", config.requireFollow ? "bg-primary" : "bg-muted")}>
                <span className={cn("h-4 w-4 rounded-full bg-white shadow transition-transform", config.requireFollow && "translate-x-4")} />
              </span>
            </button>

            {config.requireFollow && (
              <div className="space-y-4 border-l-2 border-border pl-4">
                <Field label="First message" hint="Sent right after the comment. It carries the button.">
                  <textarea className={cn(inputClass, "min-h-[64px] resize-y")} value={f.ask} onChange={(e) => setFollow("ask", e.target.value)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <Field label="Button text" hint="Max 20 characters">
                    <input className={inputClass} value={f.buttonLabel} maxLength={20} onChange={(e) => setFollow("buttonLabel", e.target.value)} />
                  </Field>
                  <Field label="Reminder if they have not followed yet">
                    <textarea className={cn(inputClass, "min-h-[64px] resize-y")} value={f.retry} onChange={(e) => setFollow("retry", e.target.value)} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <Field label="Last message if they still have not followed">
                    <textarea className={cn(inputClass, "min-h-[64px] resize-y")} value={f.giveUp} onChange={(e) => setFollow("giveUp", e.target.value)} />
                  </Field>
                  <Field label="Ask up to" hint="times, then stop">
                    <input
                      type="number"
                      min={1}
                      max={MAX_FOLLOW_CHECKS_LIMIT}
                      className={inputClass}
                      value={f.maxChecks}
                      onChange={(e) => setFollow("maxChecks", Number(e.target.value))}
                    />
                  </Field>
                </div>
                <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  Instagram only tells us who follows after the person has tapped the button, so the check happens on the tap.
                  If Instagram can&apos;t confirm, we treat it as not followed yet and ask again.
                </p>
              </div>
            )}
          </Section>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pb-8">
            <button
              type="button"
              onClick={() => save(false)}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              {busy === "draft" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save as draft
            </button>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy === "publish" && <Loader2 className="h-4 w-4 animate-spin" />}
              Publish
            </button>
          </div>
        </div>

        {/* Live preview of what the person sees */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" /> What they see · {reelText}
            </p>
            <div className="space-y-2">
              <Bubble from="them">
                <span className="opacity-60">Comment: </span>
                {config.keywords[0] ?? "your keyword"}
              </Bubble>
              {config.publicReply.trim() && <Bubble from="us">{config.publicReply}</Bubble>}
              <div className="my-2 h-px bg-border" />
              {config.requireFollow ? (
                <>
                  <Bubble from="us">{f.ask || "…"}</Bubble>
                  <div className="flex justify-end">
                    <Chip>{f.buttonLabel || "Button"}</Chip>
                  </div>
                  <p className="pt-1 text-[11px] font-medium text-emerald-600">If they follow</p>
                  <Bubble from="us">
                    {config.message || "…"}
                    {"\n"}
                    {config.linkUrl || "https://…"}
                  </Bubble>
                  <p className="pt-1 text-[11px] font-medium text-amber-600">If not yet</p>
                  <Bubble from="us">{f.retry || "…"}</Bubble>
                  <p className="pt-1 text-[11px] font-medium text-red-500">After {f.maxChecks || 3} tries</p>
                  <Bubble from="us">{f.giveUp || "…"}</Bubble>
                </>
              ) : (
                <Bubble from="us">
                  {config.message || "…"}
                  {"\n"}
                  {config.linkUrl || "https://…"}
                </Bubble>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
