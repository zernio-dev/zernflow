"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { createWorkspace } from "@/lib/actions/workspace";

export function SetupWorkspaceForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await createWorkspace(name);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="workspace-name" className="mb-2 block text-sm font-medium text-slate-200">
          Workspace name
        </label>
        <input
          id="workspace-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
        />
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {loading ? "Creating workspace..." : "Continue to dashboard"}
      </button>
    </form>
  );
}
