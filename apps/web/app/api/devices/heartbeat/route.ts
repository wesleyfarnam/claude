import { NextResponse } from "next/server";
import { heartbeatSchema } from "@drip-tv/shared";
import { requireDeviceFromRequest, DeviceAuthError } from "@/lib/device-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/devices/heartbeat
 *
 * Device-authed. The player posts a heartbeat every ~30s. We log it into
 * the partitioned device_heartbeats table and bump devices.last_seen_at /
 * status / player_version so the dashboard reflects "live" state.
 */
export async function POST(req: Request) {
  let auth;
  try {
    auth = await requireDeviceFromRequest(req);
  } catch (err) {
    const status = err instanceof DeviceAuthError ? err.status : 401;
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = heartbeatSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid heartbeat", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const hb = parsed.data;

  // The schema includes device_id, but we trust the JWT subject — never
  // the body — to determine which device this heartbeat belongs to.
  if (hb.device_id !== auth.device_id) {
    return NextResponse.json(
      { error: "Heartbeat device_id does not match token" },
      { status: 403 },
    );
  }

  const service = createSupabaseServiceClient();

  const { error: insertErr } = await service.from("device_heartbeats").insert({
    device_id: auth.device_id,
    ts: hb.ts,
    status: hb.status,
    playing_playlist_id: hb.playing_playlist_id,
    playing_item_id: hb.playing_item_id,
    cpu_pct: hb.cpu_pct ?? null,
    mem_pct: hb.mem_pct ?? null,
    temp_c: hb.temp_c ?? null,
    net_rtt_ms: hb.net_rtt_ms ?? null,
    errors: hb.errors,
  });

  if (insertErr) {
    return NextResponse.json(
      { error: insertErr.message },
      { status: 500 },
    );
  }

  // Map player status → device status. 'error' surfaces directly; anything
  // else is treated as 'active' since the device is clearly online.
  const deviceStatus = hb.status === "error" ? "error" : "active";

  const update: Record<string, unknown> = {
    last_seen_at: new Date().toISOString(),
    status: deviceStatus,
    updated_at: new Date().toISOString(),
  };
  if (hb.player_version) update.player_version = hb.player_version;

  const { error: updateErr } = await service
    .from("devices")
    .update(update)
    .eq("id", auth.device_id);

  if (updateErr) {
    return NextResponse.json(
      { error: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
