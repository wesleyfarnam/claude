import "server-only";
import { verifyDeviceToken } from "@/lib/device-jwt";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export class DeviceAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
    this.name = "DeviceAuthError";
  }
}

export type DeviceRow = {
  id: string;
  org_id: string;
  location_id: string | null;
  name: string;
  amazon_device_id: string | null;
  status: string;
  last_seen_at: string | null;
  firmware_version: string | null;
  player_version: string | null;
  registered_at: string | null;
};

export type DeviceAuth = {
  device_id: string;
  org_id: string;
  device: DeviceRow;
};

/**
 * Reads the Authorization header, verifies the device JWT, and loads
 * the matching device row via the service client (bypasses RLS — devices
 * authenticate themselves, not via Supabase auth).
 */
export async function requireDeviceFromRequest(req: Request): Promise<DeviceAuth> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader) {
    throw new DeviceAuthError("Missing Authorization header");
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    throw new DeviceAuthError("Malformed Authorization header");
  }

  let payload;
  try {
    payload = await verifyDeviceToken(match[1]);
  } catch {
    throw new DeviceAuthError("Invalid device token");
  }

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("devices")
    .select(
      "id, org_id, location_id, name, amazon_device_id, status, last_seen_at, firmware_version, player_version, registered_at",
    )
    .eq("id", payload.device_id)
    .single();

  if (error || !data) {
    throw new DeviceAuthError("Device not found");
  }
  if (data.org_id !== payload.org_id) {
    throw new DeviceAuthError("Device org mismatch");
  }

  return {
    device_id: payload.device_id,
    org_id: payload.org_id,
    device: data as DeviceRow,
  };
}
