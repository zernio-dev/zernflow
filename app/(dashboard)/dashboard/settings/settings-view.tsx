"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Settings,
  Key,
  Hash,
  Save,
  Plus,
  X,
  Check,
  Eye,
  EyeOff,
  Plug,
  Loader2,
  ExternalLink,
  Users,
  ChevronRight,
  Sparkles,
  Globe,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface WorkspaceSettings {
  id: string;
  name: string;
  hasApiKey: boolean;
  hasAiKey: boolean;
  globalKeywords: string[];
}

interface TestResult {
  success: boolean;
  accountCount?: number;
  error?: string;
}

export function SettingsView({
  workspace,
}: {
  workspace: WorkspaceSettings;
}) {
  const t = useTranslations("Settings");
  const [name, setName] = useState(workspace.name);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiKey, setAiKey] = useState("");
  const [showAiKey, setShowAiKey] = useState(false);
  const [keywords, setKeywords] = useState<string[]>(workspace.globalKeywords);
  const [newKeyword, setNewKeyword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  function addKeyword() {
    const trimmed = newKeyword.trim().toLowerCase();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) {
      setNewKeyword("");
      return;
    }
    setKeywords((prev) => [...prev, trimmed]);
    setNewKeyword("");
  }

  function removeKeyword(kw: string) {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }

  async function handleTestConnection() {
    const keyToTest = apiKey.trim();
    if (!keyToTest) return;

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/v1/channels/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyToTest, workspaceId: workspace.id }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setTestResult({
          success: false,
          error: data.error || `Connexion échouée (${res.status})`,
        });
        return;
      }

      const accounts = data.accounts || [];
      setTestResult({
        success: true,
        accountCount: accounts.length,
      });

      // Key was saved and channels synced server-side
      setApiKey("");
    } catch {
      setTestResult({
        success: false,
        error: "Impossible de joindre l'API Zernio. Vérifiez votre connexion réseau.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const supabase = createClient();

      const update: {
        name: string;
        global_keywords: string[];
        late_api_key_encrypted?: string;
        ai_api_key?: string;
      } = {
        name: name.trim(),
        global_keywords: keywords,
      };

      // Only update keys if user entered new ones
      if (apiKey.trim()) {
        update.late_api_key_encrypted = apiKey.trim();
      }
      if (aiKey.trim()) {
        update.ai_api_key = aiKey.trim();
      }

      const { error: updateError } = await supabase
        .from("workspaces")
        .update(update)
        .eq("id", workspace.id)
        .select("id")
        .single();

      if (updateError) {
        console.error("Settings save error:", updateError);
        throw new Error(updateError.message);
      }

      setSaved(true);
      setApiKey("");
      setAiKey("");
      setTestResult(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer les paramètres. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez les paramètres de votre espace de travail
        </p>
      </div>

      {/* Settings form */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-8 py-8">
          {/* Workspace name */}
          <section>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Général</h2>
            </div>
            <div className="mt-4">
              <label className="text-xs font-medium text-muted-foreground">
                Nom de l'espace de travail
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </section>

          <hr className="border-border" />

          {/* Language Selector */}
          <section>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{t("Language")}</h2>
            </div>
            <div className="mt-4">
              <label className="text-xs font-medium text-muted-foreground">
                {t("SelectLanguage")}
              </label>
              <div className="mt-1.5 flex gap-2">
                <button
                  onClick={() => {
                    document.cookie = "NEXT_LOCALE=en; path=/; max-age=31536000";
                    window.location.reload();
                  }}
                  className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  {t("English")}
                </button>
                <button
                  onClick={() => {
                    document.cookie = "NEXT_LOCALE=fr; path=/; max-age=31536000";
                    window.location.reload();
                  }}
                  className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  {t("French")}
                </button>
              </div>
            </div>
          </section>

          <hr className="border-border" />

          {/* Zernio API Key */}
          <section>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Zernio API Key</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Votre clé API Zernio sert à connecter vos plateformes sociales.
              {workspace.hasApiKey && " Une clé est actuellement configurée."}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Vous pouvez obtenir votre clé API depuis votre{" "}
              <a
                href="https://zernio.com/dashboard/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80"
              >
                tableau de bord Zernio
                <ExternalLink className="h-3 w-3" />
              </a>
              . Inscrivez-vous sur{" "}
              <a
                href="https://zernio.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:opacity-80"
              >
                zernio.com
              </a>{" "}
              si vous n'avez pas encore de compte.
            </p>

            <div className="mt-4 relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  // Clear test result when key changes
                  if (testResult) setTestResult(null);
                }}
                placeholder={
                  workspace.hasApiKey
                    ? "Saisissez une nouvelle clé pour remplacer l'actuelle"
                    : "Saisissez votre clé API Zernio"
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm font-mono placeholder:text-muted-foreground placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Test Connection button */}
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={!apiKey.trim() || testing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plug className="h-3.5 w-3.5" />
                )}
                {testing ? "Test..." : "Tester la connexion"}
              </button>

              {testResult && testResult.success && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="h-3.5 w-3.5" />
                  Connecté ({testResult.accountCount}{" "}
                  {testResult.accountCount === 1 ? "compte" : "comptes"}{" "}
                  trouvé{testResult.accountCount === 1 ? "" : "s"})
                </span>
              )}

              {testResult && !testResult.success && (
                <span className="text-xs text-red-600">
                  {testResult.error}
                </span>
              )}
            </div>

            {workspace.hasApiKey && !testResult && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3 w-3" />
                Clé API configurée
              </p>
            )}
          </section>

          <hr className="border-border" />

          {/* AI Gateway API Key */}
          <section>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">AI Gateway</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Requis pour le bloc de flux Réponse IA. Utilise{" "}
              <a
                href="https://vercel.com/ai-gateway"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80"
              >
                Vercel AI Gateway
                <ExternalLink className="h-3 w-3" />
              </a>{" "}
              pour accéder aux modèles OpenAI, Anthropic et Google avec une seule clé.
              {workspace.hasAiKey && " Une clé est actuellement configurée."}
            </p>

            <div className="mt-4 relative">
              <input
                type={showAiKey ? "text" : "password"}
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                placeholder={
                  workspace.hasAiKey
                    ? "Saisissez une nouvelle clé pour remplacer l'actuelle"
                    : "Saisissez votre clé API AI Gateway"
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm font-mono placeholder:text-muted-foreground placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowAiKey(!showAiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showAiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {workspace.hasAiKey && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3 w-3" />
                Clé AI Gateway configurée
              </p>
            )}
          </section>

          <hr className="border-border" />

          {/* Global Keywords */}
          <section>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Mots-clés globaux</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Mots-clés qui déclenchent des flux sur tous les canaux. Les déclencheurs propres à un flux sont prioritaires.
            </p>

            {/* Keyword input */}
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Ajouter un mot-clé..."
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={addKeyword}
                disabled={!newKeyword.trim()}
                className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Keyword list */}
            {keywords.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium"
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword(kw)}
                      className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground/70">
                Aucun mot-clé global configuré
              </p>
            )}
          </section>

          <hr className="border-border" />

          {/* Team */}
          <section>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Équipe</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Gérez les membres et les invitations de l'espace de travail.
            </p>
            <Link
              href="/dashboard/settings/team"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Users className="h-4 w-4" />
              Gérer l'équipe
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </section>

          <hr className="border-border" />

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Enregistrer les modifications
                </>
              )}
            </button>

            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" />
                Paramètres enregistrés
              </span>
            )}

            {error && (
              <span className="text-sm text-red-600">
                {error}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
