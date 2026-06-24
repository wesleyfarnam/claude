import "server-only";
import Mux from "@mux/mux-node";

/**
 * Returns a configured Mux client, or null when MUX credentials are missing.
 * Callers should gracefully degrade (mark assets ready without transcode) when
 * this returns null in development.
 */
export function getMux(): Mux | null {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) return null;
  return new Mux({
    tokenId,
    tokenSecret,
    webhookSecret: process.env.MUX_WEBHOOK_SECRET ?? null,
  });
}

/**
 * Create a Mux Video asset that ingests from a signed source URL we provide
 * (typically a temporary Supabase Storage signed read URL). Returns the
 * created Asset (containing id, status, etc.) or null when Mux is unconfigured.
 */
export async function createMuxUploadFromUrl(signedSourceUrl: string) {
  const mux = getMux();
  if (!mux) return null;
  const asset = await mux.video.assets.create({
    input: [{ url: signedSourceUrl }],
    playback_policy: ["public"],
    video_quality: "basic",
  });
  return asset;
}

/**
 * Verify a Mux webhook signature using the configured MUX_WEBHOOK_SECRET.
 * Returns the parsed event on success, or null when verification fails or
 * Mux is unconfigured.
 */
export function verifyMuxWebhook(rawBody: string, signatureHeader: string | null) {
  const mux = getMux();
  if (!mux) return null;
  if (!signatureHeader) return null;
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) return null;
  try {
    return mux.webhooks.unwrap(rawBody, { "mux-signature": signatureHeader }, secret);
  } catch {
    return null;
  }
}
