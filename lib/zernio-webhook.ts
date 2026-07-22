/**
 * Zernio webhook auto-registration.
 *
 * Zernflow must register its own `/api/webhooks/late` endpoint in Zernio so that
 * inbound events (DMs, comments) are delivered to the Inbox. Zernio exposes a
 * single webhook per profile/API key, so this is idempotent and operates at the
 * workspace level (the secret lives on `workspaces.webhook_secret`).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Zernio } from "./zernio-client";

/** Name used to identify Zernflow's webhook among a profile's webhooks. */
export const WEBHOOK_NAME = "Zernflow";

/** Events Zernflow needs delivered to its webhook. */
export type WebhookEvent = "message.received" | "comment.received";

export interface EnsureWebhookOptions {
  /** Public base URL of this Zernflow deployment (e.g. NEXT_PUBLIC_APP_URL). */
  appUrl: string;
  /** Workspace-level HMAC secret used to verify webhook signatures. */
  secret: string;
  /** Events to subscribe to (at least one). */
  events: WebhookEvent[];
}

export interface EnsureWebhookResult {
  action: "created" | "updated" | "unchanged";
}

/** Minimal shape of a Zernio webhook entry (subset of the SDK's Webhook type). */
interface ZernioWebhook {
  _id?: string;
  name?: string;
  url?: string;
  events?: string[];
}

function webhookUrl(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/webhooks/late`;
}

/** Normalizes a URL to origin+pathname, dropping query string and trailing slash. */
function normalizePath(u: string): string {
  try {
    const parsed = new URL(u);
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return u.replace(/\?.*$/, "").replace(/\/$/, "");
  }
}

/** True when two webhook URLs share the same origin+path, ignoring query string. */
function samePath(a: string | undefined, b: string): boolean {
  return a !== undefined && normalizePath(a) === normalizePath(b);
}

/**
 * Ensures Zernflow's webhook is registered in Zernio and up to date.
 *
 * - No webhook found → create it.
 * - Found but URL differs or an event is missing → update it.
 * - Found and correct → no-op.
 *
 * Identifying "our" webhook: match by path (ignoring any query string, since a
 * webhook registered by hand may carry an SSO bypass token in the URL) or by
 * name. Never adopt anything else: Zernio allows up to 10 webhooks per account,
 * so an unmatched entry belongs to another integration the user owns and
 * rewriting it would silently break that integration.
 */
export async function ensureWebhookRegistered(
  zernio: Zernio,
  opts: EnsureWebhookOptions,
): Promise<EnsureWebhookResult> {
  const url = webhookUrl(opts.appUrl);

  const res = await zernio.webhooks.getWebhookSettings();
  const webhooks = (res?.data?.webhooks ?? []) as ZernioWebhook[];
  const mine = webhooks.find((w) => samePath(w.url, url) || w.name === WEBHOOK_NAME);

  if (!mine) {
    await zernio.webhooks.createWebhookSettings({
      body: { name: WEBHOOK_NAME, url, secret: opts.secret, events: opts.events },
    });
    return { action: "created" };
  }

  const eventsOk = opts.events.every((e) => mine.events?.includes(e));
  if (mine.url !== url || !eventsOk) {
    await zernio.webhooks.updateWebhookSettings({
      body: { _id: mine._id!, name: WEBHOOK_NAME, url, secret: opts.secret, events: opts.events },
    });
    return { action: "updated" };
  }

  return { action: "unchanged" };
}

/** Generates a random 32-byte secret as a 64-char hex string. */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Returns the workspace's webhook secret, generating and persisting one the first
 * time it is needed. The same secret is used both to register the webhook in Zernio
 * and to verify inbound signatures, so it must be stable per workspace.
 */
export async function getOrCreateWorkspaceWebhookSecret(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<string> {
  const { data } = await supabase
    .from("workspaces")
    .select("webhook_secret")
    .eq("id", workspaceId)
    .single();

  const existing = (data as { webhook_secret?: string | null } | null)?.webhook_secret;
  if (existing) return existing;

  const secret = generateWebhookSecret();
  await supabase.from("workspaces").update({ webhook_secret: secret }).eq("id", workspaceId);
  return secret;
}

/**
 * Verifies an inbound webhook's HMAC-SHA256 signature (x-late-signature header)
 * against the shared secret using a constant-time comparison.
 */
export function verifyWebhookSignature(
  secret: string,
  body: string,
  signature: string | null,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return timingSafeEqual(sigBuf, expBuf);
}

/** Minimal channel shape needed to resolve the webhook secret. */
export interface ChannelSecretRef {
  workspace_id: string;
  webhook_secret?: string | null;
}

/**
 * Resolves the secret used to verify a webhook signature, preferring the
 * workspace-level secret and falling back to the legacy per-channel secret
 * during the transition. Returns null when neither is configured.
 */
export async function resolveWebhookSecret(
  supabase: SupabaseClient,
  channel: ChannelSecretRef,
): Promise<string | null> {
  const { data } = await supabase
    .from("workspaces")
    .select("webhook_secret")
    .eq("id", channel.workspace_id)
    .single();

  const workspaceSecret = (data as { webhook_secret?: string | null } | null)?.webhook_secret;
  return workspaceSecret || channel.webhook_secret || null;
}
