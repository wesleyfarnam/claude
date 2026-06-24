import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { MEDIA_BUCKET, signedUploadUrl } from "@/lib/media/storage";

export const ALLOWED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type AllowedMime = (typeof ALLOWED_MIMES)[number];

export function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIMES as readonly string[]).includes(mime);
}

export function mediaTypeFromMime(mime: string): "image" | "video" {
  return mime.startsWith("video/") ? "video" : "image";
}

/**
 * Ensure the `media` Supabase storage bucket exists. Safe to call repeatedly.
 * First checks via listBuckets so we don't try to create on every upload;
 * if creation fails for a non-"exists" reason, throws — silent failure here
 * is the difference between "uploads work" and "uploads fail with a confusing
 * 'related resource does not exist' error downstream."
 */
async function ensureMediaBucket(): Promise<void> {
  const svc = createSupabaseServiceClient();
  const { data: buckets, error: listErr } = await svc.storage.listBuckets();
  if (!listErr && buckets?.some((b) => b.name === MEDIA_BUCKET)) return;

  const { error } = await svc.storage.createBucket(MEDIA_BUCKET, {
    public: false,
    fileSizeLimit: "1024MiB",
    allowedMimeTypes: [...ALLOWED_MIMES],
  });
  if (!error) return;
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("exists")) {
    return;
  }
  // Surface the real reason instead of letting the next call fail with
  // "The related resource does not exist".
  throw new Error(
    `Could not create the 'media' Supabase Storage bucket: ${error.message}. ` +
      `Create it manually in the Supabase dashboard (Storage → New bucket → name 'media', private, 1024 MiB).`,
  );
}

function extFromName(name: string, fallback: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return fallback;
  const ext = name.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(ext)) return fallback;
  return ext;
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "video/mp4":
      return "mp4";
    case "video/quicktime":
      return "mov";
    case "video/webm":
      return "webm";
    default:
      return "bin";
  }
}

export interface PrepareUploadInput {
  orgId: string;
  filename: string;
  mime: string;
  bytes: number;
  userId: string;
}

export interface PrepareUploadResult {
  assetId: string;
  storagePath: string;
  signedUploadUrl: string;
  token: string;
}

/**
 * Creates the media_assets row in status='uploading' and returns a signed
 * upload URL the client can PUT the file body to. Uses the service client to
 * bypass RLS for the insert (the caller is responsible for verifying the
 * orgId via {@link requireUser} / user_org_roles before calling).
 */
export async function prepareUpload(
  input: PrepareUploadInput,
): Promise<PrepareUploadResult> {
  await ensureMediaBucket();

  const svc = createSupabaseServiceClient();
  const type = mediaTypeFromMime(input.mime);
  const fallbackExt = extFromMime(input.mime);
  const ext = extFromName(input.filename, fallbackExt);

  // Pre-allocate the row so we can use its id in the storage path.
  const { data: row, error: insertErr } = await svc
    .from("media_assets")
    .insert({
      org_id: input.orgId,
      name: input.filename,
      type,
      storage_path: "", // populated below once we know the id
      mime: input.mime,
      bytes: input.bytes,
      status: "uploading",
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    throw new Error(`Failed to create media asset: ${insertErr?.message ?? "unknown"}`);
  }

  const storagePath = `org/${input.orgId}/media/${row.id}/source.${ext}`;

  const { error: updateErr } = await svc
    .from("media_assets")
    .update({ storage_path: storagePath })
    .eq("id", row.id);
  if (updateErr) {
    throw new Error(`Failed to set storage path: ${updateErr.message}`);
  }

  const signed = await signedUploadUrl(svc, storagePath);

  return {
    assetId: row.id,
    storagePath,
    signedUploadUrl: signed.signedUrl,
    token: signed.token,
  };
}
