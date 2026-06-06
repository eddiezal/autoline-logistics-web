/**
 * Rate limiter — Amendment Item D.
 *
 * Simple fixed-window in-memory limiter, sized for the Phase A surface:
 *   • runs in the Node.js runtime of each Vercel function instance
 *   • state lives in the warm container; cold starts reset counters
 *   • multi-region or fan-out deployments will undercount (per-instance counts)
 *
 * That's enough to defeat trivial abuse (script kiddies, card-testing bots
 * hammering /api/payments/charge from one or a few IPs). It is NOT enough
 * for serious attackers — for that, swap to Upstash Redis or Vercel KV.
 *
 * Phase B upgrade path:
 *   import { Ratelimit } from "@upstash/ratelimit";
 *   import { Redis } from "@upstash/redis";
 *   const limiter = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(10, "60 s") });
 *   const { success } = await limiter.limit(`session:${ip}`);
 *
 * The call-site API in this file (`checkRateLimit`) intentionally returns
 * a Promise<boolean> so swapping to Upstash is a drop-in change.
 */

import "server-only";

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Cleanup expired entries every 60s when the module is hot. No-op on cold
// starts — Vercel will GC the whole map for us.
let cleanupHandle: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (cleanupHandle) return;
  cleanupHandle = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 60_000);
  // Prevent the interval from keeping the Node process alive in dev.
  cleanupHandle.unref?.();
}

export type RateLimitOptions = {
  /** Unique bucket key — typically `${route}:${ip}`. */
  key: string;
  /** Max requests allowed in the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * Returns `{ success: true }` if the caller is within budget, `{ success: false }`
 * otherwise. Decrements the budget on success.
 */
export async function checkRateLimit(
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  ensureCleanup();
  const now = Date.now();
  const existing = store.get(opts.key);

  if (!existing || existing.resetAt <= now) {
    // New window.
    const resetAt = now + opts.windowMs;
    store.set(opts.key, { count: 1, resetAt });
    return { success: true, remaining: opts.limit - 1, resetAt };
  }

  if (existing.count >= opts.limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: opts.limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/**
 * Extract a client IP from common proxy headers. Vercel sets
 * `x-forwarded-for` as a comma-separated list; the leftmost entry is the
 * original client. Falls back to `x-real-ip` then "anonymous" (which buckets
 * all unknown callers together — fine for our use case).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "anonymous";
}

/**
 * Convenience: build a JSON 429 response with retry-after + rate-limit
 * headers the way well-behaved clients expect.
 */
export function tooManyRequestsResponse(result: RateLimitResult): Response {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1000),
  );
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please slow down and try again shortly.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}
