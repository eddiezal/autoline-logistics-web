import * as Sentry from "@sentry/nextjs";

/**
 * Edge-runtime Sentry init (middleware + edge routes).
 *
 * No-ops if SENTRY_DSN isn't set.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
  });
}
