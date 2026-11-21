"use client";

import { FileText, Paperclip } from "lucide-react";
import type { InboxAttachment } from "@/lib/inbox-messages";

/** Renders what a message carries: pictures, video, audio and files, instead of an "Attachment" label. */
export function MessageAttachments({ attachments }: { attachments: InboxAttachment[] }) {
  return (
    <div className="mt-1 space-y-1.5">
      {attachments.map((a, i) => (
        <Attachment key={`${a.url ?? "none"}-${i}`} attachment={a} />
      ))}
    </div>
  );
}

function Attachment({ attachment: a }: { attachment: InboxAttachment }) {
  if (!a.url) {
    return (
      <p className="flex items-center gap-1 text-xs opacity-70">
        <Paperclip className="h-3 w-3" /> Attachment unavailable
      </p>
    );
  }

  if (a.type === "image" || a.type === "sticker") {
    return (
      <a href={a.url} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.url}
          alt={a.filename ?? "Image"}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={a.type === "sticker" ? "h-24 w-24 object-contain" : "max-h-72 max-w-full rounded-lg object-cover"}
        />
      </a>
    );
  }

  if (a.type === "video") {
    return <video src={a.url} controls preload="metadata" poster={a.previewUrl ?? undefined} className="max-h-72 max-w-full rounded-lg" />;
  }

  if (a.type === "audio") {
    return <audio src={a.url} controls preload="metadata" className="max-w-full" />;
  }

  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border border-current/20 px-2.5 py-1.5 text-xs underline-offset-2 hover:underline"
    >
      {a.type === "share" && a.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.previewUrl} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded object-cover" />
      ) : (
        <FileText className="h-4 w-4 flex-shrink-0" />
      )}
      <span className="truncate">{a.filename ?? (a.type === "share" ? "Shared post" : "Open file")}</span>
    </a>
  );
}
