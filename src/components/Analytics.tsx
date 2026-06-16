import Script from "next/script";

/**
 * Google Analytics 4 + dataLayer bootstrap.
 *
 * Loaded once in the root layout. Renders nothing visible. Loads
 * the GA4 gtag.js library after page interactivity (afterInteractive)
 * so it doesn't block first paint or Core Web Vitals.
 *
 * Phase 1 (today): direct gtag firing. GA4 receives events via
 * Google's CDN.
 *
 * Phase 2 (sGTM deployed): swap the src to tags.autolinelogistics.com
 * so events route through our server-side container instead. The
 * dataLayer pattern in src/lib/analytics/events.ts already
 * supports this; only this component changes.
 *
 * No-renders without NEXT_PUBLIC_GA_MEASUREMENT_ID set (e.g. in
 * dev or on PR previews without env vars). Production has it.
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
