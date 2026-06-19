import Script from "next/script";

/**
 * Google Analytics 4 + dataLayer bootstrap.
 *
 * Loaded once in the root locale layout. Renders nothing visible. Loads
 * the gtag.js library after page interactivity (afterInteractive) so it
 * doesn't block first paint or Core Web Vitals.
 *
 * Phase E swap (2026-06-18): when NEXT_PUBLIC_SGTM_URL is set, gtag.js
 * loads from the server-side GTM container instead of googletagmanager.com,
 * and gtag's transport_url is set to the same endpoint so all subsequent
 * events route through sGTM. When unset, falls back to direct gtag.js
 * loading from Google's CDN (no sGTM in the path).
 *
 * Phase 1 (when NEXT_PUBLIC_SGTM_URL is empty):
 *   Browser → gtag.js (from googletagmanager.com) → google-analytics.com/g/collect
 *
 * Phase E (when NEXT_PUBLIC_SGTM_URL is set):
 *   Browser → gtag.js (from sGTM endpoint) → sGTM endpoint → GA4 (via
 *   the GA4 Event Forwarder tag inside the GTM container)
 *
 * The dataLayer pattern in src/lib/analytics/events.ts already supports
 * both modes — no code change needed there.
 *
 * No-renders without NEXT_PUBLIC_GA_MEASUREMENT_ID set (e.g. in dev or
 * on PR previews without env vars). Production has it.
 */
export function Analytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const sgtmUrl = process.env.NEXT_PUBLIC_SGTM_URL;

  if (!measurementId) return null;

  // When sGTM URL is set, load gtag.js from there and configure
  // transport_url to route all subsequent /g/collect hits through sGTM.
  // Otherwise fall back to direct Google CDN load (no sGTM in the path).
  const gtagSrc = sgtmUrl
    ? `${sgtmUrl}/gtag/js?id=${measurementId}`
    : `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;

  const transportConfigLine = sgtmUrl
    ? `transport_url: '${sgtmUrl}',`
    : "";

  return (
    <>
      <Script src={gtagSrc} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());

          // Default consent state per Consent Mode v2 spec.
          // US users get granted by default; EU detection + denial
          // will be added in the Consent Mode v2 banner work.
          gtag('consent', 'default', {
            ad_storage: 'granted',
            ad_user_data: 'granted',
            ad_personalization: 'granted',
            analytics_storage: 'granted',
            wait_for_update: 500,
          });

          gtag('config', '${measurementId}', {
            ${transportConfigLine}
            send_page_view: true,
            anonymize_ip: true,
          });
        `}
      </Script>
    </>
  );
}
