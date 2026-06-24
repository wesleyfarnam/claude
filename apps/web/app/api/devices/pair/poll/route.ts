import { NextResponse } from "next/server";
import { getPairing, removePairing } from "@/lib/pairing-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/devices/pair/poll
 *
 * Player polls every ~3s with its pairing code. Returns 'pending' until
 * an operator claims the code, then returns the device JWT once. On a
 * successful claim, the entry is deleted so the token can never be
 * fetched twice.
 *
 * Body: { pairing_code: string }
 */
export async function POST(req: Request) {
  let pairing_code = "";
  try {
    const body = (await req.json()) as { pairing_code?: unknown };
    if (typeof body?.pairing_code === "string") {
      pairing_code = body.pairing_code.trim().toUpperCase();
    }
  } catch {
    // fall through
  }

  if (!pairing_code) {
    return NextResponse.json({ error: "pairing_code required" }, { status: 400 });
  }

  const entry = getPairing(pairing_code);
  if (!entry) {
    return NextResponse.json({ status: "expired" }, { status: 404 });
  }

  if (entry.status === "pending") {
    return NextResponse.json({ status: "pending" });
  }

  // Claimed — hand back the token exactly once.
  const { device_id, org_id, device_token } = entry;
  removePairing(pairing_code);
  return NextResponse.json({
    status: "paired",
    device_token,
    device_id,
    org_id,
  });
}
