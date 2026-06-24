import "server-only";
import { demoAmazonCall, isDemoMode } from "./__demo";

/**
 * Amazon Signage Remote Management API client.
 *
 * Wraps an OAuth2-client-credentials flow + REST surface inferred from the
 * shape of comparable AWS hardware-management APIs. The real product hasn't
 * shipped public docs in this sandbox, so the endpoint paths below are a
 * best-guess that we'll firm up once we have the integration handshake.
 *
 * Behavior contract for callers:
 *   - When creds are missing → returns `{ ok:false, code:'AMAZON_API_NOT_CONFIGURED' }`.
 *     Callers should still queue the command so the player can pick up any
 *     player-level work.
 *   - On network/HTTP errors → `{ ok:false, code:'AMAZON_API_ERROR', detail }`.
 *     Never throws — `dispatchCommand` shouldn't crash because of upstream weather.
 */

type Ok<T> = { ok: true } & T;
type Err = {
  ok: false;
  code: "AMAZON_API_NOT_CONFIGURED" | "AMAZON_API_ERROR" | "AMAZON_API_BAD_RESPONSE";
  warning?: string;
  detail?: unknown;
};

export type AmazonResult<T = Record<string, unknown>> = Ok<T> | Err;

const DEFAULT_API_BASE = "https://api.signage.amazon.com";
const TOKEN_PATH = "/oauth2/token";
const TOKEN_SAFETY_WINDOW_MS = 60_000;

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function getApiBase(): string {
  return process.env.AMAZON_SIGNAGE_API_BASE ?? DEFAULT_API_BASE;
}

function getCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.AMAZON_SIGNAGE_CLIENT_ID;
  const clientSecret = process.env.AMAZON_SIGNAGE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function notConfigured(): Err {
  return {
    ok: false,
    code: "AMAZON_API_NOT_CONFIGURED",
    warning:
      "AMAZON_SIGNAGE_CLIENT_ID / AMAZON_SIGNAGE_CLIENT_SECRET not set; command was queued for player-level pickup only.",
  };
}

function apiError(detail: unknown): Err {
  return { ok: false, code: "AMAZON_API_ERROR", detail };
}

/**
 * Returns a cached access token, refreshing when it's within the safety window
 * of expiry. Returns null when creds are unset — callers should treat this as
 * "Amazon API not configured" and short-circuit.
 */
export async function getAccessToken(): Promise<string | null> {
  const creds = getCreds();
  if (!creds) return null;

  // In demo mode, hand back a fake token so the rest of the surface can run
  // through its normal happy-path branches.
  if (isDemoMode()) {
    if (!tokenCache || tokenCache.expiresAt - TOKEN_SAFETY_WINDOW_MS < Date.now()) {
      tokenCache = {
        accessToken: "demo-token",
        expiresAt: Date.now() + 60 * 60 * 1000,
      };
    }
    return tokenCache.accessToken;
  }

  if (tokenCache && tokenCache.expiresAt - TOKEN_SAFETY_WINDOW_MS > Date.now()) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: "signage:devices:manage",
  });

  try {
    const res = await fetch(`${getApiBase()}${TOKEN_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });

    if (!res.ok) {
      tokenCache = null;
      return null;
    }

    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!data.access_token) {
      tokenCache = null;
      return null;
    }

    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return tokenCache.accessToken;
  } catch {
    tokenCache = null;
    return null;
  }
}

/**
 * Internal: post a command to the device's command endpoint.
 *
 * Amazon's surface, in the shape we've inferred, takes:
 *   POST {API_BASE}/v1/devices/{id}/commands
 *   body: { type: '<command-name>', payload?: {...} }
 *
 * and returns `{ commandId, status, ... }`.
 */
async function postCommand<T extends Record<string, unknown>>(
  amazonDeviceId: string,
  type: string,
  payload?: Record<string, unknown>,
): Promise<AmazonResult<T>> {
  const creds = getCreds();
  if (!creds) return notConfigured();

  if (isDemoMode()) {
    return demoAmazonCall<T>({ type, deviceId: amazonDeviceId, payload });
  }

  const token = await getAccessToken();
  if (!token) return apiError("Failed to obtain access token");

  try {
    const res = await fetch(
      `${getApiBase()}/v1/devices/${encodeURIComponent(amazonDeviceId)}/commands`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ type, payload: payload ?? {} }),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      let detail: unknown = `HTTP ${res.status}`;
      try {
        detail = await res.json();
      } catch {
        try {
          detail = await res.text();
        } catch {
          // swallow
        }
      }
      return apiError(detail);
    }

    let data: T;
    try {
      data = (await res.json()) as T;
    } catch {
      return { ok: false, code: "AMAZON_API_BAD_RESPONSE" };
    }

    return { ok: true, ...data };
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err));
  }
}

export async function reboot(amazonDeviceId: string): Promise<AmazonResult> {
  return postCommand(amazonDeviceId, "reboot");
}

export async function powerOn(amazonDeviceId: string): Promise<AmazonResult> {
  return postCommand(amazonDeviceId, "power_on");
}

export async function powerOff(amazonDeviceId: string): Promise<AmazonResult> {
  return postCommand(amazonDeviceId, "power_off");
}

export async function factoryReset(amazonDeviceId: string): Promise<AmazonResult> {
  return postCommand(amazonDeviceId, "factory_reset");
}

/**
 * Triggers a screenshot capture. Amazon returns a (typically signed,
 * short-lived) URL pointing to a PNG hosted on their CDN.
 */
export async function captureScreenshot(
  amazonDeviceId: string,
): Promise<AmazonResult<{ screenshotUrl?: string }>> {
  const creds = getCreds();
  if (!creds) return notConfigured();

  if (isDemoMode()) {
    return demoAmazonCall<{ screenshotUrl?: string }>({
      type: "screenshot",
      deviceId: amazonDeviceId,
    });
  }

  const token = await getAccessToken();
  if (!token) return apiError("Failed to obtain access token");

  try {
    const res = await fetch(
      `${getApiBase()}/v1/devices/${encodeURIComponent(amazonDeviceId)}/screenshot`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      let detail: unknown = `HTTP ${res.status}`;
      try {
        detail = await res.json();
      } catch {
        // swallow
      }
      return apiError(detail);
    }

    let data: { screenshot_url?: string; url?: string };
    try {
      data = (await res.json()) as { screenshot_url?: string; url?: string };
    } catch {
      return { ok: false, code: "AMAZON_API_BAD_RESPONSE" };
    }

    return { ok: true, screenshotUrl: data.screenshot_url ?? data.url };
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Pulls device telemetry (online/offline, last seen, firmware, etc).
 */
export async function getDeviceStatus(
  amazonDeviceId: string,
): Promise<AmazonResult<{ status?: Record<string, unknown> }>> {
  const creds = getCreds();
  if (!creds) return notConfigured();

  if (isDemoMode()) {
    return demoAmazonCall<{ status?: Record<string, unknown> }>({
      type: "status",
      deviceId: amazonDeviceId,
    });
  }

  const token = await getAccessToken();
  if (!token) return apiError("Failed to obtain access token");

  try {
    const res = await fetch(
      `${getApiBase()}/v1/devices/${encodeURIComponent(amazonDeviceId)}`,
      {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      let detail: unknown = `HTTP ${res.status}`;
      try {
        detail = await res.json();
      } catch {
        // swallow
      }
      return apiError(detail);
    }

    let data: Record<string, unknown>;
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      return { ok: false, code: "AMAZON_API_BAD_RESPONSE" };
    }

    return { ok: true, status: data };
  } catch (err) {
    return apiError(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Test-only: clears the cached access token. Not part of the public API.
 */
export function __resetTokenCache(): void {
  tokenCache = null;
}
