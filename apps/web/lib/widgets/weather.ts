import "server-only";

import type { WeatherConfig, WeatherPayload } from "@drip-tv/shared";
import { getCached, setCached } from "./cache";

const TTL_SEC = 15 * 60;
const BASE = "https://api.openweathermap.org";

type OwmCurrent = {
  name?: string;
  main?: { temp?: number };
  weather?: Array<{ main?: string; description?: string; icon?: string }>;
  sys?: { country?: string };
};

type OwmForecastEntry = {
  dt?: number;
  main?: { temp?: number; temp_min?: number; temp_max?: number };
  weather?: Array<{ icon?: string }>;
  dt_txt?: string;
};

type OwmForecast = {
  city?: { name?: string };
  list?: OwmForecastEntry[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function expIso(ttlSec: number): string {
  return new Date(Date.now() + ttlSec * 1000).toISOString();
}

function stubbedPayload(location: string, warning: string): WeatherPayload {
  return {
    kind: "weather",
    location,
    tempF: 0,
    tempC: 0,
    condition: warning,
    icon: "01d",
    forecast: [],
    fetched_at: nowIso(),
    expires_at: expIso(TTL_SEC),
  };
}

function fToC(f: number): number {
  return Math.round(((f - 32) * 5) / 9);
}

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dayLabelForTs(ts: number): string {
  const d = new Date(ts * 1000);
  const idx = d.getUTCDay();
  return DAY_NAMES[idx] ?? "—";
}

/**
 * Reduce the 3-hour 5-day forecast list into one entry per calendar day with
 * hi/lo and a representative icon (we pick the entry closest to local noon UTC).
 */
function summarizeForecast(list: OwmForecastEntry[]): WeatherPayload["forecast"] {
  const byDay = new Map<string, { hi: number; lo: number; icon: string; ts: number }>();
  for (const entry of list) {
    if (typeof entry.dt !== "number") continue;
    const d = new Date(entry.dt * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    const temp = entry.main?.temp ?? 0;
    const tempMax = entry.main?.temp_max ?? temp;
    const tempMin = entry.main?.temp_min ?? temp;
    const icon = entry.weather?.[0]?.icon ?? "01d";
    const existing = byDay.get(key);
    if (!existing) {
      byDay.set(key, { hi: tempMax, lo: tempMin, icon, ts: entry.dt });
    } else {
      existing.hi = Math.max(existing.hi, tempMax);
      existing.lo = Math.min(existing.lo, tempMin);
      // Prefer a midday icon if available (closest to 12:00 UTC).
      const existingHour = new Date(existing.ts * 1000).getUTCHours();
      const candidateHour = d.getUTCHours();
      if (Math.abs(candidateHour - 12) < Math.abs(existingHour - 12)) {
        existing.icon = icon;
        existing.ts = entry.dt;
      }
    }
  }

  return [...byDay.values()]
    .sort((a, b) => a.ts - b.ts)
    .slice(0, 5)
    .map((d) => ({
      day: dayLabelForTs(d.ts),
      hi: Math.round(d.hi),
      lo: Math.round(d.lo),
      icon: d.icon,
    }));
}

function cacheKey(config: WeatherConfig): string {
  if (config.zip) return `weather:zip:${config.zip}:${config.country}:${config.units}`;
  if (typeof config.lat === "number" && typeof config.lon === "number") {
    return `weather:ll:${config.lat.toFixed(2)}:${config.lon.toFixed(2)}:${config.units}`;
  }
  return `weather:unknown:${config.units}`;
}

function buildQuery(config: WeatherConfig, apiKey: string): URLSearchParams | null {
  const units = config.units === "metric" ? "metric" : "imperial";
  if (config.zip) {
    return new URLSearchParams({
      zip: `${config.zip},${config.country}`,
      units,
      appid: apiKey,
    });
  }
  if (typeof config.lat === "number" && typeof config.lon === "number") {
    return new URLSearchParams({
      lat: String(config.lat),
      lon: String(config.lon),
      units,
      appid: apiKey,
    });
  }
  return null;
}

export async function fetchWeather(config: WeatherConfig): Promise<WeatherPayload> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return stubbedPayload(config.zip ?? "Unknown", "Missing API key");
  }

  const key = cacheKey(config);
  const cached = getCached<WeatherPayload>(key);
  if (cached) return cached;

  const query = buildQuery(config, apiKey);
  if (!query) {
    return stubbedPayload("Unknown", "Missing location");
  }

  try {
    const currentUrl = `${BASE}/data/2.5/weather?${query.toString()}`;
    const currentRes = await fetch(currentUrl, { cache: "no-store" });
    if (!currentRes.ok) {
      return stubbedPayload(config.zip ?? "Unknown", `Weather API error ${currentRes.status}`);
    }
    const current = (await currentRes.json()) as OwmCurrent;

    let forecast: WeatherPayload["forecast"] = [];
    if (config.showForecast) {
      const forecastUrl = `${BASE}/data/2.5/forecast?${query.toString()}`;
      const forecastRes = await fetch(forecastUrl, { cache: "no-store" });
      if (forecastRes.ok) {
        const f = (await forecastRes.json()) as OwmForecast;
        forecast = summarizeForecast(f.list ?? []);
      }
    }

    const tempRaw = current.main?.temp ?? 0;
    const tempF = config.units === "metric" ? cToF(tempRaw) : Math.round(tempRaw);
    const tempC = config.units === "metric" ? Math.round(tempRaw) : fToC(tempRaw);

    const payload: WeatherPayload = {
      kind: "weather",
      location: current.name ?? config.zip ?? "Unknown",
      tempF,
      tempC,
      condition: current.weather?.[0]?.description ?? current.weather?.[0]?.main ?? "—",
      icon: current.weather?.[0]?.icon ?? "01d",
      forecast,
      fetched_at: nowIso(),
      expires_at: expIso(TTL_SEC),
    };

    setCached(key, payload, TTL_SEC);
    return payload;
  } catch (err) {
    return stubbedPayload(
      config.zip ?? "Unknown",
      `Weather fetch failed: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }
}
