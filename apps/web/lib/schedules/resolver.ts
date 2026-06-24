import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type ResolveResult = {
  playlistId: string | null;
  source: "schedule" | "default";
};

type DeviceRow = {
  id: string;
  location_id: string | null;
};

type ScheduleRow = {
  id: string;
  priority: number;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string;
};

type SchedulePlaylistRow = {
  schedule_id: string;
  playlist_id: string;
  position: number;
};

type LocationRow = {
  id: string;
  timezone: string;
};

/**
 * Returns a YYYY-MM-DD string and HH:MM:SS string for the given instant rendered
 * in the given IANA timezone. Uses Intl so we don't need any tz libs.
 */
function localDateAndTime(now: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  weekday: number; // 0=Sun .. 6=Sat
  seconds: number; // seconds since midnight
} {
  // Intl returns parts; we use long weekday and numeric for the rest.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const hour = Number(map.hour ?? "0");
  // Intl can return 24 for midnight in `hour12: false` mode in some runtimes.
  const normHour = hour === 24 ? 0 : hour;
  const minute = Number(map.minute ?? "0");
  const second = Number(map.second ?? "0");

  return {
    year: Number(map.year ?? "1970"),
    month: Number(map.month ?? "1"),
    day: Number(map.day ?? "1"),
    weekday: weekdayMap[map.weekday ?? "Sun"] ?? 0,
    seconds: normHour * 3600 + minute * 60 + second,
  };
}

/** Compare YMD against an ISO date string (YYYY-MM-DD) returning -1/0/1. */
function compareYmd(
  a: { year: number; month: number; day: number },
  isoDate: string,
): number {
  const parts = isoDate.split("-");
  const y = Number(parts[0] ?? "0");
  const m = Number(parts[1] ?? "0");
  const d = Number(parts[2] ?? "0");
  if (a.year !== y) return a.year < y ? -1 : 1;
  if (a.month !== m) return a.month < m ? -1 : 1;
  if (a.day !== d) return a.day < d ? -1 : 1;
  return 0;
}

/** Parse HH:MM[:SS] into seconds since midnight. */
function timeStringToSeconds(t: string): number {
  const [h = "0", m = "0", s = "0"] = t.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function matchesSchedule(
  s: ScheduleRow,
  now: Date,
  fallbackTz: string,
): boolean {
  const tz = s.timezone || fallbackTz || "UTC";
  let local;
  try {
    local = localDateAndTime(now, tz);
  } catch {
    return false;
  }

  if (s.start_date && compareYmd(local, s.start_date) < 0) return false;
  if (s.end_date && compareYmd(local, s.end_date) > 0) return false;

  if (s.days_of_week && s.days_of_week.length > 0) {
    if (!s.days_of_week.includes(local.weekday)) return false;
  }

  if (s.start_time || s.end_time) {
    const startSec = s.start_time ? timeStringToSeconds(s.start_time) : 0;
    const endSec = s.end_time ? timeStringToSeconds(s.end_time) : 24 * 3600;
    if (startSec <= endSec) {
      // Normal window: start <= now < end.
      if (local.seconds < startSec || local.seconds >= endSec) return false;
    } else {
      // Overnight window (e.g. 22:00 → 06:00): now >= start OR now < end.
      if (!(local.seconds >= startSec || local.seconds < endSec)) return false;
    }
  }

  return true;
}

/**
 * Resolve which playlist a device should be playing right now.
 *
 * Flow: device → schedules targeting that device (directly or via location) →
 * filter by date / time-of-day / day-of-week (in the schedule's tz, falling
 * back to the location's tz) → pick the highest-priority match, then its
 * first playlist by `position`. If nothing matches, returns `null`.
 */
export async function resolveCurrentPlaylist(
  deviceId: string,
  now: Date,
): Promise<ResolveResult> {
  const service = createSupabaseServiceClient();

  const { data: device, error: deviceErr } = await service
    .from("devices")
    .select("id, location_id")
    .eq("id", deviceId)
    .maybeSingle<DeviceRow>();

  if (deviceErr || !device) return { playlistId: null, source: "default" };

  let locationTz = "America/New_York";
  if (device.location_id) {
    const { data: loc } = await service
      .from("locations")
      .select("id, timezone")
      .eq("id", device.location_id)
      .maybeSingle<LocationRow>();
    if (loc?.timezone) locationTz = loc.timezone;
  }

  // Pull all schedule targets that match either this device directly or its
  // location, then load the parent schedules.
  const orConditions: string[] = [`device_id.eq.${deviceId}`];
  if (device.location_id) orConditions.push(`location_id.eq.${device.location_id}`);

  const { data: targets } = await service
    .from("schedule_targets")
    .select("schedule_id")
    .or(orConditions.join(","));

  const scheduleIds = Array.from(
    new Set(((targets ?? []) as Array<{ schedule_id: string }>).map((t) => t.schedule_id)),
  );

  if (scheduleIds.length === 0) {
    return {
      playlistId: null,
      source: "default",
    };
  }

  const { data: schedules } = await service
    .from("schedules")
    .select("id, priority, start_date, end_date, days_of_week, start_time, end_time, timezone")
    .in("id", scheduleIds);

  const matching = ((schedules ?? []) as ScheduleRow[]).filter((s) =>
    matchesSchedule(s, now, locationTz),
  );

  if (matching.length === 0) {
    return {
      playlistId: null,
      source: "default",
    };
  }

  matching.sort((a, b) => b.priority - a.priority);
  const winner = matching[0];
  if (!winner) {
    return {
      playlistId: null,
      source: "default",
    };
  }

  const { data: pls } = await service
    .from("schedule_playlists")
    .select("schedule_id, playlist_id, position")
    .eq("schedule_id", winner.id)
    .order("position", { ascending: true })
    .limit(1);

  const first = ((pls ?? []) as SchedulePlaylistRow[])[0];
  if (!first) {
    return {
      playlistId: null,
      source: "default",
    };
  }

  return { playlistId: first.playlist_id, source: "schedule" };
}
