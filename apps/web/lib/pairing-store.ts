import "server-only";

/**
 * In-memory pairing-code store. DEV ONLY.
 *
 * Production deployments should swap this for a Redis/Upstash KV store so
 * the codes survive cold starts and are shared across instances. For now,
 * a process-local Map is good enough — pairing is a few-minute interactive
 * flow and Next.js dev/server affinity is fine.
 *
 * Lifecycle:
 *   1. Player calls /api/devices/pair/start → entry created (status: 'pending')
 *   2. Operator calls /api/devices/pair/claim with the code → entry mutated
 *      to status: 'claimed' with device_id + device_token
 *   3. Player polls /api/devices/pair/poll → reads the claim and the entry
 *      is deleted on first successful read
 */

export type PendingPairing = {
  code: string;
  hardware_id: string | null;
  status: "pending";
  created_at: number;
  expires_at: number;
};

export type ClaimedPairing = {
  code: string;
  hardware_id: string | null;
  status: "claimed";
  created_at: number;
  expires_at: number;
  device_id: string;
  org_id: string;
  device_token: string;
};

export type PairingEntry = PendingPairing | ClaimedPairing;

declare global {
  // eslint-disable-next-line no-var
  var __dripTvPairingStore: Map<string, PairingEntry> | undefined;
}

function getStore(): Map<string, PairingEntry> {
  if (!globalThis.__dripTvPairingStore) {
    globalThis.__dripTvPairingStore = new Map<string, PairingEntry>();
  }
  return globalThis.__dripTvPairingStore;
}

const TTL_MS = 10 * 60 * 1000;

function reapExpired() {
  const now = Date.now();
  const store = getStore();
  for (const [code, entry] of store.entries()) {
    if (entry.expires_at < now) store.delete(code);
  }
}

export function putPending(code: string, hardware_id: string | null): PendingPairing {
  reapExpired();
  const now = Date.now();
  const entry: PendingPairing = {
    code,
    hardware_id,
    status: "pending",
    created_at: now,
    expires_at: now + TTL_MS,
  };
  getStore().set(code, entry);
  return entry;
}

export function getPairing(code: string): PairingEntry | undefined {
  reapExpired();
  return getStore().get(code);
}

export function markClaimed(
  code: string,
  device_id: string,
  org_id: string,
  device_token: string,
): ClaimedPairing | null {
  const store = getStore();
  const existing = store.get(code);
  if (!existing || existing.status !== "pending") return null;
  const claimed: ClaimedPairing = {
    ...existing,
    status: "claimed",
    device_id,
    org_id,
    device_token,
  };
  store.set(code, claimed);
  return claimed;
}

export function removePairing(code: string) {
  getStore().delete(code);
}
