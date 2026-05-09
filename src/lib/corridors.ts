/**
 * Corridor catalog — single source of truth for corridor pages and the index.
 *
 * Each corridor has a `slug` (used as URL segment) and either lives at
 * /corridors/<slug>/page.tsx (status: "live") or appears as a "Coming soon"
 * card on the /corridors index (status: "coming-soon").
 *
 * Sub-destinations describe the specific cities/regions within the
 * destination state that customers care about differently. Surfaced as
 * cards on the corridor page.
 */

export interface SubDestination {
  slug: string;
  name: string;
  routing: string;
  timeline: string;
  note: string;
  customers: string;
}

export interface Corridor {
  slug: string;
  fromState: string;
  toState: string;
  fromName: string;
  toName: string;
  status: "live" | "coming-soon";
  shortDesc: string;
  subDestinations?: SubDestination[];
}

export const CORRIDORS: Corridor[] = [
  {
    slug: "california-hawaii",
    fromState: "CA",
    toState: "HI",
    fromName: "California",
    toName: "Hawaii",
    status: "live",
    shortDesc:
      "Door-to-door to all four major islands. Port logistics, ocean booking, and inland trucking under one locked price.",
    subDestinations: [
      {
        slug: "oahu",
        name: "Oahu — Honolulu",
        routing: "CA → Long Beach/Oakland port → Honolulu port → your address",
        timeline: "10–14 days door-to-door",
        note: "Primary mainland-Hawaii port. Most sailings per week, fastest turnaround. Default destination if you ship to Oahu.",
        customers: "Military PCS to Pearl Harbor / JBPHH, mainland vehicle buyers, college students",
      },
      {
        slug: "maui",
        name: "Maui — Kahului",
        routing: "CA → Long Beach/Oakland → Honolulu → Kahului (inter-island)",
        timeline: "12–18 days door-to-door",
        note: "Inter-island barge from Honolulu. Add 2–4 days to the Oahu baseline for the second leg.",
        customers: "Snowbirds, retirees relocating, second-home owners, hospitality workers",
      },
      {
        slug: "big-island",
        name: "Big Island — Hilo or Kona",
        routing: "CA → Long Beach/Oakland → Honolulu → Hilo or Kona (inter-island)",
        timeline: "12–18 days door-to-door",
        note: "Two delivery ports. We route to Hilo (east side) or Kona (west side) based on which is closer to your destination address.",
        customers: "Coffee farm owners, ranch operations, retirees, science / observatory staff",
      },
      {
        slug: "kauai",
        name: "Kauai — Lihue",
        routing: "CA → Long Beach/Oakland → Honolulu → Lihue (inter-island)",
        timeline: "12–18 days door-to-door",
        note: "Smallest Hawaiian port. Inter-island barge from Honolulu typically 2–4 days, fewer sailings per week than Maui or Big Island.",
        customers: "Retirees, vacation-home owners, hospitality industry, healthcare workers",
      },
    ],
  },
  {
    slug: "california-alaska",
    fromState: "CA",
    toState: "AK",
    fromName: "California",
    toName: "Alaska",
    status: "live",
    shortDesc:
      "Two routes — overland via the Alaska Highway or ocean via Tacoma. We pick the right one for your season and destination.",
    subDestinations: [
      {
        slug: "anchorage",
        name: "Anchorage / JBER",
        routing: "CA → Tacoma port → Anchorage (ocean, default) OR overland via the Alaska Highway",
        timeline: "Ocean: 8–14 days · Overland: 7–12 days (summer only)",
        note: "Default destination. Joint Base Elmendorf-Richardson (JBER) is the largest military base, primary destination for Air Force / Army PCS. Best year-round route reliability.",
        customers: "Military PCS (JBER, Air Force, Army), oil/gas commuters, retirees, healthcare workers",
      },
      {
        slug: "fairbanks",
        name: "Fairbanks / Eielson AFB / Fort Wainwright",
        routing: "CA → Tacoma → Anchorage → Fairbanks (ocean route, +1–2 days inland) OR overland direct",
        timeline: "Ocean: 10–16 days · Overland: 8–12 days (summer fastest)",
        note: "Interior Alaska. Eielson AFB and Fort Wainwright are the major military bases here. Overland is often faster in summer due to direct routing.",
        customers: "Military PCS (Air Force at Eielson, Army at Wainwright), university faculty, oil/gas",
      },
      {
        slug: "mat-su-valley",
        name: "Mat-Su Valley — Wasilla, Palmer",
        routing: "CA → Tacoma → Anchorage → Mat-Su (ocean route, +1 day inland)",
        timeline: "Ocean: 8–14 days door-to-door",
        note: "Anchorage suburbs. Same primary routing as Anchorage with a short final inland leg. Common destination for working-class families and Anchorage commuters.",
        customers: "Anchorage commuters, retirees, working-class families, oil/gas crews",
      },
      {
        slug: "southeast-alaska",
        name: "Juneau / Ketchikan / Sitka",
        routing: "CA → Tacoma → southeast ports via Alaska Marine Highway (ferry-based)",
        timeline: "14–21 days door-to-door (highly variable)",
        note: "Southeast Alaska destinations route through the Alaska Marine Highway System. Longer timelines and fewer sailings — your coordinator will confirm specifics at quote time.",
        customers: "Government workers (state capital is Juneau), tourism industry, retirees, fisheries",
      },
    ],
  },

  // Coming-soon corridors — sequenced by likely customer demand for B2C auto transport
  {
    slug: "california-texas",
    fromState: "CA",
    toState: "TX",
    fromName: "California",
    toName: "Texas",
    status: "coming-soon",
    shortDesc: "California to Houston, Dallas, Austin, and San Antonio. Open and enclosed transport.",
  },
  {
    slug: "california-florida",
    fromState: "CA",
    toState: "FL",
    fromName: "California",
    toName: "Florida",
    status: "coming-soon",
    shortDesc: "Coast-to-coast, most popular snowbird corridor. Heavy enclosed-trailer demand for collector vehicles.",
  },
  {
    slug: "california-new-york",
    fromState: "CA",
    toState: "NY",
    fromName: "California",
    toName: "New York",
    status: "coming-soon",
    shortDesc: "Coast-to-coast. NYC metro and upstate destinations. Multi-vehicle relocation packages available.",
  },
  {
    slug: "california-arizona",
    fromState: "CA",
    toState: "AZ",
    fromName: "California",
    toName: "Arizona",
    status: "coming-soon",
    shortDesc: "Phoenix, Scottsdale, Tucson. Strong snowbird and retiree relocation traffic.",
  },
  {
    slug: "california-nevada",
    fromState: "CA",
    toState: "NV",
    fromName: "California",
    toName: "Nevada",
    status: "coming-soon",
    shortDesc: "Las Vegas, Reno, Carson City. Quick turnaround, often same-week dispatch.",
  },
  {
    slug: "california-washington",
    fromState: "CA",
    toState: "WA",
    fromName: "California",
    toName: "Washington",
    status: "coming-soon",
    shortDesc: "Seattle, Tacoma, Spokane. Pacific Northwest corridor with abundant carrier capacity.",
  },
  {
    slug: "california-oregon",
    fromState: "CA",
    toState: "OR",
    fromName: "California",
    toName: "Oregon",
    status: "coming-soon",
    shortDesc: "Portland, Salem, Eugene. I-5 corridor, frequent sailings.",
  },
  {
    slug: "california-colorado",
    fromState: "CA",
    toState: "CO",
    fromName: "California",
    toName: "Colorado",
    status: "coming-soon",
    shortDesc: "Denver, Boulder, Colorado Springs. Mountain-state relocations and seasonal moves.",
  },
  {
    slug: "florida-new-york",
    fromState: "FL",
    toState: "NY",
    fromName: "Florida",
    toName: "New York",
    status: "coming-soon",
    shortDesc: "The classic snowbird corridor. Heavy seasonal patterns — northbound spring, southbound fall.",
  },
  {
    slug: "texas-florida",
    fromState: "TX",
    toState: "FL",
    fromName: "Texas",
    toName: "Florida",
    status: "coming-soon",
    shortDesc: "Houston, Dallas → Miami, Tampa, Jacksonville. Cross-Gulf corridor.",
  },
];

/**
 * Helper to look up a single corridor by slug. Returns undefined if not found.
 */
export function getCorridor(slug: string): Corridor | undefined {
  return CORRIDORS.find((c) => c.slug === slug);
}

/**
 * Helper to filter the live corridors (those with their own page).
 */
export function getLiveCorridors(): Corridor[] {
  return CORRIDORS.filter((c) => c.status === "live");
}

/**
 * Helper to filter the coming-soon corridors.
 */
export function getComingSoonCorridors(): Corridor[] {
  return CORRIDORS.filter((c) => c.status === "coming-soon");
}
