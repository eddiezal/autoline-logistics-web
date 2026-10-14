/**
 * Full US ZIP -> city/state resolution. Server-side only.
 *
 * Why this exists (2026-10-14): website leads reached ProABD with
 * Transport.Origin/Destination.City = "" — the form collects ZIPs, and we
 * never resolved them. ProABD's lead list and its Central Dispatch sync are
 * city-driven, so agents saw location-less leads and had to open the full
 * quote to price anything (Renee, 2026-07-30 and 2026-10-13). The 3-digit
 * zipPrefixToState ranges in zip-metros.ts also have gaps (e.g. 723xx AR,
 * 340xx FL) that produced blank states in agent emails and the weekly digest.
 *
 * Dataset: src/data/zip-locations.json, 42k+ entries of "City|ST", generated
 * from the `zipcodes` npm package (devDependency) by
 * scripts/generate-zip-locations.mjs. ~960KB raw — acceptable in a serverless
 * function, NOT for the client bundle. Keep imports of this module inside
 * server code ("server-only" enforced below).
 */

import "server-only";

import zipLocations from "@/data/zip-locations.json";

const TABLE = zipLocations as Record<string, string>;

export interface ZipLocation {
  city: string;
  state: string;
}

/**
 * Normalize user input to a 5-digit ZIP: trims, takes the leading digit run,
 * handles ZIP+4 ("32550-4502" -> "32550"). Returns null when no 5-digit ZIP
 * can be extracted.
 */
export function normalizeZip(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{5})(?:-\d{1,4})?$/);
  return m ? m[1]! : null;
}

/** Exact 5-digit lookup. ZIP+4 input is truncated first. */
export function lookupZipLocation(raw: string | null | undefined): ZipLocation | null {
  const zip = normalizeZip(raw);
  if (!zip) return null;
  const hit = TABLE[zip];
  if (!hit) return null;
  const sep = hit.lastIndexOf("|");
  if (sep <= 0) return null;
  return { city: hit.slice(0, sep), state: hit.slice(sep + 1) };
}

/**
 * State for a ZIP with graceful degradation: exact dataset hit first, then
 * any dataset neighbor sharing the 3-digit prefix (USPS sectional centers
 * never span states), so even a ZIP missing from the table resolves when its
 * prefix exists. Returns null only for prefixes absent from the dataset.
 */
export function stateFromZip(raw: string | null | undefined): string | null {
  const exact = lookupZipLocation(raw);
  if (exact) return exact.state;
  const zip = normalizeZip(raw);
  if (!zip) return null;
  const prefix = zip.slice(0, 3);
  const neighborState = PREFIX_STATE.get(prefix);
  return neighborState ?? null;
}

// Prefix -> state index built once at module load (~1ms for 42k entries).
const PREFIX_STATE: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const zip of Object.keys(TABLE)) {
    const prefix = zip.slice(0, 3);
    if (!m.has(prefix)) {
      const hit = TABLE[zip]!;
      m.set(prefix, hit.slice(hit.lastIndexOf("|") + 1));
    }
  }
  return m;
})();
