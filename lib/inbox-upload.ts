/**
 * Which files the inbox may send, per platform. The content types are the ones Zernio's media
 * presign endpoint accepts; the per-platform rules follow what each messaging API can carry.
 */

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type AttachmentKind = "image" | "video" | "audio" | "file";

const IMAGE = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const VIDEO = ["video/mp4", "video/mpeg", "video/quicktime", "video/webm", "video/x-m4v", "video/avi", "video/x-msvideo"];
const AUDIO = ["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm", "audio/x-m4a"];
const PDF = ["application/pdf"];

/** Browsers file input accept string. Documents are WhatsApp-only, so the picker shows them for all and the server explains. */
export const ATTACHMENT_ACCEPT = [...IMAGE, ...VIDEO, ...AUDIO, ...PDF].join(",");

export type AttachmentCheck = { ok: true; kind: AttachmentKind } | { ok: false; error: string };

export function checkAttachment(contentType: string, size: number, platform: string): AttachmentCheck {
  const type = contentType.toLowerCase();
  if (size <= 0) return { ok: false, error: "That file is empty." };
  if (size > MAX_ATTACHMENT_BYTES) return { ok: false, error: "Files can be at most 25 MB." };

  const kind: AttachmentKind | null = IMAGE.includes(type)
    ? "image"
    : VIDEO.includes(type)
      ? "video"
      : AUDIO.includes(type)
        ? "audio"
        : PDF.includes(type)
          ? "file"
          : null;
  if (!kind) return { ok: false, error: "That file type can't be sent. Use an image, video, audio file or PDF." };

  if (kind === "file" && platform !== "whatsapp") {
    return { ok: false, error: "Only WhatsApp can receive documents. Send an image, video or audio file instead." };
  }
  return { ok: true, kind };
}
