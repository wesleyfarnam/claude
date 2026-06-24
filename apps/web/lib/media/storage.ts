import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const MEDIA_BUCKET = "media";

export function mediaBucket(): string {
  return MEDIA_BUCKET;
}

/**
 * Returns a signed upload URL that the browser can PUT a file body to,
 * scoped to a specific storage path. Used by the media-upload flow.
 */
export async function signedUploadUrl(supabase: SupabaseClient, path: string) {
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message ?? "unknown"}`);
  }
  return data;
}

/**
 * Returns a short-lived signed read URL for an object in the media bucket.
 */
export async function signedReadUrl(
  supabase: SupabaseClient,
  path: string,
  expires = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, expires);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Returns a long-lived (1 week) signed URL for a thumbnail, using the service
 * client so it works regardless of caller. Suitable for thumbs shown in the
 * library grid.
 */
export async function publicThumbUrl(path: string): Promise<string | null> {
  const svc = createSupabaseServiceClient();
  const { data, error } = await svc.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error || !data) return null;
  return data.signedUrl;
}
