import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  MessageSquare,
  Users,
  Radio,
  MessageCircle,
  Zap,
  CheckCircle,
  TrendingUp,
  Heart,
  Github,
  X,
  Check,
  Sparkles,
  ListOrdered,
  Link2,
} from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="ZernFlow" width={28} height={28} className="rounded-lg" />
            <span className="text-base font-bold text-gray-900">ZernFlow</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="https://github.com/zernio-dev/zernflow"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-900 sm:inline-flex"
            >
              <Github className="h-4 w-4" />
              Voir sur GitHub
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-900"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5">
            <span className="text-xs font-medium text-indigo-700">Licence MIT</span>
            <Link
              href="https://github.com/zernio-dev/zernflow"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-700"
            >
              Voir sur GitHub <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            L'alternative open source à{" "}
            <span className="text-indigo-600">ManyChat</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-500">
            Automatisez les DM, les commentaires et les flux sur Instagram, Facebook, WhatsApp,
            Telegram, X, Bluesky et Reddit. Gratuit, auto-hébergeable et pensé pour les développeurs.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 sm:w-auto"
            >
              Commencer gratuitement
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="https://github.com/zernio-dev/zernflow"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:w-auto"
            >
              <Github className="h-4 w-4" />
              Voir le code source
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-400">Licence MIT. Auto-hébergez ou utilisez notre cloud. Aucune carte bancaire requise.</p>
        </div>

        {/* Flow builder preview */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-xl">
            <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
              <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-300" />
              <span className="ml-3 text-xs text-gray-400">Flux de bienvenue</span>
            </div>
            <div className="relative flex min-h-[300px] items-center justify-center gap-4 p-8 sm:gap-6 sm:p-12"
              style={{
                backgroundImage: "radial-gradient(circle, #e5e7eb 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            >
              {/* Trigger */}
              <div className="w-40 rounded-xl border-2 border-indigo-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50">
                    <MessageCircle className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-900">Déclencheur commentaire</span>
                </div>
                <p className="text-[10px] text-gray-500">Mot-clé : &quot;info&quot;</p>
              </div>

              <div className="hidden h-0.5 w-6 bg-gray-300 sm:block" />

              {/* Send DM */}
              <div className="hidden w-44 rounded-xl border-2 border-emerald-200 bg-white p-4 shadow-sm sm:block">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-900">Envoyer un DM</span>
                </div>
                <p className="text-[10px] text-gray-500">&quot;Salut ! Voici le lien...&quot;</p>
              </div>

              <div className="hidden h-0.5 w-6 bg-gray-300 sm:block" />

              {/* Tag */}
              <div className="w-36 rounded-xl border-2 border-amber-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50">
                    <Users className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-900">Étiqueter comme prospect</span>
                </div>
                <p className="text-[10px] text-gray-500">Étiquette : &quot;intéressé&quot;</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="border-y border-gray-100 bg-gray-50/60 py-10">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-gray-400">Fonctionne avec 7 plateformes (ManyChat n'en prend en charge que 2)</p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              { name: "Instagram", platform: "instagram" },
              { name: "Facebook", platform: "facebook" },
              { name: "WhatsApp", platform: "whatsapp" },
              { name: "Telegram", platform: "telegram" },
              { name: "X / Twitter", platform: "twitter" },
              { name: "Bluesky", platform: "bluesky" },
              { name: "Reddit", platform: "reddit" },
            ].map((p) => (
              <span key={p.platform} className="inline-flex items-center gap-2 text-sm font-medium text-gray-500">
                <PlatformIcon platform={p.platform} size={18} />
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ManyChat comparison */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Pourquoi les équipes quittent ManyChat
            </h2>
            <p className="mt-3 text-base text-gray-500">
              Les mêmes fonctionnalités essentielles. Plus de plateformes. Pas de facture mensuelle.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-3xl">
            <div className="overflow-hidden rounded-2xl border border-gray-200">
              {/* Header */}
              <div className="grid grid-cols-3 border-b border-gray-200 bg-gray-50">
                <div className="px-6 py-4" />
                <div className="border-l border-gray-200 px-6 py-4 text-center">
                  <p className="text-sm font-semibold text-gray-400">ManyChat</p>
                </div>
                <div className="border-l border-gray-200 bg-indigo-50 px-6 py-4 text-center">
                  <p className="text-sm font-semibold text-indigo-600">ZernFlow</p>
                </div>
              </div>
              {/* Rows */}
              {[
                { feature: "Instagram & Facebook", manychat: true, zernflow: true },
                { feature: "WhatsApp", manychat: true, zernflow: true },
                { feature: "Telegram", manychat: false, zernflow: true },
                { feature: "X / Twitter", manychat: false, zernflow: true },
                { feature: "Bluesky & Reddit", manychat: false, zernflow: true },
                { feature: "Constructeur visuel de flux", manychat: true, zernflow: true },
                { feature: "Réponses IA (votre clé)", manychat: true, zernflow: true },
                { feature: "Choix du fournisseur IA", manychat: false, zernflow: true },
                { feature: "Commentaire vers DM", manychat: true, zernflow: true },
                { feature: "Boîte de réception live chat", manychat: true, zernflow: true },
                { feature: "Séquences / campagnes drip", manychat: true, zernflow: true },
                { feature: "CRM contacts", manychat: true, zernflow: true },
                { feature: "Open source", manychat: false, zernflow: true },
                { feature: "Auto-hébergeable", manychat: false, zernflow: true },
                { feature: "Gratuit pour toujours", manychat: false, zernflow: true },
              ].map((row) => (
                <div key={row.feature} className="grid grid-cols-3 border-b border-gray-100 last:border-b-0">
                  <div className="px-6 py-3">
                    <p className="text-sm text-gray-700">{row.feature}</p>
                  </div>
                  <div className="flex items-center justify-center border-l border-gray-100 px-6 py-3">
                    {row.manychat ? (
                      <Check className="h-4 w-4 text-gray-300" />
                    ) : (
                      <X className="h-4 w-4 text-gray-300" />
                    )}
                  </div>
                  <div className="flex items-center justify-center border-l border-gray-100 bg-indigo-50/30 px-6 py-3">
                    <Check className="h-4 w-4 text-indigo-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-gray-50/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Tout ce qu'il faut pour grandir sur les réseaux
            </h2>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: MessageCircle,
                title: "Commentaire vers DM",
                desc: "Quelqu'un commente un mot-clé ? Envoyez instantanément en DM votre lien, votre offre ou votre ressource verrouillée.",
              },
              {
                icon: GitBranch,
                title: "Constructeur visuel de flux",
                desc: "Créez des conversations par glisser-déposer : messages de bienvenue, relances, tunnels de vente. Sans code.",
              },
              {
                icon: Sparkles,
                title: "Réponses IA",
                desc: "Laissez l'IA gérer les conversations. Choisissez OpenAI, Anthropic ou Google. Votre clé API, votre choix.",
              },
              {
                icon: MessageSquare,
                title: "Boîte de réception live chat",
                desc: "Tous vos DM au même endroit. Le bot gère le simple, vous intervenez quand c'est important.",
              },
              {
                icon: Users,
                title: "CRM contacts",
                desc: "Étiquetez votre audience, créez des segments et suivez les interactions. Le bon message aux bonnes personnes.",
              },
              {
                icon: Radio,
                title: "Diffusions",
                desc: "Envoyez des promotions et mises à jour à votre audience. Ciblez par étiquettes, plateforme ou segments.",
              },
              {
                icon: ListOrdered,
                title: "Séquences",
                desc: "Des campagnes drip automatiques. Message, attente, message. Inscrivez les contacts depuis vos flux.",
              },
              {
                icon: Link2,
                title: "Outils de croissance",
                desc: "Générez des liens de démarrage DM pour chaque plateforme. Partagez-les partout pour lancer des conversations.",
              },
              {
                icon: Zap,
                title: "Webhooks et API",
                desc: "Connectez n'importe quel outil. Envoyez les prospects vers Google Sheets, déclenchez Zapier ou appelez des API externes.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-white p-6">
                  <Icon className="mb-3 h-5 w-5 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Open source section */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1">
                <Github className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-500">Licence MIT</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Open source, vraiment.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-gray-500">
                ZernFlow est entièrement open source sous licence MIT. Lisez chaque ligne de code,
                hébergez-le sur votre propre infrastructure ou forkez-le pour l'adapter à vos besoins.
                Pas de piège "open core", pas de fonctionnalités réservées à l'entreprise derrière un paywall.
              </p>
              <p className="mt-3 text-base leading-relaxed text-gray-500">
                Vos automatisations, vos contacts, vos données. Tout vous appartient.
                Aucun verrouillage fournisseur.
              </p>
              <div className="mt-6">
                <Link
                  href="https://github.com/zernio-dev/zernflow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <Github className="h-4 w-4" />
                  Voir le projet sur GitHub
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "7 plateformes, un seul outil", detail: "Instagram, Facebook, WhatsApp, Telegram, X, Bluesky, Reddit. ManyChat n'en couvre que 3." },
                { label: "Gratuit pour toujours", detail: "Pas de frais mensuels. Pas de coût par compte. Pas de limite de fonctionnalités." },
                { label: "Auto-hébergeable", detail: "Clonez le dépôt, configurez vos variables d'environnement et déployez. Votre serveur, vos règles." },
                { label: "Piloté par la communauté", detail: "Construit publiquement. PR bienvenues. Roadmap guidée par les utilisateurs, pas par des investisseurs." },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-gray-200 px-5 py-4">
                  <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-100 bg-gray-50/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            Prêt en 5 minutes
          </h2>
          <div className="mx-auto mt-14 grid max-w-3xl gap-10 sm:grid-cols-3">
            {[
              {
                step: "1",
                icon: CheckCircle,
                title: "Connectez vos comptes",
                desc: "Reliez Instagram, Facebook, WhatsApp, Telegram ou toute autre plateforme en quelques clics.",
              },
              {
                step: "2",
                icon: GitBranch,
                title: "Créez un flux",
                desc: "Utilisez le constructeur visuel pour créer votre automatisation. Choisissez un déclencheur, ajoutez des messages et définissez des conditions.",
              },
              {
                step: "3",
                icon: TrendingUp,
                title: "Regardez la croissance",
                desc: "Vos flux tournent 24/7. Capturez des prospects, répondez aux questions et vendez même pendant votre absence.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="text-center">
                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
                    <Icon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
            Conçu pour les créateurs, les entreprises et les agences
          </h2>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
            {[
              {
                icon: Heart,
                title: "Créateurs",
                desc: "Répondez automatiquement aux commentaires, envoyez des ressources verrouillées en DM et développez votre liste email depuis les réseaux.",
              },
              {
                icon: TrendingUp,
                title: "Petites entreprises",
                desc: "Qualifiez vos prospects via DM, répondez instantanément aux FAQ et réservez des rendez-vous automatiquement.",
              },
              {
                icon: Users,
                title: "Agences",
                desc: "Gérez tous les comptes clients dans un seul espace. Créez des flux une fois, réutilisez-les pour plusieurs marques.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-xl border border-gray-200 bg-white p-6">
                  <Icon className="mb-3 h-5 w-5 text-indigo-500" />
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-2xl bg-indigo-600 p-10 sm:p-14">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Arrêtez de payer pour l'automatisation chat
              </h2>
              <p className="mt-3 text-sm text-indigo-100">
                Passez de ManyChat à ZernFlow en quelques minutes. Importez vos flux, connectez vos comptes et lancez-vous.
                Gratuit pour toujours, open source, licence MIT.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium text-indigo-600 shadow-sm hover:bg-indigo-50"
                >
                  Commencer gratuitement
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="https://github.com/zernio-dev/zernflow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-400 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  <Github className="h-4 w-4" />
                  Voir sur GitHub
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">ZernFlow</span>
            <span className="text-sm text-gray-300">|</span>
            <Link
              href="https://github.com/zernio-dev/zernflow"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </Link>
            <Link
              href="https://zernio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/powered-by-zernio.svg" alt="Propulsé par Zernio" className="h-10" />
            </Link>
          </div>
          <p className="text-xs text-gray-400">
            Open source, licence MIT
          </p>
        </div>
      </footer>
    </div>
  );
}
