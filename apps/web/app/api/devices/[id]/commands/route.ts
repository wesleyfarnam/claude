import { NextResponse } from "next/server";
import { deviceCommandType } from "@drip-tv/shared";
import { requireUser } from "@/lib/auth/rbac";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { dispatchCommand, isHardwareCommand, type DeviceCommandRow } from "@/lib/commands/dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/devices/[id]/commands
 *
 * Queue a command for a device. Requires an authenticated user.
 *
 * Body: { type: DeviceCommandType, payload?: object }
 *
 * Hardware commands (reboot, power_on, power_off, factory_reset, screenshot)
 * are dispatched synchronously to Amazon so we can return the result inline.
 * Player-level commands (force_refresh, clear_cache, reload_config) stay
 * `queued` for the player to pick up on its next poll.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { user } = await requireUser();
  const { id: deviceId } = await params;

  if (!deviceId) {
    return NextResponse.json({ error: "Missing device id" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = raw as { type?: unknown; payload?: unknown };
  const parsedType = deviceCommandType.safeParse(body.type);
  if (!parsedType.success) {
    return NextResponse.json(
      { error: "Invalid command type", detail: parsedType.error.flatten() },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};

  // Use the service client so we don't fight RLS for the insert/update path —
  // requireUser() has already authenticated and the device id is scoped by the
  // route segment. (A proper org check would belong upstream of this endpoint.)
  const service = createSupabaseServiceClient();

  // Sanity check the device exists so we fail fast instead of inserting a row
  // pointed at nothing.
  const { data: device, error: deviceErr } = await service
    .from("devices")
    .select("id, org_id")
    .eq("id", deviceId)
    .single();

  if (deviceErr || !device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const { data: inserted, error: insertErr } = await service
    .from("device_commands")
    .insert({
      device_id: deviceId,
      type: parsedType.data,
      payload,
      status: "queued",
      created_by: user.id,
    })
    .select("id, device_id, type, payload, status, created_by, created_at, sent_at, acked_at, result")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: "Failed to queue command", detail: insertErr?.message },
      { status: 500 },
    );
  }

  const row = inserted as DeviceCommandRow;

  // Dispatch synchronously for hardware commands so the caller gets the
  // upstream result inline. Player commands return immediately as `queued`.
  if (isHardwareCommand(row.type)) {
    const outcome = await dispatchCommand(row);
    return NextResponse.json({
      ...row,
      status: outcome.status,
      result: outcome.result,
      routed: outcome.routed,
    });
  }

  return NextResponse.json({ ...row, routed: "player" });
}
