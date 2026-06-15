/**
 * Corridor catalog. Single source of truth for corridor pages and the index.
 *
 * Each corridor has a `slug` (used as URL segment) and either lives at
 * /corridors/<slug>/page.tsx (status: "live") or appears as a "Coming soon"
 * card on the /corridors index (status: "coming-soon").
 *
 * COPY LIVES IN `src/messages/{en,es}.json`, NOT HERE.
 * - From/to state display names: `quote.states.{code}`
 * - Corridor shortDesc: `corridors.catalog.{camelKey}.shortDesc`
 * - Sub-destination fields (name, routing, timeline, note, customers):
 *   `corridors.catalog.{camelKey}.subDestinations.{subKey}.{field}`
 */

export interface SubDestination {
  /** URL-friendly identifier, also used as the `dest` query param to /quote. */
  slug: string;
}

export interface PricingConfig {
  /** Representative origin ZIP for cron pricing lookups. */
  originZip: string;
  originCity: string;
  originState: string;
  /** Representative destination ZIP for cron pricing lookups. */
  destZip: string;
  destCity: string;
  destState: string;
  /** Display-side transit window for the snapshot card.
   *  Derived from corridor-typical carrier transit, not SD response
   *  (Pricing Insights API doesn't return transit days). */
  transitMinDays: number;
  transitMaxDays: number;
}

export interface Corridor {
  /** URL segment under /corridors/<slug>. Also the join key for catalog lookups. */
  slug: string;
  fromState: string;
  toState: string;
  status: "live" | "coming-soon";
  subDestinations?: SubDestination[];
  /** Optional. If present, the daily pricing cron will log SD prices for this
   *  corridor. Only continental-US corridors qualify (SD Pricing Insights API
   *  excludes AK/HI/PR). */
  pricing?: PricingConfig;
}

export const CORRIDORS: Corridor[] = [
  {
    slug: "california-hawaii",
    fromState: "CA",
    toState: "HI",
    status: "live",
    subDestinations: [
      { slug: "oahu" },
      { slug: "maui" },
      { slug: "big-island" },
      { slug: "kauai" },
    ],
  },
  {
    slug: "california-alaska",
    fromState: "CA",
    toState: "AK",
    status: "live",
    subDestinations: [
      { slug: "anchorage" },
      { slug: "fairbanks" },
      { slug: "mat-su-valley" },
      { slug: "southeast-alaska" },
    ],
  },
  {
    slug: "california-texas",
    fromState: "CA",
    toState: "TX",
    status: "live",
    subDestinations: [
      { slug: "dallas-fort-worth" },
      { slug: "houston" },
      { slug: "austin" },
      { slug: "san-antonio" },
    ],
    pricing: {
      originZip: "90210",
      originCity: "Los Angeles",
      originState: "CA",
      destZip: "78701",
      destCity: "Austin",
      destState: "TX",
      transitMinDays: 3,
      transitMaxDays: 5,
    },
  },

  // Long-distance high-margin corridors promoted to live 2026-06-15.
  {
    slug: "california-florida",
    fromState: "CA",
    toState: "FL",
    status: "live",
    subDestinations: [
      { slug: "miami" },
      { slug: "orlando" },
      { slug: "tampa" },
      { slug: "jacksonville" },
    ],
    pricing: {
      originZip: "90210",
      originCity: "Los Angeles",
      originState: "CA",
      destZip: "33101",
      destCity: "Miami",
      destState: "FL",
      transitMinDays: 6,
      transitMaxDays: 9,
    },
  },
  {
    slug: "california-new-york",
    fromState: "CA",
    toState: "NY",
    status: "live",
    subDestinations: [
      { slug: "manhattan" },
      { slug: "brooklyn" },
      { slug: "long-island" },
      { slug: "upstate" },
    ],
    pricing: {
      originZip: "90210",
      originCity: "Los Angeles",
      originState: "CA",
      destZip: "10001",
      destCity: "New York",
      destState: "NY",
      transitMinDays: 7,
      transitMaxDays: 10,
    },
  },
  {
    slug: "new-york-florida",
    fromState: "NY",
    toState: "FL",
    status: "live",
    subDestinations: [
      { slug: "miami" },
      { slug: "orlando" },
      { slug: "tampa" },
      { slug: "naples" },
    ],
    pricing: {
      originZip: "10001",
      originCity: "New York",
      originState: "NY",
      destZip: "33101",
      destCity: "Miami",
      destState: "FL",
      transitMinDays: 3,
      transitMaxDays: 5,
    },
  },
  {
    slug: "texas-florida",
    fromState: "TX",
    toState: "FL",
    status: "live",
    subDestinations: [
      { slug: "miami" },
      { slug: "tampa" },
      { slug: "orlando" },
      { slug: "jacksonville" },
    ],
    pricing: {
      originZip: "77001",
      originCity: "Houston",
      originState: "TX",
      destZip: "33101",
      destCity: "Miami",
      destState: "FL",
      transitMinDays: 3,
      transitMaxDays: 5,
    },
  },
  {
    slug: "california-georgia",
    fromState: "CA",
    toState: "GA",
    status: "live",
    subDestinations: [
      { slug: "atlanta" },
      { slug: "savannah" },
      { slug: "macon" },
      { slug: "augusta" },
    ],
    pricing: {
      originZip: "90210",
      originCity: "Los Angeles",
      originState: "CA",
      destZip: "30303",
      destCity: "Atlanta",
      destState: "GA",
      transitMinDays: 6,
      transitMaxDays: 8,
    },
  },
  {
    slug: "california-north-carolina",
    fromState: "CA",
    toState: "NC",
    status: "live",
    subDestinations: [
      { slug: "charlotte" },
      { slug: "raleigh" },
      { slug: "durham" },
      { slug: "asheville" },
    ],
    pricing: {
      originZip: "90210",
      originCity: "Los Angeles",
      originState: "CA",
      destZip: "28202",
      destCity: "Charlotte",
      destState: "NC",
      transitMinDays: 6,
      transitMaxDays: 9,
    },
  },
  {
    slug: "california-illinois",
    fromState: "CA",
    toState: "IL",
    status: "live",
    subDestinations: [
      { slug: "chicago" },
      { slug: "naperville" },
      { slug: "aurora" },
      { slug: "joliet" },
    ],
    pricing: {
      originZip: "90210",
      originCity: "Los Angeles",
      originState: "CA",
      destZip: "60601",
      destCity: "Chicago",
      destState: "IL",
      transitMinDays: 5,
      transitMaxDays: 7,
    },
  },

  // Shorter / lower-priority corridors stay coming-soon for now.
  { slug: "california-arizona", fromState: "CA", toState: "AZ", status: "coming-soon" },
  { slug: "california-nevada", fromState: "CA", toState: "NV", status: "coming-soon" },
  { slug: "california-washington", fromState: "CA", toState: "WA", status: "coming-soon" },
  { slug: "california-oregon", fromState: "CA", toState: "OR", status: "coming-soon" },
  { slug: "california-colorado", fromState: "CA", toState: "CO", status: "coming-soon" },
];

/**
 * Convert corridor slug ("california-hawaii") to the camelCase catalog key
 * used in messages JSON under corridors.catalog.{key}.
 */
export function corridorCatalogKey(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Convert a sub-destination slug to its catalog key. Some entries use shorter
 * keys in the catalog than their URL slugs.
 */
export function subDestCatalogKey(slug: string): string {
  const SHORT_FORMS: Record<string, string> = {
    "big-island": "bigIsland",
    "mat-su-valley": "matSu",
    "southeast-alaska": "southeast",
    "dallas-fort-worth": "dallasFortWorth",
    "san-antonio": "sanAntonio",
    "long-island": "longIsland",
  };
  return SHORT_FORMS[slug] ?? slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

export function getCorridor(slug: string): Corridor | undefined {
  return CORRIDORS.find((c) => c.slug === slug);
}

export function getLiveCorridors(): Corridor[] {
  return CORRIDORS.filter((c) => c.status === "live");
}

export function getComingSoonCorridors(): Corridor[] {
  return CORRIDORS.filter((c) => c.status === "coming-soon");
}

/** Corridors whose pricing should be synced by the daily cron.
 *  Returns only live corridors with a `pricing` config set. */
export function getPricingCorridors(): Corridor[] {
  return CORRIDORS.filter((c) => c.status === "live" && c.pricing);
}
