"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

export function CreateFlowButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const pendingRef = useRef(false);

  async function handleCreate() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setCreating(true);

    try {
      const res = await fetch("/api/v1/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Flux sans titre" }),
      });

      if (!res.ok) {
        console.error("Failed to create flow");
        alert("Impossible de créer le flux. Réessayez.");
        return;
      }

      const flow = await res.json();
      router.push(`/dashboard/flows/${flow.id}`);
    } catch (err) {
      console.error("Failed to create flow:", err);
      alert("Impossible de créer le flux. Réessayez.");
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
      {creating ? "Création..." : "Nouveau flux"}
    </button>
  );
}
