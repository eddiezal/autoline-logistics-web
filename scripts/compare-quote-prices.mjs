/**
 * Website quote vs agent price — same lead, both numbers, three moments,
 * and (for booked orders) the FINAL ECONOMICS.
 *
 * Joins leads (our SD-derived quote incl. markup, estimate.price) to ProABD
 * webhook events (agent's price + carrier pay + deposit) via ABD_Id.
 *
 * 2026-08-10 (evening) upgrades:
 *  - Tracks the FIRST priced event separately from the LATEST. "Ours vs
 *    agent FIRST quote" is the price-promise metric; "first vs latest" is
 *    post-quote drift (bump territory — price-integrity.mjs studies that).
 *  - Excludes internal test leads.
 *  - NEW (same evening): FINAL ECONOMICS section for records that reached the
 *    order stage — final price, carrier pay, deposit (fee), and the "room
 *    check": would the SITE quote have covered the actual carrier cost
 *    with a healthy fee intact? This is the proof-format for the agent
 *    education: their quote vs our quote vs what the carrier really cost.
 *
 * Context: agents receive the site's quoted price by email since 8/10 PM.
 * Leads before that date are the baseline; leads after measure the
 * stop-gap. Date column makes the before/after eyeball-able.
 *
 * Usage: node scripts/compare-quote-prices.mjs [--fee-floor 150]
 */
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

/** Minimum fee considered "healthy" for the room check. */
const FEE_FLOOR = (() => {
  const i = process.argv.indexOf("--fee-floor");
  return i > -1 ? Number(process.argv[i + 1]) || 150 : 150;
})();

// Candidate-path pickers — same vocabulary as price-integrity.mjs, so the
// two scripts can never disagree about where a price lives.
function dig(obj, path) {
  let cur = obj;
  for (const k of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[k];
  }
  return cur;
}
function pickNum(raw, paths) {
  for (const p of paths) {
    const v = dig(raw, p);
    const n = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
const PRICE_PATHS = ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price", "Total_Tariff", "Tariff"];
const DEPOSIT_PATHS = ["Transport.Deposit", "Deposit"];
const CARRIER_PATHS = ["Transport.Carrier_Pay", "Carrier_Pay"];

const TEST_RE = /\btest(ing)?\b|\bfake\b/i;

// 1) Website leads that reached ProABD with a real quote from us.
const leadsSnap = await db.collection("leads").get();
const byAbd = new Map();
let testsSkipped = 0;
for (const d of leadsSnap.docs) {
  const l = d.data();
  const abdId = l.proabdAbdId;
  const ourPrice = Number(l.estimate?.price) || 0;
  if (!abdId || ourPrice <= 0) continue;
  const c = l.contact ?? {};
  if (TEST_RE.test([c.firstName, c.lastName, c.email, c.notes].filter(Boolean).join(" "))) {
    testsSkipped++;
    continue;
  }
  byAbd.set(String(abdId), {
    ref: l.leadRef ?? d.id,
    created: l.createdAt?.toDate?.()?.toISOString().slice(0, 10) ?? "",
    tier: l.tier ?? "",
    route: `${l.origin?.state ?? "?"}→${l.destination?.state ?? "?"}`,
    ourPrice,
    firstPrice: 0,
    firstAt: Infinity,
    lastPrice: 0,
    lastAt: 0,
    carrierPay: 0,
    deposit: 0,
    everOrder: false,
    stage: "",
    statusId: "",
  });
}

// 2) FIRST and LATEST priced ProABD event per record (+ latest deposit/carrier).
const evSnap = await db.collection("proabd_webhook_events").get();
for (const d of evSnap.docs) {
  const abdId = d.get("entity_id");
  if (!abdId || !byAbd.has(abdId)) continue;
  const rec = byAbd.get(abdId);
  const raw = d.get("raw_item") ?? {};
  if ((d.get("entity_type") ?? "") === "order") rec.everOrder = true;
  const price = pickNum(raw, PRICE_PATHS);
  if (price == null) continue;
  const t = d.get("received_at")?.toDate?.()?.getTime() ?? 0;
  if (t < rec.firstAt) {
    rec.firstAt = t;
    rec.firstPrice = price;
  }
  if (t >= rec.lastAt) {
    rec.lastAt = t;
    rec.lastPrice = price;
    rec.carrierPay = pickNum(raw, CARRIER_PATHS) ?? 0;
    rec.deposit = pickNum(raw, DEPOSIT_PATHS) ?? 0;
    rec.stage = d.get("entity_type") ?? "";
    rec.statusId = String(raw?.Status_Id ?? "");
  }
}

// 3) Report — ours vs agent's FIRST quote; drift column shows first→latest.
const rows = [...byAbd.values()]
  .filter((r) => r.firstPrice > 0)
  .sort((a, b) => (a.created < b.created ? 1 : -1));

console.log(
  "ref               date        route    tier       ours     agent1st     diff     diff%    latest    drift   stage",
);
console.log("─".repeat(118));
const diffs = [];
let drifted = 0;
for (const r of rows) {
  const diff = r.firstPrice - r.ourPrice;
  const pct = (diff / r.ourPrice) * 100;
  diffs.push(pct);
  const drift = r.lastPrice - r.firstPrice;
  if (Math.abs(drift) >= 50) drifted++;
  console.log(
    `${r.ref.padEnd(18)}${r.created.padEnd(12)}${r.route.padEnd(9)}${r.tier.padEnd(10)}` +
    `$${r.ourPrice.toFixed(0).padStart(6)}  $${r.firstPrice.toFixed(0).padStart(7)}  ` +
    `${diff >= 0 ? "+" : "-"}$${Math.abs(diff).toFixed(0).padStart(5)}  ${pct >= 0 ? "+" : ""}${pct.toFixed(1).padStart(6)}%  ` +
    `$${r.lastPrice.toFixed(0).padStart(6)}  ${drift === 0 ? "     —" : `${drift > 0 ? "+" : "-"}$${Math.abs(drift).toFixed(0).padStart(4)}`}   ` +
    `${r.stage}${r.statusId ? ":" + r.statusId : ""}`,
  );
}

// Conventional median (averages the two middle values on even n).
// 8/10 lesson: the earlier floor-index convention overstated "fee parity"
// on the n=6 order table ($245 vs the true $207.50) — an external review
// caught it. Discrete-percentile shortcuts are banned in this script.
const median_ = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

if (diffs.length) {
  const median = median_(diffs);
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const higher = diffs.filter((x) => x > 2).length;
  const lower = diffs.filter((x) => x < -2).length;
  const close = diffs.length - higher - lower;
  console.log("\n===== ours vs agent FIRST quote (price-promise metric) =====");
  console.log(`compared:        ${diffs.length} website leads with both prices (${testsSkipped} internal tests excluded)`);
  console.log(`agent higher:    ${higher}  (first quote >2% above the number the customer saw)`);
  console.log(`within ±2%:      ${close}`);
  console.log(`agent lower:     ${lower}`);
  console.log(`median diff:     ${median >= 0 ? "+" : ""}${median.toFixed(1)}%`);
  console.log(`mean diff:       ${mean >= 0 ? "+" : ""}${mean.toFixed(1)}%`);
  console.log(`drifted ≥$50 after first quote: ${drifted} (post-quote movement — bump analysis lives in price-integrity.mjs)`);
} else {
  console.log("\nNo overlapping records with prices on both sides yet.");
}

// 4) FINAL ECONOMICS — booked web orders only. The room check: would the
//    SITE quote have covered the actual carrier cost with FEE_FLOOR intact?
const orders = rows.filter((r) => r.everOrder && r.lastPrice > 0);
if (orders.length) {
  console.log(`\n===== FINAL ECONOMICS — web leads that reached ORDER stage (n=${orders.length}) =====`);
  console.log(
    "ref               date        ours     final   carrier   deposit   feeActual   feeAtSitePrice   room?",
  );
  console.log("─".repeat(112));
  let roomYes = 0, roomNo = 0, roomUnknown = 0, feeLeftOnTable = 0;
  let promiseBreaks = 0; // final customer price materially ABOVE the displayed site price
  const feeActuals = [], feeAtSite = [];
  for (const r of orders) {
    if (r.lastPrice > r.ourPrice + 50) promiseBreaks++;
    const feeActual = r.carrierPay > 0 ? r.lastPrice - r.carrierPay : null;
    const feeIfSite = r.carrierPay > 0 ? r.ourPrice - r.carrierPay : null;
    let room = "?";
    if (r.carrierPay > 0) {
      if (r.ourPrice >= r.carrierPay + FEE_FLOOR) { room = "YES"; roomYes++; }
      else { room = "NO"; roomNo++; }
      feeActuals.push(feeActual);
      feeAtSite.push(feeIfSite);
      if (r.ourPrice > r.lastPrice) feeLeftOnTable += r.ourPrice - r.lastPrice;
    } else roomUnknown++;
    console.log(
      `${r.ref.padEnd(18)}${r.created.padEnd(12)}$${r.ourPrice.toFixed(0).padStart(6)}  $${r.lastPrice.toFixed(0).padStart(6)}  ` +
      `$${r.carrierPay.toFixed(0).padStart(6)}  $${r.deposit.toFixed(0).padStart(6)}   ` +
      `${feeActual == null ? "      ?" : "$" + feeActual.toFixed(0).padStart(6)}     ` +
      `${feeIfSite == null ? "      ?" : "$" + feeIfSite.toFixed(0).padStart(6)}        ${room}`,
    );
  }
  console.log("\nroom check (site quote ≥ carrier pay + $" + FEE_FLOOR + " fee):");
  console.log(`  YES ${roomYes} · NO ${roomNo} · carrier pay unknown ${roomUnknown}`);
  console.log(`  site-to-final PROMISE BREAKS (final > displayed price + $50): ${promiseBreaks}`);
  if (feeActuals.length) {
    const sumA = feeActuals.reduce((a, b) => a + b, 0);
    const sumS = feeAtSite.reduce((a, b) => a + b, 0);
    const target = FEE_FLOOR * feeActuals.length;
    console.log("\nportfolio math (totals beat medians at small n):");
    console.log(`  fee ACTUAL total:            $${sumA.toFixed(0)}  (median $${median_(feeActuals).toFixed(0)})`);
    console.log(`  fee AT SITE PRICE total:     $${sumS.toFixed(0)}  (median $${median_(feeAtSite).toFixed(0)})`);
    console.log(`  cost of holding site price:  $${(sumA - sumS).toFixed(0)} across ${feeActuals.length} orders (~$${((sumA - sumS) / feeActuals.length).toFixed(0)}/order)`);
    console.log(`  site-price fee vs $${FEE_FLOOR}/order target: ${sumS >= target ? "+" : "-"}$${Math.abs(sumS - target).toFixed(0)} (${sumS >= target ? "surplus funds the tail cases" : "UNDER target — reserve too thin"})`);
    console.log(`  revenue conceded on booked orders (ours − final, where positive): $${feeLeftOnTable.toFixed(0)} (counterfactual — assumes same orders close at site price)`);
  }
  console.log(
    "\nReading: portfolio insurance framing — holding the displayed price costs the actual-vs-site",
  );
  console.log(
    "fee delta and buys zero promise breaks; strong orders finance the tail. NOT free compliance.",
  );
  console.log("Deposit = collected broker fee per CRM (proxy); feeActual = final − carrier pay. Fee ≠ profit (contribution comes later).");
} else {
  console.log("\nNo web leads at order stage with prices yet — final-economics table will populate as bookings land.");
}
console.log("\nNote: 'ours' = website quote incl. markup over SD carrier estimate.");
console.log("'agent1st' = first priced ProABD event; 'latest' = most recent. Leads after 8/10 PM had the site quote emailed to agents.");
process.exit(0);
