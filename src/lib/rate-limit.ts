// Fixed-window in-memory limiter. It is per server process: behind several
// instances, put a shared limiter (reverse proxy or Redis) in front as well.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) pruneExpired(now);
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;
  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

function pruneExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still full of live keys: drop the oldest instead of growing without bound.
  while (buckets.size >= MAX_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

export function clientIp(req: Request) {
  // Only meaningful behind a proxy that overwrites these headers.
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

// Per-account throttle for data-heavy endpoints, so even a valid account cannot
// scrape the whole student base in a loop. Returns a 429 response, or null.
export const LIMITS = {
  read: { limit: 120, windowMs: 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  import: { limit: 30, windowMs: 10 * 60_000 },
} as const;

export function throttleUser(userId: string, kind: keyof typeof LIMITS) {
  const { limit, windowMs } = LIMITS[kind];
  const result = rateLimit(`user:${kind}:${userId}`, limit, windowMs);
  if (result.allowed) return null;
  return Response.json(
    { error: "Trop de requêtes. Réessayez dans un instant." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
