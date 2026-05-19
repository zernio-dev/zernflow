"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, Loader2, GitBranch, FileJson, X } from "lucide-react";
import type { Json } from "@/lib/types/database";

interface FlowExportData {
  name: string;
  description?: string | null;
  nodes: Json;
  edges: Json;
  version: number;
  exportedAt: string;
  source: "zernflow";
}

function isValidFlowData(data: unknown): data is FlowExportData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.name === "string" &&
    Array.isArray(d.nodes) &&
    Array.isArray(d.edges)
  );
}

export function ExportFlowButton({
  flow,
}: {
  flow: { id: string; name: string; nodes: Json; edges: Json; description?: string | null; version?: number };
}) {
  function handleExport(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const exportData: FlowExportData = {
      name: flow.name,
      description: flow.description || null,
      nodes: flow.nodes,
      edges: flow.edges,
      version: flow.version || 1,
      exportedAt: new Date().toISOString(),
      source: "zernflow",
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.flow.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground transition-colors"
      aria-label={`Export ${flow.name}`}
    >
      <Download className="h-3.5 w-3.5" />
    </button>
  );
}

export function ImportFlowButton() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FlowExportData | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!isValidFlowData(data)) {
        throw new Error("Invalid flow file. Expected name, nodes, and edges.");
      }

      setPreview(data);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON file");
      } else {
        setError(err instanceof Error ? err.message : "Invalid file");
      }
      setTimeout(() => setError(null), 4000);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleConfirmImport() {
    if (!preview) return;

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: preview.name + " (imported)",
          description: preview.description || null,
          nodes: preview.nodes,
          edges: preview.edges,
        }),
      });

      if (!res.ok) {
        let errorMsg = "Failed to import flow";
        try {
          const err = await res.json();
          errorMsg = err.error || errorMsg;
        } catch {
          errorMsg = `Server returned ${res.status}`;
        }
        throw new Error(errorMsg);
      }

      const flow = await res.json();
      setPreview(null);
      router.push(`/dashboard/flows/${flow.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import");
      setTimeout(() => setError(null), 4000);
    } finally {
      setImporting(false);
    }
  }

  const nodeCount = preview ? (Array.isArray(preview.nodes) ? preview.nodes.length : 0) : 0;
  const edgeCount = preview ? (Array.isArray(preview.edges) ? preview.edges.length : 0) : 0;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.flow.json"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
      >
        {importing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {importing ? "Importing..." : "Import"}
      </button>

      {error && (
        <span className="text-xs font-medium text-destructive">{error}</span>
      )}

      {/* Import preview */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPreview(null)}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{preview.name}</p>
                <p className="text-xs text-muted-foreground">
                  {nodeCount} {nodeCount === 1 ? "node" : "nodes"} · {edgeCount} {edgeCount === 1 ? "connection" : "connections"}
                </p>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-xs font-medium text-destructive">{error}</p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
