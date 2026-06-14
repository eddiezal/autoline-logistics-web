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

export interface Corridor {
  /** URL segment under /corridors/<slug>. Also the join key for catalog lookups. */
  slug: string;
  fromState: string;
  toState: string;
  status: "live" | "coming-soon";
  subDestinations?: SubDestination[];
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
  },

  // Coming-soon corridors, sequenced by likely customer demand for B2C auto transport
  { slug: "california-florida", fromState: "CA", toState: "FL", status: "coming-soon" },
  { slug: "california-new-york", fromState: "CA", toState: "NY", status: "coming-soon" },
  { slug: "california-arizona", fromState: "CA", toState: "AZ", status: "coming-soon" },
  { slug: "california-nevada", fromState: "CA", toState: "NV", status: "coming-soon" },
  { slug: "california-washington", fromState: "CA", toState: "WA", status: "coming-soon" },
  { slug: "california-oregon", fromState: "CA", toState: "OR", status: "coming-soon" },
  { slug: "california-colorado", fromState: "CA", toState: "CO", status: "coming-soon" },
  { slug: "florida-new-york", fromState: "FL", toState: "NY", status: "coming-soon" },
  { slug: "texas-florida", fromState: "TX", toState: "FL", status: "coming-soon" },
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
