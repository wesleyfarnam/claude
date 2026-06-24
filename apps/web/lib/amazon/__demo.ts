import "server-only";

/**
 * Local-dev mock for the Amazon Signage API.
 *
 * Activated by setting `AMAZON_SIGNAGE_API_BASE=mock://` (with real client
 * id/secret still set — any non-empty values are fine). When demo mode is on,
 * all `signage-client` calls short-circuit through `demoAmazonCall` instead of
 * hitting the network, returning a fake success after ~500ms.
 *
 * Why: lets us exercise the dispatch path, command-row updates, and UI
 * polling without burning real API quota or needing prod creds in dev.
 *
 * Note: this file is intentionally side-effect-free at import time — the
 * `isDemoMode()` predicate is re-evaluated on each call so tests can flip
 * the env var between cases.
 */

const DEMO_DELAY_MS = 500;

export function isDemoMode(): boolean {
  return process.env.AMAZON_SIGNAGE_API_BASE === "mock://";
}

type DemoCall = {
  type: string;
  deviceId: string;
  payload?: Record<string, unknown>;
};

export async function demoAmazonCall<T extends Record<string, unknown>>(
  call: DemoCall,
): Promise<{ ok: true } & T> {
  await new Promise((resolve) => setTimeout(resolve, DEMO_DELAY_MS));

  const base = {
    ok: true as const,
    commandId: `demo-${call.type}-${Date.now()}`,
    acceptedStatus: "accepted",
    deviceId: call.deviceId,
    mocked: true,
  };

  if (call.type === "screenshot") {
    return {
      ...base,
      screenshotUrl: `https://mock.signage.amazon.com/screenshots/${encodeURIComponent(
        call.deviceId,
      )}/${Date.now()}.png`,
    } as unknown as { ok: true } & T;
  }

  if (call.type === "status") {
    return {
      ...base,
      status: {
        online: true,
        last_seen_at: new Date().toISOString(),
        firmware_version: "mock-1.0.0",
        uptime_s: 12345,
      },
    } as unknown as { ok: true } & T;
  }

  return base as unknown as { ok: true } & T;
}
