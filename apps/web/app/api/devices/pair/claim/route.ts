import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/rbac";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { signDeviceToken } from "@/lib/device-jwt";
import { getPairing, markClaimed } from "@/lib/pairing-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/devices/pair/claim
 *
 * Dashboard-side. The operator enters a 6-char pairing code that the player
 * displayed on screen. We look up the in-memory entry, create the device
 * row in the caller's org, mint a long-lived JWT, and stash it on the
 * pairing entry so the player can pick it up on its next poll.
 *
 * Body: { pairing_code: string, name: string, location_id?: string }
 */
export async function POST(req: Request) {
  const { user, supabase } = await requireUser();

  let pairing_code = "";
  let name = "";
  let location_id: string | null = null;
  try {
    const body = (await req.json()) as {
      pairing_code?: unknown;
      name?: unknown;
      location_id?: unknown;
    };
    if (typeof body?.pairing_code === "string") {
      pairing_code = body.pairing_code.trim().toUpperCase();
    }
    if (typeof body?.name === "string") {
      name = body.name.trim();
    }
    if (typeof body?.location_id === "string" && body.location_id.length > 0) {
      location_id = body.location_id;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!pairing_code) {
    return NextResponse.json({ error: "pairing_code required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const entry = getPairing(pairing_code);
  if (!entry) {
    return NextResponse.json(
      { error: "Pairing code not found or expired" },
      { status: 404 },
    );
  }
  if (entry.status !== "pending") {
    return NextResponse.json(
      { error: "Pairing code already claimed" },
      { status: 409 },
    );
  }

  // Resolve the operator's org. We use the RLS-scoped client so users can
  // only ever claim into orgs they belong to.
  const { data: roles, error: roleErr } = await supabase
    .from("user_org_roles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1);

  if (roleErr || !roles || roles.length === 0) {
    return NextResponse.json(
      { error: "No organization for user" },
      { status: 403 },
    );
  }
  const org_id = roles[0]!.org_id as string;

  // Optional location must belong to the same org. RLS will block cross-org
  // reads anyway, but we double-check the row exists.
  if (location_id) {
    const { data: loc, error: locErr } = await supabase
      .from("locations")
      .select("id")
      .eq("id", location_id)
      .single();
    if (locErr || !loc) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 },
      );
    }
  }

  // Create the devices row via the service client so we can set fields
  // (registered_at, status) regardless of RLS write policy.
  const service = createSupabaseServiceClient();
  const { data: device, error: devErr } = await service
    .from("devices")
    .insert({
      org_id,
      location_id,
      name,
      status: "active",
      registered_at: new Date().toISOString(),
    })
    .select("id, org_id")
    .single();

  if (devErr || !device) {
    return NextResponse.json(
      { error: devErr?.message ?? "Could not create device" },
      { status: 500 },
    );
  }

  const device_token = await signDeviceToken({
    device_id: device.id as string,
    org_id: device.org_id as string,
  });

  const claimed = markClaimed(
    pairing_code,
    device.id as string,
    device.org_id as string,
    device_token,
  );

  if (!claimed) {
    // Race: the entry was reaped between getPairing and markClaimed. The
    // device row exists but the player can't pick it up — surface the error
    // so the operator can retry pairing.
    return NextResponse.json(
      { error: "Pairing code expired during claim — please regenerate" },
      { status: 410 },
    );
  }

  return NextResponse.json({ device_id: device.id });
}
