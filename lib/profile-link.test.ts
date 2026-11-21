import { describe, expect, it } from "vitest";
import { profileLabel, profileUrl } from "./profile-link";

describe("profileUrl", () => {
  it("links an Instagram username", () => {
    expect(profileUrl("instagram", "whereisronit_")).toBe("https://www.instagram.com/whereisronit_/");
    expect(profileUrl("instagram", "@priti.explores")).toBe("https://www.instagram.com/priti.explores/");
  });

  it("refuses usernames that are not plain handles", () => {
    expect(profileUrl("instagram", "a/../evil")).toBeNull();
    expect(profileUrl("instagram", "ıɥʇǝs")).toBeNull();
    expect(profileUrl("instagram", "")).toBeNull();
    expect(profileUrl("instagram", null)).toBeNull();
  });

  it("links WhatsApp by phone number", () => {
    expect(profileUrl("whatsapp", null, "919958166154")).toBe("https://wa.me/919958166154");
    expect(profileUrl("whatsapp", null, "+91 99581 66154")).toBe("https://wa.me/919958166154");
    expect(profileUrl("whatsapp", null, "123")).toBeNull();
  });

  it("has no link for platforms without public handles", () => {
    expect(profileUrl("facebook", "someone")).toBeNull();
  });
});

describe("profileLabel", () => {
  it("names the action", () => {
    expect(profileLabel("instagram")).toBe("Open Instagram profile");
    expect(profileLabel("whatsapp")).toBe("Open in WhatsApp");
  });
});
