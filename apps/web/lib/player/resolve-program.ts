import "server-only";
import {
  emptyProgram,
  type Display,
  type Program,
  type ProgramItem,
  type ResolvedMedia,
} from "@drip-tv/shared";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { signedReadUrl } from "@/lib/media/storage";
import { coerceLayoutToDisplay } from "@/lib/displays/coerce";
import type { DeviceRow } from "@/lib/device-auth";

const PROGRAM_VALIDITY_SEC = 60;
const SIGNED_URL_TTL_SEC = 60 * 60; // 1h — comfortably longer than validity

type ScheduleRow = {
  id: string;
  name: string;
  priority: number;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string;
};

type MediaRow = {
  id: string;
  name: string;
  type: "image" | "video";
  storage_path: string | null;
  mime: string | null;
  mux_playback_id: string | null;
  hls_url: string | null;
  status: string;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Wall-clock fields for `date` as observed in `timeZone`. */
function zonedParts(date: Date, timeZone: string) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).formatToParts(date);
  } catch {
    // Unknown timezone — fall back to UTC.
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).formatToParts(date);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // some engines emit 24 for midnight
  const minute = Number(get("minute"));
  const weekday = WEEKDAY_INDEX[get("weekday")] ?? 0;
  return {
    dateNum: year * 10000 + month * 100 + day,
    minutes: hour * 60 + minute,
    weekday,
  };
}

function dateStrToNum(d: string): number {
  // "YYYY-MM-DD" → YYYYMMDD
  const [y, m, day] = d.split("-").map((x) => Number(x));
  return (y ?? 0) * 10000 + (m ?? 0) * 100 + (day ?? 0);
}

function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(":").map((x) => Number(x));
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Is a schedule active at `now`, honoring its date/day/time-of-day window? */
export function isScheduleActiveNow(s: ScheduleRow, now: Date): boolean {
  const { dateNum, minutes, weekday } = zonedParts(now, s.timezone || "America/New_York");

  if (s.start_date && dateNum < dateStrToNum(s.start_date)) return false;
  if (s.end_date && dateNum > dateStrToNum(s.end_date)) return false;

  if (s.days_of_week && s.days_of_week.length > 0 && !s.days_of_week.includes(weekday)) {
    return false;
  }

  if (s.start_time && s.end_time) {
    const start = timeStrToMinutes(s.start_time);
    const end = timeStrToMinutes(s.end_time);
    if (start <= end) {
      if (minutes < start || minutes >= end) return false;
    } else {
      // Overnight window (e.g. 22:00 → 06:00).
      if (minutes < start && minutes >= end) return false;
    }
  }

  return true;
}

/** Best playable URL for a media asset, or null if none can be produced. */
async function resolveMediaUrl(
  svc: ReturnType<typeof createSupabaseServiceClient>,
  m: MediaRow,
): Promise<string | null> {
  if (m.type === "video") {
    if (m.mux_playback_id) return `https://stream.mux.com/${m.mux_playback_id}.m3u8`;
    if (m.hls_url) return m.hls_url;
  }
  if (m.storage_path) {
    return signedReadUrl(svc, m.storage_path, SIGNED_URL_TTL_SEC);
  }
  return null;
}

function collectMediaIdsFromDisplay(display: Display, into: Set<string>): void {
  for (const page of display.pages) {
    for (const zone of page.zones) {
      if (zone.content.kind === "media") into.add(zone.content.mediaId);
    }
  }
}

/**
 * Resolve the program a device should be playing right now: its active
 * schedule → playlists → items, with displays and media fully expanded.
 * Returns an empty program when nothing is scheduled.
 */
export async function resolveProgramForDevice(device: DeviceRow): Promise<Program> {
  const svc = createSupabaseServiceClient();
  const now = new Date();
  const generatedAt = now.toISOString();
  const validUntil = new Date(now.getTime() + PROGRAM_VALIDITY_SEC * 1000).toISOString();
  const empty = () => emptyProgram(generatedAt, validUntil);

  // 1. Schedules targeting this device directly or via its location.
  const orParts = [`device_id.eq.${device.id}`];
  if (device.location_id) orParts.push(`location_id.eq.${device.location_id}`);
  const { data: targets } = await svc
    .from("schedule_targets")
    .select("schedule_id")
    .or(orParts.join(","));

  const scheduleIds = Array.from(
    new Set((targets ?? []).map((t) => t.schedule_id as string)),
  );
  if (scheduleIds.length === 0) return empty();

  // 2. Load those schedules and pick the highest-priority one active now.
  const { data: schedules } = await svc
    .from("schedules")
    .select(
      "id, name, priority, start_date, end_date, days_of_week, start_time, end_time, timezone",
    )
    .in("id", scheduleIds);

  const active = (schedules ?? [])
    .map((s) => s as ScheduleRow)
    .filter((s) => isScheduleActiveNow(s, now))
    .sort((a, b) => b.priority - a.priority);

  const chosen = active[0];
  if (!chosen) return empty();

  // 3. Playlists attached to the chosen schedule, in order.
  const { data: schedulePlaylists } = await svc
    .from("schedule_playlists")
    .select("playlist_id, position")
    .eq("schedule_id", chosen.id)
    .order("position", { ascending: true });

  const playlistOrder = (schedulePlaylists ?? []).map((sp) => sp.playlist_id as string);
  if (playlistOrder.length === 0) return empty();
  const orderIndex = new Map(playlistOrder.map((id, i) => [id, i]));

  // 4. Playlist meta (for default durations / loop) and their items.
  const { data: playlists } = await svc
    .from("playlists")
    .select("id, loop, default_item_duration_sec")
    .in("id", playlistOrder);
  const defaultDuration = new Map(
    (playlists ?? []).map((p) => [p.id as string, (p.default_item_duration_sec as number) ?? 10]),
  );
  const anyLoop = (playlists ?? []).some((p) => p.loop === true) || playlists?.length === 0;

  const { data: itemRows } = await svc
    .from("playlist_items")
    .select("id, playlist_id, position, display_id, media_id, duration_sec")
    .in("playlist_id", playlistOrder)
    .order("position", { ascending: true });

  const items = (itemRows ?? []).slice().sort((a, b) => {
    const pa = orderIndex.get(a.playlist_id as string) ?? 0;
    const pb = orderIndex.get(b.playlist_id as string) ?? 0;
    if (pa !== pb) return pa - pb;
    return (a.position as number) - (b.position as number);
  });
  if (items.length === 0) return empty();

  // 5. Fetch referenced displays + media in bulk.
  const displayIds = Array.from(
    new Set(items.filter((i) => i.display_id).map((i) => i.display_id as string)),
  );
  const directMediaIds = new Set(
    items.filter((i) => i.media_id).map((i) => i.media_id as string),
  );

  const displayMap = new Map<string, Display>();
  if (displayIds.length > 0) {
    const { data: displayRows } = await svc
      .from("displays")
      .select("id, name, aspect_ratio, layout_json, version")
      .in("id", displayIds);
    for (const row of displayRows ?? []) {
      const d = coerceLayoutToDisplay(
        row.id as string,
        row.name as string,
        row.aspect_ratio as string,
        row.layout_json,
        row.version as number,
      );
      if (d) {
        displayMap.set(d.id, d);
        collectMediaIdsFromDisplay(d, directMediaIds);
      }
    }
  }

  const mediaMap = new Map<string, { row: MediaRow; url: string }>();
  const mediaIds = Array.from(directMediaIds);
  if (mediaIds.length > 0) {
    const { data: mediaRows } = await svc
      .from("media_assets")
      .select("id, name, type, storage_path, mime, mux_playback_id, hls_url, status")
      .in("id", mediaIds);
    for (const raw of mediaRows ?? []) {
      const row = raw as MediaRow;
      const url = await resolveMediaUrl(svc, row);
      if (url) mediaMap.set(row.id, { row, url });
    }
  }

  // 6. Build the ordered program items.
  const programItems: ProgramItem[] = [];
  for (const item of items) {
    if (item.display_id) {
      const display = displayMap.get(item.display_id as string);
      if (display) {
        programItems.push({
          type: "display",
          itemId: item.id as string,
          playlistId: item.playlist_id as string,
          displayId: display.id,
          name: display.name,
          display,
        });
      }
    } else if (item.media_id) {
      const resolved = mediaMap.get(item.media_id as string);
      if (resolved) {
        programItems.push({
          type: "media",
          itemId: item.id as string,
          playlistId: item.playlist_id as string,
          mediaId: resolved.row.id,
          name: resolved.row.name,
          mediaType: resolved.row.type,
          url: resolved.url,
          mime: resolved.row.mime,
          durationSec:
            (item.duration_sec as number) ||
            defaultDuration.get(item.playlist_id as string) ||
            10,
        });
      }
    }
  }

  if (programItems.length === 0) return empty();

  const media: ResolvedMedia[] = Array.from(mediaMap.values()).map(({ row, url }) => ({
    mediaId: row.id,
    mediaType: row.type,
    url,
    mime: row.mime,
  }));

  return {
    scheduleId: chosen.id,
    scheduleName: chosen.name,
    items: programItems,
    media,
    loop: anyLoop,
    generatedAt,
    validUntil,
  };
}
