"use client";

import { useCallback } from "react";
import { Plus, X, GripVertical, Image, Type, MousePointer, MessageCircle, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickReply {
  title: string;
  payload: string;
}

interface Button {
  title: string;
  type: "postback" | "url";
  payload?: string;
  url?: string;
}

interface CarouselElement {
  imageUrl?: string;
  title: string;
  subtitle?: string;
  buttons?: Button[];
}

interface Carousel {
  elements: CarouselElement[];
}

interface Message {
  text?: string;
  imageUrl?: string;
  quickReplies?: QuickReply[];
  buttons?: Button[];
  carousel?: Carousel;
}

interface SendMessagePanelData {
  messages?: Message[];
  [key: string]: unknown;
}

interface SendMessagePanelProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

function VariableHint() {
  return (
    <p className="text-[11px] text-muted-foreground/60">
      Utilisez {"{{variable}}"} pour le contenu dynamique
    </p>
  );
}

export function SendMessagePanel({ data: rawData, onChange }: SendMessagePanelProps) {
  const data = rawData as SendMessagePanelData;
  const messages = data.messages || [];

  const updateMessage = useCallback(
    (index: number, updated: Message) => {
      const msgs = [...messages];
      msgs[index] = updated;
      onChange({ ...data, messages: msgs });
    },
    [data, messages, onChange]
  );

  const addMessage = useCallback(() => {
    onChange({ ...data, messages: [...messages, { text: "" }] });
  }, [data, messages, onChange]);

  const removeMessage = useCallback(
    (index: number) => {
      onChange({ ...data, messages: messages.filter((_, i) => i !== index) });
    },
    [data, messages, onChange]
  );

  return (
    <div className="space-y-4">
      {messages.map((message, msgIndex) => (
        <MessageEditor
          key={msgIndex}
          index={msgIndex}
          message={message}
          onChange={(updated) => updateMessage(msgIndex, updated)}
          onRemove={() => removeMessage(msgIndex)}
          canRemove={messages.length > 1}
        />
      ))}

      <button
        type="button"
        onClick={addMessage}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-blue-400 hover:text-blue-500"
      >
        <Plus className="h-4 w-4" />
        Ajouter un message
      </button>

      {messages.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Ajoutez au moins un message à envoyer.
        </p>
      )}

      {/* Platform hints */}
      <div className="rounded-lg border border-border bg-muted p-3">
        <p className="text-xs font-medium text-muted-foreground">Notes par plateforme</p>
        <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
          <li>Facebook/Instagram : 3 boutons max par message</li>
          <li>Telegram : les boutons apparaissent en clavier intégré</li>
          <li>Les réponses rapides disparaissent après la réponse de l'utilisateur</li>
          <li>Carrousels : natifs sur Facebook/Instagram, repli texte ailleurs</li>
        </ul>
      </div>
    </div>
  );
}

function MessageEditor({
  index,
  message,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  message: Message;
  onChange: (m: Message) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const isCarouselMode = !!message.carousel;

  const toggleMode = useCallback(() => {
    if (isCarouselMode) {
      // Switch to text mode: remove carousel
      const { carousel: _, ...rest } = message;
      onChange({ ...rest, text: rest.text || "" });
    } else {
      // Switch to carousel mode: remove text-mode fields, add empty carousel
      onChange({
        carousel: {
          elements: [{ title: "", subtitle: "", imageUrl: "" }],
        },
      });
    }
  }, [isCarouselMode, message, onChange]);

  // Quick replies
  const addQuickReply = useCallback(() => {
    const replies = message.quickReplies || [];
    onChange({ ...message, quickReplies: [...replies, { title: "", payload: "" }] });
  }, [message, onChange]);

  const updateQuickReply = useCallback(
    (i: number, updated: QuickReply) => {
      const replies = [...(message.quickReplies || [])];
      replies[i] = updated;
      onChange({ ...message, quickReplies: replies });
    },
    [message, onChange]
  );

  const removeQuickReply = useCallback(
    (i: number) => {
      const replies = (message.quickReplies || []).filter((_, idx) => idx !== i);
      onChange({ ...message, quickReplies: replies.length > 0 ? replies : undefined });
    },
    [message, onChange]
  );

  // Buttons
  const addButton = useCallback(() => {
    const buttons = message.buttons || [];
    onChange({ ...message, buttons: [...buttons, { title: "", type: "postback", payload: "" }] });
  }, [message, onChange]);

  const updateButton = useCallback(
    (i: number, updated: Button) => {
      const buttons = [...(message.buttons || [])];
      buttons[i] = updated;
      onChange({ ...message, buttons });
    },
    [message, onChange]
  );

  const removeButton = useCallback(
    (i: number) => {
      const buttons = (message.buttons || []).filter((_, idx) => idx !== i);
      onChange({ ...message, buttons: buttons.length > 0 ? buttons : undefined });
    },
    [message, onChange]
  );

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Message header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-xs font-semibold text-muted-foreground">
            Message {index + 1}
          </span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => isCarouselMode && toggleMode()}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
            !isCarouselMode
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-muted-foreground/60 hover:text-muted-foreground"
          )}
        >
          <Type className="h-3 w-3" />
          Texte
        </button>
        <button
          type="button"
          onClick={() => !isCarouselMode && toggleMode()}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
            isCarouselMode
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-muted-foreground/60 hover:text-muted-foreground"
          )}
        >
          <LayoutGrid className="h-3 w-3" />
          Carousel
        </button>
      </div>

      <div className="space-y-4 p-3">
        {isCarouselMode ? (
          <CarouselEditor
            carousel={message.carousel!}
            onChange={(carousel) => onChange({ ...message, carousel })}
          />
        ) : (
          <>
            {/* Text */}
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <Type className="h-3 w-3 text-muted-foreground/60" />
                <label className="text-xs font-medium text-muted-foreground">Texte</label>
              </div>
              <textarea
                value={message.text || ""}
                onChange={(e) => onChange({ ...message, text: e.target.value })}
                placeholder="Saisissez votre message... Utilisez {{name}} pour les variables"
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <VariableHint />
            </div>

            {/* Image URL */}
            <div>
              <div className="mb-1.5 flex items-center gap-1.5">
                <Image className="h-3 w-3 text-muted-foreground/60" />
                <label className="text-xs font-medium text-muted-foreground">URL de l'image</label>
              </div>
              <input
                type="url"
                value={message.imageUrl || ""}
                onChange={(e) =>
                  onChange({ ...message, imageUrl: e.target.value || undefined })
                }
                placeholder="https://example.com/image.png"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Quick Replies */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="h-3 w-3 text-muted-foreground/60" />
                  <label className="text-xs font-medium text-muted-foreground">
                    Réponses rapides
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addQuickReply}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-blue-500 hover:bg-blue-50"
                >
                  <Plus className="h-3 w-3" />
                  Ajouter
                </button>
              </div>
              {(message.quickReplies || []).map((qr, i) => (
                <div key={i} className="mb-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={qr.title}
                    onChange={(e) => updateQuickReply(i, { ...qr, title: e.target.value })}
                    placeholder="Libellé"
                    className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={qr.payload}
                    onChange={(e) => updateQuickReply(i, { ...qr, payload: e.target.value })}
                    placeholder="Payload"
                    className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeQuickReply(i)}
                    className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MousePointer className="h-3 w-3 text-muted-foreground/60" />
                  <label className="text-xs font-medium text-muted-foreground">
                    Boutons
                  </label>
                </div>
                <button
                  type="button"
                  onClick={addButton}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-blue-500 hover:bg-blue-50"
                >
                  <Plus className="h-3 w-3" />
                  Ajouter
                </button>
              </div>
              {(message.buttons || []).map((btn, i) => (
                <div
                  key={i}
                  className="mb-2 rounded-lg border border-border bg-muted p-2.5"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={btn.title}
                      onChange={(e) => updateButton(i, { ...btn, title: e.target.value })}
                      placeholder="Libellé du bouton"
                      className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeButton(i)}
                      className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={btn.type}
                      onChange={(e) => {
                        const type = e.target.value as "postback" | "url";
                        updateButton(i, {
                          ...btn,
                          type,
                          payload: type === "postback" ? btn.payload || "" : undefined,
                          url: type === "url" ? btn.url || "" : undefined,
                        });
                      }}
                      className="rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="postback">Postback</option>
                      <option value="url">URL</option>
                    </select>
                    {btn.type === "postback" ? (
                      <input
                        type="text"
                        value={btn.payload || ""}
                        onChange={(e) => updateButton(i, { ...btn, payload: e.target.value })}
                        placeholder="Valeur du payload"
                        className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <input
                        type="url"
                        value={btn.url || ""}
                        onChange={(e) => updateButton(i, { ...btn, url: e.target.value })}
                        placeholder="https://..."
                        className="flex-1 rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CarouselEditor({
  carousel,
  onChange,
}: {
  carousel: Carousel;
  onChange: (c: Carousel) => void;
}) {
  const elements = carousel.elements || [];

  const addCard = useCallback(() => {
    onChange({
      elements: [...elements, { title: "", subtitle: "", imageUrl: "" }],
    });
  }, [elements, onChange]);

  const updateCard = useCallback(
    (i: number, updated: CarouselElement) => {
      const els = [...elements];
      els[i] = updated;
      onChange({ elements: els });
    },
    [elements, onChange]
  );

  const removeCard = useCallback(
    (i: number) => {
      onChange({ elements: elements.filter((_, idx) => idx !== i) });
    },
    [elements, onChange]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <LayoutGrid className="h-3 w-3 text-muted-foreground/60" />
          <label className="text-xs font-medium text-muted-foreground">
            Cartes ({elements.length})
          </label>
        </div>
        <button
          type="button"
          onClick={addCard}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-blue-500 hover:bg-blue-50"
        >
          <Plus className="h-3 w-3" />
          Ajouter une carte
        </button>
      </div>

      {elements.map((el, i) => (
        <CarouselCardEditor
          key={i}
          index={i}
          element={el}
          onChange={(updated) => updateCard(i, updated)}
          onRemove={() => removeCard(i)}
          canRemove={elements.length > 1}
        />
      ))}

      {elements.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Ajoutez au moins une carte au carrousel.
        </p>
      )}
    </div>
  );
}

function CarouselCardEditor({
  index,
  element,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  element: CarouselElement;
  onChange: (el: CarouselElement) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const buttons = element.buttons || [];

  const addButton = useCallback(() => {
    if (buttons.length >= 3) return;
    onChange({
      ...element,
      buttons: [...buttons, { title: "", type: "postback", payload: "" }],
    });
  }, [element, buttons, onChange]);

  const updateButton = useCallback(
    (i: number, updated: Button) => {
      const btns = [...buttons];
      btns[i] = updated;
      onChange({ ...element, buttons: btns });
    },
    [element, buttons, onChange]
  );

  const removeButton = useCallback(
    (i: number) => {
      const btns = buttons.filter((_, idx) => idx !== i);
      onChange({ ...element, buttons: btns.length > 0 ? btns : undefined });
    },
    [element, buttons, onChange]
  );

  return (
    <div className="rounded-lg border border-border bg-muted p-2.5">
      {/* Card header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground">
          Carte {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-0.5 text-muted-foreground/60 hover:bg-accent hover:text-muted-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {/* Image URL */}
        <div>
          <div className="mb-1 flex items-center gap-1">
            <Image className="h-2.5 w-2.5 text-muted-foreground/60" />
            <label className="text-[11px] font-medium text-muted-foreground">URL de l'image</label>
          </div>
          <input
            type="url"
            value={element.imageUrl || ""}
            onChange={(e) =>
              onChange({ ...element, imageUrl: e.target.value || undefined })
            }
            placeholder="https://example.com/image.png"
            className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Title */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Titre
          </label>
          <input
            type="text"
            value={element.title}
            onChange={(e) => onChange({ ...element, title: e.target.value })}
            placeholder="Titre de la carte (80 caractères max)"
            maxLength={80}
            className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Subtitle */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Sous-titre
          </label>
          <input
            type="text"
            value={element.subtitle || ""}
            onChange={(e) =>
              onChange({ ...element, subtitle: e.target.value || undefined })
            }
            placeholder="Sous-titre de la carte"
            className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Buttons */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <MousePointer className="h-2.5 w-2.5 text-muted-foreground/60" />
              <label className="text-[11px] font-medium text-muted-foreground">
                Boutons ({buttons.length}/3)
              </label>
            </div>
            {buttons.length < 3 && (
              <button
                type="button"
                onClick={addButton}
                className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-blue-500 hover:bg-blue-50"
              >
                <Plus className="h-2.5 w-2.5" />
                Ajouter
              </button>
            )}
          </div>
          {buttons.map((btn, i) => (
            <div
              key={i}
              className="mb-1.5 rounded border border-border bg-card p-2"
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <input
                  type="text"
                  value={btn.title}
                  onChange={(e) =>
                    updateButton(i, { ...btn, title: e.target.value })
                  }
                  placeholder="Libellé du bouton"
                  className="flex-1 rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removeButton(i)}
                  className="rounded p-0.5 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={btn.type}
                  onChange={(e) => {
                    const type = e.target.value as "postback" | "url";
                    updateButton(i, {
                      ...btn,
                      type,
                      payload:
                        type === "postback" ? btn.payload || "" : undefined,
                      url: type === "url" ? btn.url || "" : undefined,
                    });
                  }}
                  className="rounded border border-border bg-card px-1.5 py-1 text-[11px] text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="postback">Postback</option>
                  <option value="url">URL</option>
                </select>
                {btn.type === "postback" ? (
                  <input
                    type="text"
                    value={btn.payload || ""}
                    onChange={(e) =>
                      updateButton(i, { ...btn, payload: e.target.value })
                    }
                    placeholder="Valeur du payload"
                    className="flex-1 rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                ) : (
                  <input
                    type="url"
                    value={btn.url || ""}
                    onChange={(e) =>
                      updateButton(i, { ...btn, url: e.target.value })
                    }
                    placeholder="https://..."
                    className="flex-1 rounded border border-border bg-card px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
