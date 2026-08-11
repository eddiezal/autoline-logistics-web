import Script from "next/script";

/**
 * Google Analytics 4 + dataLayer bootstrap.
 *
 * Loaded once in the root locale layout. Renders nothing visible. Loads
 * the gtag.js library after page interactivity (afterInteractive) so it
 * doesn't block first paint or Core Web Vitals.
 *
 * Events go DIRECT to google-analytics.com:
 *
 *   Browser → gtag.js (from Google) → google-analytics.com/g/collect
 *
 * HISTORY — why there is deliberately NO transport_url / sGTM path here:
 * this component used to route events through a server-side GTM container
 * on Cloud Run via NEXT_PUBLIC_SGTM_URL. That server failed intermittently
 * (2026-08-06 incident: majority of events 503'd while page_views landed,
 * collapsing GA4 bounce rate to ~100%). The env var was deleted as
 * mitigation — but NEXT_PUBLIC_* values bake into the client bundle at
 * BUILD time, and a cached build resurrected the old bundle with the dead
 * sGTM URL still baked in. Conversion reconciliation (2026-08-11) brackets
 * the bad deploy going live on Friday 2026-08-07 between ~9:00 AM and
 * ~3:30 PM PT; collection then stayed silently dead until the 8/10
 * ~7:30 PM PT fix deploy (caught by the lag-vs-loss monitor's first run;
 * 9 lost paid conversions restored via offline click upload — see
 * scripts/backfill-conversions.mjs). Lesson: an env-var kill switch for a
 * client-side destination is a cache-resurrection hazard. If sGTM ever
 * comes back, reintroduce it as a CODE change on a healthy server, never
 * as an env toggle.
 *
 * Renders nothing without NEXT_PUBLIC_GA_MEASUREMENT_ID set.
 */
export function Analytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (!measurementId) return null;

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
            send_page_view: true,
            anonymize_ip: true,
          });
        `}
      </Script>
    </>
  );
}
