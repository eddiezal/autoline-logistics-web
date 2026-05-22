#!/usr/bin/env node
/**
 * Super Dispatch Pricing Insights probe. Run on your machine (sandbox can't
 * reach SD's host):  node scripts/sd-pricing-test.mjs
 * Reads .env.local for SD_PRICING_API_KEY + SD_PRICING_BASE_URL + SD_PRICING_QUOTE_PATH.
 * Prints status + the raw JSON so we can confirm the price/confidence field names.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  if (!(t.slice(0, i).trim() in process.env)) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const KEY = process.env.SD_PRICING_API_KEY || process.env.SD_PRICING_ACCESS_TOKEN || "";
const BASE = (process.env.SD_PRICING_BASE_URL || "").replace(/\/$/, "");
const PATH = process.env.SD_PRICING_QUOTE_PATH || "";
if (!KEY || !BASE || !PATH) { console.error("Missing SD_PRICING_API_KEY / BASE_URL / QUOTE_PATH in .env.local"); process.exit(1); }
const body = {
  pickup: { city: "Los Angeles", state: "CA", zip: "90001" },
  delivery: { city: "New York", state: "NY", zip: "10001" },
  trailer_type: "open",
  vehicles: [{ type: "sedan", is_inoperable: false }],
};
console.log(`POST ${BASE}${PATH}\nbody: ${JSON.stringify(body)}\n`);
const res = await fetch(BASE + PATH, {
  method: "POST",
  headers: { "X-API-Key": KEY, "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify(body),
});
console.log(`${res.status} ${res.statusText}\n=== RAW RESPONSE ===`);
console.log(await res.text());
