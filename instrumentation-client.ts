import * as Sentry from "@sentry/nextjs";

/**
 * Client-runtime Sentry init.
 *
 * Sentry v10 + Next 16 reads this file automatically (replaces the older
 * `sentry.client.config.ts` convention).
 *
 * No-ops if NEXT_PUBLIC_SENTRY_DSN isn't set. NEXT_PUBLIC_ prefix is required
 * because client-runtime env vars must be exposed at build time.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    // Performance tracing — adjust per traffic
    tracesSampleRate: 0.1,
    // Session Replay — capture errors with replays only (cheaper than always-on)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Don't send dev-only errors
    enabled: process.env.NODE_ENV === "production",
  });
}

// Required for next-intl / Next 16 navigation tracing
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
