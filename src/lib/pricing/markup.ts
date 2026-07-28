/**
 * Customer-facing pricing — flat-fee model v1 (2026-07-28).
 *
 * WHAT CHANGED: the 22.5% percentage markup is replaced by a graduated
 * flat fee fitted to Ben's own order book (336 booked orders Mar–Jul):
 *
 *     customer price = SD carrier estimate + fee
 *     fee            = $150 + 9% × carrier estimate, capped at $400
 *     display        = rounded to the nearest $5 (no $X99 games — we are
 *                      the anti-bait-and-switch brand)
 *
 * WHY: agents price Carrier_Pay + flat fee (median $245; 88% of orders
 * $150–$350) — they never used a percentage. The old ×1.225 therefore
 * underquoted small moves by ~$100 (sticker shock when the agent walked
 * the price up) and overquoted big moves by ~$200 (lost lead before the
 * phone rang). The linear fit of fee-vs-carrier-pay across the book is
 * fee = $149 + 9.1% (r = 0.73, median residual $32) — this model IS the
 * agents' revealed pricing, so web number ≈ phone number by construction.
 * Mid-book prices (~$900–1,200 carrier) barely move; only the broken
 * tails change.
 *
 * Shadow logging: /api/lead stores carrierEstimate + legacyPrice (what
 * ×1.225 would have shown) on every lead doc — server-side only, never in
 * an API response — so scripts/compare-quote-prices.mjs can measure the
 * new model against agent quotes as head-to-heads accrue. Revert = put
 * applyCustomerMarkup back on LEGACY_MARKUP_FACTOR.
 *
 * Apply this to any number shown to the public OR routed through the lead
 * email to agents. Internal calibration tools call the SD client with
 * `markup: false` for the raw market number.
 *
 * History:
 * - 2026-06-22: ×1.225 set on launch night (replaced raw SD passthrough).
 * - 2026-07-24: flat-fee discovery (n=6 head-to-head + 345-order book).
 * - 2026-07-28: flat-fee v1 shipped per Eddie ("we could be losing the
 *   heavy deals by overpricing them"). Strategy agreed before the change.
 */

/** Model tag stamped onto lead docs for cohort analysis. */
export const PRICING_MODEL = "flatfee-v1";

export const FEE_BASE = 150;
export const FEE_RATE = 0.09;
export const FEE_CAP = 400;

/** Legacy percentage model — shadow logging + revert path only. */
export const LEGACY_MARKUP_FACTOR = 1.225;

export interface MarkupTarget {
  price: number;
  low: number;
  high: number;
}

/** The graduated flat fee for a given carrier estimate (unrounded). */
export function customerFee(carrierEstimate: number): number {
  return Math.min(FEE_CAP, FEE_BASE + FEE_RATE * carrierEstimate);
}

const roundTo5 = (n: number) => Math.round(n / 5) * 5;

/**
 * Convert a raw SD price triple into customer-facing numbers. Each band
 * value gets its own fee (monotonic — low stays below high). Confidence
 * and other fields pass through unchanged. Returns a NEW object.
 */
export function applyCustomerMarkup<T extends MarkupTarget>(raw: T): T {
  return {
    ...raw,
    price: roundTo5(raw.price + customerFee(raw.price)),
    low: roundTo5(raw.low + customerFee(raw.low)),
    high: roundTo5(raw.high + customerFee(raw.high)),
  };
}

/** What the retired ×1.225 model would have shown — shadow logging only. */
export function legacyMarkupPrice(rawPrice: number): number {
  return Math.round(rawPrice * LEGACY_MARKUP_FACTOR);
}
