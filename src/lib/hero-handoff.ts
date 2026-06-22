/**
 * Shared contract for the homepage hero → /quote handoff.
 *
 * Single source of truth for the URL params that flow from any
 * quote-entry CTA (HeroRouteFinder, calculator, route price checker)
 * into the QuoteForm. Defining the shape + serializer + parser in one
 * file means future fields added to either side automatically flow
 * without manual sync.
 *
 * Adding a new field:
 *   1. Add the property to HeroHandoff
 *   2. Add the URL param name to URL_PARAM_MAP
 *   3. Update the producer (HeroRouteFinder etc.) to pass it into buildQuoteHref
 *   4. Update QuoteForm to consume it from the handoff prop
 *
 * History:
 * - 2026-06-22: Created after Tier B bug surfaced — hero passed 6 URL
 *   params, /quote page parsed 2, QuoteForm consumed 0, customers
 *   re-typed ZIPs after submitting the hero form. Tier C codifies the
 *   contract so the bug can't recur.
 */

export interface HeroHandoff {
  /** Origin ZIP (5-digit US). */
  originZip?: string;
  /** Destination ZIP (5-digit US). */
  destinationZip?: string;
  /** Vehicle type key (sedan / suv / truckStandard / ...). */
  vehicleType?: string;
  /** Vehicle condition (operable / inoperable). */
  condition?: string;
  /** Carrier transport mode (open / enclosed). */
  transportType?: string;
  /** Service-tier preference (standby / priority / expedited). */
  timing?: string;
}

/**
 * Maps HeroHandoff keys → URL query-param names. Centralized here so
 * the producer and parser can never drift.
 */
const URL_PARAM_MAP: Record<keyof HeroHandoff, string> = {
  originZip: "from",
  destinationZip: "to",
  vehicleType: "vehicle_type",
  condition: "condition",
  transportType: "transport",
  timing: "timing",
};

export type QuoteHref = {
  pathname: "/quote";
  query: Record<string, string>;
};

/**
 * Build the URL object for navigating to /quote with the handoff
 * pre-filled. Omits any falsy values so /quote sees clean params.
 */
export function buildQuoteHref(handoff: HeroHandoff): QuoteHref {
  const query: Record<string, string> = {};
  (Object.keys(URL_PARAM_MAP) as Array<keyof HeroHandoff>).forEach((k) => {
    const value = handoff[k];
    if (value) query[URL_PARAM_MAP[k]] = value;
  });
  return { pathname: "/quote", query };
}

/**
 * Parse the /quote page's searchParams back into a HeroHandoff. Accepts
 * the raw Record<string, string | undefined> shape Next.js provides.
 */
export function parseQuoteSearchParams(
  params: Partial<Record<string, string>>,
): HeroHandoff {
  return {
    originZip: params.from,
    destinationZip: params.to,
    vehicleType: params.vehicle_type,
    condition: params.condition,
    transportType: params.transport,
    timing: params.timing,
  };
}

/**
 * Recognized URL-param keys, exported for the /quote searchParams type.
 */
export const QUOTE_SEARCH_PARAM_KEYS = Object.values(URL_PARAM_MAP);
export type QuoteSearchParamKey = (typeof QUOTE_SEARCH_PARAM_KEYS)[number];
