"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  MessageSquare,
  HelpCircle,
  UserPlus,
  GitBranch,
  Loader2,
  BookmarkPlus,
  ArrowLeft,
  ShoppingCart,
  Calendar,
  Gift,
  Star,
  TrendingUp,
  Bell,
  RefreshCw,
  Headphones,
  Users,
  Zap,
  Heart,
  Award,
  Package,
  Phone,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// --- Template types ---

interface TemplateNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface TemplateEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

// --- Built-in templates ---

const templates: FlowTemplate[] = [
  // ─── ONBOARDING ───────────────────────────────────────────────
  {
    id: "welcome-flow",
    name: "Flux de bienvenue",
    description:
      "Accueillez les nouveaux abonnés avec un message chaleureux, attendez une minute, puis envoyez une relance pour maintenir l'engagement.",
    category: "Onboarding",
    icon: MessageSquare,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: { label: "Déclencheur de bienvenue", triggerType: "welcome", config: {} },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Message de bienvenue",
          text: "Salut ! Bienvenue ! 👋 Nous sommes ravis de vous accueillir. Comment pouvons-nous vous aider aujourd'hui ?",
        },
      },
      {
        id: "delay-1",
        type: "delay",
        position: { x: 250, y: 300 },
        data: { label: "Attendre 1 minute", duration: 60, unit: "seconds" },
      },
      {
        id: "msg-2",
        type: "sendMessage",
        position: { x: 250, y: 450 },
        data: {
          label: "Relance",
          text: "Au passage, posez-moi toutes vos questions. Je suis là pour vous aider ! 😊",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "delay-1" },
      { id: "e3", source: "delay-1", target: "msg-2" },
    ],
  },
  {
    id: "onboarding-quiz",
    name: "Quiz d'accueil",
    description:
      "Qualifiez les nouveaux prospects avec 3 questions ciblées, étiquetez-les par profil et envoyez une recommandation personnalisée.",
    category: "Onboarding",
    icon: Search,
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: { label: "Nouvel abonné", triggerType: "welcome", config: {} },
      },
      {
        id: "msg-q1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Question 1",
          text: "Bienvenue ! Pour commencer, qu'est-ce qui vous décrit le mieux ?\n\nA) Propriétaire d'entreprise\nB) Freelance\nC) Étudiant",
        },
      },
      {
        id: "wait-1",
        type: "smartDelay",
        position: { x: 250, y: 280 },
        data: { label: "Attendre la réponse", waitForInput: true, timeout: 600 },
      },
      {
        id: "set-role",
        type: "setCustomField",
        position: { x: 250, y: 400 },
        data: { label: "Enregistrer le rôle", fieldSlug: "role", value: "{{last_message}}" },
      },
      {
        id: "msg-rec",
        type: "sendMessage",
        position: { x: 250, y: 530 },
        data: {
          label: "Recommandation personnalisée",
          text: "Merci, {{name}} ! D'après votre profil, voici ce que nous vous recommandons 👇",
        },
      },
      {
        id: "tag-qualified",
        type: "addTag",
        position: { x: 250, y: 660 },
        data: { label: "Étiquette : prospect qualifié", tagName: "qualified-lead" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-q1" },
      { id: "e2", source: "msg-q1", target: "wait-1" },
      { id: "e3", source: "wait-1", target: "set-role" },
      { id: "e4", source: "set-role", target: "msg-rec" },
      { id: "e5", source: "msg-rec", target: "tag-qualified" },
    ],
  },

  // ─── SUPPORT ──────────────────────────────────────────────────
  {
    id: "faq-bot",
    name: "Bot FAQ",
    description:
      'Répondez aux mots-clés "help" ou "faq" en analysant le message et en orientant vers les bonnes réponses.',
    category: "Support",
    icon: HelpCircle,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Déclencheur FAQ",
          triggerType: "keyword",
          config: { keywords: ["help", "faq"] },
        },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 250, y: 150 },
        data: {
          label: "Vérifier le mot-clé",
          conditions: [
            { id: "c1", field: "trigger_keyword", operator: "equals", value: "help" },
          ],
        },
      },
      {
        id: "msg-help",
        type: "sendMessage",
        position: { x: 50, y: 350 },
        data: {
          label: "Réponse d'aide",
          text: "Voici ce que je peux faire pour vous :\n- Informations tarifaires\n- Configuration du compte\n- Support technique\n\nÉcrivez simplement votre question !",
        },
      },
      {
        id: "msg-faq",
        type: "sendMessage",
        position: { x: 450, y: 350 },
        data: {
          label: "Réponse FAQ",
          text: "Voici nos questions les plus fréquentes :\n\n1. Comment démarrer ?\n2. Quelles offres sont disponibles ?\n3. Comment contacter le support ?\n\nRépondez avec un numéro pour plus de détails !",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "condition-1" },
      { id: "e2", source: "condition-1", target: "msg-help", sourceHandle: "true" },
      { id: "e3", source: "condition-1", target: "msg-faq", sourceHandle: "false" },
    ],
  },
  {
    id: "live-agent-handoff",
    name: "Transfert vers un agent",
    description:
      "Détectez les mots-clés de frustration, récupérez le problème du client, puis transférez vers un agent humain et étiquetez la conversation.",
    category: "Support",
    icon: Headphones,
    iconColor: "text-rose-600",
    iconBg: "bg-rose-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Mots-clés de frustration",
          triggerType: "keyword",
          config: { keywords: ["agent", "human", "speak to someone", "not happy"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Accuser réception",
          text: "Je suis désolé de l'entendre ! 😔 Je vous mets en relation avec un agent tout de suite. Pouvez-vous décrire brièvement votre problème ?",
        },
      },
      {
        id: "wait-1",
        type: "smartDelay",
        position: { x: 250, y: 300 },
        data: { label: "Attendre le problème", waitForInput: true, timeout: 300 },
      },
      {
        id: "set-issue",
        type: "setCustomField",
        position: { x: 250, y: 420 },
        data: { label: "Enregistrer le problème", fieldSlug: "support_issue", value: "{{last_message}}" },
      },
      {
        id: "tag-1",
        type: "addTag",
        position: { x: 250, y: 540 },
        data: { label: "Étiquette : besoin d'un humain", tagName: "needs-human" },
      },
      {
        id: "msg-2",
        type: "sendMessage",
        position: { x: 250, y: 660 },
        data: {
          label: "Message de transfert",
          text: "Merci ! Un agent sera avec vous dans quelques minutes. ⏳ Votre numéro de référence est #{{contact_id}}.",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "wait-1" },
      { id: "e3", source: "wait-1", target: "set-issue" },
      { id: "e4", source: "set-issue", target: "tag-1" },
      { id: "e5", source: "tag-1", target: "msg-2" },
    ],
  },

  // ─── MARKETING ────────────────────────────────────────────────
  {
    id: "lead-capture",
    name: "Capture de prospect",
    description:
      "Collectez les informations du prospect étape par étape : demandez le nom, attendez la réponse, enregistrez-la, puis demandez l'email et étiquetez le contact.",
    category: "Marketing",
    icon: UserPlus,
    iconColor: "text-green-600",
    iconBg: "bg-green-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Déclencheur prospect",
          triggerType: "keyword",
          config: { keywords: ["interested", "info", "pricing"] },
        },
      },
      {
        id: "msg-name",
        type: "sendMessage",
        position: { x: 250, y: 120 },
        data: { label: "Demander le nom", text: "Super, je serais ravi de vous aider ! Quel est votre nom ?" },
      },
      {
        id: "wait-name",
        type: "smartDelay",
        position: { x: 250, y: 240 },
        data: { label: "Attendre le nom", waitForInput: true, timeout: 300 },
      },
      {
        id: "set-name",
        type: "setCustomField",
        position: { x: 250, y: 360 },
        data: { label: "Enregistrer le nom", fieldSlug: "name", value: "{{last_message}}" },
      },
      {
        id: "msg-email",
        type: "sendMessage",
        position: { x: 250, y: 480 },
        data: {
          label: "Demander l'email",
          text: "Merci, {{name}} ! Quelle est votre adresse email pour que nous puissions vous envoyer plus de détails ?",
        },
      },
      {
        id: "wait-email",
        type: "smartDelay",
        position: { x: 250, y: 600 },
        data: { label: "Attendre l'email", waitForInput: true, timeout: 300 },
      },
      {
        id: "set-email",
        type: "setCustomField",
        position: { x: 250, y: 720 },
        data: { label: "Enregistrer l'email", fieldSlug: "email", value: "{{last_message}}" },
      },
      {
        id: "tag-lead",
        type: "addTag",
        position: { x: 250, y: 840 },
        data: { label: 'Ajouter l\'étiquette "lead"', tagName: "lead" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-name" },
      { id: "e2", source: "msg-name", target: "wait-name" },
      { id: "e3", source: "wait-name", target: "set-name" },
      { id: "e4", source: "set-name", target: "msg-email" },
      { id: "e5", source: "msg-email", target: "wait-email" },
      { id: "e6", source: "wait-email", target: "set-email" },
      { id: "e7", source: "set-email", target: "tag-lead" },
    ],
  },
  {
    id: "gated-resource-dm",
    name: "Ressource verrouillée en DM",
    description:
      "Déclenchez depuis un mot-clé en commentaire, vérifiez l'abonnement, demandez aux non-abonnés de s'abonner en DM, puis envoyez la ressource promise après confirmation.",
    category: "Marketing",
    icon: Gift,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-100",
    nodes: [
      {
        id: "trigger-comment",
        type: "trigger",
        position: { x: 320, y: 0 },
        data: {
          label: "Mot-clé en commentaire",
          triggerType: "comment_keyword",
          keywords: [
            { value: "prompt", matchType: "contains" },
            { value: "guide", matchType: "contains" },
          ],
        },
      },
      {
        id: "check-subscriber",
        type: "condition",
        position: { x: 320, y: 150 },
        data: {
          label: "Déjà abonné ?",
          logic: "and",
          conditions: [
            { field: "is_subscribed", operator: "equals", value: "true" },
          ],
        },
      },
      {
        id: "deliver-existing",
        type: "action",
        position: { x: 80, y: 340 },
        data: {
          label: "Envoyer la ressource",
          actionType: "privateReply",
          text:
            "Merci pour votre commentaire ! Vous êtes déjà abonné, voici donc la ressource :\n\n{{resource_link}}\n\nBonne découverte !",
        },
      },
      {
        id: "ask-subscribe",
        type: "action",
        position: { x: 560, y: 320 },
        data: {
          label: "Demander l'abonnement",
          actionType: "privateReply",
          text:
            "Presque terminé. Pour recevoir la ressource, abonnez-vous d'abord à ce compte. Ensuite, appuyez sur le bouton de confirmation dans ce DM et je vous l'enverrai.",
        },
      },
      {
        id: "confirm-button",
        type: "sendMessage",
        position: { x: 560, y: 480 },
        data: {
          label: "Bouton de confirmation",
          messages: [
            {
              text: "Une fois abonné, appuyez ci-dessous pour que je vérifie et vous envoie la ressource.",
              buttons: [
                {
                  title: "Je me suis abonné",
                  type: "postback",
                  payload: "CONFIRM_SUBSCRIBED_FOR_RESOURCE",
                },
              ],
            },
          ],
        },
      },
      {
        id: "wait-confirmation",
        type: "action",
        position: { x: 560, y: 640 },
        data: {
          label: "Attendre la confirmation",
          actionType: "smartDelay",
          timeout: 24,
          timeoutUnit: "hours",
        },
      },
      {
        id: "recheck-subscriber",
        type: "condition",
        position: { x: 560, y: 800 },
        data: {
          label: "Abonné maintenant ?",
          logic: "and",
          conditions: [
            { field: "is_subscribed", operator: "equals", value: "true" },
          ],
        },
      },
      {
        id: "deliver-new",
        type: "sendMessage",
        position: { x: 340, y: 980 },
        data: {
          label: "Livrer la ressource",
          messages: [
            {
              text:
                "Parfait, merci pour votre abonnement ! Voici la ressource :\n\n{{resource_link}}\n\nRépondez si vous voulez de l'aide pour l'utiliser.",
            },
          ],
        },
      },
      {
        id: "tag-resource-sent",
        type: "action",
        position: { x: 340, y: 1140 },
        data: {
          label: "Étiqueter ressource envoyée",
          actionType: "addTag",
          action: "add",
          tagName: "resource-sent",
        },
      },
      {
        id: "remind-subscribe",
        type: "sendMessage",
        position: { x: 760, y: 980 },
        data: {
          label: "Pas encore abonné",
          messages: [
            {
              text:
                "Je ne peux pas encore vérifier l'abonnement. Abonnez-vous d'abord, puis appuyez de nouveau sur le bouton de confirmation et je déverrouillerai la ressource.",
              buttons: [
                {
                  title: "Vérifier encore",
                  type: "postback",
                  payload: "CONFIRM_SUBSCRIBED_FOR_RESOURCE",
                },
              ],
            },
          ],
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-comment", target: "check-subscriber" },
      { id: "e2", source: "check-subscriber", target: "deliver-existing", sourceHandle: "true" },
      { id: "e3", source: "check-subscriber", target: "ask-subscribe", sourceHandle: "false" },
      { id: "e4", source: "ask-subscribe", target: "confirm-button" },
      { id: "e5", source: "confirm-button", target: "wait-confirmation" },
      { id: "e6", source: "wait-confirmation", target: "recheck-subscriber" },
      { id: "e7", source: "recheck-subscriber", target: "deliver-new", sourceHandle: "true" },
      { id: "e8", source: "deliver-new", target: "tag-resource-sent" },
      { id: "e9", source: "recheck-subscriber", target: "remind-subscribe", sourceHandle: "false" },
      { id: "e10", source: "remind-subscribe", target: "wait-confirmation" },
    ],
  },
  {
    id: "appointment-booking",
    name: "Prise de rendez-vous",
    description:
      "Qualifiez le prospect avec 2 questions rapides, puis envoyez un lien Calendly pour réserver un appel, entièrement automatisé.",
    category: "Marketing",
    icon: Calendar,
    iconColor: "text-violet-600",
    iconBg: "bg-violet-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Réserver un appel",
          triggerType: "keyword",
          config: { keywords: ["book", "call", "appointment", "demo"] },
        },
      },
      {
        id: "msg-q1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Question budget",
          text: "Super ! Avant de partager le lien, petite question : quelle est votre fourchette de budget mensuel ?\n\nA) Moins de 500 $\nB) 500 $ à 2 000 $\nC) 2 000 $+",
        },
      },
      {
        id: "wait-q1",
        type: "smartDelay",
        position: { x: 250, y: 280 },
        data: { label: "Attendre le budget", waitForInput: true, timeout: 600 },
      },
      {
        id: "set-budget",
        type: "setCustomField",
        position: { x: 250, y: 400 },
        data: { label: "Enregistrer le budget", fieldSlug: "budget", value: "{{last_message}}" },
      },
      {
        id: "msg-q2",
        type: "sendMessage",
        position: { x: 250, y: 530 },
        data: {
          label: "Question calendrier",
          text: "Parfait ! Et quand souhaitez-vous commencer ?\n\nA) Dès que possible\nB) Le mois prochain\nC) Je me renseigne simplement",
        },
      },
      {
        id: "wait-q2",
        type: "smartDelay",
        position: { x: 250, y: 660 },
        data: { label: "Attendre le calendrier", waitForInput: true, timeout: 600 },
      },
      {
        id: "msg-link",
        type: "sendMessage",
        position: { x: 250, y: 790 },
        data: {
          label: "Envoyer Calendly",
          text: "Parfait ! Voici le lien pour réserver votre appel stratégique gratuit de 30 minutes 📅\n\nhttps://calendly.com/your-link\n\nÀ très vite, {{name}} !",
        },
      },
      {
        id: "tag-hot",
        type: "addTag",
        position: { x: 250, y: 920 },
        data: { label: "Étiquette : prospect chaud", tagName: "hot-lead" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-q1" },
      { id: "e2", source: "msg-q1", target: "wait-q1" },
      { id: "e3", source: "wait-q1", target: "set-budget" },
      { id: "e4", source: "set-budget", target: "msg-q2" },
      { id: "e5", source: "msg-q2", target: "wait-q2" },
      { id: "e6", source: "wait-q2", target: "msg-link" },
      { id: "e7", source: "msg-link", target: "tag-hot" },
    ],
  },
  {
    id: "viral-giveaway",
    name: "Concours viral",
    description:
      "Lancez un concours : collectez l'email, confirmez la participation, puis demandez un partage pour obtenir des chances bonus et faire grandir votre audience.",
    category: "Marketing",
    icon: Gift,
    iconColor: "text-pink-600",
    iconBg: "bg-pink-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Mot-clé concours",
          triggerType: "keyword",
          config: { keywords: ["giveaway", "contest", "win", "enter"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Message de participation",
          text: "🎉 Vous participez à notre concours ! Pour confirmer votre participation, quelle est votre adresse email ?",
        },
      },
      {
        id: "wait-email",
        type: "smartDelay",
        position: { x: 250, y: 280 },
        data: { label: "Attendre l'email", waitForInput: true, timeout: 300 },
      },
      {
        id: "set-email",
        type: "setCustomField",
        position: { x: 250, y: 400 },
        data: { label: "Enregistrer l'email", fieldSlug: "email", value: "{{last_message}}" },
      },
      {
        id: "tag-entrant",
        type: "addTag",
        position: { x: 250, y: 520 },
        data: { label: "Étiquette : participant concours", tagName: "giveaway-entrant" },
      },
      {
        id: "msg-share",
        type: "sendMessage",
        position: { x: 250, y: 650 },
        data: {
          label: "Partager pour un bonus",
          text: "✅ Votre participation est confirmée ! Vous voulez 3x plus de chances de gagner ? Partagez cette publication et répondez \"PARTAGÉ\" ci-dessous ! 🚀",
        },
      },
      {
        id: "wait-share",
        type: "smartDelay",
        position: { x: 250, y: 780 },
        data: { label: "Attendre le partage", waitForInput: true, timeout: 1800 },
      },
      {
        id: "tag-bonus",
        type: "addTag",
        position: { x: 250, y: 900 },
        data: { label: "Étiquette : chances bonus", tagName: "bonus-entries" },
      },
      {
        id: "msg-confirm",
        type: "sendMessage",
        position: { x: 250, y: 1020 },
        data: {
          label: "Bonus confirmé",
          text: "🔥 Super ! Vos chances bonus ont été ajoutées. Bonne chance : le gagnant sera annoncé vendredi ! 🤞",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "wait-email" },
      { id: "e3", source: "wait-email", target: "set-email" },
      { id: "e4", source: "set-email", target: "tag-entrant" },
      { id: "e5", source: "tag-entrant", target: "msg-share" },
      { id: "e6", source: "msg-share", target: "wait-share" },
      { id: "e7", source: "wait-share", target: "tag-bonus" },
      { id: "e8", source: "tag-bonus", target: "msg-confirm" },
    ],
  },

  // ─── E-COMMERCE ───────────────────────────────────────────────
  {
    id: "abandoned-cart",
    name: "Relance de panier abandonné",
    description:
      "Réengagez les utilisateurs qui ont consulté un produit sans acheter. Envoyez un rappel après 1 h, puis un code promo après 24 h.",
    category: "E-commerce",
    icon: ShoppingCart,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Panier abandonné",
          triggerType: "keyword",
          config: { keywords: ["cart", "abandoned"] },
        },
      },
      {
        id: "delay-1h",
        type: "delay",
        position: { x: 250, y: 150 },
        data: { label: "Attendre 1 heure", duration: 3600, unit: "seconds" },
      },
      {
        id: "msg-reminder",
        type: "sendMessage",
        position: { x: 250, y: 300 },
        data: {
          label: "Rappel",
          text: "Bonjour {{name}}, vous avez laissé un article dans votre panier ! 🛒 Vos articles sont réservés pour une durée limitée. Prêt à finaliser votre commande ?",
        },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 250, y: 450 },
        data: {
          label: "A-t-il acheté ?",
          conditions: [{ id: "c1", field: "tag", operator: "contains", value: "purchased" }],
        },
      },
      {
        id: "delay-24h",
        type: "delay",
        position: { x: 450, y: 600 },
        data: { label: "Attendre encore 23 heures", duration: 82800, unit: "seconds" },
      },
      {
        id: "msg-discount",
        type: "sendMessage",
        position: { x: 450, y: 750 },
        data: {
          label: "Code promo",
          text: "Dernière chance ! 🔥 Voici 15 % de réduction rien que pour vous : **SAVE15**\n\nUtilisez-le au paiement avant expiration ! ⏰",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "delay-1h" },
      { id: "e2", source: "delay-1h", target: "msg-reminder" },
      { id: "e3", source: "msg-reminder", target: "condition-1" },
      { id: "e4", source: "condition-1", target: "delay-24h", sourceHandle: "false" },
      { id: "e5", source: "delay-24h", target: "msg-discount" },
    ],
  },
  {
    id: "order-status",
    name: "Mises à jour de commande",
    description:
      "Tenez les clients informés avec des confirmations de commande, des notifications d'expédition et des confirmations de livraison en temps réel.",
    category: "E-commerce",
    icon: Package,
    iconColor: "text-cyan-600",
    iconBg: "bg-cyan-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Mot-clé commande",
          triggerType: "keyword",
          config: { keywords: ["order", "tracking", "where is my"] },
        },
      },
      {
        id: "msg-confirm",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Commande confirmée",
          text: "🎉 Commande confirmée ! Votre commande #{{order_id}} a bien été reçue et est en cours de traitement.",
        },
      },
      {
        id: "delay-ship",
        type: "delay",
        position: { x: 250, y: 300 },
        data: { label: "Attendre l'expédition (2 jours)", duration: 172800, unit: "seconds" },
      },
      {
        id: "msg-shipped",
        type: "sendMessage",
        position: { x: 250, y: 450 },
        data: {
          label: "Notification d'expédition",
          text: "📦 Votre commande est en route ! Suivez votre colis ici : {{tracking_link}}\n\nLivraison estimée : 3 à 5 jours ouvrés.",
        },
      },
      {
        id: "delay-deliver",
        type: "delay",
        position: { x: 250, y: 600 },
        data: { label: "Attendre la livraison (4 jours)", duration: 345600, unit: "seconds" },
      },
      {
        id: "msg-delivered",
        type: "sendMessage",
        position: { x: 250, y: 750 },
        data: {
          label: "Confirmation de livraison",
          text: "✅ Votre commande devrait maintenant être livrée ! Vous l'appréciez ? Répondez \"AVIS\" pour partager votre retour et obtenir 10 % sur votre prochaine commande ! 🌟",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-confirm" },
      { id: "e2", source: "msg-confirm", target: "delay-ship" },
      { id: "e3", source: "delay-ship", target: "msg-shipped" },
      { id: "e4", source: "msg-shipped", target: "delay-deliver" },
      { id: "e5", source: "delay-deliver", target: "msg-delivered" },
    ],
  },
  {
    id: "review-request",
    name: "Demande d'avis et témoignage",
    description:
      "Après achat, demandez automatiquement un avis. Orientez les clients satisfaits vers un avis public et les autres vers le support.",
    category: "E-commerce",
    icon: Star,
    iconColor: "text-yellow-600",
    iconBg: "bg-yellow-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Déclencheur post-achat",
          triggerType: "keyword",
          config: { keywords: ["review", "feedback"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Demande de note",
          text: "Bonjour {{name}} ! Comment noteriez-vous votre récente expérience avec nous ?\n\n⭐ 1-2 (Pas terrible)\n⭐⭐⭐ 3 (Correct)\n⭐⭐⭐⭐⭐ 4-5 (Excellent !)",
        },
      },
      {
        id: "wait-rating",
        type: "smartDelay",
        position: { x: 250, y: 280 },
        data: { label: "Attendre la note", waitForInput: true, timeout: 600 },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 250, y: 400 },
        data: {
          label: "Client satisfait ?",
          conditions: [{ id: "c1", field: "last_message", operator: "contains", value: "4" }],
        },
      },
      {
        id: "msg-happy",
        type: "sendMessage",
        position: { x: 50, y: 560 },
        data: {
          label: "Laisser un avis public",
          text: "C'est génial ! 🎉 Pourriez-vous laisser un petit avis ? Cela compte énormément pour nous !\n\n👉 https://g.page/your-business/review",
        },
      },
      {
        id: "msg-unhappy",
        type: "sendMessage",
        position: { x: 450, y: 560 },
        data: {
          label: "Transférer au support",
          text: "Nous sommes vraiment désolés de l'apprendre ! 😔 Laissez-nous corriger cela. Notre équipe support vous contactera sous 24 heures.",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "wait-rating" },
      { id: "e3", source: "wait-rating", target: "condition-1" },
      { id: "e4", source: "condition-1", target: "msg-happy", sourceHandle: "true" },
      { id: "e5", source: "condition-1", target: "msg-unhappy", sourceHandle: "false" },
    ],
  },

  // ─── ENGAGEMENT ───────────────────────────────────────────────
  {
    id: "re-engagement",
    name: "Campagne de réactivation",
    description:
      "Réengagez les abonnés inactifs depuis plus de 30 jours avec une offre attractive et un message personnalisé.",
    category: "Engagement",
    icon: RefreshCw,
    iconColor: "text-teal-600",
    iconBg: "bg-teal-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Déclencheur inactif",
          triggerType: "keyword",
          config: { keywords: ["inactive", "winback"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Vous nous manquez",
          text: "Bonjour {{name}}, vous nous manquez ! 😢 Cela fait un moment que nous n'avons pas échangé. Pouvons-nous vous aider avec quelque chose ?",
        },
      },
      {
        id: "delay-1",
        type: "delay",
        position: { x: 250, y: 300 },
        data: { label: "Attendre 3 jours", duration: 259200, unit: "seconds" },
      },
      {
        id: "msg-offer",
        type: "sendMessage",
        position: { x: 250, y: 450 },
        data: {
          label: "Offre spéciale",
          text: "Toujours là ? 👋 Voici une offre spéciale rien que pour vous : 20 % de réduction sur toute la boutique avec **COMEBACK20** 🎁\n\nL'offre expire dans 48 heures !",
        },
      },
      {
        id: "wait-reply",
        type: "smartDelay",
        position: { x: 250, y: 600 },
        data: { label: "Attendre la réponse", waitForInput: true, timeout: 172800 },
      },
      {
        id: "condition-replied",
        type: "condition",
        position: { x: 250, y: 730 },
        data: {
          label: "A-t-il répondu ?",
          conditions: [{ id: "c1", field: "has_replied", operator: "equals", value: "true" }],
        },
      },
      {
        id: "tag-active",
        type: "addTag",
        position: { x: 50, y: 880 },
        data: { label: "Étiquette : réengagé", tagName: "re-engaged" },
      },
      {
        id: "tag-inactive",
        type: "addTag",
        position: { x: 450, y: 880 },
        data: { label: "Étiquette : perdu", tagName: "churned" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "delay-1" },
      { id: "e3", source: "delay-1", target: "msg-offer" },
      { id: "e4", source: "msg-offer", target: "wait-reply" },
      { id: "e5", source: "wait-reply", target: "condition-replied" },
      { id: "e6", source: "condition-replied", target: "tag-active", sourceHandle: "true" },
      { id: "e7", source: "condition-replied", target: "tag-inactive", sourceHandle: "false" },
    ],
  },
  {
    id: "referral-program",
    name: "Programme de parrainage",
    description:
      "Transformez vos meilleurs clients en ambassadeurs. Donnez-leur un code de parrainage unique et récompensez-les quand leurs amis s'inscrivent.",
    category: "Engagement",
    icon: Users,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Mot-clé parrainage",
          triggerType: "keyword",
          config: { keywords: ["refer", "referral", "invite friend"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Expliquer le programme",
          text: "🤝 Notre programme de parrainage est simple : partagez votre lien unique et vous êtes tous les deux récompensés !\n\nPour chaque ami inscrit, vous recevez 10 $ de crédit. Sans limite !",
        },
      },
      {
        id: "set-ref",
        type: "setCustomField",
        position: { x: 250, y: 300 },
        data: {
          label: "Définir le code de parrainage",
          fieldSlug: "referral_code",
          value: "REF_{{contact_id}}",
        },
      },
      {
        id: "msg-code",
        type: "sendMessage",
        position: { x: 250, y: 430 },
        data: {
          label: "Envoyer le lien de parrainage",
          text: "Voici votre lien de parrainage personnel, {{name}} ! 🎯\n\nhttps://yourapp.com/signup?ref={{referral_code}}\n\nPartagez-le et commencez à gagner !",
        },
      },
      {
        id: "tag-ambassador",
        type: "addTag",
        position: { x: 250, y: 560 },
        data: { label: "Étiquette : ambassadeur", tagName: "brand-ambassador" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "set-ref" },
      { id: "e3", source: "set-ref", target: "msg-code" },
      { id: "e4", source: "msg-code", target: "tag-ambassador" },
    ],
  },
  {
    id: "loyalty-program",
    name: "Récompenses fidélité",
    description:
      "Identifiez les clients VIP selon leur nombre d'achats, puis envoyez-leur des avantages exclusifs et un message de remerciement personnalisé.",
    category: "Engagement",
    icon: Award,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Déclencheur fidélité",
          triggerType: "keyword",
          config: { keywords: ["points", "rewards", "loyalty", "vip"] },
        },
      },
      {
        id: "condition-vip",
        type: "condition",
        position: { x: 250, y: 150 },
        data: {
          label: "Est VIP ?",
          conditions: [{ id: "c1", field: "purchase_count", operator: "greater_than", value: "5" }],
        },
      },
      {
        id: "msg-vip",
        type: "sendMessage",
        position: { x: 50, y: 330 },
        data: {
          label: "Accueil VIP",
          text: "Bienvenue, VIP ! 👑 Vous faites partie de nos clients les plus précieux. Pour vous remercier, voici votre code exclusif de 30 % de réduction : **VIP30**\n\nEn plus, vous avez un accès anticipé à tous les nouveaux produits !",
        },
      },
      {
        id: "msg-standard",
        type: "sendMessage",
        position: { x: 450, y: 330 },
        data: {
          label: "Membre standard",
          text: "Bonjour {{name}} ! 🌟 Vous faites partie de notre programme fidélité. Faites encore 3 achats pour débloquer le statut VIP et des avantages exclusifs ! Il vous en reste {{purchases_remaining}}.",
        },
      },
      {
        id: "tag-vip",
        type: "addTag",
        position: { x: 50, y: 490 },
        data: { label: "Étiquette : VIP", tagName: "vip" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "condition-vip" },
      { id: "e2", source: "condition-vip", target: "msg-vip", sourceHandle: "true" },
      { id: "e3", source: "condition-vip", target: "msg-standard", sourceHandle: "false" },
      { id: "e4", source: "msg-vip", target: "tag-vip" },
    ],
  },

  // ─── AUTOMATION ───────────────────────────────────────────────
  {
    id: "event-reminder",
    name: "Rappel d'événement et webinaire",
    description:
      "Automatisez la promotion de vos événements : collectez les inscriptions, confirmez instantanément, envoyez un rappel 24 h avant et le lien du direct le jour J.",
    category: "Automation",
    icon: Bell,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Mot-clé inscription",
          triggerType: "keyword",
          config: { keywords: ["register", "webinar", "event", "join"] },
        },
      },
      {
        id: "msg-confirm",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Inscription confirmée",
          text: "🎉 Vous êtes inscrit à notre prochain webinaire !\n\n📅 Date : {{event_date}}\n🕐 Heure : {{event_time}}\n\nNous vous enverrons un rappel 24 h avant !",
        },
      },
      {
        id: "set-registered",
        type: "setCustomField",
        position: { x: 250, y: 300 },
        data: { label: "Marquer comme inscrit", fieldSlug: "event_registered", value: "true" },
      },
      {
        id: "delay-24h",
        type: "delay",
        position: { x: 250, y: 430 },
        data: { label: "Attendre jusqu'à 24 h avant", duration: 86400, unit: "seconds" },
      },
      {
        id: "msg-reminder",
        type: "sendMessage",
        position: { x: 250, y: 580 },
        data: {
          label: "Rappel 24 h",
          text: "⏰ Rappel : notre webinaire a lieu demain à {{event_time}} !\n\nVoici ce que nous allons couvrir :\n✅ Sujet 1\n✅ Sujet 2\n✅ Sujet 3\n\nÀ demain !",
        },
      },
      {
        id: "delay-day",
        type: "delay",
        position: { x: 250, y: 730 },
        data: { label: "Attendre le jour de l'événement", duration: 82800, unit: "seconds" },
      },
      {
        id: "msg-live",
        type: "sendMessage",
        position: { x: 250, y: 880 },
        data: {
          label: "Lien du direct",
          text: "🔴 Nous sommes en direct ! Rejoignez le webinaire maintenant :\n\n👉 {{live_link}}\n\nÀ tout de suite, {{name}} !",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-confirm" },
      { id: "e2", source: "msg-confirm", target: "set-registered" },
      { id: "e3", source: "set-registered", target: "delay-24h" },
      { id: "e4", source: "delay-24h", target: "msg-reminder" },
      { id: "e5", source: "msg-reminder", target: "delay-day" },
      { id: "e6", source: "delay-day", target: "msg-live" },
    ],
  },
  {
    id: "upsell-flow",
    name: "Upsell et vente croisée",
    description:
      "Après un achat, recommandez intelligemment des produits complémentaires selon la commande du client afin d'augmenter le revenu.",
    category: "Automation",
    icon: TrendingUp,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Déclencheur achat",
          triggerType: "keyword",
          config: { keywords: ["purchased", "thank you for your order"] },
        },
      },
      {
        id: "delay-1",
        type: "delay",
        position: { x: 250, y: 150 },
        data: { label: "Attendre 2 jours", duration: 172800, unit: "seconds" },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 300 },
        data: {
          label: "Message de vente additionnelle",
          text: "Bonjour {{name}} ! 👋 Vous appréciez votre achat ? Les clients qui ont acheté cela ont aussi aimé :\n\n🔥 Produit A — 29 $\n💎 Produit B — 49 $\n🚀 Pack spécial — 65 $ (13 $ économisés !)",
        },
      },
      {
        id: "wait-reply",
        type: "smartDelay",
        position: { x: 250, y: 450 },
        data: { label: "Attendre l'intérêt", waitForInput: true, timeout: 86400 },
      },
      {
        id: "msg-offer",
        type: "sendMessage",
        position: { x: 250, y: 580 },
        data: {
          label: "Offre limitée",
          text: "Toujours intéressé ? Voici 10 % de réduction si vous l'ajoutez au panier dans les 2 prochaines heures ! ⏳\n\nUtilisez le code : **UPGRADE10**",
        },
      },
      {
        id: "tag-upsell",
        type: "addTag",
        position: { x: 250, y: 710 },
        data: { label: "Étiquette : vente additionnelle ciblée", tagName: "upsell-targeted" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "delay-1" },
      { id: "e2", source: "delay-1", target: "msg-1" },
      { id: "e3", source: "msg-1", target: "wait-reply" },
      { id: "e4", source: "wait-reply", target: "msg-offer" },
      { id: "e5", source: "msg-offer", target: "tag-upsell" },
    ],
  },
  {
    id: "ai-customer-service",
    name: "Bot de service client IA",
    description:
      "Utilisez l'IA pour répondre intelligemment aux questions clients, avec transfert automatique vers un humain si la confiance est faible.",
    category: "Automation",
    icon: Zap,
    iconColor: "text-yellow-600",
    iconBg: "bg-yellow-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "N'importe quel message",
          triggerType: "keyword",
          config: { keywords: ["?", "how", "what", "when", "where", "why", "can you"] },
        },
      },
      {
        id: "ai-1",
        type: "aiResponse",
        position: { x: 250, y: 150 },
        data: {
          label: "Réponse IA",
          systemPrompt:
            "Vous êtes un assistant service client utile. Répondez aux questions de façon concise et professionnelle. Si vous n'êtes pas sûr, dites : 'Je vais vous mettre en relation avec un spécialiste.'",
          model: "openai/gpt-4o-mini",
          temperature: 0.3,
          maxTokens: 300,
          contextMessages: 5,
        },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 250, y: 320 },
        data: {
          label: "Besoin d'un humain ?",
          conditions: [
            { id: "c1", field: "ai_response", operator: "contains", value: "specialist" },
          ],
        },
      },
      {
        id: "tag-escalate",
        type: "addTag",
        position: { x: 50, y: 480 },
        data: { label: "Étiquette : besoin d'un agent", tagName: "needs-agent" },
      },
      {
        id: "msg-end",
        type: "sendMessage",
        position: { x: 450, y: 480 },
        data: {
          label: "Satisfait ?",
          text: "Cela vous a-t-il aidé ? Répondez \"OUI\" si tout est bon, ou posez une autre question ! 😊",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "ai-1" },
      { id: "e2", source: "ai-1", target: "condition-1" },
      { id: "e3", source: "condition-1", target: "tag-escalate", sourceHandle: "true" },
      { id: "e4", source: "condition-1", target: "msg-end", sourceHandle: "false" },
    ],
  },
  {
    id: "phone-number-collector",
    name: "Collecte de numéros de téléphone",
    description:
      "Collectez et validez facilement les numéros de téléphone des contacts, puis étiquetez-les pour vos campagnes SMS.",
    category: "Automation",
    icon: Phone,
    iconColor: "text-green-600",
    iconBg: "bg-green-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Déclencheur demande de téléphone",
          triggerType: "keyword",
          config: { keywords: ["sms", "text me", "phone", "call me"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Demander le téléphone",
          text: "Bien sûr ! Quel est votre numéro de téléphone ? (Incluez l'indicatif pays, ex. +237 6 00 00 00 00)",
        },
      },
      {
        id: "wait-phone",
        type: "smartDelay",
        position: { x: 250, y: 280 },
        data: { label: "Attendre le téléphone", waitForInput: true, timeout: 300 },
      },
      {
        id: "set-phone",
        type: "setCustomField",
        position: { x: 250, y: 400 },
        data: { label: "Enregistrer le téléphone", fieldSlug: "phone", value: "{{last_message}}" },
      },
      {
        id: "tag-sms",
        type: "addTag",
        position: { x: 250, y: 520 },
        data: { label: "Étiquette : abonné SMS", tagName: "sms-subscriber" },
      },
      {
        id: "msg-confirm",
        type: "sendMessage",
        position: { x: 250, y: 640 },
        data: {
          label: "Confirmation",
          text: "✅ Parfait ! Nous avons enregistré votre numéro. Vous recevrez des mises à jour et offres exclusives par SMS. Répondez STOP à tout moment pour vous désabonner.",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "wait-phone" },
      { id: "e3", source: "wait-phone", target: "set-phone" },
      { id: "e4", source: "set-phone", target: "tag-sms" },
      { id: "e5", source: "tag-sms", target: "msg-confirm" },
    ],
  },
  {
    id: "satisfaction-survey",
    name: "Enquête de satisfaction client",
    description:
      "Lancez une enquête rapide de type NPS après un point de contact clé pour mesurer la satisfaction et orienter promoteurs et détracteurs.",
    category: "Automation",
    icon: Heart,
    iconColor: "text-red-600",
    iconBg: "bg-red-100",
    nodes: [
      {
        id: "trigger-1",
        type: "trigger",
        position: { x: 250, y: 0 },
        data: {
          label: "Déclencheur sondage",
          triggerType: "keyword",
          config: { keywords: ["survey", "nps", "rate us"] },
        },
      },
      {
        id: "msg-1",
        type: "sendMessage",
        position: { x: 250, y: 150 },
        data: {
          label: "Question NPS",
          text: "Bonjour {{name}} ! Petite question : sur une échelle de 0 à 10, quelle est la probabilité que vous nous recommandiez à un ami ?\n\n(Répondez avec un nombre)",
        },
      },
      {
        id: "wait-nps",
        type: "smartDelay",
        position: { x: 250, y: 280 },
        data: { label: "Attendre le score", waitForInput: true, timeout: 600 },
      },
      {
        id: "set-nps",
        type: "setCustomField",
        position: { x: 250, y: 400 },
        data: { label: "Enregistrer le score NPS", fieldSlug: "nps_score", value: "{{last_message}}" },
      },
      {
        id: "condition-1",
        type: "condition",
        position: { x: 250, y: 530 },
        data: {
          label: "Promoteur (9-10) ?",
          conditions: [{ id: "c1", field: "nps_score", operator: "greater_than", value: "8" }],
        },
      },
      {
        id: "msg-promoter",
        type: "sendMessage",
        position: { x: 50, y: 690 },
        data: {
          label: "Parcours promoteur",
          text: "Waouh, merci ! 🙌 Pourriez-vous partager un court avis ? Cela nous aide énormément à grandir !\n\n👉 https://g.page/review",
        },
      },
      {
        id: "msg-detractor",
        type: "sendMessage",
        position: { x: 450, y: 690 },
        data: {
          label: "Parcours détracteur",
          text: "Nous sommes désolés de l'apprendre ! 😔 Votre retour compte beaucoup. Pouvez-vous nous dire ce que nous pouvons améliorer ? Un membre de l'équipe vous recontactera personnellement.",
        },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-1", target: "msg-1" },
      { id: "e2", source: "msg-1", target: "wait-nps" },
      { id: "e3", source: "wait-nps", target: "set-nps" },
      { id: "e4", source: "set-nps", target: "condition-1" },
      { id: "e5", source: "condition-1", target: "msg-promoter", sourceHandle: "true" },
      { id: "e6", source: "condition-1", target: "msg-detractor", sourceHandle: "false" },
    ],
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  All: "Tous",
  Onboarding: "Accueil",
  Support: "Support",
  Marketing: "Marketing",
  "E-commerce": "E-commerce",
  Engagement: "Engagement",
  Automation: "Automatisation",
};

const CATEGORIES = ["All", ...Array.from(new Set(templates.map((t) => t.category)))];

// --- Component ---

export function TemplatesView({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const pendingRef = useRef(false);

  async function handleUseTemplate(template: FlowTemplate) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setCreating(template.id);

    try {
      const res = await fetch("/api/v1/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          nodes: template.nodes,
          edges: template.edges,
        }),
      });

      if (!res.ok) {
        throw new Error("Impossible de créer le flux");
      }

      const flow = await res.json();
      router.push(`/dashboard/flows/${flow.id}`);
    } catch (err) {
      console.error("Failed to create flow from template:", err);
      pendingRef.current = false;
      setCreating(null);
    }
  }

  const filteredTemplates = templates.filter((t) => {
    const matchCat = activeCategory === "All" || t.category === activeCategory;
    const matchSearch =
      search === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/dashboard/flows"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Flux
              </Link>
            </div>
            <h1 className="text-2xl font-bold">Modèles de flux</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {templates.length} flux prêts à l'emploi. Démarrez avec un modèle et adaptez-le à vos besoins.
            </p>
          </div>
          <button
            disabled
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-60"
            title="Bientôt disponible"
          >
            <BookmarkPlus className="h-4 w-4" />
            Enregistrer le flux actuel comme modèle
          </button>
        </div>

        {/* Search + filters */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher des modèles..."
              className="h-9 rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 w-56"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Template gallery */}
      <div className="flex-1 overflow-auto p-8">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-10 w-10 text-muted-foreground mb-4 opacity-40" />
            <p className="text-sm font-medium text-muted-foreground">Aucun modèle trouvé</p>
            <p className="mt-1 text-xs text-muted-foreground">Essayez de modifier votre recherche ou votre filtre</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTemplates.map((template) => {
              const isCreating = creating === template.id;
              const Icon = template.icon;
              const nodeCount = template.nodes.length;

              return (
                <div
                  key={template.id}
                  className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-md"
                >
                  {/* Icon + category */}
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        template.iconBg
                      )}
                    >
                      <Icon className={cn("h-5 w-5", template.iconColor)} />
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {CATEGORY_LABELS[template.category] ?? template.category}
                    </span>
                  </div>

                  {/* Name + description */}
                  <h3 className="mt-4 text-sm font-semibold group-hover:text-primary transition-colors">
                    {template.name}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {template.description}
                  </p>

                  {/* Node count */}
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <GitBranch className="h-3 w-3" />
                    <span>
                      {nodeCount} {nodeCount === 1 ? "bloc" : "blocs"}
                    </span>
                  </div>

                  {/* Use template button */}
                  <button
                    onClick={() => handleUseTemplate(template)}
                    disabled={!!creating}
                    className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {isCreating ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Création...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5" />
                        Utiliser le modèle
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
