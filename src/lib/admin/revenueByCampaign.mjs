/**
 * Revenue-by-campaign — SHARED pure computation (2026-08-19).
 *
 * ONE implementation, TWO callers (the weekly-report lesson: a local script
 * and a dashboard that compute the same number separately will eventually
 * disagree about it):
 *   · scripts/revenue-by-campaign.mjs   (CLI wrapper, plain node)
 *   · src/lib/admin/revenueLive.ts      (Acquisition view + Overview clause)
 *
 * The join: ad click → lead (attribution) → ProABD record (proabdAbdId or
 * Custom_Id) → latest webhook state (Booked_Date, Transport.Deposit,
 * Status). Fees are booking DEPOSITS — our broker fee at booking.
 *
 * Contract discipline lives HERE so no caller can drop it:
 *   · Clock B: rates/fee expectancy computed only within the mature cohort
 *     (created ≥14d ago; no booking ever observed past 20.3 days). Green
 *     cohort returns counts and dollars, never rates.
 *   · Net excludes records whose CURRENT status is canceled (Status 23).
 *     Official treatment = P8 disposition rule; until then gross+net
 *     bracket the truth.
 *   · Source buckets replicate the dashboard's deriveSource logic so this
 *     module can never disagree with the Overview about what "paid" means.
 *
 * Pure: no I/O, no env, importable from Next (allowJs) and plain node.
 */

export const REVENUE_COHORT_START = "2026-07-20"; // ads relaunch
export const CANCELED_STATUS_ID = "23";
/** Bookings observed 0–20.3 days after lead arrival; ≥14d = essentially final. */
export const MATURITY_DAYS = 14;
/** net/$100 renders colored only at/above this many bookings (color-unlock rule). */
export const COLOR_UNLOCK_BOOKINGS = 5;

/**
 * Fold webhook events (ascending received order) into latest-state per ABD_Id.
 * items: [{abdId, customId, statusId, itemType, bookedDate, deposit}]
 */
export function reduceWebhookState(items) {
  const state = new Map();
  const byCustomId = new Map();
  for (const it of items) {
    const id = String(it.abdId ?? "");
    if (!id) continue;
    const booked = !!(it.bookedDate && it.bookedDate !== "0000-00-00 00:00:00");
    state.set(id, {
      statusId: String(it.statusId ?? ""),
      isOrder: String(it.itemType ?? "") === "order",
      booked,
      deposit: Number(it.deposit ?? 0) || 0,
    });
    if (it.customId) byCustomId.set(String(it.customId), id);
  }
  return { state, byCustomId };
}

/** deriveSource parity (src/app/admin/page.tsx) — keep in lockstep. */
export function bucketLead(a) {
  const src = String(a?.utmSource ?? "").trim().toLowerCase();
  const med = String(a?.utmMedium ?? "").trim().toLowerCase();
  const gclid = typeof a?.gclid === "string" && a.gclid.trim() ? true : false;
  if (src === "google" && (med === "cpc" || med === "ppc" || med === "paid")) {
    return { bucket: "ads", campaignId: String(a?.utmCampaign ?? "").trim() || null };
  }
  if (gclid) return { bucket: "ads-incomplete", campaignId: null };
  if (src) return { bucket: "referral", campaignId: null };
  const ref = String(a?.referrer ?? "").trim().toLowerCase();
  if (/google\.|bing\.|duckduckgo\.|yahoo\./.test(ref)) return { bucket: "organic", campaignId: null };
  return { bucket: "direct", campaignId: null };
}

/**
 * leads: [{at: Date, bucket, campaignId, abdId, leadRef}] (tests already excluded)
 * state/byCustomId: from reduceWebhookState
 * matureCutoff: Date — leads created at/before this are mature
 * Returns rows keyed "ads:<id>" | "ads-incomplete" | "organic" | "direct" | "referral",
 * sorted by mature gross fees desc.
 */
export function computeRevenue({ leads, state, byCustomId, matureCutoff }) {
  const groups = new Map();
  const agg = (key) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = {
      key,
      matureLeads: 0, matureLinked: 0, matureBooked: 0, matureCanceled: 0,
      matureFeeGross: 0, matureFeeNet: 0,
      greenLeads: 0, greenBooked: 0, greenFeeGross: 0,
    }));
    return g;
  };

  for (const l of leads) {
    const key = l.bucket === "ads" ? `ads:${l.campaignId ?? "?"}` : l.bucket;
    const g = agg(key);
    const abd = l.abdId ?? (l.leadRef ? byCustomId.get(l.leadRef) : null) ?? null;
    const s = abd ? state.get(abd) : null;
    const linked = !!abd;
    const canceled = !!s && s.statusId === CANCELED_STATUS_ID;
    const booked = !!s && s.booked && s.isOrder;
    const fee = booked ? s.deposit : 0;
    if (l.at <= matureCutoff) {
      g.matureLeads++;
      if (linked) g.matureLinked++;
      if (booked) { g.matureBooked++; g.matureFeeGross += fee; if (!canceled) g.matureFeeNet += fee; }
      if (canceled) g.matureCanceled++;
    } else {
      g.greenLeads++;
      if (booked) { g.greenBooked++; g.greenFeeGross += fee; }
    }
  }

  const rows = [...groups.values()].sort((a, b) => b.matureFeeGross - a.matureFeeGross);
  const paidRows = rows.filter((r) => r.key.startsWith("ads"));
  const totalsPaid = paidRows.reduce(
    (t, r) => ({
      matureLeads: t.matureLeads + r.matureLeads,
      matureBooked: t.matureBooked + r.matureBooked,
      matureCanceled: t.matureCanceled + r.matureCanceled,
      matureFeeGross: t.matureFeeGross + r.matureFeeGross,
      matureFeeNet: t.matureFeeNet + r.matureFeeNet,
      greenLeads: t.greenLeads + r.greenLeads,
      greenBooked: t.greenBooked + r.greenBooked,
      greenFeeGross: t.greenFeeGross + r.greenFeeGross,
    }),
    { matureLeads: 0, matureBooked: 0, matureCanceled: 0, matureFeeGross: 0, matureFeeNet: 0, greenLeads: 0, greenBooked: 0, greenFeeGross: 0 },
  );
  return { rows, totalsPaid };
}

/** Human label for a row key. campaignNames: Map(id -> name). */
export function rowLabel(key, campaignNames) {
  if (key === "ads-incomplete") return "Ads (attribution incomplete)";
  if (key.startsWith("ads:")) {
    const id = key.slice(4);
    if (id === "?") return "Ads (no campaign id)";
    return "Ads: " + (campaignNames?.get?.(id) ?? id);
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}
