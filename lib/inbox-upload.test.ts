import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES, checkAttachment } from "./inbox-upload";

describe("checkAttachment", () => {
  it("accepts images, video and audio on Instagram", () => {
    expect(checkAttachment("image/png", 1000, "instagram")).toEqual({ ok: true, kind: "image" });
    expect(checkAttachment("video/mp4", 1000, "instagram")).toEqual({ ok: true, kind: "video" });
    expect(checkAttachment("audio/mpeg", 1000, "instagram")).toEqual({ ok: true, kind: "audio" });
  });

  it("only lets WhatsApp send PDFs", () => {
    expect(checkAttachment("application/pdf", 1000, "whatsapp")).toEqual({ ok: true, kind: "file" });
    const r = checkAttachment("application/pdf", 1000, "instagram");
    expect(r.ok).toBe(false);
  });

  it("rejects unknown types, empty files and oversize files", () => {
    expect(checkAttachment("application/zip", 1000, "whatsapp").ok).toBe(false);
    expect(checkAttachment("image/png", 0, "instagram").ok).toBe(false);
    expect(checkAttachment("image/png", MAX_ATTACHMENT_BYTES + 1, "instagram").ok).toBe(false);
  });

  it("is case-insensitive on the content type", () => {
    expect(checkAttachment("IMAGE/PNG", 10, "instagram")).toEqual({ ok: true, kind: "image" });
  });
});
