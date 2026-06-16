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
