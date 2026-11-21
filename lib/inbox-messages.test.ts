import { describe, expect, it } from "vitest";
import { isOutbound, mapZernioMessage } from "./inbox-messages";

describe("mapZernioMessage", () => {
  it("treats Zernio's outgoing as outbound and incoming as inbound", () => {
    expect(mapZernioMessage({ id: "1", direction: "outgoing" }, "c").direction).toBe("outbound");
    expect(mapZernioMessage({ id: "2", direction: "incoming" }, "c").direction).toBe("inbound");
  });

  it("still accepts the legacy outbound spelling", () => {
    expect(isOutbound("outbound")).toBe(true);
    expect(isOutbound(undefined)).toBe(false);
  });

  it("reads the text from `message`", () => {
    expect(mapZernioMessage({ id: "1", message: "hi" }, "c").text).toBe("hi");
  });

  it("keeps attachment urls, types and filenames", () => {
    const row = mapZernioMessage(
      { id: "1", attachments: [{ type: "image", url: "https://x/y.jpg" }, { type: "file", url: "https://x/a.pdf", filename: "a.pdf" }] },
      "c"
    );
    expect(row.attachments).toEqual([
      { type: "image", url: "https://x/y.jpg", previewUrl: null, filename: null },
      { type: "file", url: "https://x/a.pdf", previewUrl: null, filename: "a.pdf" },
    ]);
  });

  it("sets attachments to null when there are none", () => {
    expect(mapZernioMessage({ id: "1", attachments: [] }, "c").attachments).toBeNull();
  });

  it("maps delivery status, defaulting to sent", () => {
    expect(mapZernioMessage({ id: "1", deliveryStatus: "delivered" }, "c").status).toBe("delivered");
    expect(mapZernioMessage({ id: "1", deliveryStatus: "failed" }, "c").status).toBe("failed");
    expect(mapZernioMessage({ id: "1", deliveryStatus: null }, "c").status).toBe("sent");
  });

  it("flags content the API cannot render", () => {
    expect(mapZernioMessage({ id: "1", noRenderableContent: true }, "c").unsupported).toBe(true);
    expect(mapZernioMessage({ id: "1", noRenderableContent: true, message: "x" }, "c").unsupported).toBe(false);
  });
});
