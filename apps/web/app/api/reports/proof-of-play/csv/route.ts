import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/reports/proof-of-play/csv?from=YYYY-MM-DD&to=YYYY-MM-DD&device=ID
 *
 * Returns a CSV row per (date, device, media) bucket with headers:
 *   date, device_name, media_name, plays, total_duration_ms
 *
 * Reads through `createSupabaseServerClient()` so RLS scopes the
 * result to the requesting user's org/locations.
 */

function isIsoDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isUuid(value: string | null): value is string {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setUTCDate(fromDate.getUTCDate() - 6);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: Request) {
  const { supabase } = await requireUser();

  const url = new URL(req.url);
  const defaults = defaultRange();
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const deviceRaw = url.searchParams.get("device");
  const from = isIsoDate(fromRaw) ? fromRaw : defaults.from;
  const to = isIsoDate(toRaw) ? toRaw : defaults.to;
  const deviceId = isUuid(deviceRaw) ? deviceRaw : undefined;

  // Inclusive upper bound: bump `to` to next day exclusive.
  const gte = `${from}T00:00:00.000Z`;
  const toDate = new Date(`${to}T00:00:00.000Z`);
  toDate.setUTCDate(toDate.getUTCDate() + 1);
  const lt = toDate.toISOString();

  let query = supabase
    .from("playback_events")
    .select("device_id, ts, media_id, duration_ms")
    .gte("ts", gte)
    .lt("ts", lt);
  if (deviceId) query = query.eq("device_id", deviceId);

  const { data: eventsData, error } = await query.limit(100000);
  if (error) {
    return NextResponse.json(
      { error: "Failed to load playback events", detail: error.message },
      { status: 500 },
    );
  }
  const events = (eventsData ?? []) as Array<{
    device_id: string;
    ts: string;
    media_id: string | null;
    duration_ms: number;
  }>;

  // Bucket per (date, device_id, media_id).
  type Agg = { plays: number; total_duration_ms: number };
  const buckets = new Map<string, Agg>();
  const deviceIds = new Set<string>();
  const mediaIds = new Set<string>();
  for (const evt of events) {
    const date = evt.ts.slice(0, 10);
    const mediaKey = evt.media_id ?? "__null__";
    const key = `${date}|${evt.device_id}|${mediaKey}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { plays: 0, total_duration_ms: 0 };
      buckets.set(key, bucket);
    }
    bucket.plays += 1;
    bucket.total_duration_ms += evt.duration_ms;
    deviceIds.add(evt.device_id);
    if (evt.media_id) mediaIds.add(evt.media_id);
  }

  // Hydrate device + media names.
  const deviceNames = new Map<string, string>();
  if (deviceIds.size > 0) {
    const { data: deviceRows } = await supabase
      .from("devices")
      .select("id, name")
      .in("id", Array.from(deviceIds));
    for (const row of deviceRows ?? []) {
      const id = row.id as string | null;
      const name = row.name as string | null;
      if (id) deviceNames.set(id, name ?? "Unnamed device");
    }
  }
  const mediaNames = new Map<string, string>();
  if (mediaIds.size > 0) {
    const { data: mediaRows } = await supabase
      .from("media_assets")
      .select("id, name")
      .in("id", Array.from(mediaIds));
    for (const row of mediaRows ?? []) {
      const id = row.id as string | null;
      const name = row.name as string | null;
      if (id) mediaNames.set(id, name ?? "Untitled");
    }
  }

  const lines: string[] = [
    ["date", "device_name", "media_name", "plays", "total_duration_ms"].join(
      ",",
    ),
  ];

  const sortedKeys = Array.from(buckets.keys()).sort();
  for (const key of sortedKeys) {
    const agg = buckets.get(key);
    if (!agg) continue;
    const parts = key.split("|");
    const date = parts[0] ?? "";
    const devId = parts[1] ?? "";
    const medKey = parts[2] ?? "__null__";
    const deviceName = deviceNames.get(devId) ?? "Unknown device";
    const mediaName =
      medKey === "__null__"
        ? "Unknown media"
        : mediaNames.get(medKey) ?? "Deleted media";
    lines.push(
      [
        csvEscape(date),
        csvEscape(deviceName),
        csvEscape(mediaName),
        csvEscape(agg.plays),
        csvEscape(agg.total_duration_ms),
      ].join(","),
    );
  }

  const body = lines.join("\n") + "\n";
  const filename = `proof-of-play_${from}_${to}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
