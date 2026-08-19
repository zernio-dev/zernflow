import Image from "next/image";
import { redirect } from "next/navigation";
import { Database, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SetupWorkspaceForm } from "./setup-workspace-form";

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership) redirect("/dashboard");

  const schemaMissing = error?.code === "PGRST205" || error?.code === "42P01";
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
    /^https:\/\/([^.]+)\.supabase\.co/,
  )?.[1];
  const sqlEditorUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : "https://supabase.com/dashboard";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-16 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_34%)]" />
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.07] p-8 shadow-2xl backdrop-blur-xl sm:p-10">
        <Image src="/logo.png" alt="ZernFlow" width={48} height={48} className="mb-8 rounded-xl" />

        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300">
          {schemaMissing ? <Database className="h-6 w-6" /> : <Wrench className="h-6 w-6" />}
        </div>

        <h1 className="text-3xl font-semibold tracking-tight">
          {schemaMissing ? "Database setup required" : "Finish workspace setup"}
        </h1>
        <p className="mt-3 leading-7 text-slate-300">
          {schemaMissing
            ? "Your Supabase connection works, but the ZernFlow database tables have not been installed yet."
            : "Your account is signed in but does not have a workspace. Create one to continue to the dashboard."}
        </p>

        {schemaMissing ? (
          <div className="mt-8 space-y-4">
            <ol className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-slate-300">
              <li><span className="mr-2 text-sky-300">1.</span>Open the <a href={sqlEditorUrl} target="_blank" rel="noreferrer" className="font-medium text-sky-300 hover:text-sky-200">Supabase SQL Editor</a>.</li>
              <li><span className="mr-2 text-sky-300">2.</span>Copy all of <code className="text-sky-300">supabase/migrations/ALL_MIGRATIONS.sql</code> from this project.</li>
              <li><span className="mr-2 text-sky-300">3.</span>Paste it into a new query and select <strong className="text-white">Run</strong>.</li>
            </ol>
            <p className="text-sm text-slate-400">
              Reload this page after the query succeeds. Migration 17 creates a workspace for accounts that already exist.
            </p>
          </div>
        ) : (
          <SetupWorkspaceForm defaultName={`${user.email?.split("@")[0] || "My"}'s Workspace`} />
        )}
      </div>
    </main>
  );
}
