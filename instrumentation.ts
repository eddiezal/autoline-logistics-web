/**
 * Next.js instrumentation entry point.
 *
 * Routes server-side error tracking to Sentry when SENTRY_DSN is configured.
 * No-ops in development and any environment without a DSN.
 *
 * Reference: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Sentry v10 renamed the convenience export from `onRequestError` to
// `captureRequestError`. Next.js will call this hook when a request
// throws an unhandled error (Next 15+).
export const onRequestError = Sentry.captureRequestError;
