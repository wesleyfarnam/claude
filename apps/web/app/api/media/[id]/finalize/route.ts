import { NextResponse } from "next/server";
import sharp from "sharp";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/auth/rbac";
import { MEDIA_BUCKET, signedReadUrl } from "@/lib/media/storage";
import { createMuxUploadFromUrl, getMux } from "@/lib/mux";

interface FinalizeRow {
  id: string;
  org_id: string;
  type: "image" | "video";
  storage_path: string;
  mime: string | null;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user } = await requireUser();
  const { id } = await context.params;

  const svc = createSupabaseServiceClient();

  // Look up the asset and verify the caller belongs to its org.
  const { data: asset, error: assetErr } = await svc
    .from("media_assets")
    .select("id, org_id, type, storage_path, mime")
    .eq("id", id)
    .maybeSingle<FinalizeRow>();

  if (assetErr) {
    return NextResponse.json({ error: assetErr.message }, { status: 500 });
  }
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const { data: role } = await svc
    .from("user_org_roles")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", asset.org_id)
    .maybeSingle();
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (asset.type === "image") {
    return finalizeImage(svc, asset);
  }
  return finalizeVideo(svc, asset);
}

async function finalizeImage(
  svc: ReturnType<typeof createSupabaseServiceClient>,
  asset: FinalizeRow,
) {
  const { data: file, error: dlErr } = await svc.storage
    .from(MEDIA_BUCKET)
    .download(asset.storage_path);
  if (dlErr || !file) {
    await markError(svc, asset.id, `download failed: ${dlErr?.message ?? "unknown"}`);
    return NextResponse.json(
      { error: `Failed to download uploaded image: ${dlErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let width: number | null = null;
  let height: number | null = null;
  let thumbPath: string | null = null;

  try {
    const img = sharp(buffer);
    const meta = await img.metadata();
    width = typeof meta.width === "number" ? meta.width : null;
    height = typeof meta.height === "number" ? meta.height : null;

    const thumbBuf = await sharp(buffer)
      .resize({ width: 640, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    thumbPath = `org/${asset.org_id}/media/${asset.id}/thumb.webp`;
    const { error: upErr } = await svc.storage
      .from(MEDIA_BUCKET)
      .upload(thumbPath, thumbBuf, {
        contentType: "image/webp",
        upsert: true,
      });
    if (upErr) {
      thumbPath = null;
      console.warn(`finalizeImage: thumb upload failed: ${upErr.message}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.warn(`finalizeImage: sharp processing failed: ${message}`);
  }

  const { error: updErr } = await svc
    .from("media_assets")
    .update({
      width,
      height,
      thumb_path: thumbPath,
      status: "ready",
    })
    .eq("id", asset.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "ready", width, height, thumb_path: thumbPath });
}

async function finalizeVideo(
  svc: ReturnType<typeof createSupabaseServiceClient>,
  asset: FinalizeRow,
) {
  const mux = getMux();
  if (!mux) {
    // Graceful degrade — no Mux configured in this env. Mark ready so the asset
    // is still usable as a raw download. TODO: enqueue a re-process pass once
    // MUX_TOKEN_ID / MUX_TOKEN_SECRET are populated.
    console.warn(
      `finalizeVideo: Mux not configured; marking asset ${asset.id} ready without transcode.`,
    );
    const { error: updErr } = await svc
      .from("media_assets")
      .update({ status: "ready" })
      .eq("id", asset.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      status: "ready",
      note: "MUX credentials missing — uploaded file marked ready without HLS transcode.",
    });
  }

  // Give Mux a temporary signed read URL it can fetch the source from.
  const sourceUrl = await signedReadUrl(svc, asset.storage_path, 60 * 60);
  if (!sourceUrl) {
    await markError(svc, asset.id, "failed to sign source url for Mux");
    return NextResponse.json(
      { error: "Failed to sign source URL for Mux" },
      { status: 500 },
    );
  }

  try {
    const created = await createMuxUploadFromUrl(sourceUrl);
    if (!created) {
      throw new Error("Mux client returned null");
    }
    const { error: updErr } = await svc
      .from("media_assets")
      .update({
        mux_asset_id: created.id,
        status: "processing",
      })
      .eq("id", asset.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: "processing", mux_asset_id: created.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    await markError(svc, asset.id, `mux create failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function markError(
  svc: ReturnType<typeof createSupabaseServiceClient>,
  id: string,
  note: string,
): Promise<void> {
  await svc.from("media_assets").update({ status: "error" }).eq("id", id);
  console.warn(`media_assets ${id} marked error: ${note}`);
}
