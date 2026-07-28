"use client";

import { useState, useEffect } from "react";
import {
  X,
  Mail,
  Calendar,
  Tag,
  User,
  Hash,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/platform-icon";
import type { Database, Platform } from "@/lib/types/database";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type TagRow = Database["public"]["Tables"]["tags"]["Row"];
type CustomFieldDef =
  Database["public"]["Tables"]["custom_field_definitions"]["Row"];
type CustomFieldValue =
  Database["public"]["Tables"]["contact_custom_fields"]["Row"];

interface ContactDetails {
  contact: Contact;
  tags: TagRow[];
  customFields: { definition: CustomFieldDef; value: string }[];
  channels: {
    platform: Platform;
    platform_username: string | null;
  }[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactPanel({
  contactId,
  workspaceId,
  onClose,
}: {
  contactId: string | null;
  workspaceId: string;
  onClose: () => void;
}) {
  const [loadedDetails, setDetails] = useState<ContactDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contactId) return;

    async function loadContact() {
      setLoading(true);
      const supabase = createClient();

      const [contactRes, tagsRes, fieldsRes, channelsRes] = await Promise.all([
        supabase.from("contacts").select("*").eq("id", contactId!).single(),
        supabase
          .from("contact_tags")
          .select("tag_id, tags(*)")
          .eq("contact_id", contactId!),
        supabase
          .from("contact_custom_fields")
          .select("*, custom_field_definitions(*)")
          .eq("contact_id", contactId!),
        supabase
          .from("contact_channels")
          .select("platform_username, channels(platform)")
          .eq("contact_id", contactId!),
      ]);

      if (contactRes.data) {
        const tags = (tagsRes.data ?? [])
          .map((ct) => ct.tags)
          .filter(Boolean) as TagRow[];

        const customFields = (fieldsRes.data ?? [])
          .map((cf) => ({
            definition: cf.custom_field_definitions as unknown as CustomFieldDef,
            value: cf.value,
          }))
          .filter((cf) => cf.definition);

        const channels = (channelsRes.data ?? []).map((cc) => ({
          platform: (cc.channels as unknown as { platform: Platform }).platform,
          platform_username: cc.platform_username,
        }));

        setDetails({
          contact: contactRes.data,
          tags,
          customFields,
          channels,
        });
      }

      setLoading(false);
    }

    loadContact();
  }, [contactId, workspaceId]);

  if (!contactId) return null;

  const details =
    loadedDetails?.contact.id === contactId ? loadedDetails : null;

  return (
    <div className="flex h-full w-80 flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <h3 className="text-sm font-semibold">Contact Info</h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      ) : details ? (
        <div className="flex-1 overflow-y-auto">
          {/* Profile section */}
          <div className="flex flex-col items-center border-b border-border p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-semibold">
              {details.contact.avatar_url ? (
                <img
                  src={details.contact.avatar_url}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                details.contact.display_name?.[0]?.toUpperCase() ?? "?"
              )}
            </div>
            <p className="mt-3 text-sm font-semibold">
              {details.contact.display_name ?? "Unknown"}
            </p>
            {details.contact.email && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {details.contact.email}
              </p>
            )}
            <span
              className={cn(
                "mt-2 rounded-full px-2.5 py-0.5 text-[10px] font-medium",
                details.contact.is_subscribed
                  ? "bg-green-100 text-green-700"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {details.contact.is_subscribed ? "Subscribed" : "Unsubscribed"}
            </span>
          </div>

          {/* Details */}
          <div className="space-y-4 p-4">
            {/* Connected platforms */}
            {details.channels.length > 0 && (
              <div>
                <h4 className="text-xs font-medium uppercase text-muted-foreground">
                  Platforms
                </h4>
                <div className="mt-2 space-y-1.5">
                  {details.channels.map((ch, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm"
                    >
                      <PlatformIcon
                        platform={ch.platform}
                        className="h-3.5 w-3.5"
                        size={14}
                      />
                      <span className="capitalize text-muted-foreground">
                        {ch.platform}
                      </span>
                      {ch.platform_username && (
                        <span className="truncate text-foreground">
                          @{ch.platform_username}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email */}
            {details.contact.email && (
              <div>
                <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  Email
                </h4>
                <p className="mt-1 text-sm">{details.contact.email}</p>
              </div>
            )}

            {/* Last interaction */}
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Last Interaction
              </h4>
              <p className="mt-1 text-sm">
                {formatDate(details.contact.last_interaction_at)}
              </p>
            </div>

            {/* Joined */}
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                <User className="h-3 w-3" />
                Created
              </h4>
              <p className="mt-1 text-sm">
                {formatDate(details.contact.created_at)}
              </p>
            </div>

            {/* Tags */}
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                <Tag className="h-3 w-3" />
                Tags
              </h4>
              {details.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {details.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs"
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
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">No tags</p>
              )}
            </div>

            {/* Custom fields */}
            {details.customFields.length > 0 && (
              <div>
                <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
                  <Hash className="h-3 w-3" />
                  Custom Fields
                </h4>
                <div className="mt-2 space-y-2">
                  {details.customFields.map((cf) => (
                    <div key={cf.definition.id}>
                      <p className="text-xs text-muted-foreground">
                        {cf.definition.name}
                      </p>
                      <p className="text-sm">{cf.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Contact not found
        </div>
      )}
    </div>
  );
}
