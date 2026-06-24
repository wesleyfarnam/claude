import "server-only";

/**
 * Dev-only in-process TTL cache.
 *
 * NOTE: This is a `Map` that lives in the Node process and resets on every cold
 * start / redeploy. In production we'll swap in Vercel KV (or similar), but for
 * now it gives us enough caching to stay well under upstream rate limits during
 * dev.
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setCached<T>(key: string, value: T, ttlSec: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

export function clearCache(): void {
  store.clear();
}
