import { NextResponse } from "next/server";
import { playbackEventBatchSchema } from "@drip-tv/shared";
import { requireDeviceFromRequest, DeviceAuthError } from "@/lib/device-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/playback-events
 *
 * Device-authenticated bulk ingest of playback events. The body is
 * validated against `playbackEventBatchSchema` (max 500 events).
 *
 * The authed device_id always overrides any client-supplied value so a
 * compromised token cannot inject events for another device.
 */
export async function POST(req: Request) {
  let auth;
  try {
    auth = await requireDeviceFromRequest(req);
  } catch (err) {
    if (err instanceof DeviceAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = playbackEventBatchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid batch", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.events.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  // Force device_id to the authed device — clients cannot impersonate.
  const rows = parsed.data.events.map((evt) => ({
    device_id: auth.device_id,
    ts: evt.ts,
    playlist_id: evt.playlist_id,
    playlist_item_id: evt.playlist_item_id,
    media_id: evt.media_id,
    display_id: evt.display_id,
    duration_ms: evt.duration_ms,
    completed: evt.completed,
    reason: evt.reason,
  }));

  const service = createSupabaseServiceClient();
  const { error } = await service.from("playback_events").insert(rows);

  if (error) {
    return NextResponse.json(
      { error: "Failed to insert playback events", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ inserted: rows.length });
}
