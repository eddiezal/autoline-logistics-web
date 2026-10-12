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

// ── Value vocabularies (Release A, 2026-10-12) ─────────────────────────
// The hero speaks UI words (drivable / nonDrivable, flexible / withinWeek /
// asap); the server and ProABD speak operable / inoperable and standby /
// priority / expedited. Until this release nothing translated between them,
// so every non-running car reached ProABD as running and every hero lead was
// stored as "priority". These normalizers accept BOTH vocabularies (old
// links in the wild keep working) and return the canonical server value, or
// undefined for anything unrecognized. Used by the /quote parser AND by
// /api/lead, so the two sides can't drift again.

export const CANONICAL_CONDITIONS = ["operable", "inoperable"] as const;
export type CanonicalCondition = (typeof CANONICAL_CONDITIONS)[number];

export const CANONICAL_TIERS = ["standby", "priority", "expedited"] as const;
export type CanonicalTier = (typeof CANONICAL_TIERS)[number];

export const CANONICAL_TRANSPORTS = ["open", "enclosed"] as const;
export type CanonicalTransport = (typeof CANONICAL_TRANSPORTS)[number];

/** Vehicle keys the quote form offers. Superset of the hero's options. */
export const QUOTE_VEHICLE_TYPES = [
  "sedan",
  "suv",
  "truckStandard",
  "truckLifted",
  "van",
  "classic",
  "exotic",
  "other",
] as const;
export type QuoteVehicleType = (typeof QUOTE_VEHICLE_TYPES)[number];

const CONDITION_ALIASES: Record<string, CanonicalCondition> = {
  operable: "operable",
  drivable: "operable",
  running: "operable",
  inoperable: "inoperable",
  nondrivable: "inoperable",
  "non-drivable": "inoperable",
  notrunning: "inoperable",
};

const TIER_ALIASES: Record<string, CanonicalTier> = {
  standby: "standby",
  flexible: "standby",
  priority: "priority",
  withinweek: "priority",
  expedited: "expedited",
  asap: "expedited",
};

function key(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().toLowerCase() : null;
}

export function normalizeCondition(v: unknown): CanonicalCondition | undefined {
  const k = key(v);
  return k ? CONDITION_ALIASES[k] : undefined;
}

export function normalizeTiming(v: unknown): CanonicalTier | undefined {
  const k = key(v);
  return k ? TIER_ALIASES[k] : undefined;
}

export function normalizeTransport(v: unknown): CanonicalTransport | undefined {
  const k = key(v);
  if (!k) return undefined;
  if (k.includes("enclos")) return "enclosed";
  if (k.includes("open")) return "open";
  return undefined;
}

/** Returns the form's vehicle key (case-insensitive match), else undefined. */
export function normalizeVehicleType(v: unknown): QuoteVehicleType | undefined {
  const k = key(v);
  if (!k) return undefined;
  return QUOTE_VEHICLE_TYPES.find((t) => t.toLowerCase() === k);
}

/**
 * Parse the /quote page's searchParams back into a HeroHandoff. Accepts
 * the raw Record<string, string | undefined> shape Next.js provides.
 * Condition, timing, transport and vehicle type come back in canonical
 * form (see normalizers above); unrecognized values are dropped.
 */
export function parseQuoteSearchParams(
  params: Partial<Record<string, string>>,
): HeroHandoff {
  return {
    originZip: params.from,
    destinationZip: params.to,
    vehicleType: normalizeVehicleType(params.vehicle_type),
    condition: normalizeCondition(params.condition),
    transportType: normalizeTransport(params.transport),
    timing: normalizeTiming(params.timing),
  };
}

/**
 * Recognized URL-param keys, exported for the /quote searchParams type.
 */
export const QUOTE_SEARCH_PARAM_KEYS = Object.values(URL_PARAM_MAP);
export type QuoteSearchParamKey = (typeof QUOTE_SEARCH_PARAM_KEYS)[number];
