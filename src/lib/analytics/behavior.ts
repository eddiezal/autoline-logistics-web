/**
 * First-party behavioral analytics — client side.
 *
 * Design (2026-07-22, "own the funnel" decision): anonymous visitor ID +
 * rolling session ID, five-event vocabulary, beacons to our own
 * /api/events collector writing Firestore. No GA dependency, no PII, no
 * fingerprinting — a random UUID cookie is the entire identity model.
 * The visitor ID is stamped onto lead docs at submit, which is what lets
 * reporting join behavior → lead → ProABD outcome (booked/lost).
 *
 * Event vocabulary (keep it small on purpose):
 *   page_view       every route change (BehaviorTracker)
 *   form_started    first interaction with the quote form
 *   estimate_shown  a live price rendered pre-submit (meta.price)
 *   (submit)        not an event — the lead doc itself, joined by vid
 *
 * Release 1 additions (2026-08-12, form-optimization spec): field-level
 * funnel + technical-abandonment discrimination. The 8/6–8/11 outages
 * taught us that "drop-off" can be broken machinery in disguise, so the
 * form now reports WHERE people stop and WHETHER it was voluntary:
 *   form_field       meta {field, action: focus|complete, fv}
 *   form_friction    meta {kind: validation_error|captcha_error|
 *                    captcha_expired|api_error|network_error, reason?,
 *                    status?, fv}
 *   submit_attempted meta {fv}
 *   lead_persisted   meta {fv} — client-side confirmation the API
 *                    accepted; joins against the lead doc via vid
 * Nov 13 2026 additions (quote-form diagnosis): the Oct 15 to Nov 13 read
 * could not say whether the 59% who never start the form ever saw it, or
 * how long they stayed, or which device they were on.
 *   form_in_view     meta {fv} once, when the form's first field enters
 *                    the viewport
 *   engaged          meta {fv, s: 15} once, after 15 visible seconds on
 *                    the quote page
 *   device           NOT sent by the client: the collector derives
 *                    phone|tablet|desktop from the User-Agent header
 *   form_friction    api_error now carries meta.code (the API's code)
 * R2B experiment (2026-11-13, see src/lib/experiments/r2b.ts):
 *   ab_exposure      meta {exp: "r2b", variant: c|t, priced: 0|1, price?,
 *                    forced?, fv} once per form mount, in BOTH arms, at the
 *                    moment route and vehicle are known and the price call
 *                    returns. priced = 1 is a price-eligible exposure.
 *   estimate_shown   from the quote form carries meta.tool = "quote-form"
 *                    (the price checker uses "route-checker").
 *   every event      top-level ab {r2b: c|t, forced?} once assigned
 * fv = form version tag (release stamp) so every funnel read can split
 * by form release without correlating deploy timestamps by hand.
 */

import { readR2b } from "@/lib/experiments/r2b";

const VID_COOKIE = "alv_vid";
const VID_MAX_AGE = 400 * 24 * 60 * 60; // ~13 months, first-party
const SESSION_KEY = "alv_sid";
const SESSION_ATTR_KEY = "alv_attr"; // session-scoped click attribution
const SESSION_GAP_MS = 30 * 60 * 1000; // 30-min rolling session window

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Stable anonymous visitor ID (400-day first-party cookie). */
export function getVisitorId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)alv_vid=([^;]+)/);
  if (m) return m[1];
  const vid = randomId();
  document.cookie = `${VID_COOKIE}=${vid}; max-age=${VID_MAX_AGE}; path=/; SameSite=Lax`;
  return vid;
}

/** Rolling 30-minute session ID (sessionStorage + activity timestamp). */
export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const now = Date.now();
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const [sid, lastStr] = raw.split("|");
      const last = Number(lastStr);
      if (sid && Number.isFinite(last) && now - last < SESSION_GAP_MS) {
        window.sessionStorage.setItem(SESSION_KEY, `${sid}|${now}`);
        return sid;
      }
    }
    const sid = randomId();
    window.sessionStorage.setItem(SESSION_KEY, `${sid}|${now}`);
    // New session → stale click attribution must not carry over. A visitor
    // who returns organically two hours after a paid click is a new
    // session with no campaign; getSessionAttribution() re-captures from
    // the URL if this landing IS a fresh ad click.
    window.sessionStorage.removeItem(SESSION_ATTR_KEY);
    return sid;
  } catch {
    return null; // storage blocked — event still sends without session grouping
  }
}

/** Session-scoped paid-click attribution attached to every event. */
export interface SessionAttribution {
  src: string | null; // utm_source
  med: string | null; // utm_medium
  campaignId: string | null; // utm_campaign (numeric campaign id per URL suffix)
  adGroupId: string | null; // utm_content
  gclid: boolean; // a Google click ID was present on the landing URL
}

/**
 * Capture-or-recall the session's click attribution (2026-07-28, the
 * "signal→lead rate" unlock). On a landing that carries utm params or a
 * gclid, values persist for the session, so SPA navigations — which lose query
 * params — keep reporting the campaign that paid for the visit. A newer
 * click mid-session overwrites (latest click wins). Cleared on session
 * rollover by getSessionId().
 *
 * This is what lets reporting tie NON-converting research behavior
 * (estimate_shown, tool_result) to a campaign; converting visitors were
 * already joined via the lead doc's attribution fields.
 */
export function getSessionAttribution(): SessionAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const q = new URLSearchParams(window.location.search);
    const clip = (v: string | null) => (v && v.trim() ? v.trim().slice(0, 100) : null);
    const fresh: SessionAttribution = {
      src: clip(q.get("utm_source")),
      med: clip(q.get("utm_medium")),
      campaignId: clip(q.get("utm_campaign")),
      adGroupId: clip(q.get("utm_content")),
      gclid: Boolean(clip(q.get("gclid"))),
    };
    const hasFresh = fresh.gclid || fresh.src !== null || fresh.campaignId !== null;
    if (hasFresh) {
      window.sessionStorage.setItem(SESSION_ATTR_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const raw = window.sessionStorage.getItem(SESSION_ATTR_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as SessionAttribution;
    return {
      src: clip(typeof stored.src === "string" ? stored.src : null),
      med: clip(typeof stored.med === "string" ? stored.med : null),
      campaignId: clip(typeof stored.campaignId === "string" ? stored.campaignId : null),
      adGroupId: clip(typeof stored.adGroupId === "string" ? stored.adGroupId : null),
      gclid: stored.gclid === true,
    };
  } catch {
    return null; // storage blocked or malformed — event sends unattributed
  }
}

export type BehaviorEventType =
  | "page_view"
  | "form_started"
  | "estimate_shown"
  | "tool_result"
  | "estimate_email_captured"
  | "form_field"
  | "form_friction"
  | "submit_attempted"
  | "lead_persisted"
  | "form_in_view"
  | "engaged"
  | "ab_exposure";

/**
 * Send a behavioral event to our first-party collector. Fire-and-forget:
 * sendBeacon when available (survives navigation), keepalive fetch as
 * fallback. Never throws; analytics must never break the site.
 */
export function sendEvent(
  type: BehaviorEventType,
  meta?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;
  try {
    const ab = readR2b();
    const body = JSON.stringify({
      vid: getVisitorId(),
      // Order matters: getSessionId() clears stale attribution on session
      // rollover BEFORE getSessionAttribution() re-captures from the URL.
      sid: getSessionId(),
      attr: getSessionAttribution(),
      type,
      path: window.location.pathname,
      locale: /^\/es(\/|$)/.test(window.location.pathname) ? "es" : "en",
      ref: document.referrer ? document.referrer.slice(0, 300) : null,
      meta: meta ?? null,
      // R2B (2026-11-13): experiment arm, when this visitor has one.
      ab: ab ? ab.variant : null,
      ab_forced: ab ? ab.forced : false,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    /* never let analytics break the page */
  }
}
