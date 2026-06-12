import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Token-bucket rate limiting per user (§2.7.5): 10 requests / minute.
 * Upstash Redis in production; an in-memory sliding window as fallback so
 * the protection never silently disappears when Redis isn't configured.
 */

const LIMIT = 10;
const WINDOW_MS = 60_000;

let upstash: Ratelimit | null = null;
if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  upstash = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(LIMIT, "1 m"),
    prefix: "aiglonix:alerts",
  });
}

const memoryHits = new Map<string, number[]>();

export async function checkRateLimit(userId: string): Promise<boolean> {
  if (upstash) {
    const { success } = await upstash.limit(userId);
    return success;
  }
  const now = Date.now();
  const hits = (memoryHits.get(userId) ?? []).filter(
    (t) => now - t < WINDOW_MS,
  );
  if (hits.length >= LIMIT) {
    memoryHits.set(userId, hits);
    return false;
  }
  hits.push(now);
  memoryHits.set(userId, hits);
  return true;
}
