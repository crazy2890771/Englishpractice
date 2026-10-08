/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for a single Node instance; use Redis/Upstash for multi-instance deployments.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs = 60_000, now = Date.now()) {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryAfterMs = windowMs - (now - hits[0]!);
    return { ok: false as const, retryAfterMs };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return { ok: true as const, remaining: limit - hits.length };
}

export function _resetRateLimits() {
  buckets.clear();
}
