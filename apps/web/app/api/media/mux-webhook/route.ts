import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifyMuxWebhook } from "@/lib/mux";

// Mux occasionally batches events; the route is dynamic on every request.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("mux-signature");

  const event = verifyMuxWebhook(rawBody, signature);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type !== "video.asset.ready") {
    // Accept other events so Mux stops retrying, but we only care about ready.
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const asset = event.data;
  const muxAssetId = asset.id;
  const playbackIds = Array.isArray(asset.playback_ids) ? asset.playback_ids : [];
  const firstPlayback = playbackIds[0];
  const playbackId = firstPlayback?.id ?? null;
  const duration = typeof asset.duration === "number" ? asset.duration : null;

  if (!playbackId) {
    return NextResponse.json(
      { ok: false, error: "no playback_id on ready asset" },
      { status: 422 },
    );
  }

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("media_assets")
    .update({
      hls_url: `https://stream.mux.com/${playbackId}.m3u8`,
      mux_playback_id: playbackId,
      duration_sec: duration,
      status: "ready",
    })
    .eq("mux_asset_id", muxAssetId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
