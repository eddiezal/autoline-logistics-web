/**
 * ProABD field census — what do we ACTUALLY already receive?
 *
 * Written 2026-08-16 to settle a question by measurement instead of assumption.
 *
 * source-comparison.mjs has carried the caveat "fee per source needs the unmapped
 * Transport fields" since v1. That caveat was INHERITED, never verified — and it
 * sits awkwardly beside the fact that price-integrity.mjs computed carrier pay,
 * broker fee and deposit movement on 84 booked orders. Both cannot be true.
 *
 * Two possible explanations, and this script distinguishes them:
 *   A. The webhook payload really lacks the money fields, and price-integrity
 *      read them from somewhere else (the orders CSV import, a different route).
 *   B. The payload HAS them, and source-comparison.mjs simply never asked —
 *      it calls .select() with an explicit field list, so anything omitted is
 *      invisible whether or not it exists.
 *
 * If B, the "we need Brian to map the Transport fields" blocker does not exist
 * and the economic analysis can start today.
 *
 * This fetches WITHOUT .select() so nothing is hidden by our own query.
 *
 * PII SAFETY: sample values are printed ONLY for keys matching a safe allowlist
 * (ids, dates, types, statuses, money). Everything else reports type and
 * population only — never the value. Customer names, emails, phones and
 * addresses must not land in a terminal log or a repo.
 *
 * Usage:
 *   node scripts/proabd-field-census.mjs             # census over a 4000-doc sample
 *   node scripts/proabd-field-census.mjs --all       # every event (slower)
 *   node scripts/proabd-field-census.mjs --key Transport   # drill into one subtree
 */

import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) { console.error("Missing FIREBASE_PROJECT_ID"); process.exit(1); }
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const args = process.argv.slice(2);
const ALL = args.includes("--all");
const kIdx = args.indexOf("--key");
const DRILL = kIdx >= 0 ? String(args[kIdx + 1] ?? "") : null;
const LIMIT = ALL ? 20000 : 4000;

/** Keys whose VALUES are safe to print. Everything else: type + population only. */
const SAFE_VALUE = /(^|_|\.)(id|ids|date|type|status|code|flag|count|num|qty|quantity|referrer|source|stage|state|method|terms|trailer|operable|running)($|_|\d)/i;
/** Anything that smells like money — the whole point of the exercise. */
const MONEY = /(price|fee|cost|deposit|amount|total|pay|payment|rate|commission|balance|charge|due|tariff|carrier_?pay|broker)/i;
/** Never print, even if it sneaks past SAFE_VALUE. */
const PII = /(name|email|mail|phone|cell|tel|address|addr|street|city|zip|postal|contact|customer|shipper|consignee|origin|destination|company)/i;

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v.toDate instanceof Function);
const str = (v) => (v === undefined || v === null ? "" : String(v).trim());

const fields = new Map(); // path -> {seen, populated, types:Set, samples:Set, nums:[]}

function note(path, v) {
  let f = fields.get(path);
  if (!f) { f = { seen: 0, populated: 0, types: new Set(), samples: new Set(), nums: [] }; fields.set(path, f); }
  f.seen++;
  const s = str(v);
  if (s === "" || s === "null" || s === "undefined") return;
  f.populated++;
  f.types.add(Array.isArray(v) ? "array" : v?.toDate instanceof Function ? "timestamp" : typeof v);
  const num = Number(s.replace(/[$,]/g, ""));
  if (Number.isFinite(num) && s.length < 16) f.nums.push(num);
  const safe = (SAFE_VALUE.test(path) || MONEY.test(path)) && !PII.test(path);
  if (safe && f.samples.size < 6) f.samples.add(s.slice(0, 24));
}

function walk(obj, prefix, depth) {
  if (depth > 3 || !isObj(obj)) return;
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (isObj(v)) { note(path, "[object]"); walk(v, path, depth + 1); }
    else note(path, v);
  }
}

console.log(`\nReading proabd_webhook_events (no .select — full payload), limit ${LIMIT} ...`);
const snap = await db.collection("proabd_webhook_events")
  .orderBy("received_at", "desc").limit(LIMIT).get();
console.log(`${snap.size} events sampled.\n`);
for (const doc of snap.docs) walk(doc.data(), "", 0);

const total = snap.size;
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
const pctOf = (n) => (n / total * 100).toFixed(1) + "%";

function row(path, f) {
  const types = [...f.types].join("/") || "—";
  const nums = f.nums.length ? f.nums.slice().sort((a, b) => a - b) : null;
  const range = nums ? `${nums[0]} .. ${nums[nums.length - 1]}` : "";
  const samples = f.samples.size ? [...f.samples].join(", ") : (PII.test(path) ? "(withheld — PII)" : "(not shown)");
  return pad(path.slice(0, 42), 44) + rp(f.populated, 7) + rp(pctOf(f.populated), 9) + "  " +
    pad(types, 11) + (MONEY.test(path) && range ? `range ${range}` : samples).slice(0, 60);
}

const entries = [...fields.entries()].sort((a, b) => b[1].populated - a[1].populated);

if (DRILL) {
  console.log(`=== KEYS UNDER "${DRILL}" ===`);
  const hits = entries.filter(([p]) => p.toLowerCase().includes(DRILL.toLowerCase()));
  if (!hits.length) console.log(`  no key path contains "${DRILL}" in this sample.`);
  console.log(pad("path", 44) + rp("populated", 7) + rp("%", 9) + "  " + pad("type", 11) + "sample / range");
  console.log("-".repeat(104));
  hits.forEach(([p, f]) => console.log(row(p, f)));
  process.exit(0);
}

/* ---- The headline: is there money in this payload? ---- */
const money = entries.filter(([p]) => MONEY.test(p) && !PII.test(p));
console.log("=".repeat(104));
console.log("=== MONEY FIELDS — the question this script exists to answer ===");
console.log("=".repeat(104));
if (!money.length) {
  console.log("  NONE FOUND. The webhook payload genuinely lacks fee/cost/deposit fields.");
  console.log("  => Explanation A. price-integrity.mjs must be reading them elsewhere");
  console.log("     (orders CSV import, or a separate route). Find that source before");
  console.log("     asking Brian for anything — we may already have the data by another path.");
} else {
  console.log(`  ${money.length} money-ish field(s) PRESENT in the payload:`);
  console.log("  " + pad("path", 42) + rp("populated", 7) + rp("%", 9) + "  " + pad("type", 11) + "range");
  console.log("  " + "-".repeat(100));
  money.forEach(([p, f]) => console.log("  " + row(p, f)));
  console.log(`\n  => Explanation B. The fields are already arriving. source-comparison.mjs`);
  console.log(`     could not see them because its .select() never asked for them.`);
  console.log(`     The "Brian must map the Transport fields" blocker does NOT exist for`);
  console.log(`     anything listed above. Add them to the select and the economic`);
  console.log(`     analysis can start today.`);
  console.log(`     Still verify: population % must be high enough on BOOKED records`);
  console.log(`     specifically, not just overall.`);
}

/* ---- Everything else ---- */
console.log(`\n${"=".repeat(104)}`);
console.log("=== FULL FIELD CENSUS (values shown only for non-PII keys) ===");
console.log("=".repeat(104));
console.log(pad("path", 44) + rp("populated", 7) + rp("%", 9) + "  " + pad("type", 11) + "sample / range");
console.log("-".repeat(104));
entries.forEach(([p, f]) => console.log(row(p, f)));

console.log(`\n── What to look for ──`);
console.log("  · a first-contact or first-touch timestamp   -> removes an instrumentation item");
console.log("  · carrier pay vs broker fee as separate keys -> gives net contribution, not gross");
console.log("  · a duplicate/parent id                      -> needed for the duplicate-clustering rule");
console.log("  · anything holding a gclid / click id        -> record-level ad cost attribution");
console.log("  · lead-cost or vendor-cost keys              -> Q2b becomes computable without invoices");
console.log(`\n  Sample is the ${LIMIT} most recent events; a field used only on old records may`);
console.log(`  be under-counted. Re-run with --all before concluding a field is absent.\n`);
process.exit(0);
