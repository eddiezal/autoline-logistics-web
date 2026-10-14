/**
 * Regenerates src/data/zip-locations.json from the `zipcodes` npm package
 * (devDependency). Run manually when the dataset needs refreshing:
 *   node scripts/generate-zip-locations.mjs
 *
 * Output shape: { "90210": "Beverly Hills|CA", ... } — compact on purpose;
 * parsed by src/lib/leads/zipLocation.ts. US ZIPs only (50 states + DC + PR).
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const z = require("zipcodes");
const codes = z.codes; // internal map zip -> record
const out = {};
let n = 0;
for (const key of Object.keys(codes)) {
  const r = codes[key];
  if (!r || r.country !== "US" || !/^\d{5}$/.test(r.zip)) continue;
  if (!r.city || !r.state) continue;
  out[r.zip] = r.city + "|" + r.state;
  n++;
}
writeFileSync("src/data/zip-locations.json", JSON.stringify(out));
console.log("wrote", n, "US ZIPs to src/data/zip-locations.json");
