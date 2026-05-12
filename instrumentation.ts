/**
 * Next.js instrumentation entry point.
 *
 * Routes server-side error tracking to Sentry when SENTRY_DSN is configured.
 * No-ops in development and any environment without a DSN.
 *
 * Reference: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { onRequestError } from "@sentry/nextjs";
