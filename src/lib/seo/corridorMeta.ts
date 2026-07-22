/**
 * Corridor page metadata helpers — the "cost-angle title surgery".
 *
 * WHY (2026-07-22, GSC 28-day read): non-brand impressions arrived on cost-
 * intent corridor queries ("cost to ship a car from california to texas",
 * "car shipping new york to florida") but 0 clicks — pages sit page 3-4 with
 * feature-angle titles. These helpers put the search language AND the real
 * price (same Firestore snapshot the CorridorPricingCard renders) into the
 * <title>/<meta description>, which no template-content competitor can match.
 *
 * The anchor price mirrors CorridorPricingCard exactly: sedan snapshot
 * midpoint, rounded to the nearest $25, customer markup already applied by
 * the cron (SD client applies it before writePricingSnapshot). Stale
 * snapshots (>72h) return null → pages fall back to a no-number title, so
 * we never advertise a dead price in the SERP.
 */

import "server-only";
import {
  readPricingSnapshot,
  snapshotStaleness,
} from "@/lib/pricing/firestore";

/**
 * Customer-facing anchor price for a corridor (sedan midpoint, $25-rounded)
 * or null when there's no fresh snapshot (errors, stale, or corridors the
 * SD Pricing API doesn't cover — AK/HI).
 */
export async function getCorridorAnchorPrice(
  corridorSlug: string,
): Promise<number | null> {
  try {
    const sedan = await readPricingSnapshot(corridorSlug, "sedan");
    if (!sedan || sedan.status !== "fresh") return null;
    if (snapshotStaleness(sedan) === "hidden") return null;
    return Math.round((sedan.priceLow + sedan.priceHigh) / 2 / 25) * 25;
  } catch {
    return null; // metadata must never take a page down over a pricing read
  }
}

export function formatAnchor(price: number): string {
  return "$" + price.toLocaleString("en-US");
}
