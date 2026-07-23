import "server-only";

import type { SportsConfig, SportsEvent, SportsPayload } from "@drip-tv/shared";
import { getCached, setCached } from "./cache";

const TTL_SEC = 30 * 60;
const BASE = "https://www.thesportsdb.com/api/v1/json/3";

type SdbLeague = {
  idLeague?: string | null;
  strLeague?: string | null;
  strLeagueAlternate?: string | null;
};

type SdbLeaguesResponse = {
  leagues?: SdbLeague[] | null;
};

type SdbTeam = {
  idTeam?: string | null;
  strTeam?: string | null;
  strLeague?: string | null;
  strAlternate?: string | null;
};

type SdbTeamsResponse = {
  teams?: SdbTeam[] | null;
};

type SdbEvent = {
  idEvent?: string | null;
  strEvent?: string | null;
  strHomeTeam?: string | null;
  strAwayTeam?: string | null;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  dateEvent?: string | null;
  strTimestamp?: string | null;
  strStatus?: string | null;
  strLeague?: string | null;
};

type SdbEventsResponse = {
  events?: SdbEvent[] | null;
  results?: SdbEvent[] | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function expIso(ttlSec: number): string {
  return new Date(Date.now() + ttlSec * 1000).toISOString();
}

function stub(league: string, team: string | null, warning: string): SportsPayload {
  return {
    kind: "sports",
    league,
    team,
    mode: team ? "next" : "recent",
    events: [],
    warning,
    fetched_at: nowIso(),
    expires_at: expIso(TTL_SEC),
  };
}

function cacheKey(config: SportsConfig): string {
  return `sports:${config.league.toLowerCase()}:${(config.team ?? "").toLowerCase()}`;
}

function parseScore(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function resolveLeagueId(leagueName: string): Promise<{ id: string; name: string } | null> {
  const cacheHit = getCached<{ id: string; name: string }>(`sports:leagueid:${normalize(leagueName)}`);
  if (cacheHit) return cacheHit;

  const json = await fetchJson<SdbLeaguesResponse>(`${BASE}/all_leagues.php`);
  if (!json?.leagues) return null;

  const needle = normalize(leagueName);
  const match =
    json.leagues.find((l) => normalize(l.strLeague ?? "") === needle) ??
    json.leagues.find((l) => normalize(l.strLeagueAlternate ?? "") === needle) ??
    json.leagues.find((l) =>
      normalize(l.strLeague ?? "").includes(needle) ||
      normalize(l.strLeagueAlternate ?? "").includes(needle),
    );

  if (!match?.idLeague || !match.strLeague) return null;
  const resolved = { id: match.idLeague, name: match.strLeague };
  setCached(`sports:leagueid:${needle}`, resolved, 24 * 60 * 60);
  return resolved;
}

async function resolveTeamId(teamName: string, leagueName: string): Promise<string | null> {
  const key = `sports:teamid:${normalize(teamName)}:${normalize(leagueName)}`;
  const cacheHit = getCached<string>(key);
  if (cacheHit) return cacheHit;

  const json = await fetchJson<SdbTeamsResponse>(
    `${BASE}/searchteams.php?t=${encodeURIComponent(teamName)}`,
  );
  if (!json?.teams) return null;

  const needleLeague = normalize(leagueName);
  const match =
    json.teams.find(
      (t) => normalize(t.strTeam ?? "") === normalize(teamName) &&
        normalize(t.strLeague ?? "") === needleLeague,
    ) ??
    json.teams.find((t) => normalize(t.strTeam ?? "") === normalize(teamName)) ??
    json.teams[0];

  if (!match?.idTeam) return null;
  setCached(key, match.idTeam, 24 * 60 * 60);
  return match.idTeam;
}

function toEvent(e: SdbEvent, mode: "recent" | "next"): SportsEvent | null {
  const id = e.idEvent;
  const home = e.strHomeTeam;
  const away = e.strAwayTeam;
  if (!id || !home || !away) return null;
  const date = e.strTimestamp ?? e.dateEvent ?? nowIso();
  return {
    id,
    home,
    away,
    homeScore: parseScore(e.intHomeScore),
    awayScore: parseScore(e.intAwayScore),
    date,
    status: mode === "recent" ? "final" : "scheduled",
  };
}

export async function fetchSports(config: SportsConfig): Promise<SportsPayload> {
  const key = cacheKey(config);
  const cached = getCached<SportsPayload>(key);
  if (cached) return cached;

  const league = await resolveLeagueId(config.league);
  if (!league) {
    const payload = stub(config.league, config.team ?? null, `League "${config.league}" not found`);
    setCached(key, payload, 5 * 60);
    return payload;
  }

  // Team specified → show next 5 fixtures for the team.
  if (config.team) {
    const teamId = await resolveTeamId(config.team, league.name);
    if (!teamId) {
      const payload = stub(
        league.name,
        config.team,
        `Team "${config.team}" not found in ${league.name}`,
      );
      setCached(key, payload, 5 * 60);
      return payload;
    }
    const json = await fetchJson<SdbEventsResponse>(`${BASE}/eventsnext.php?id=${teamId}`);
    const raw = json?.events ?? [];
    const events = raw
      .map((e) => toEvent(e, "next"))
      .filter((e): e is SportsEvent => e !== null)
      .slice(0, 5);
    const payload: SportsPayload = {
      kind: "sports",
      league: league.name,
      team: config.team,
      mode: "next",
      events,
      warning: events.length === 0 ? "No upcoming fixtures" : undefined,
      fetched_at: nowIso(),
      expires_at: expIso(TTL_SEC),
    };
    setCached(key, payload, TTL_SEC);
    return payload;
  }

  // No team → show recent league results.
  const json = await fetchJson<SdbEventsResponse>(`${BASE}/eventspastleague.php?id=${league.id}`);
  const raw = json?.events ?? [];
  const events = raw
    .map((e) => toEvent(e, "recent"))
    .filter((e): e is SportsEvent => e !== null)
    .slice(0, 5);
  const payload: SportsPayload = {
    kind: "sports",
    league: league.name,
    team: null,
    mode: "recent",
    events,
    warning: events.length === 0 ? "No recent results" : undefined,
    fetched_at: nowIso(),
    expires_at: expIso(TTL_SEC),
  };
  setCached(key, payload, TTL_SEC);
  return payload;
}
