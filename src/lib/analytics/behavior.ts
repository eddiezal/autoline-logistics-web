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
    return sid;
  } catch {
    return null; // storage blocked — event still sends without session grouping
  }
}

export type BehaviorEventType = "page_view" | "form_started" | "estimate_shown";

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
      sid: getSessionId(),
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
