import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspace } from "@/lib/workspace";
import {
  ArrowLeft,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  const { workspace, supabase } = await getWorkspace();

  const [contactRes, channelsRes, conversationsRes, customFieldsRes] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("*, contact_tags(tag_id, tags(*))")
        .eq("id", contactId)
        .eq("workspace_id", workspace.id)
        .single(),
      supabase
        .from("contact_channels")
        .select("*, channels(platform, username, display_name)")
        .eq("contact_id", contactId),
      supabase
        .from("conversations")
        .select("id, platform, status, last_message_at, last_message_preview")
        .eq("contact_id", contactId)
        .eq("workspace_id", workspace.id)
        .order("last_message_at", { ascending: false }),
      supabase
        .from("contact_custom_fields")
        .select("value, custom_field_definitions(name, slug, field_type)")
        .eq("contact_id", contactId),
    ]);

  if (!contactRes.data) notFound();

  const contact = contactRes.data;
  const channels = channelsRes.data ?? [];
  const conversations = conversationsRes.data ?? [];
  const customFields = customFieldsRes.data ?? [];
  const tags = (contact.contact_tags ?? [])
    .map((ct: { tags: unknown }) => ct.tags)
    .filter(Boolean) as { id: string; name: string; color: string | null }[];

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "Jamais";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <Link
          href="/dashboard/contacts"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour aux contacts
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold">
            {contact.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={contact.avatar_url}
                alt={contact.display_name || "Contact"}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              contact.display_name?.[0]?.toUpperCase() ?? "?"
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {contact.display_name ?? "Inconnu"}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {contact.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {contact.email}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Dernière activité le {formatDate(contact.last_interaction_at)}
              </span>
              {contact.is_subscribed ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Abonné
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Désabonné
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs font-medium"
                style={
                  tag.color
                    ? {
                        backgroundColor: `${tag.color}20`,
                        borderColor: `${tag.color}40`,
                        color: tag.color,
                      }
                    : undefined
                }
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Connected channels */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
              Canaux connectés
            </h2>
            {channels.length === 0 ? (
              <p className="text-sm text-muted-foreground/60">Aucun canal</p>
            ) : (
              <div className="space-y-2">
                {channels.map((cc) => {
                  const ch = cc.channels as {
                    platform?: string;
                    display_name?: string;
                    username?: string;
                  } | null;
                  return (
                    <div
                      key={cc.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <PlatformIcon
                        platform={ch?.platform ?? ""}
                        className="h-4 w-4"
                        size={16}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {ch?.display_name ?? ch?.username ?? "Inconnu"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ch?.platform} ·{" "}
                          {cc.platform_username
                            ? `@${cc.platform_username}`
                            : cc.platform_sender_id}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Conversations */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
              Conversations
            </h2>
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground/60">
                Aucune conversation
              </p>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <Link
                    key={conv.id}
                    href="/dashboard/inbox"
                    className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
                  >
                    <PlatformIcon
                      platform={conv.platform}
                      className="mt-0.5 h-4 w-4"
                      size={16}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium capitalize text-muted-foreground">
                          {conv.platform} · {conv.status}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                          {formatDate(conv.last_message_at)}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate text-sm">
                        {conv.last_message_preview || "Aucun message"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Custom fields */}
          {customFields.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
                Champs personnalisés
              </h2>
              <div className="space-y-2">
                {customFields.map((cf, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <span className="text-sm text-muted-foreground">
                      {(
                        cf.custom_field_definitions as { name?: string }
                      )?.name ?? "Champ"}
                    </span>
                    <span className="text-sm font-medium">{cf.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
