import "server-only";
import { SignJWT, jwtVerify } from "jose";

/**
 * Device JWT utilities — HS256 long-lived tokens used by Vega player sticks
 * to authenticate against the Drip TV control plane (heartbeats, schedule,
 * commands). Tokens expire after 1 year; rotation happens on re-pair.
 */

const DEV_FALLBACK_SECRET =
  "drip-tv-dev-only-device-jwt-secret-do-not-use-in-production";

let warnedAboutFallback = false;

function getSecret(): Uint8Array {
  const raw = process.env.DEVICE_JWT_SECRET;
  if (!raw || raw.length === 0) {
    if (!warnedAboutFallback) {
      warnedAboutFallback = true;
      // eslint-disable-next-line no-console
      console.warn(
        "[device-jwt] DEVICE_JWT_SECRET is not set — using deterministic dev fallback. " +
          "Set DEVICE_JWT_SECRET in production.",
      );
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }
  return new TextEncoder().encode(raw);
}

export type DeviceJwtPayload = {
  device_id: string;
  org_id: string;
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function signDeviceToken(payload: DeviceJwtPayload): Promise<string> {
  return new SignJWT({ device_id: payload.device_id, org_id: payload.org_id })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ONE_YEAR_SECONDS)
    .setSubject(payload.device_id)
    .setIssuer("drip-tv")
    .setAudience("drip-tv-player")
    .sign(getSecret());
}

export async function verifyDeviceToken(token: string): Promise<DeviceJwtPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: "drip-tv",
    audience: "drip-tv-player",
  });
  const device_id = typeof payload.device_id === "string" ? payload.device_id : null;
  const org_id = typeof payload.org_id === "string" ? payload.org_id : null;
  if (!device_id || !org_id) {
    throw new Error("Invalid device token payload");
  }
  return { device_id, org_id };
}
