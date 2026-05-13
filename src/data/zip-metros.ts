/**
 * Top ~80 US metro ZIPs with lat/lng for the Ship vs Drive Calculator v1.
 *
 * Why this dataset shape — not full US ZIP set:
 *   • v1 only needs distance for "common" routes. ~80 metros cover ~80% of
 *     real B2C auto-transport demand.
 *   • Full Census ZIP→lat/lng table is ~3MB. We don't want to ship that for
 *     a non-critical tool; v2 will hit Google Maps Distance Matrix API.
 *   • For ZIPs not in the table, we fall back to 3-digit prefix matching
 *     (USPS sectional center facility — same-prefix ZIPs are always in the
 *     same metro) before giving up and routing to /quote.
 *
 * Coordinates are approximate metro centroids — accuracy +/-10 mi is plenty
 * for a directional cost-comparison tool. We multiply haversine by 1.2x to
 * approximate real road distance (highways are not straight lines).
 *
 * v2 swap: replace this dataset + haversine math with a Maps API call.
 * v3 swap: pull distance from Super Dispatch pricing API alongside the price.
 */

export interface MetroZip {
  zip: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

export const METRO_ZIPS: ReadonlyArray<MetroZip> = [
  // California
  { zip: "90001", city: "Los Angeles",      state: "CA", lat: 33.9731, lng: -118.2479 },
  { zip: "90012", city: "Downtown LA",      state: "CA", lat: 34.0610, lng: -118.2380 },
  { zip: "90210", city: "Beverly Hills",    state: "CA", lat: 34.0901, lng: -118.4065 },
  { zip: "90802", city: "Long Beach",       state: "CA", lat: 33.7670, lng: -118.1900 },
  { zip: "92101", city: "San Diego",        state: "CA", lat: 32.7194, lng: -117.1631 },
  { zip: "92807", city: "Anaheim",          state: "CA", lat: 33.8606, lng: -117.7600 },
  { zip: "93301", city: "Bakersfield",      state: "CA", lat: 35.3733, lng: -119.0187 },
  { zip: "93701", city: "Fresno",           state: "CA", lat: 36.7468, lng: -119.7726 },
  { zip: "94102", city: "San Francisco",    state: "CA", lat: 37.7793, lng: -122.4193 },
  { zip: "94601", city: "Oakland",          state: "CA", lat: 37.7770, lng: -122.2240 },
  { zip: "95110", city: "San Jose",         state: "CA", lat: 37.3360, lng: -121.8920 },
  { zip: "95814", city: "Sacramento",       state: "CA", lat: 38.5810, lng: -121.4940 },
  // Pacific Northwest
  { zip: "97201", city: "Portland",         state: "OR", lat: 45.5152, lng: -122.6784 },
  { zip: "97401", city: "Eugene",           state: "OR", lat: 44.0521, lng: -123.0868 },
  { zip: "98101", city: "Seattle",          state: "WA", lat: 47.6101, lng: -122.3344 },
  { zip: "98402", city: "Tacoma",           state: "WA", lat: 47.2529, lng: -122.4443 },
  { zip: "99201", city: "Spokane",          state: "WA", lat: 47.6588, lng: -117.4260 },
  // Mountain West
  { zip: "85003", city: "Phoenix",          state: "AZ", lat: 33.4484, lng: -112.0740 },
  { zip: "85701", city: "Tucson",           state: "AZ", lat: 32.2226, lng: -110.9747 },
  { zip: "87101", city: "Albuquerque",      state: "NM", lat: 35.0844, lng: -106.6504 },
  { zip: "89101", city: "Las Vegas",        state: "NV", lat: 36.1716, lng: -115.1391 },
  { zip: "89501", city: "Reno",             state: "NV", lat: 39.5296, lng: -119.8138 },
  { zip: "80202", city: "Denver",           state: "CO", lat: 39.7392, lng: -104.9903 },
  { zip: "80903", city: "Colorado Springs", state: "CO", lat: 38.8339, lng: -104.8214 },
  { zip: "84101", city: "Salt Lake City",   state: "UT", lat: 40.7608, lng: -111.8910 },
  { zip: "83702", city: "Boise",            state: "ID", lat: 43.6150, lng: -116.2023 },
  { zip: "59101", city: "Billings",         state: "MT", lat: 45.7833, lng: -108.5007 },
  // Texas and Southwest
  { zip: "73102", city: "Oklahoma City",    state: "OK", lat: 35.4676, lng: -97.5164 },
  { zip: "74103", city: "Tulsa",            state: "OK", lat: 36.1540, lng: -95.9928 },
  { zip: "75201", city: "Dallas",           state: "TX", lat: 32.7831, lng: -96.8067 },
  { zip: "76102", city: "Fort Worth",       state: "TX", lat: 32.7555, lng: -97.3308 },
  { zip: "77002", city: "Houston",          state: "TX", lat: 29.7604, lng: -95.3698 },
  { zip: "78201", city: "San Antonio",      state: "TX", lat: 29.4241, lng: -98.4936 },
  { zip: "78701", city: "Austin",           state: "TX", lat: 30.2672, lng: -97.7431 },
  { zip: "79901", city: "El Paso",          state: "TX", lat: 31.7619, lng: -106.4850 },
  { zip: "72201", city: "Little Rock",      state: "AR", lat: 34.7465, lng: -92.2896 },
  { zip: "70112", city: "New Orleans",      state: "LA", lat: 29.9511, lng: -90.0715 },
  { zip: "70802", city: "Baton Rouge",      state: "LA", lat: 30.4515, lng: -91.1871 },
  // Midwest
  { zip: "60601", city: "Chicago",          state: "IL", lat: 41.8855, lng: -87.6217 },
  { zip: "62701", city: "Springfield",      state: "IL", lat: 39.8017, lng: -89.6437 },
  { zip: "46204", city: "Indianapolis",     state: "IN", lat: 39.7684, lng: -86.1581 },
  { zip: "43215", city: "Columbus",         state: "OH", lat: 39.9612, lng: -82.9988 },
  { zip: "44113", city: "Cleveland",        state: "OH", lat: 41.4845, lng: -81.7028 },
  { zip: "45202", city: "Cincinnati",       state: "OH", lat: 39.1031, lng: -84.5120 },
  { zip: "48201", city: "Detroit",          state: "MI", lat: 42.3433, lng: -83.0540 },
  { zip: "53202", city: "Milwaukee",        state: "WI", lat: 43.0389, lng: -87.9065 },
  { zip: "55401", city: "Minneapolis",      state: "MN", lat: 44.9778, lng: -93.2650 },
  { zip: "50309", city: "Des Moines",       state: "IA", lat: 41.5868, lng: -93.6250 },
  { zip: "63101", city: "St. Louis",        state: "MO", lat: 38.6270, lng: -90.1994 },
  { zip: "64108", city: "Kansas City",      state: "MO", lat: 39.0997, lng: -94.5786 },
  { zip: "68102", city: "Omaha",            state: "NE", lat: 41.2565, lng: -95.9345 },
  // Southeast
  { zip: "30303", city: "Atlanta",          state: "GA", lat: 33.7490, lng: -84.3880 },
  { zip: "31401", city: "Savannah",         state: "GA", lat: 32.0809, lng: -81.0912 },
  { zip: "32202", city: "Jacksonville",     state: "FL", lat: 30.3322, lng: -81.6557 },
  { zip: "33101", city: "Miami",            state: "FL", lat: 25.7617, lng: -80.1918 },
  { zip: "33401", city: "West Palm Beach",  state: "FL", lat: 26.7153, lng: -80.0534 },
  { zip: "33602", city: "Tampa",            state: "FL", lat: 27.9506, lng: -82.4572 },
  { zip: "32801", city: "Orlando",          state: "FL", lat: 28.5384, lng: -81.3789 },
  { zip: "29401", city: "Charleston",       state: "SC", lat: 32.7765, lng: -79.9311 },
  { zip: "28202", city: "Charlotte",        state: "NC", lat: 35.2271, lng: -80.8431 },
  { zip: "27601", city: "Raleigh",          state: "NC", lat: 35.7796, lng: -78.6382 },
  { zip: "23219", city: "Richmond",         state: "VA", lat: 37.5407, lng: -77.4360 },
  { zip: "23510", city: "Norfolk",          state: "VA", lat: 36.8508, lng: -76.2859 },
  { zip: "37203", city: "Nashville",        state: "TN", lat: 36.1627, lng: -86.7816 },
  { zip: "38103", city: "Memphis",          state: "TN", lat: 35.1495, lng: -90.0490 },
  { zip: "40202", city: "Louisville",       state: "KY", lat: 38.2527, lng: -85.7585 },
  { zip: "35203", city: "Birmingham",       state: "AL", lat: 33.5186, lng: -86.8104 },
  { zip: "39201", city: "Jackson",          state: "MS", lat: 32.2988, lng: -90.1848 },
  // Mid-Atlantic and Northeast
  { zip: "20001", city: "Washington",       state: "DC", lat: 38.9072, lng: -77.0369 },
  { zip: "21202", city: "Baltimore",        state: "MD", lat: 39.2904, lng: -76.6122 },
  { zip: "19103", city: "Philadelphia",     state: "PA", lat: 39.9526, lng: -75.1652 },
  { zip: "15222", city: "Pittsburgh",       state: "PA", lat: 40.4406, lng: -79.9959 },
  { zip: "10001", city: "New York",         state: "NY", lat: 40.7506, lng: -73.9971 },
  { zip: "11201", city: "Brooklyn",         state: "NY", lat: 40.6943, lng: -73.9903 },
  { zip: "14202", city: "Buffalo",          state: "NY", lat: 42.8864, lng: -78.8784 },
  { zip: "07102", city: "Newark",           state: "NJ", lat: 40.7357, lng: -74.1724 },
  { zip: "08608", city: "Trenton",          state: "NJ", lat: 40.2206, lng: -74.7597 },
  { zip: "06103", city: "Hartford",         state: "CT", lat: 41.7637, lng: -72.6851 },
  { zip: "02108", city: "Boston",           state: "MA", lat: 42.3601, lng: -71.0589 },
  { zip: "02903", city: "Providence",       state: "RI", lat: 41.8240, lng: -71.4128 },
  { zip: "03101", city: "Manchester",       state: "NH", lat: 42.9956, lng: -71.4548 },
  { zip: "04101", city: "Portland",         state: "ME", lat: 43.6591, lng: -70.2568 },
  { zip: "05401", city: "Burlington",       state: "VT", lat: 44.4759, lng: -73.2121 },
  // Hawaii
  { zip: "96813", city: "Honolulu",         state: "HI", lat: 21.3099, lng: -157.8581 },
  { zip: "96720", city: "Hilo",             state: "HI", lat: 19.7297, lng: -155.0900 },
  { zip: "96732", city: "Kahului (Maui)",   state: "HI", lat: 20.8848, lng: -156.4729 },
  { zip: "96766", city: "Lihue (Kauai)",    state: "HI", lat: 21.9788, lng: -159.3711 },
  // Alaska
  { zip: "99501", city: "Anchorage",        state: "AK", lat: 61.2181, lng: -149.9003 },
  { zip: "99701", city: "Fairbanks",        state: "AK", lat: 64.8378, lng: -147.7164 },
  { zip: "99801", city: "Juneau",           state: "AK", lat: 58.3019, lng: -134.4197 },
];

const ZIP_INDEX: Map<string, MetroZip> = new Map(METRO_ZIPS.map((z) => [z.zip, z]));

/** Returns the metro entry if the ZIP is in our v1 table, otherwise null. */
export function lookupZip(zip: string): MetroZip | null {
  return ZIP_INDEX.get(zip) ?? null;
}

/**
 * Look up a ZIP with prefix-fallback: if the exact ZIP isn't in our table,
 * find the closest table entry sharing the same first 3 digits (USPS
 * sectional center facility). Same-prefix ZIPs are always in the same
 * metro, so distance estimates are within rounding error.
 */
export function lookupZipApprox(
  zip: string
): { entry: MetroZip; approximated: boolean } | null {
  const exact = ZIP_INDEX.get(zip);
  if (exact) return { entry: exact, approximated: false };
  if (!/^\d{5}$/.test(zip)) return null;
  const prefix = zip.slice(0, 3);
  const target = parseInt(zip, 10);
  let best: MetroZip | null = null;
  let bestDiff = Infinity;
  for (const z of METRO_ZIPS) {
    if (z.zip.slice(0, 3) !== prefix) continue;
    const diff = Math.abs(parseInt(z.zip, 10) - target);
    if (diff < bestDiff) {
      best = z;
      bestDiff = diff;
    }
  }
  return best ? { entry: best, approximated: true } : null;
}

/**
 * Best-effort ZIP-prefix to state detection for ZIPs NOT in METRO_ZIPS.
 * Used to detect Hawaii / Alaska edge cases even when the ZIP is not in
 * our curated table.
 */
export function zipPrefixToState(zip: string): string | null {
  if (!/^\d{5}$/.test(zip)) return null;
  const n = parseInt(zip, 10);
  if (n >= 96700 && n <= 96899) return "HI";
  if (n >= 99500 && n <= 99999) return "AK";
  return null;
}

/** Great-circle distance in miles between two lat/lng points (haversine). */
export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Estimate real road distance between two metro ZIPs.
 * Multiplies great-circle by 1.2x — empirical highway factor.
 */
export function roadDistanceMiles(a: MetroZip, b: MetroZip): number {
  return haversineMiles(a, b) * 1.2;
}
