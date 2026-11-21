/**
 * A link to a contact's own profile on the platform, or null when we cannot build a safe one.
 * Usernames come from platform webhooks, so they are checked before going into a URL.
 */
const USERNAME = /^[A-Za-z0-9._]{1,30}$/;

export function profileUrl(platform: string, username: string | null | undefined, senderId?: string | null): string | null {
  const user = username?.replace(/^@/, "").trim();
  const ok = !!user && USERNAME.test(user);
  switch (platform) {
    case "instagram":
      return ok ? `https://www.instagram.com/${user}/` : null;
    case "twitter":
      return ok ? `https://x.com/${user}` : null;
    case "telegram":
      return ok ? `https://t.me/${user}` : null;
    case "whatsapp": {
      // The WhatsApp sender id is the phone number in international format.
      const digits = senderId?.replace(/\D/g, "") ?? "";
      return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
    }
    default:
      return null;
  }
}

export function profileLabel(platform: string): string {
  return platform === "whatsapp" ? "Open in WhatsApp" : `Open ${platform === "twitter" ? "X" : platform[0].toUpperCase() + platform.slice(1)} profile`;
}
