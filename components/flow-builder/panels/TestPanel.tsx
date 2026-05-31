"use client";

import { useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import {
  X,
  Play,
  MessageSquare,
  GitBranch,
  Clock,
  Tag,
  Sparkles,
  Shuffle,
  Hand,
  ArrowRight,
  Globe,
  AlertCircle,
  CheckCircle2,
  XCircle,
  UserPlus,
  ListOrdered,
  Send,
  Zap,
} from "lucide-react";
import {
  simulateFlow,
  type SimulationStep,
  type SimulationResult,
} from "@/lib/flow-engine/simulator";

interface TestPanelProps {
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onHighlightNode: (nodeId: string) => void;
}

const stepIcons: Record<string, typeof MessageSquare> = {
  trigger: Zap,
  message: MessageSquare,
  condition: GitBranch,
  delay: Clock,
  action: Tag,
  ai_response: Sparkles,
  split: Shuffle,
  smart_delay: Clock,
  human_takeover: Hand,
  go_to_flow: ArrowRight,
  enroll_sequence: ListOrdered,
  subscribe: UserPlus,
  unsubscribe: UserPlus,
  comment_reply: Send,
  private_reply: Send,
  http_request: Globe,
  error: AlertCircle,
  flow_end: CheckCircle2,
};

const stepColors: Record<string, string> = {
  trigger: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950",
  message: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950",
  condition:
    "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950",
  delay: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950",
  action: "text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-950",
  ai_response:
    "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950",
  split: "text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-950",
  smart_delay:
    "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950",
  human_takeover:
    "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
  go_to_flow: "text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-950",
  enroll_sequence:
    "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950",
  subscribe: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950",
  unsubscribe: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
  comment_reply:
    "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950",
  private_reply:
    "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950",
  http_request:
    "text-cyan-600 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-950",
  error: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
  flow_end: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950",
};

export function TestPanel({
  nodes,
  edges,
  onClose,
  onHighlightNode,
}: TestPanelProps) {
  const [message, setMessage] = useState("help");
  const [tags, setTags] = useState("");
  const [result, setResult] = useState<SimulationResult | null>(null);

  function runTest() {
    const mockTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const sim = simulateFlow(nodes, edges, {
      incomingMessage: message,
      mockContact: {
        tags: mockTags,
        isSubscribed: true,
      },
    });

    setResult(sim);
  }

  function renderStepDetail(step: SimulationStep) {
    const r = step.result;

    switch (r.type) {
      case "trigger":
        return (
          <div>
            <span className="text-xs text-muted-foreground">
              Type : {r.triggerType}
              {r.keywords && ` | Mots-clés : ${r.keywords.join(", ")}`}
            </span>
            <div className="mt-1">
              {r.matched ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> Correspondance
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                  <XCircle className="h-3 w-3" /> Pas de correspondance
                </span>
              )}
            </div>
          </div>
        );

      case "message":
        return (
          <div className="space-y-1">
            {r.texts.map((text, i) => (
              <div
                key={i}
                className="rounded-lg bg-primary/10 px-3 py-2 text-xs"
              >
                {text}
              </div>
            ))}
            {r.buttons && r.buttons.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {r.buttons.map((b, i) => (
                  <span
                    key={i}
                    className="rounded-md border border-border px-2 py-0.5 text-[10px]"
                  >
                    {b.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        );

      case "condition":
        return (
          <div>
            <div className="space-y-0.5">
              {r.conditions.map((c, i) => (
                <p key={i} className="text-xs text-muted-foreground font-mono">
                  {c}
                </p>
              ))}
            </div>
            <div className="mt-1">
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${
                  r.result ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {r.result ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {r.result ? "VRAI" : "FAUX"} &rarr; chemin {r.path === "yes" ? "oui" : "non"}
              </span>
            </div>
          </div>
        );

      case "delay":
        return (
          <p className="text-xs text-muted-foreground">
            Attendrait {r.duration} {r.unit}{" "}
            <span className="text-amber-600">(ignoré pendant le test)</span>
          </p>
        );

      case "action":
        return (
          <p className="text-xs text-muted-foreground">{r.detail}</p>
        );

      case "ai_response":
        return (
          <p className="text-xs text-muted-foreground">
            {r.mode === "skipped"
              ? "L'IA générerait une réponse ici"
              : r.text}
          </p>
        );

      case "split":
        return (
          <p className="text-xs text-muted-foreground">
            Sélection aléatoire : <strong>{r.selectedPath}</strong> (poids :{" "}
            {r.weight})
          </p>
        );

      case "smart_delay":
        return (
          <p className="text-xs text-muted-foreground">
            Attendrait le prochain message utilisateur{" "}
            <span className="text-amber-600">(en pause)</span>
          </p>
        );

      case "human_takeover":
        return (
          <p className="text-xs text-muted-foreground">
            Automatisation en pause, signalée pour revue humaine
          </p>
        );

      case "go_to_flow":
        return (
          <p className="text-xs text-muted-foreground">
            Irait vers le flux : <span className="font-mono">{r.flowId}</span>
          </p>
        );

      case "enroll_sequence":
        return (
          <p className="text-xs text-muted-foreground">
            Inscrirait à la séquence :{" "}
            <span className="font-mono">{r.sequenceId}</span>
          </p>
        );

      case "subscribe":
        return (
          <p className="text-xs text-muted-foreground">
            Le contact serait abonné
          </p>
        );

      case "unsubscribe":
        return (
          <p className="text-xs text-muted-foreground">
            Le contact serait désabonné
          </p>
        );

      case "comment_reply":
        return (
          <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs">
            {r.text || "(vide)"}
          </div>
        );

      case "private_reply":
        return (
          <div className="rounded-lg bg-primary/10 px-3 py-2 text-xs">
            {r.text || "(vide)"}
          </div>
        );

      case "http_request":
        return (
          <p className="text-xs text-muted-foreground font-mono">
            {r.method} {r.url}
          </p>
        );

      case "error":
        return (
          <p className="text-xs text-red-600">{r.message}</p>
        );

      case "flow_end":
        return (
          <p className="text-xs text-emerald-600 font-medium">
            Flux terminé avec succès
          </p>
        );

      default:
        return null;
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[min(20rem,calc(100vw-1rem))] flex-col border-l border-border bg-card shadow-xl md:relative md:inset-auto md:z-auto md:w-80 md:shadow-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Tester le flux</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Config */}
      <div className="space-y-3 border-b border-border p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Message simulé
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Saisissez un message de test..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter") runTest();
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Étiquettes fictives (séparées par des virgules)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="vip, premium"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={runTest}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Play className="h-3.5 w-3.5" />
          Lancer le test
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {!result ? (
          <div className="py-8 text-center">
            <Play className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Lancez un test pour voir le chemin du flux
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Le simulateur trace le chemin d'exécution sans envoyer de vrais
              messages.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="mb-3 space-y-1">
                {result.errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-2"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                    <p className="text-xs text-red-700 dark:text-red-400">
                      {err}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Steps timeline */}
            {result.steps.map((step, i) => {
              const Icon =
                stepIcons[step.result.type] || AlertCircle;
              const colorClass =
                stepColors[step.result.type] || stepColors.error;
              const isLast = i === result.steps.length - 1;

              return (
                <div key={i} className="flex gap-3">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colorClass}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    {!isLast && (
                      <div className="w-px flex-1 bg-border" />
                    )}
                  </div>

                  {/* Content */}
                  <div
                    className="min-w-0 flex-1 pb-4 cursor-pointer"
                    onClick={() => onHighlightNode(step.nodeId)}
                  >
                    <p className="text-xs font-medium leading-7">
                      {step.nodeLabel}
                    </p>
                    {renderStepDetail(step)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
