import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/* ============================================================
 * Security headers — Amendment Item D
 *
 * Applied to every route via `headers()`. Built to allow the third-party
 * surfaces this app actually uses; everything else is denied.
 *
 *   Auth.net Accept.js (sandbox + prod) → tokenizes cards in browser
 *   Firebase Auth (Google sign-in popup, magic link), Firestore, Storage
 *   GA4 + Google Tag Manager
 *   Super Dispatch Pricing Insights API
 *   hCaptcha widget + verify endpoint
 *   Vercel internals (.vercel.live, .vercel.app preview)
 *
 * HSTS only in production (NEXT_PUBLIC_VERCEL_ENV check) — dev HTTPS
 * settings persist after teardown and break local dev.
 * ============================================================ */

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Inline scripts unfortunately needed for Next.js inline boot script + GA snippet.
  // 'unsafe-eval' kept off; we don't run user code or eval third-party SDKs.
  // sGTM endpoints listed alongside googletagmanager.com so the Phase E
  // swap (Analytics.tsx loading gtag from the sGTM endpoint) doesn't
  // trip CSP. Add the custom domain (sgtm.autolinelogistics.com) here
  // when DNS cutover happens.
  "script-src 'self' 'unsafe-inline' https://js.authorize.net https://jstest.authorize.net https://*.hcaptcha.com https://hcaptcha.com https://www.googletagmanager.com https://gtm-server-184060108234.us-central1.run.app https://sgtm.autolinelogistics.com https://apis.google.com https://accounts.google.com https://www.gstatic.com https://va.vercel-scripts.com https://*.callrail.com",
  // Styles: 'unsafe-inline' allows our CSS-variable inline styles.
  // fonts.googleapis.com: Inter loads via runtime stylesheet since 2026-08-11
  // (next/font's build-time download hard-failed builds when Google's CDN
  // 404'd the pinned files — see layout.tsx INTER_CSS_URL comment).
  "style-src 'self' 'unsafe-inline' https://*.hcaptcha.com https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // GA endpoints wildcarded per Google's official CSP guidance (see the
  // 2026-08-11 incident note on connect-src below — img-src is gtag's
  // pixel-transport fallback and must match).
  "img-src 'self' data: blob: https://*.googleusercontent.com https://*.firebasestorage.app https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://www.google.com https://*.gstatic.com https://api.mapbox.com https://*.callrail.com",
  // Fetch destinations.
  // sGTM endpoints added for /g/collect routing through Cloud Run (Phase E).
  // www.google-analytics.com stays as fallback for when NEXT_PUBLIC_SGTM_URL
  // is unset. Add the custom domain (sgtm.autolinelogistics.com) when DNS
  // cutover happens.
  //
  // ⚠️ INCIDENT 2026-08-11 (silent GA4 outage #3): Google server-side
  // rolled out new gtag collect endpoints — hits now POST to
  // analytics.google.com/g/collect (+ stats.g.doubleclick.net sibling and
  // www.google.com/ccm/collect with Google signals), NOT just
  // www.google-analytics.com. Our connect-src only allowed the old host,
  // so EVERY GA4 hit from every visitor was CSP-blocked silently (gtag
  // detects the blocked transport and gives up without a console error;
  // pages with no CSP — the RawTest smoke page — tracked fine, which
  // masked it). Fix: allowlist per Google's documented CSP set:
  // *.google-analytics.com (regional endpoints incl. region1),
  // *.analytics.google.com, *.googletagmanager.com, stats.g.doubleclick.net,
  // www.google.com (ccm/collect). NEVER pin a single Google collect host
  // again — Google moves these under our feet.
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebasestorage.app https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://apitest.authorize.net https://api.authorize.net https://pricing-insights.superdispatch.com https://*.google-analytics.com https://*.analytics.google.com https://analytics.google.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://www.google.com https://gtm-server-184060108234.us-central1.run.app https://sgtm.autolinelogistics.com https://*.hcaptcha.com https://hcaptcha.com https://accounts.google.com https://*.ingest.sentry.io https://*.vercel.app https://vercel.live wss://*.firebaseio.com https://api.mapbox.com https://events.mapbox.com https://*.callrail.com",
  // iframes for: Google sign-in popup, Auth.net Accept.js, hCaptcha challenge, Firebase auth handler.
  "frame-src 'self' https://accounts.google.com https://*.authorize.net https://js.authorize.net https://jstest.authorize.net https://*.hcaptcha.com https://hcaptcha.com https://*.firebaseapp.com",
  // Disallow inline plugins entirely.
  "object-src 'none'",
  "base-uri 'self'",
  // Forms post to: our origin (server actions, API routes) + mailto: (current QuoteForm fallback).
  "form-action 'self' mailto:",
  // Defeat clickjacking. (frame-ancestors supersedes X-Frame-Options where supported.)
  "frame-ancestors 'none'",
  // Mapbox-gl spawns rendering workers from blob: URLs. Without an explicit
  // worker-src directive, browsers fall back to script-src which does not
  // allow blob:, blocking the portal tracking map. Added 2026-06-23.
  "worker-src 'self' blob:",
  // Force HTTPS for any same-origin sub-resources.
  "upgrade-insecure-requests",
].join("; ");

const isProd = process.env.NODE_ENV === "production";

const SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // COOP: "same-origin-allow-popups" keeps us isolated from cross-origin
  // documents we navigate to, BUT lets us be the opener for popups (Firebase
  // Auth's Google sign-in flow). The strict "same-origin" default blocks
  // window.closed / window.close() postMessage between our page and the
  // accounts.google.com popup, killing signInWithPopup.
  // See: https://firebase.google.com/docs/auth/web/redirect-best-practices
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Lock down browser feature exposure to only what we actively use.
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(self), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()",
  },
  // X-XSS-Protection is deprecated but doesn't hurt; modern browsers ignore it,
  // legacy IE/Edge get a small benefit.
  { key: "X-XSS-Protection", value: "0" },
];

if (isProd) {
  // CSP only in production: Next.js dev HMR uses inline eval() which strict
  // CSP would block, killing the dev loop. Phase B upgrade: nonce-based CSP
  // that works in both modes.
  SECURITY_HEADERS.push({
    key: "Content-Security-Policy",
    value: CSP_DIRECTIVES,
  });
  // HSTS — 2-year max-age + includeSubDomains is the standard "submit to
  // preload list" config. Don't enable preload here unless we're ready to
  // be irreversibly committed to HTTPS-only across the entire
  // autolinelogistics.com domain — flip after the DNS cutover settles.
  SECURITY_HEADERS.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  });
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      {
        // Analysis Library charts: self-contained HTML documents served
        // INSIDE the /admin auth boundary and iframed by the study pages
        // (/admin/analysis/[slug]). The global frame-ancestors 'none' +
        // X-Frame-Options DENY block that embed ("refused to connect"),
        // so this more-specific rule (same-key headers: last match wins)
        // relaxes framing to SAME-ORIGIN ONLY for chart routes, with a
        // locked-down document CSP (inline script/style only, no network).
        source: "/admin/analysis/:slug/chart",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
          },
        ],
      },
    ];
  },
  async redirects() {
    // Pre-DNS-cutover safety net. The live Squarespace site uses paths that
    // don't 1:1 map to our Next.js routes. These 301s catch the realistic
    // Google Ads landing pages + common deep links so post-cutover traffic
    // lands on the right page instead of 404'ing.
    // Note: Next.js redirects fire BEFORE next-intl middleware, so these
    // work at the root regardless of locale.
    return [
      // Quote variations
      { source: "/get-a-quote", destination: "/quote", permanent: true },
      { source: "/get-quote", destination: "/quote", permanent: true },
      { source: "/quote-request", destination: "/quote", permanent: true },
      { source: "/request-quote", destination: "/quote", permanent: true },
      { source: "/free-quote", destination: "/quote", permanent: true },
      { source: "/instant-quote", destination: "/quote", permanent: true },
      // Contact (no equivalent page, route to quote which is the conversion point)
      { source: "/contact", destination: "/quote", permanent: true },
      { source: "/contact-us", destination: "/quote", permanent: true },
      // ES-locale contact (Next.js redirects run before next-intl middleware,
      // so /contact source doesn't match locale-prefixed paths). Added 2026-07-06
      // after GSC flagged /es/contact as 404.
      { source: "/es/contact", destination: "/es/quote", permanent: true },
      { source: "/es/contact-us", destination: "/es/quote", permanent: true },
      // Legacy services tier deep-links (external referrals discovered via GSC
      // 2026-07-06). Tier is now selected inside the quote form via ?tier= param.
      { source: "/services/standby", destination: "/quote?tier=standby", permanent: true },
      { source: "/services/priority", destination: "/quote?tier=priority", permanent: true },
      { source: "/services/expedited", destination: "/quote?tier=expedited", permanent: true },
      { source: "/es/services/standby", destination: "/es/quote?tier=standby", permanent: true },
      { source: "/es/services/priority", destination: "/es/quote?tier=priority", permanent: true },
      { source: "/es/services/expedited", destination: "/es/quote?tier=expedited", permanent: true },
      // Generic transport keywords (often used as Squarespace landing slugs)
      { source: "/auto-transport", destination: "/", permanent: true },
      { source: "/car-shipping", destination: "/", permanent: true },
      { source: "/vehicle-transport", destination: "/", permanent: true },
      { source: "/vehicle-shipping", destination: "/", permanent: true },
      { source: "/shipping", destination: "/", permanent: true },
      // Squarespace defaults
      { source: "/home", destination: "/", permanent: true },
      { source: "/index", destination: "/", permanent: true },
      // Deleted blog articles (2026-06-22 deposit positioning sweep) -> blog index
      { source: "/blog/deposit-before-driver", destination: "/blog", permanent: true },
      { source: "/blog/pagar-deposito-envio-auto-conductor", destination: "/blog", permanent: true },
      // Customer-portal shortcuts. Customers (and any old email links) may
      // type /login or /signin at the root. The real portal lives at
      // /portal/login. Added 2026-06-23 after a customer hit /login and
      // got a 404.
      { source: "/login", destination: "/portal/login", permanent: true },
      { source: "/signin", destination: "/portal/login", permanent: true },
      { source: "/sign-in", destination: "/portal/login", permanent: true },
      { source: "/account", destination: "/portal/account", permanent: true },
      { source: "/my-account", destination: "/portal/account", permanent: true },
    ];
  },
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
