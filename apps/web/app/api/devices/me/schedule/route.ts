import { NextResponse } from "next/server";
import { requireDeviceFromRequest, DeviceAuthError } from "@/lib/device-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/devices/me/schedule
 *
 * Device-authed. Returns the playlist the player should be running plus
 * any queued commands. The schedule resolver lands in a later milestone;
 * for now we return `playlist: null` with a 60s validity window. Pending
 * commands are surfaced so the player can ack/execute them.
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

  const now = new Date();
  const valid_until = new Date(now.getTime() + 60 * 1000);

  return NextResponse.json({
    playlist: null,
    valid_until: valid_until.toISOString(),
    commands: commands ?? [],
  });
}
