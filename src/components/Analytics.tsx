import Script from "next/script";

/**
 * Google Analytics 4 + dataLayer bootstrap.
 *
 * Loaded once in the root locale layout. Renders nothing visible. Loads
 * the gtag.js library after page interactivity (afterInteractive) so it
 * doesn't block first paint or Core Web Vitals.
 *
 * Architecture (standard sGTM pattern):
 *
 *   1. gtag.js LIBRARY loads from googletagmanager.com (Google's CDN).
 *      Google's sGTM image doesn't natively serve the gtag.js library
 *      without setting up a Web container client. We don't need that;
 *      loading the library from Google is fine.
 *
 *   2. Event data POSTs go through transport_url. When NEXT_PUBLIC_SGTM_URL
 *      is set, gtag sends every /g/collect hit to our Cloud Run sGTM
 *      service. sGTM forwards to GA4 via the published GA4 Event
 *      Forwarder tag.
 *
 *   Phase 1 (when NEXT_PUBLIC_SGTM_URL is empty):
 *     Browser → gtag.js (from Google) → google-analytics.com/g/collect
 *
 *   Phase E (when NEXT_PUBLIC_SGTM_URL is set):
 *     Browser → gtag.js (from Google) → sGTM endpoint → GA4
 *
 * Net effect of Phase E: ad blocker recognition drops (your sGTM
 * subdomain isn't a known analytics endpoint), data quality improves
 * (no third-party cookie restrictions on your own domain), and
 * Enhanced Conversions + OCI become possible server-side.
 *
 * No-renders without NEXT_PUBLIC_GA_MEASUREMENT_ID set.
 */
export function Analytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const sgtmUrl = process.env.NEXT_PUBLIC_SGTM_URL;

  if (!measurementId) return null;

  // Always load gtag.js from Google's CDN. Set transport_url to route
  // events through sGTM when configured.
  const transportConfigLine = sgtmUrl
    ? `transport_url: '${sgtmUrl}',`
    : "";

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
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
