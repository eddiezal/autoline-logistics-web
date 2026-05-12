import * as Sentry from "@sentry/nextjs";

/**
 * Server-runtime Sentry init.
 *
 * No-ops if SENTRY_DSN isn't set. Set the DSN in Vercel Production env vars
 * (Settings → Environment Variables) once Sentry project is provisioned.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    // Adjust per traffic. 0.1 = 10% sampling. Bump up in low-traffic phases.
    tracesSampleRate: 0.1,
    // Only send in real environments — dev errors are noise.
    enabled: process.env.NODE_ENV === "production",
  });
}
