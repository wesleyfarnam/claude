import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Reports queries — all read-only, all org-scoped via RLS through
 * `createSupabaseServerClient()`. RLS on `playback_events` joins to
 * `devices`, which is in turn org-scoped, so callers don't need to
 * filter by org_id directly. `orgId` is accepted on the API for
 * future-proofing (e.g. super-admins switching orgs).
 *
 * The `media_id` column on `playback_events` is a bare uuid (no FK to
 * `media_assets`), so we hydrate media names with a second query and
 * group/aggregate in memory. Date ranges are bounded so this stays
 * tractable.
 */

export type PlaybackSummaryRow = {
  media_id: string | null;
  media_name: string;
  plays: number;
  total_duration_ms: number;
  devices_count: number;
};

export type PlaybackByDeviceRow = {
  device_id: string;
  device_name: string;
  plays: number;
  total_duration_ms: number;
};

export type PlaybackTimelineRow = {
  date: string;
  plays: number;
  total_duration_ms: number;
};

export type PlaybackEventRow = {
  device_id: string;
  ts: string;
  media_id: string | null;
  duration_ms: number;
};

type Filters = {
  orgId: string;
  from: string; // ISO date (YYYY-MM-DD)
  to: string;   // ISO date (YYYY-MM-DD), inclusive
  deviceIds?: string[];
  mediaIds?: string[];
  deviceId?: string;
};

/**
 * Convert `YYYY-MM-DD` filters into an inclusive timestamptz range.
 * `from` becomes 00:00:00 UTC of that date; `to` becomes 00:00:00 UTC
 * of the next day (exclusive upper bound).
 */
function rangeBounds(from: string, to: string): { gte: string; lt: string } {
  const fromTs = `${from}T00:00:00.000Z`;
  // Add one day to `to` for an exclusive upper bound.
  const toDate = new Date(`${to}T00:00:00.000Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 1);
  const ltTs = toDate.toISOString();
  return { gte: fromTs, lt: ltTs };
}

/** YYYY-MM-DD from an ISO timestamp (UTC). */
function isoDate(ts: string): string {
  return ts.slice(0, 10);
}

async function fetchEvents(
  filters: Filters,
): Promise<PlaybackEventRow[]> {
  const supabase = await createSupabaseServerClient();
  const { gte, lt } = rangeBounds(filters.from, filters.to);

  let query = supabase
    .from("playback_events")
    .select("device_id, ts, media_id, duration_ms")
    .gte("ts", gte)
    .lt("ts", lt);

  if (filters.deviceIds && filters.deviceIds.length > 0) {
    query = query.in("device_id", filters.deviceIds);
  } else if (filters.deviceId) {
    query = query.eq("device_id", filters.deviceId);
  }
  if (filters.mediaIds && filters.mediaIds.length > 0) {
    query = query.in("media_id", filters.mediaIds);
  }

  // Cap at a sane upper bound — week-range UI rarely exceeds this.
  const { data, error } = await query.limit(50000);
  if (error) {
    throw new Error(`playback_events query failed: ${error.message}`);
  }
  return (data ?? []) as PlaybackEventRow[];
}

/**
 * Per-media breakdown across the range. Rows with no media_id (e.g.
 * display-only events) are bucketed under a single "Unknown media"
 * row.
 */
export async function playbackSummary(
  filters: { orgId: string; from: string; to: string; deviceIds?: string[]; mediaIds?: string[] },
): Promise<PlaybackSummaryRow[]> {
  const supabase = await createSupabaseServerClient();
  const events = await fetchEvents(filters);

  // Aggregate per media_id.
  type Agg = { plays: number; total_duration_ms: number; devices: Set<string> };
  const buckets = new Map<string, Agg>();
  const NULL_KEY = "__null__";

  for (const evt of events) {
    const key = evt.media_id ?? NULL_KEY;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { plays: 0, total_duration_ms: 0, devices: new Set<string>() };
      buckets.set(key, bucket);
    }
    bucket.plays += 1;
    bucket.total_duration_ms += evt.duration_ms;
    bucket.devices.add(evt.device_id);
  }

  // Hydrate media names.
  const mediaIds = Array.from(buckets.keys()).filter((k) => k !== NULL_KEY);
  const nameById = new Map<string, string>();
  if (mediaIds.length > 0) {
    const { data, error } = await supabase
      .from("media_assets")
      .select("id, name")
      .in("id", mediaIds);
    if (error) {
      throw new Error(`media_assets query failed: ${error.message}`);
    }
    for (const row of data ?? []) {
      const id = row.id as string | null;
      const name = row.name as string | null;
      if (id) nameById.set(id, name ?? "Untitled");
    }
  }

  const rows: PlaybackSummaryRow[] = [];
  for (const [key, agg] of buckets) {
    const media_id = key === NULL_KEY ? null : key;
    const media_name =
      media_id === null
        ? "Unknown media"
        : nameById.get(media_id) ?? "Deleted media";
    rows.push({
      media_id,
      media_name,
      plays: agg.plays,
      total_duration_ms: agg.total_duration_ms,
      devices_count: agg.devices.size,
    });
  }

  // Sort by plays desc, then duration desc.
  rows.sort((a, b) => b.plays - a.plays || b.total_duration_ms - a.total_duration_ms);
  return rows;
}

/**
 * Per-device breakdown across the range.
 */
export async function playbackByDevice(
  filters: { orgId: string; from: string; to: string },
): Promise<PlaybackByDeviceRow[]> {
  const supabase = await createSupabaseServerClient();
  const events = await fetchEvents(filters);

  type Agg = { plays: number; total_duration_ms: number };
  const buckets = new Map<string, Agg>();
  for (const evt of events) {
    let bucket = buckets.get(evt.device_id);
    if (!bucket) {
      bucket = { plays: 0, total_duration_ms: 0 };
      buckets.set(evt.device_id, bucket);
    }
    bucket.plays += 1;
    bucket.total_duration_ms += evt.duration_ms;
  }

  const deviceIds = Array.from(buckets.keys());
  const nameById = new Map<string, string>();
  if (deviceIds.length > 0) {
    const { data, error } = await supabase
      .from("devices")
      .select("id, name")
      .in("id", deviceIds);
    if (error) {
      throw new Error(`devices query failed: ${error.message}`);
    }
    for (const row of data ?? []) {
      const id = row.id as string | null;
      const name = row.name as string | null;
      if (id) nameById.set(id, name ?? "Unnamed device");
    }
  }

  const rows: PlaybackByDeviceRow[] = [];
  for (const [device_id, agg] of buckets) {
    rows.push({
      device_id,
      device_name: nameById.get(device_id) ?? "Unknown device",
      plays: agg.plays,
      total_duration_ms: agg.total_duration_ms,
    });
  }
  rows.sort((a, b) => b.plays - a.plays || b.total_duration_ms - a.total_duration_ms);
  return rows;
}

/**
 * Daily totals across the range. Buckets are computed from the event
 * `ts` (UTC date). Returns one row per day with activity — empty days
 * are omitted.
 */
export async function playbackTimeline(
  filters: { orgId: string; from: string; to: string; deviceId?: string },
): Promise<PlaybackTimelineRow[]> {
  const events = await fetchEvents(filters);

  type Agg = { plays: number; total_duration_ms: number };
  const buckets = new Map<string, Agg>();
  for (const evt of events) {
    const date = isoDate(evt.ts);
    let bucket = buckets.get(date);
    if (!bucket) {
      bucket = { plays: 0, total_duration_ms: 0 };
      buckets.set(date, bucket);
    }
    bucket.plays += 1;
    bucket.total_duration_ms += evt.duration_ms;
  }

  const rows: PlaybackTimelineRow[] = Array.from(buckets.entries()).map(
    ([date, agg]) => ({
      date,
      plays: agg.plays,
      total_duration_ms: agg.total_duration_ms,
    }),
  );
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}
