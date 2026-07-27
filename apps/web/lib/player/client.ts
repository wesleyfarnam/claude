import type { Heartbeat, PlaybackEvent, Program } from "@drip-tv/shared";

/**
 * Browser-side player client: device-credential persistence and the small set
 * of fetch calls the kiosk player makes against the control plane. No
 * server-only imports here — this module runs on the Signage Stick.
 */

const CREDS_KEY = "driptv.device.creds";
const HWID_KEY = "driptv.device.hwid";
const PROGRAM_CACHE_KEY = "driptv.program.cache";

export const PLAYER_VERSION = "0.1.0-web";

export type DeviceCreds = {
  token: string;
  deviceId: string;
  orgId: string;
};

export type ScheduleCommand = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
};

export type ScheduleResponse = {
  program: Program;
  valid_until: string;
  commands: ScheduleCommand[];
};

function safeGet(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable in some kiosk shells */
  }
}
function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getStoredCreds(): DeviceCreds | null {
  const raw = safeGet(CREDS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DeviceCreds>;
    if (parsed.token && parsed.deviceId && parsed.orgId) {
      return { token: parsed.token, deviceId: parsed.deviceId, orgId: parsed.orgId };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function storeCreds(creds: DeviceCreds): void {
  safeSet(CREDS_KEY, JSON.stringify(creds));
}

export function clearCreds(): void {
  safeRemove(CREDS_KEY);
}

/** A stable per-device hardware id, generated once and persisted. */
export function getHardwareId(): string {
  let id = safeGet(HWID_KEY);
  if (!id) {
    id = uuid();
    safeSet(HWID_KEY, id);
  }
  return id;
}

export function cacheProgram(program: Program): void {
  safeSet(PROGRAM_CACHE_KEY, JSON.stringify(program));
}

export function readCachedProgram(): Program | null {
  const raw = safeGet(PROGRAM_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Program;
  } catch {
    return null;
  }
}

// ── API calls ────────────────────────────────────────────────────────

export async function startPairing(
  hardwareId: string,
): Promise<{ pairing_code: string; expires_at: string }> {
  const res = await fetch("/api/devices/pair/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hardware_id: hardwareId }),
  });
  if (!res.ok) throw new Error(`pair/start failed (${res.status})`);
  return (await res.json()) as { pairing_code: string; expires_at: string };
}

export type PollResult =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "paired"; device_token: string; device_id: string; org_id: string };

export async function pollPairing(pairingCode: string): Promise<PollResult> {
  const res = await fetch("/api/devices/pair/poll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairing_code: pairingCode }),
  });
  if (res.status === 404) return { status: "expired" };
  if (!res.ok) throw new Error(`pair/poll failed (${res.status})`);
  return (await res.json()) as PollResult;
}

export async function fetchSchedule(token: string): Promise<ScheduleResponse> {
  const res = await fetch("/api/devices/me/schedule", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    throw new UnauthorizedError();
  }
  if (!res.ok) throw new Error(`schedule fetch failed (${res.status})`);
  return (await res.json()) as ScheduleResponse;
}

export async function sendHeartbeat(token: string, body: Heartbeat): Promise<void> {
  await fetch("/api/devices/heartbeat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export async function sendPlaybackEvents(
  token: string,
  events: PlaybackEvent[],
): Promise<void> {
  if (events.length === 0) return;
  await fetch("/api/playback-events", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ events }),
  });
}

export async function ackCommand(
  token: string,
  deviceId: string,
  commandId: string,
  status: "ack" | "failed",
  result?: Record<string, unknown>,
): Promise<void> {
  await fetch(`/api/devices/${deviceId}/commands/${commandId}/ack`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, result }),
  });
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Device token rejected");
    this.name = "UnauthorizedError";
  }
}
