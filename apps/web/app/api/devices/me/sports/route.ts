import { NextResponse } from "next/server";
import { SPORTS_LEAGUES, type SportsEvent } from "@drip-tv/shared";
import { requireDeviceFromRequest, DeviceAuthError } from "@/lib/device-auth";
import { fetchSports } from "@/lib/widgets/sports";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_LEAGUES = 3; // bound external calls / rate limits
const MAX_EVENTS = 8;

export type DeviceSportsRow = SportsEvent & { league: string };
export type DeviceSportsPayload = {
  leagues: string[];
  events: DeviceSportsRow[];
  warning?: string;
  fetched_at: string;
  expires_at: string;
};

/**
 * GET /api/devices/me/sports?leagues=NFL,NBA
 *
 * Device-authed. Returns recent results merged across the requested leagues
 * (defaults to all supported leagues). Each event is tagged with its league so
 * the player can show a mixed scoreboard.
 */
export async function GET(req: Request) {
  try {
    await requireDeviceFromRequest(req);
  } catch (err) {
    const status = err instanceof DeviceAuthError ? err.status : 401;
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status });
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get("leagues");
  const requested = raw
    ? raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => (SPORTS_LEAGUES as readonly string[]).includes(s))
    : [];
  const leagues = (requested.length > 0 ? requested : [...SPORTS_LEAGUES]).slice(0, MAX_LEAGUES);

  const groups = await Promise.all(
    leagues.map((league) => fetchSports({ kind: "sports", league, units: "imperial" })),
  );

  const events: DeviceSportsRow[] = groups
    .flatMap((g) => g.events.map((e) => ({ ...e, league: g.league })))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, MAX_EVENTS);

  const payload: DeviceSportsPayload = {
    leagues,
    events,
    warning: events.length === 0 ? "No recent results" : undefined,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
