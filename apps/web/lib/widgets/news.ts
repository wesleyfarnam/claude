import "server-only";

import type { NewsConfig, NewsPayload } from "@drip-tv/shared";
import { getCached, setCached } from "./cache";

const TTL_SEC = 10 * 60;
const BASE = "https://newsapi.org/v2/top-headlines";

type NewsApiArticle = {
  title?: string | null;
  source?: { name?: string | null } | null;
  publishedAt?: string | null;
};

type NewsApiResponse = {
  status?: string;
  articles?: NewsApiArticle[];
  message?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function expIso(ttlSec: number): string {
  return new Date(Date.now() + ttlSec * 1000).toISOString();
}

function stubbedPayload(warning: string): NewsPayload {
  return {
    kind: "news",
    headlines: [
      { title: warning, source: "Drip TV", published_at: nowIso() },
    ],
    fetched_at: nowIso(),
    expires_at: expIso(TTL_SEC),
  };
}

function cacheKey(config: NewsConfig): string {
  return `news:${config.country}:${config.category}:${config.max}`;
}

export async function fetchNews(config: NewsConfig): Promise<NewsPayload> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    return stubbedPayload("Missing API key");
  }

  const key = cacheKey(config);
  const cached = getCached<NewsPayload>(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    country: config.country,
    category: config.category,
    pageSize: String(config.max),
    apiKey,
  });
  if (config.keywords.length > 0) {
    params.set("q", config.keywords.join(" OR "));
  }

  try {
    const res = await fetch(`${BASE}?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      return stubbedPayload(`News API error ${res.status}`);
    }
    const json = (await res.json()) as NewsApiResponse;
    if (json.status && json.status !== "ok") {
      return stubbedPayload(json.message ?? "News API error");
    }

    const headlines = (json.articles ?? [])
      .slice(0, config.max)
      .map((a) => ({
        title: a.title ?? "—",
        source: a.source?.name ?? "Unknown",
        published_at: a.publishedAt ?? nowIso(),
      }));

    const payload: NewsPayload = {
      kind: "news",
      headlines,
      fetched_at: nowIso(),
      expires_at: expIso(TTL_SEC),
    };

    setCached(key, payload, TTL_SEC);
    return payload;
  } catch (err) {
    return stubbedPayload(
      `News fetch failed: ${err instanceof Error ? err.message : "unknown"}`,
    );
  }
}
