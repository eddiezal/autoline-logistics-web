/**
 * Unmatched-calls queue — shared OBJECTIVE classification (2026-08-19).
 *
 * Terminology (v2.1): UNMATCHED = "no automated CRM match" — not "no CRM
 * trace"/"unlogged". Human review can find the caller was an existing
 * customer on another number; the automated match failed, not the CRM
 * relationship. The exported function keeps the name `unloggedCalls` for API
 * stability; renaming it would churn both callers for zero behavior change.
 *
 * This module carries only the parts of the call cross-check that need no
 * provisional thresholds: a call is UNMATCHED when it ran ≥60s (the
 * conversions definition, ratified 8/5), was not spam, and the caller's
 * number matches no CRM record or web lead created BEFORE the call nor any
 * CRM record created within 72h AFTER it. Objective facts only — the chase /
 * service metrics stay script-side until their definitions freeze (~Sep 2).
 *
 * Callers: src/lib/admin/callsLive.ts (Sales workload queue) and — lockstep
 * duty — scripts/call-crosscheck.mjs implements the same rule inline; if the
 * rule changes here, change it there (documented in both files).
 *
 * PII: phone keys live only in memory here; nothing in the returned rows
 * identifies a caller — id, time, duration, source, listen URL.
 */

export const MIN_DURATION_SEC = 60;
export const BECAME_WINDOW_H = 72;
/** Phone capture works from the 8/10 webhook fix; earlier calls have no number. */
export const CALLS_COVERAGE_START = "2026-08-10";

/** Mirror of src/lib/leads/identity.ts normalizePhoneKey — keep in lockstep. */
export function phoneKey(raw) {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits.length === 10 ? digits : null;
}

/**
 * calls: [{id, at: Date, key, durationSec, spam, campaign, source, timelineUrl}]
 * crmByPhone: Map(phoneKey -> [createdAt: Date])   (ProABD records)
 * webByPhone: Map(phoneKey -> [createdAt: Date])   (web leads)
 * Returns unlogged rows sorted longest-first.
 */
export function unloggedCalls({ calls, crmByPhone, webByPhone }) {
  const graceMs = 5 * 60_000;
  const out = [];
  for (const c of calls) {
    if (c.spam || c.durationSec < MIN_DURATION_SEC || !c.key) continue;
    const priors = [...(crmByPhone.get(c.key) ?? []), ...(webByPhone.get(c.key) ?? [])]
      .some((at) => at.getTime() < c.at.getTime() - graceMs);
    if (priors) continue;
    const became = (crmByPhone.get(c.key) ?? []).some((at) => {
      const dt = at.getTime() - c.at.getTime();
      return dt >= -graceMs && dt <= BECAME_WINDOW_H * 3600_000;
    });
    if (became) continue;
    out.push({
      id: c.id,
      at: c.at,
      durationSec: c.durationSec,
      campaign: c.campaign ?? null,
      source: c.source ?? null,
      timelineUrl: c.timelineUrl ?? null,
    });
  }
  out.sort((a, b) => b.durationSec - a.durationSec);
  return out;
}
