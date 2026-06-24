import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; commandId: string }> };

const ackSchema = z.object({
  status: z.enum(["ack", "failed"]),
  result: z.record(z.unknown()).optional(),
});

/**
 * POST /api/devices/[id]/commands/[commandId]/ack
 *
 * Player → server callback. The on-device player calls this after executing
 * (or trying to execute) a queued command. Auth is via the device JWT
 * (`requireDeviceFromRequest`), NOT a user session.
 *
 * Body: { status: 'ack' | 'failed', result?: object }
 *
 * Note: `device-auth.ts` is owned by the M3 agent; we import it lazily so
 * type-checking this file doesn't depend on the import being resolvable at
 * build time during parallel work.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id: deviceId, commandId } = await params;
  if (!deviceId || !commandId) {
    return NextResponse.json({ error: "Missing route params" }, { status: 400 });
  }

  // Lazy import — see file header note.
  const { requireDeviceFromRequest, DeviceAuthError } = await import(
    "@/lib/device-auth"
  );

  let auth;
  try {
    auth = await requireDeviceFromRequest(req);
  } catch (err) {
    if (err instanceof DeviceAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.device_id !== deviceId) {
    return NextResponse.json(
      { error: "Token does not match device id in path" },
      { status: 403 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ackSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const service = createSupabaseServiceClient();

  // Make sure the command belongs to the authenticated device — don't let
  // device A ack device B's commands.
  const { data: command, error: cmdErr } = await service
    .from("device_commands")
    .select("id, device_id, status")
    .eq("id", commandId)
    .single();

  if (cmdErr || !command) {
    return NextResponse.json({ error: "Command not found" }, { status: 404 });
  }
  if (command.device_id !== deviceId) {
    return NextResponse.json(
      { error: "Command does not belong to this device" },
      { status: 403 },
    );
  }

  const ackedAt = new Date().toISOString();
  const { data: updated, error: updateErr } = await service
    .from("device_commands")
    .update({
      status: parsed.data.status,
      result: parsed.data.result ?? null,
      acked_at: ackedAt,
    })
    .eq("id", commandId)
    .select("id, device_id, type, status, result, acked_at")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: "Failed to record ack", detail: updateErr?.message },
      { status: 500 },
    );
  }

  return NextResponse.json(updated);
}
