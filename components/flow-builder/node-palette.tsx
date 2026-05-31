"use client";

import {
  Zap,
  MessageSquare,
  GitBranch,
  Clock,
  Tag,
  FileText,
  Globe,
  ArrowRightLeft,
  UserCheck,
  Bell,
  Shuffle,
  Hourglass,
  Sparkles,
  ListOrdered,
} from "lucide-react";
import type { DragEvent } from "react";

interface PaletteItem {
  type: string;
  nodeType: string;
  label: string;
  icon: typeof Zap;
  actionType?: string;
}

interface PaletteCategory {
  name: string;
  items: PaletteItem[];
}

const categories: PaletteCategory[] = [
  {
    name: "Déclencheurs",
    items: [
      { type: "trigger", nodeType: "trigger", label: "Déclencheur mot-clé", icon: Zap },
    ],
  },
  {
    name: "Messages",
    items: [
      {
        type: "sendMessage",
        nodeType: "sendMessage",
        label: "Envoyer un message",
        icon: MessageSquare,
      },
      {
        type: "aiResponse",
        nodeType: "aiResponse",
        label: "Réponse IA",
        icon: Sparkles,
      },
    ],
  },
  {
    name: "Logique",
    items: [
      { type: "condition", nodeType: "condition", label: "Condition", icon: GitBranch },
      { type: "delay", nodeType: "delay", label: "Délai", icon: Clock },
      {
        type: "action",
        nodeType: "abSplit",
        label: "Test A/B",
        icon: Shuffle,
        actionType: "abSplit",
      },
      {
        type: "action",
        nodeType: "smartDelay",
        label: "Délai intelligent",
        icon: Hourglass,
        actionType: "smartDelay",
      },
    ],
  },
  {
    name: "Actions",
    items: [
      {
        type: "action",
        nodeType: "addTag",
        label: "Ajouter une étiquette",
        icon: Tag,
        actionType: "addTag",
      },
      {
        type: "action",
        nodeType: "removeTag",
        label: "Retirer une étiquette",
        icon: Tag,
        actionType: "removeTag",
      },
      {
        type: "action",
        nodeType: "setCustomField",
        label: "Définir un champ",
        icon: FileText,
        actionType: "setCustomField",
      },
      {
        type: "action",
        nodeType: "httpRequest",
        label: "Requête HTTP",
        icon: Globe,
        actionType: "httpRequest",
      },
      {
        type: "action",
        nodeType: "goToFlow",
        label: "Aller au flux",
        icon: ArrowRightLeft,
        actionType: "goToFlow",
      },
      {
        type: "action",
        nodeType: "humanTakeover",
        label: "Reprise humaine",
        icon: UserCheck,
        actionType: "humanTakeover",
      },
      {
        type: "action",
        nodeType: "commentReply",
        label: "Réponse commentaire",
        icon: MessageSquare,
        actionType: "commentReply",
      },
      {
        type: "action",
        nodeType: "privateReply",
        label: "Réponse privée",
        icon: MessageSquare,
        actionType: "privateReply",
      },
      {
        type: "action",
        nodeType: "subscribe",
        label: "Abonner",
        icon: Bell,
        actionType: "subscribe",
      },
      {
        type: "action",
        nodeType: "unsubscribe",
        label: "Désabonner",
        icon: Bell,
        actionType: "unsubscribe",
      },
      {
        type: "action",
        nodeType: "enrollSequence",
        label: "Inscrire à une séquence",
        icon: ListOrdered,
        actionType: "enrollSequence",
      },
    ],
  },
];

function onDragStart(event: DragEvent, item: PaletteItem) {
  const data = JSON.stringify({
    type: item.type,
    nodeType: item.nodeType,
    actionType: item.actionType,
  });
  event.dataTransfer.setData("application/reactflow", data);
  event.dataTransfer.effectAllowed = "move";
}

export function NodePalette() {
  return (
    <div className="hidden w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Blocs</h2>
        <p className="text-xs text-muted-foreground">Glisser sur le canevas</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {categories.map((category) => (
          <div key={category.name} className="mb-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {category.name}
            </h3>
            <div className="space-y-1">
              {category.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.nodeType}
                    draggable
                    onDragStart={(e) => onDragStart(e, item)}
                    className="flex cursor-grab items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
