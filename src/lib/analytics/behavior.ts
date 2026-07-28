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
 */

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

export type BehaviorEventType = "page_view" | "form_started" | "estimate_shown" | "tool_result";

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
