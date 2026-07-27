import { NextResponse } from "next/server";
import { requireDeviceFromRequest, DeviceAuthError } from "@/lib/device-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { resolveProgramForDevice } from "@/lib/player/resolve-program";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/devices/me/schedule
 *
 * Device-authed. Resolves the device's active schedule into a fully-expanded
 * `program` (ordered displays + media the player loops through), and surfaces
 * any queued commands so the player can execute + ack them. `playlist` is kept
 * as `null` for backward compatibility with earlier player builds.
 */
export async function GET(req: Request) {
  let auth;
  try {
    auth = await requireDeviceFromRequest(req);
  } catch (err) {
    const status = err instanceof DeviceAuthError ? err.status : 401;
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status });
  }

  const service = createSupabaseServiceClient();
  const { data: commands, error } = await service
    .from("device_commands")
    .select("id, type, payload, status, created_at")
    .eq("device_id", auth.device_id)
    .eq("status", "queued")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let program;
  try {
    program = await resolveProgramForDevice(auth.device);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve program";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    playlist: null,
    program,
    valid_until: program.validUntil,
    commands: commands ?? [],
  });
}
