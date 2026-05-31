"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

export function CreateSequenceButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const pendingRef = useRef(false);

  async function handleCreate() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setCreating(true);

    try {
      const res = await fetch("/api/v1/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Séquence sans titre" }),
      });
      const result = await res.json();

      if (!res.ok || result.error) {
        console.error("Failed to create sequence:", result.error);
        alert(`Impossible de créer la séquence : ${result.error}`);
        return;
      }

      if (result.sequence) {
        router.push(`/dashboard/sequences/${result.sequence.id}`);
      }
    } catch (err) {
      console.error("Failed to create sequence:", err);
      alert(`Impossible de créer la séquence : ${err instanceof Error ? err.message : "Erreur inconnue"}`);
    } finally {
      pendingRef.current = false;
      setCreating(false);
    }
  }

  return (
    <button
      onClick={handleCreate}
      disabled={creating}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {creating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      {creating ? "Création..." : "Nouvelle séquence"}
    </button>
  );
}
