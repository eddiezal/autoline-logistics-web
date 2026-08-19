/**
 * Webhook → orders-CSV top-up: keep the order book fresh BETWEEN Kacy's
 * monthly ProABD exports.
 *
 * Why this exists (2026-08-19): the /admin book goes stale because the full
 * orders export is a monthly manual pull. But our ProABD read path is the
 * Export-API WEBHOOK — every record that changes lands in
 * proabd_webhook_events with Transport.Price / Transport.Deposit /
 * Booked_Date / Shipper.Email at 100% population (field census 2026-08-19).
 * A record that booked since the last import BY DEFINITION changed recently,
 * so the webhook mirror necessarily contains it.
 *
 * Division of labor — this does NOT replace Kacy's export:
 *   · THIS SCRIPT  = freshness top-up for records that changed since Jul 8
 *     (webhook coverage start). Cannot see orders untouched since before
 *     then, and cannot see deletions.
 *   · KACY MONTHLY = authoritative full-book reconciliation since March.
 *   · check-deposit-coverage.mjs's cross-check + the metric contract's
 *     10%-divergence rule guard the seam between the two sources.
 *
 * Output: a CSV in EXACTLY the schema import-orders.mjs consumes
 * (order_id,email,order_created,price,deposit), written OUTSIDE the repo
 * (folder root — it contains customer emails, never commit it). Feeding the
 * existing import keeps one battle-tested write path to the orders
 * collection instead of two.
 *
 * order_created = Booked_Date when present, else Create_Date (counts of
 * each are printed — if the fallback share is high, question the run).
 * Datetimes pass through as ProABD-Eastern wall clock; import-orders.mjs
 * (fixed 2026-08-19) parses them correctly.
 *
 * VALIDATION (--validate <kacy.csv>): joins overlapping order_ids against a
 * known-good export and reports price/deposit mismatches. Run this the
 * first time and after any ProABD-side change. Zero overlap = the id
 * spaces don't match = STOP and investigate, do not import.
 *
 * Usage:
 *   node scripts/export-orders-from-webhook.mjs                       # since Jul 8, writes ../orders-webhook-topup.csv
 *   node scripts/export-orders-from-webhook.mjs --since 2026-08-10
 *   node scripts/export-orders-from-webhook.mjs --validate ../orders-import-aug2026.csv
 *   node scripts/export-orders-from-webhook.mjs --out ../orders-topup.csv
 *
 * Read-only against Firestore; writes only the local CSV.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const SINCE = new Date(`${arg("since") ?? "2026-07-08"}T00:00:00-07:00`); // webhook coverage start
const OUT = arg("out") ?? "../orders-webhook-topup.csv";
const VALIDATE = arg("validate");

console.log(`Webhook order top-up · events since ${SINCE.toISOString().slice(0, 10)} · out: ${OUT}`);

/* ---- pull order events, newest wins per ABD_Id ---- */
const snap = await db.collection("proabd_webhook_events")
  .where("received_at", ">=", SINCE)
  .orderBy("received_at", "asc")
  .get();

let orderEvents = 0;
const byId = new Map(); // ABD_Id -> latest raw_item (events are asc, later overwrites)
for (const doc of snap.docs) {
  const d = doc.data();
  const item = d.raw_item;
  if (!item || String(d.entity_type ?? item.Item_Type) !== "order") continue;
  const id = String(item.ABD_Id ?? "");
  if (!id) continue;
  orderEvents++;
  byId.set(id, item);
}
console.log(`${snap.size} events read · ${orderEvents} order events · ${byId.size} distinct orders`);

/* ---- build rows ---- */
const csvEscape = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
let usedBooked = 0, usedCreate = 0, skippedNoMoney = 0;
const rows = [];
for (const [id, item] of byId) {
  const price = Number(item.Transport?.Price ?? "");
  const deposit = Number(item.Transport?.Deposit ?? "");
  if (!Number.isFinite(price) && !Number.isFinite(deposit)) { skippedNoMoney++; continue; }
  let created = item.Booked_Date && item.Booked_Date !== "0000-00-00 00:00:00" ? item.Booked_Date : null;
  if (created) usedBooked++;
  else { created = item.Create_Date ?? ""; usedCreate++; }
  rows.push({
    order_id: id,
    email: String(item.Shipper?.Email ?? ""),
    order_created: created,
    price: Number.isFinite(price) ? price : "",
    deposit: Number.isFinite(deposit) ? deposit : "",
  });
}
rows.sort((a, b) => String(a.order_created).localeCompare(String(b.order_created)));
console.log(`${rows.length} orders → CSV · order_created from Booked_Date: ${usedBooked}, from Create_Date (fallback): ${usedCreate}${skippedNoMoney ? ` · ${skippedNoMoney} skipped (no money fields)` : ""}`);
if (usedCreate > usedBooked) {
  console.log(`⚠ Fallback share is high — check whether order events carry Booked_Date before trusting monthly grouping.`);
}

/* ---- optional validation against a known-good Kacy export ---- */
if (VALIDATE) {
  const text = readFileSync(VALIDATE, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(",").map((h) => h.trim());
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  for (const k of ["order_id", "price", "deposit"]) {
    if (!(k in col)) { console.error(`validation file missing column ${k}`); process.exit(1); }
  }
  // naive split is fine for the numeric columns we compare; emails may
  // contain no commas in this export, and we never print them anyway.
  const kacy = new Map();
  for (const line of lines.slice(1)) {
    const parts = line.split(",");
    const id = (parts[col.order_id] ?? "").trim();
    if (id) kacy.set(id, { price: Number(parts[col.price]), deposit: Number(parts[col.deposit]) });
  }
  let overlap = 0, priceMismatch = 0, depositMismatch = 0;
  const examples = [];
  for (const r of rows) {
    const k = kacy.get(r.order_id);
    if (!k) continue;
    overlap++;
    const pDiff = Number.isFinite(k.price) && r.price !== "" && Math.abs(k.price - Number(r.price)) > 0.5;
    const dDiff = Number.isFinite(k.deposit) && r.deposit !== "" && Math.abs(k.deposit - Number(r.deposit)) > 0.5;
    if (pDiff) priceMismatch++;
    if (dDiff) depositMismatch++;
    if ((pDiff || dDiff) && examples.length < 8) {
      examples.push(`  ${r.order_id}: price ${k.price} vs ${r.price} · deposit ${k.deposit} vs ${r.deposit}`);
    }
  }
  console.log(`\n===== VALIDATION vs ${VALIDATE} =====`);
  console.log(`overlap ${overlap} orders · price mismatches ${priceMismatch} · deposit mismatches ${depositMismatch}`);
  if (overlap === 0) {
    console.error(`ZERO OVERLAP — the id spaces do not match. STOP. Do not import this CSV.`);
    process.exit(1);
  }
  if (examples.length) {
    console.log(`examples (ABD_Ids only, no customer data):`);
    for (const e of examples) console.log(e);
    console.log(`NOTE: a mismatch can be legitimate — the webhook is NEWER than the export`);
    console.log(`(price renegotiated since). Investigate direction before concluding corruption.`);
  }
}

/* ---- write ---- */
const header = "order_id,email,order_created,price,deposit";
const body = rows.map((r) => [r.order_id, r.email, r.order_created, r.price, r.deposit].map(csvEscape).join(",")).join("\n");
writeFileSync(OUT, header + "\n" + body + "\n");
console.log(`\nWrote ${OUT} (${rows.length} rows). PII inside — keep it OUTSIDE the repo.`);
console.log(`Next: node scripts/import-orders.mjs "${OUT}"`);
console.log(`Then: node scripts/check-deposit-coverage.mjs`);
