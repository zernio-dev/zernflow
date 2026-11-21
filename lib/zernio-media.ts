import type { Zernio } from "@/lib/zernio-client";

/**
 * Puts a file in Zernio's media storage and returns its public URL. Zernio sends attachments
 * by URL, so the inbox composer and comment automations both upload through here first.
 * Callers check the file type and size with checkAttachment() before calling.
 */
export async function uploadToZernio(zernio: Zernio, file: File): Promise<string> {
  const presign = await zernio.media.getMediaPresignedUrl({
    body: { filename: file.name, contentType: file.type as never, size: file.size },
  });
  const { uploadUrl, publicUrl } = (presign.data ?? {}) as { uploadUrl?: string; publicUrl?: string };
  if (!uploadUrl || !publicUrl) throw new Error("Zernio did not return an upload link");

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: Buffer.from(await file.arrayBuffer()),
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return publicUrl;
}
