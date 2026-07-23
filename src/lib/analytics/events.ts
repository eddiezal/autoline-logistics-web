/**
 * Typed analytics event system.
 *
 * The contract between the app and the tracking layer (GA4 today,
 * server-side GTM later). Every analytics event flows through track().
 *
 * Phase 1 (today): track() pushes to window.dataLayer AND directly
 * to GA4 via gtag(). Lets us ship analytics without sGTM in place.
 *
 * Phase 2 (sGTM container deployed): switch to dataLayer-only.
 * Server-side GTM picks up dataLayer events and fans out to GA4 +
 * Google Ads + Meta + others. Single source of truth.
 *
 * The event vocabulary is intentionally constrained. Adding a new
 * event requires updating this file's union type AND the sGTM
 * container config when it lands.
 */
import "client-only";

// ---- Event shape definitions ----------------------------------------

/**
 * Page-level events. Fired by client components that need to track
 * specific page or component impressions beyond the auto page_view.
 */
type PageEvent =
  | {
      name: "corridor_view";
      props: {
        corridor_slug: string;
        from_state: string;
        to_state: string;
      };
    }
  | {
      name: "pricing_card_impression";
      props: {
        corridor_slug: string;
        vehicle_type: "sedan" | "suv" | "pickup";
      };
    }
  | {
      name: "blog_read_deep";
      props: {
        slug: string;
        cluster: string;
      };
    };

/**
 * Funnel events. Mid-funnel intent signals + the quote/calculator
 * primary conversion paths.
 */
type FunnelEvent =
  | {
      name: "quote_started";
      props: {
        from_state?: string;
        to_state?: string;
      };
    }
  | {
      name: "quote_submitted";
      props: {
        from_state: string;
        to_state: string;
        vehicle_type: string;
        gclid?: string;
      };
    }
  | {
      name: "calculator_started";
      props: Record<string, never>;
    }
  | {
      name: "calculator_completed";
      props: {
        verdict_state:
          | "SHIP_BIG"
          | "SHIP_CLOSE"
          | "WASH"
          | "DRIVE_CLOSE"
          | "DRIVE_BIG";
        delta_usd: number;
      };
    }
  | {
      name: "route_price_checked";
      props: {
        from_zip: string;
        to_zip: string;
        vehicle_type: string;
      };
    };

/**
 * Conversion events. These are what Google Ads optimizes against
 * once Smart Bidding kicks in. Hard vs soft is communicated to
 * Google Ads via the per-conversion-action setup in the UI, not
 * here.
 */
type ConversionEvent =
  | {
      name: "lead_phone_call";
      props: {
        source: "tel_link" | "google_ads_extension";
      };
    }
  | {
      name: "lead_form_submit";
      props: {
        from_state: string;
        to_state: string;
        gclid?: string;
      };
    }
  | {
      name: "lead_calculator_complete";
      props: {
        verdict_state: string;
      };
    }
  | {
      name: "lead_portal_signin";
      props: {
        method: "google" | "magic_link";
      };
    };

/**
 * Full union. Add new variants here when introducing new events.
 */
export type AnalyticsEvent = PageEvent | FunnelEvent | ConversionEvent;

// ---- Tracking implementation ----------------------------------------

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Track an analytics event.
 *
 * Pushes to dataLayer (for sGTM later) AND fires gtag directly (for
 * GA4 today, before sGTM is live). Safe to call from any client
 * component; no-ops on the server.
 */
export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: event.name,
    ...event.props,
  });

  if (typeof window.gtag === "function") {
    window.gtag("event", event.name, event.props);
  }
}

/**
 * Set a user property on the current GA4 session. Used to tag
 * sessions with locale, user_type, gclid, etc.
 */
export function setUserProperty(name: string, value: string): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    user_properties: { [name]: value },
  });

  if (typeof window.gtag === "function") {
    window.gtag("set", "user_properties", { [name]: value });
  }
}

/**
 * Capture GCLID from URL on landing, persist to first-party cookie
 * for 60 days. Read by quote_submitted + other conversion events
 * for OCI attribution back to the click.
 */
export function captureGclid(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const url = new URL(window.location.href);
  const gclid = url.searchParams.get("gclid");

  if (gclid) {
    const sixtyDays = 60 * 24 * 60 * 60;
    document.cookie = `gclid=${gclid}; max-age=${sixtyDays}; path=/; SameSite=Lax`;
    return gclid;
  }

  const match = document.cookie.match(/(?:^|;\s*)gclid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** UTM parameters captured from the landing URL. */
export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

const UTM_KEYS: ReadonlyArray<keyof UtmParams> = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

/**
 * Capture UTM parameters from the URL, persist to a first-party cookie
 * for 60 days (last-touch wins), fall back to the cookie when the current
 * URL has none. Same pattern as captureGclid().
 *
 * Added 2026-07-20: the quote form previously sent NO utm fields at all,
 * so every Google Ads lead rendered as "Google (organic)" / "Direct" in
 * the agent email. See launch-day attribution bug.
 */
export function captureUtm(): UtmParams | undefined {
  if (typeof window === "undefined") return undefined;

  const url = new URL(window.location.href);
  const fromUrl: UtmParams = {};
  let any = false;
  for (const key of UTM_KEYS) {
    const v = url.searchParams.get(key);
    if (v) {
      fromUrl[key] = v;
      any = true;
    }
  }

  if (any) {
    const sixtyDays = 60 * 24 * 60 * 60;
    document.cookie =
      "utm_last=" +
      encodeURIComponent(JSON.stringify(fromUrl)) +
      `; max-age=${sixtyDays}; path=/; SameSite=Lax`;
    return fromUrl;
  }

  const match = document.cookie.match(/(?:^|;\s*)utm_last=([^;]+)/);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as UtmParams;
    // Only return known keys with string values (cookie could be stale/garbled).
    const clean: UtmParams = {};
    let anyClean = false;
    for (const key of UTM_KEYS) {
      const v = parsed[key];
      if (typeof v === "string" && v) {
        clean[key] = v;
        anyClean = true;
      }
    }
    return anyClean ? clean : undefined;
  } catch {
    return undefined;
  }
}

/**
 * First-touch landing path, persisted to a 30-day first-party cookie.
 *
 * Set once — the first page a visitor is seen on wins for 30 days. Read
 * at quote submit so the lead doc records which page STARTED the journey
 * (landingPath) separately from where the form was submitted (submitPath).
 *
 * Called on every full page load via <AttributionCapture /> in the locale
 * layout, which also re-runs captureGclid/captureUtm there so click IDs
 * and UTMs are cookied on ARRIVAL — not just at submit time. Before this,
 * a visitor who landed with UTMs, navigated client-side (params drop),
 * then submitted on another page lost attribution entirely.
 *
 * Added 2026-07-22: powers the "which pages produce leads" dashboard view.
 */
export function captureLandingPath(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const thirtyDays = 30 * 24 * 60 * 60;
  // First-touch TIMESTAMP (2026-07-22): set alongside the landing path so
  // leads can carry time-to-convert (firstTouchAt → submittedAt).
  if (!document.cookie.match(/(?:^|;\s*)first_touch_at=/)) {
    document.cookie = `first_touch_at=${Date.now()}; max-age=${thirtyDays}; path=/; SameSite=Lax`;
  }

  const match = document.cookie.match(/(?:^|;\s*)first_landing=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);

  const path = window.location.pathname;
  document.cookie =
    "first_landing=" +
    encodeURIComponent(path) +
    `; max-age=${thirtyDays}; path=/; SameSite=Lax`;
  return path;
}

/** First-touch epoch millis from the 30-day cookie, if present. */
export function getFirstTouchAt(): number | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(/(?:^|;\s*)first_touch_at=(\d+)/);
  const v = m ? Number(m[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : undefined;
}
