/**
 * R2B: in-form price moment, randomized (built 2026-11-13).
 *
 * Registry entry: quote-path-r2b (src/lib/admin/decisionRegistry.ts).
 * Treatment shows the site's estimate inside the quote form once route and
 * vehicle are known; control sees today's form. Both arms are identical up to
 * that moment, and both arms record an `ab_exposure` event at it, so the
 * denominators match by construction.
 *
 * Switch: NEXT_PUBLIC_R2B_SPLIT. Anything other than "on" means the split is
 * closed: nobody is assigned, no event is stamped, no price is shown. That is
 * also the rollback (set it to "off" and redeploy).
 *
 * Supervised tests: add ?r2b=t or ?r2b=c to the URL. The choice holds for the
 * browser session only, never writes the assignment cookie, and is marked
 * `forced` on every event and on the lead so reads can exclude it.
 *
 * Client only. No PII: the cookie holds one letter.
 */
export type R2bVariant = "c" | "t";
export interface R2bAssignment {
  variant: R2bVariant;
  forced: boolean;
}

const COOKIE = "alv_ab_r2b";
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
const FORCE_KEY = "alv_ab_r2b_forced";

const isVariant = (v: unknown): v is R2bVariant => v === "c" || v === "t";

export function r2bSplitOpen(): boolean {
  return process.env.NEXT_PUBLIC_R2B_SPLIT === "on";
}

function readForced(): R2bVariant | null {
  try {
    const q = new URLSearchParams(window.location.search).get("r2b");
    if (isVariant(q)) {
      window.sessionStorage.setItem(FORCE_KEY, q);
      return q;
    }
    const s = window.sessionStorage.getItem(FORCE_KEY);
    return isVariant(s) ? s : null;
  } catch {
    return null;
  }
}

function readCookie(): R2bVariant | null {
  const m = document.cookie.match(/(?:^|;\s*)alv_ab_r2b=([ct])(?:;|$)/);
  return m ? (m[1] as R2bVariant) : null;
}

/** Current assignment without creating one. Used to stamp events. */
export function readR2b(): R2bAssignment | null {
  if (typeof window === "undefined") return null;
  const forced = readForced();
  if (forced) return { variant: forced, forced: true };
  if (!r2bSplitOpen()) return null;
  const c = readCookie();
  return c ? { variant: c, forced: false } : null;
}

/** Assignment for a visitor who is looking at the quote form. Assigns 50/50
 *  on first sight when the split is open; stable afterwards. */
export function getR2bAssignment(): R2bAssignment | null {
  if (typeof window === "undefined") return null;
  const existing = readR2b();
  if (existing) return existing;
  if (!r2bSplitOpen()) return null;
  let bit: number;
  try {
    bit = crypto.getRandomValues(new Uint8Array(1))[0] & 1;
  } catch {
    bit = Math.random() < 0.5 ? 0 : 1;
  }
  const variant: R2bVariant = bit === 1 ? "t" : "c";
  try {
    document.cookie = `${COOKIE}=${variant}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
  } catch {
    return null; // cookies blocked: stay out of the experiment
  }
  // Confirm it stuck; a visitor whose cookie does not persist would be
  // re-randomized on every view, so leave them out.
  return readCookie() === variant ? { variant, forced: false } : null;
}
