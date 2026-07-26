import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { putPending } from "@/lib/pairing-store";

// Unambiguous uppercase alphanumeric — no 0/1/O/I (and no L) for human reads.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const generateCode = customAlphabet(ALPHABET, 6);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/devices/pair/start
 *
 * Player-side bootstrap (NO auth required). The Drip TV player stick calls this on
 * first boot to obtain a short pairing code. The operator types the code
 * into the dashboard to claim it. The code is in-memory only.
 *
 * Body: { hardware_id?: string }
 * Returns: { pairing_code, expires_at }
 */
export async function POST(req: Request) {
  let hardware_id: string | null = null;
  try {
    const body = (await req.json()) as { hardware_id?: unknown };
    if (typeof body?.hardware_id === "string" && body.hardware_id.length > 0) {
      hardware_id = body.hardware_id.slice(0, 128);
    }
  } catch {
    // body is optional
  }

  const code = generateCode();
  const entry = putPending(code, hardware_id);

  return NextResponse.json({
    pairing_code: entry.code,
    expires_at: new Date(entry.expires_at).toISOString(),
  });
}
