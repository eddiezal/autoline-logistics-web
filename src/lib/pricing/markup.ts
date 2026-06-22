/**
 * Customer-facing pricing markup.
 *
 * Raw SD market price is wholesale-ish. Customer-facing displays add a fixed
 * markup so the user sees a number closer to what they'll actually pay. The
 * agent still has discretion on the final quote per their tier, but the
 * displayed estimate sets a realistic anchor.
 *
 * Apply this to any number that is shown to the public OR routed through
 * the lead email to agents (so agents know what number the customer was
 * shown and can quote consistently).
 *
 * Internal calibration tools (if added later) should call the SD client
 * with `markup: false` to get the raw market number.
 *
 * History:
 * - 2026-06-22: Markup set to 22.5% per Eddie's call on launch night.
 *   Replaces the previous "show raw SD price as-is" behavior. Affects
 *   /quote LivePriceEstimate panel, corridor pricing card, route price
 *   checker, and lead email.
 */

export const CUSTOMER_PRICE_MARKUP_PCT = 0.225;
export const CUSTOMER_PRICE_MARKUP_FACTOR = 1 + CUSTOMER_PRICE_MARKUP_PCT;

export interface MarkupTarget {
  price: number;
  low: number;
  high: number;
}

/**
 * Apply the customer-facing markup to a price triple. Confidence and other
 * fields pass through unchanged. Returns a NEW object; doesn't mutate input.
 */
export function applyCustomerMarkup<T extends MarkupTarget>(raw: T): T {
  return {
    ...raw,
    price: Math.round(raw.price * CUSTOMER_PRICE_MARKUP_FACTOR),
    low: Math.round(raw.low * CUSTOMER_PRICE_MARKUP_FACTOR),
    high: Math.round(raw.high * CUSTOMER_PRICE_MARKUP_FACTOR),
  };
}
