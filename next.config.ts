import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
};

// Only apply Sentry's webpack wrapper when source-map upload is actually
// configured (org + auth token). In dev / local builds this skips Sentry's
// build-time machinery so the dev loop stays fast.
const sentryConfigured = Boolean(
  process.env.SENTRY_ORG && process.env.SENTRY_AUTH_TOKEN
);

const baseConfig = withNextIntl(nextConfig);

export default sentryConfigured
  ? withSentryConfig(baseConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT ?? "autoline-logistics-web",
      // Quiet by default; let CI logs be verbose
      silent: !process.env.CI,
      // Hide Sentry SDK from public network — proxies events through this app
      tunnelRoute: "/monitoring",
      // Capture client errors that happen before Sentry is initialized
      widenClientFileUpload: true,
      // Source maps stay private (don't ship them to clients)
      sourcemaps: { disable: false },
      // Quiet Sentry's runtime logging in production
      disableLogger: true,
    })
  : baseConfig;
