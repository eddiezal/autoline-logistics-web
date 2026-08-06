/**
 * PRICE INTEGRITY ANALYSIS — quantify post-booking price changes ("bump ups")
 * from the ProABD webhook event history, with fairness controls.
 *
 * What it measures, per order entity:
 *   1. Price at booking (first order-stage event, or last price seen before it)
 *   2. Final observed price (latest event)
 *   3. Post-booking delta (final - at-booking) and WHEN it moved
 *   4. Who touched the record when the price moved (raw_item.UserName)
 *   5. Lead source (Referrer_Id: 503 = Taylor, 18493 = website ES, etc.)
 *   6. Web-lead join: site instant quote vs booked price (leads.proabdAbdId)
 *   7. Outcome (booked / canceled-lost by status-name heuristic)
 *
 * Fairness controls baked in:
 *   - Vehicle-change flag: if the vehicle fingerprint changed between booking
 *     and the final event, the delta is quarantined (legit scope change).
 *   - Days-to-bump: same-week bumps vs long-gap market drift reported apart.
 *   - Route + mileage printed for every flagged order so remote routes can be
 *     reviewed by hand (remoteness legitimately reprices).
 *   - Agents anonymized as Agent A/B/C in the summary; legend printed last.
 *
 * Output: console summary + price-integrity-flagged.csv (KEEP OUT OF THE REPO
 * — contains order ids and routes; save to the AutoExpress folder).
 *
 * Usage:  node scripts/price-integrity.mjs            (all history)
 *         node scripts/price-integrity.mjs --min-bump 50
 */
import { config as loadEnv } from "dotenv";
import { writeFileSync } from "node:fs";
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

const MIN_BUMP = (() => {
  const i = process.argv.indexOf("--min-bump");
  return i > -1 ? Number(process.argv[i + 1]) || 50 : 50;
})();

// ---------- helpers (candidate-path pickers, same vocabulary as shipment-sync) ----------
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
function pickStr(raw, paths, cap = 120) {
  for (const p of paths) {
    const v = dig(raw, p);
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, cap);
  }
  return null;
}
const PRICE_PATHS = ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price", "Total_Tariff", "Tariff"];
const DEPOSIT_PATHS = ["Transport.Deposit", "Deposit"];
const pt = (d) =>
  d ? d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "2-digit", year: "numeric" }) : "?";

/** Best-effort vehicle fingerprint so scope changes don't count as bumps. */
function vehicleFingerprint(raw) {
  const arrs = [];
  for (const key of ["Vehicles", "Vehicle"]) {
    const v = raw?.[key] ?? dig(raw, `Transport.${key}`);
    if (Array.isArray(v)) arrs.push(v);
    else if (v && typeof v === "object") arrs.push([v]);
  }
  if (!arrs.length) return null; // unknown shape — treated as "no change detected"
  const parts = [];
  for (const arr of arrs)
    for (const item of arr) {
      if (item && typeof item === "object") {
        const y = item.v_year ?? item.Year ?? item.year ?? "";
        const mk = item.v_make ?? item.Make ?? item.make ?? "";
        const md = item.v_model ?? item.Model ?? item.model ?? "";
        parts.push(`${y} ${mk} ${md}`.trim().toLowerCase());
      }
    }
  return parts.sort().join("|") || null;
}
const CANCELISH = /cancel|lost|dead|refund|dispute/i;

// ---------- 1. pull the full event history, oldest first, paged ----------
console.log("Pulling proabd_webhook_events (paged)...");
const events = [];
let last = null;
for (;;) {
  let q = db.collection("proabd_webhook_events").orderBy("received_at", "asc").limit(2000);
  if (last) q = q.startAfter(last);
  const snap = await q.get();
  if (snap.empty) break;
  for (const doc of snap.docs) {
    const d = doc.data();
    events.push({
      id: String(d.entity_id ?? "").trim(),
      type: String(d.entity_type ?? ""),
      at: d.received_at?.toDate?.() ?? null,
      raw: d.raw_item ?? {},
    });
  }
  last = snap.docs[snap.docs.length - 1];
  if (snap.size < 2000) break;
}
console.log(`  ${events.length} events.`);

// ---------- 2. per-entity price timelines ----------
const entities = new Map();
for (const ev of events) {
  if (!ev.id || !ev.at) continue;
  const e = entities.get(ev.id) ?? { timeline: [], firstOrderAt: null, lastRaw: null };
  const price = pickNum(ev.raw, PRICE_PATHS);
  const deposit = pickNum(ev.raw, DEPOSIT_PATHS);
  const user = pickStr(ev.raw, ["UserName"], 60);
  const status = pickStr(ev.raw, ["Child_Status", "Status"], 60);
  e.timeline.push({ at: ev.at, type: ev.type, price, deposit, user, status, vfp: vehicleFingerprint(ev.raw) });
  if (ev.type === "order" && !e.firstOrderAt) e.firstOrderAt = ev.at;
  e.lastRaw = ev.raw;
  entities.set(ev.id, e);
}

// ---------- 3. web-lead quotes for the quote-vs-booked join ----------
const leadQuotes = new Map(); // abdId -> site quote
const leadSnap = await db.collection("leads").get();
for (const doc of leadSnap.docs) {
  const d = doc.data();
  const abd = d.proabdAbdId != null ? String(d.proabdAbdId).trim() : "";
  const q = Number(d.estimate?.price);
  if (abd && Number.isFinite(q) && q > 0) leadQuotes.set(abd, q);
}
console.log(`  ${leadQuotes.size} web leads carry both an ABD id and a site quote.`);

// ---------- 4. analyze booked orders ----------
const rows = [];
const agents = new Map(); // user -> stats
const bySource = new Map(); // referrer -> stats
function bump(map, key, fn) {
  const cur = map.get(key) ?? { n: 0, bumped: 0, bumpSum: 0, deltas: [], quarantined: 0 };
  fn(cur);
  map.set(key, cur);
}
// v2 accumulators (second-opinion upgrades)
const byDayBucket = new Map();               // how soon after booking do bumps land
const crosstab = new Map();                  // PRIVATE agent × source bump counts
const feeSplit = { n: 0, priceSum: 0, feeSum: 0 }; // did the bump land in the broker fee or the carrier pay
const promiseRows = [];                      // web leads: final price vs displayed site quote
// one shared anonymizer so loop-time and report-time letters always match
const label = new Map();
const anon = (u) => { if (!label.has(u)) label.set(u, `Agent ${String.fromCharCode(65 + label.size)}`); return label.get(u); };

for (const [id, e] of entities) {
  if (!e.firstOrderAt) continue; // never booked — not in scope for bump analysis
  const tl = e.timeline;
  const atBooking =
    tl.filter((x) => x.price != null && x.at <= e.firstOrderAt).pop() ??
    tl.find((x) => x.price != null && x.type === "order");
  const final = [...tl].reverse().find((x) => x.price != null);
  // promise variance is measured even when the booking price never moved —
  // a stable-but-above-site-quote price is still a broken promise.
  if (final) {
    const sq = leadQuotes.get(id) ?? null;
    if (sq != null) {
      const cid = pickStr(e.lastRaw, ["Custom_Id"], 30) ?? id;
      const rt = `${pickStr(e.lastRaw, ["Transport.Origin.State", "Origin.State", "Origin_State"], 6) ?? "?"}→${
        pickStr(e.lastRaw, ["Transport.Destination.State", "Destination.State", "Destination_State"], 6) ?? "?"}`;
      const ref = pickStr(e.lastRaw, ["Referrer"], 40) ?? "unknown";
      const refId = pickStr(e.lastRaw, ["Referrer_Id"], 12) ?? "?";
      promiseRows.push({ customId: cid, route: rt, referrer: `${ref}(${refId})`, siteQuote: sq, finalPrice: final.price, promiseVariance: final.price - sq });
    }
  }
  if (!atBooking || !final || atBooking === final) continue;
  const delta = final.price - atBooking.price;
  const days = (final.at - e.firstOrderAt) / 86400000;

  // vehicle-change quarantine: compare fingerprints around booking vs final
  const vfpBook = tl.filter((x) => x.vfp && x.at <= e.firstOrderAt).pop()?.vfp ?? null;
  const vfpFinal = [...tl].reverse().find((x) => x.vfp)?.vfp ?? null;
  const vehicleChanged = vfpBook != null && vfpFinal != null && vfpBook !== vfpFinal;

  // who touched it when the price moved past the at-booking value
  const bumpEvent = tl.find((x) => x.at > e.firstOrderAt && x.price != null && x.price - atBooking.price >= MIN_BUMP);
  const referrer = pickStr(e.lastRaw, ["Referrer"], 40) ?? "unknown";
  const referrerId = pickStr(e.lastRaw, ["Referrer_Id"], 12) ?? "?";
  const route = `${pickStr(e.lastRaw, ["Transport.Origin.State", "Origin.State", "Origin_State"], 6) ?? "?"}→${
    pickStr(e.lastRaw, ["Transport.Destination.State", "Destination.State", "Destination_State"], 6) ?? "?"}`;
  const mileage = pickStr(e.lastRaw, ["Mileage"], 10);
  const customId = pickStr(e.lastRaw, ["Custom_Id"], 30) ?? id;
  const lastStatus = final.status ?? "";
  const outcome = CANCELISH.test(lastStatus) ? "canceled/lost" : "active/booked";
  const owner = [...tl].reverse().find((x) => x.user)?.user ?? "unknown";
  const toucher = bumpEvent?.user ?? owner;
  const siteQuote = leadQuotes.get(id) ?? null;

  // deposit (broker fee) split: how much of the price move landed in the fee
  const depAtBooking = tl.filter((x) => x.deposit != null && x.at <= e.firstOrderAt).pop()?.deposit ?? null;
  const depFinal = [...tl].reverse().find((x) => x.deposit != null)?.deposit ?? null;
  const depDelta = depAtBooking != null && depFinal != null ? depFinal - depAtBooking : null;

  // customer-promise variance (web leads only): final price vs the DISPLAYED site quote.
  // This — not the booking adjustment — is the brand-integrity measurement.
  const promiseVariance = siteQuote != null ? final.price - siteQuote : null;

  const isBump = delta >= MIN_BUMP && !vehicleChanged;
  const dayBucket = days <= 3 ? "0-3d" : days <= 7 ? "4-7d" : days <= 14 ? "8-14d" : "15d+";
  bump(agents, toucher, (s) => {
    s.n++;
    if (vehicleChanged && delta >= MIN_BUMP) s.quarantined++;
    if (isBump) { s.bumped++; s.bumpSum += delta; s.deltas.push(delta); }
  });
  bump(bySource, `${referrer} (${referrerId})`, (s) => {
    s.n++;
    if (isBump) { s.bumped++; s.bumpSum += delta; s.deltas.push(delta); }
  });
  if (isBump) {
    bump(byDayBucket, dayBucket, (s) => { s.bumped++; s.deltas.push(delta); });
    if (depDelta != null) { feeSplit.n++; feeSplit.priceSum += delta; feeSplit.feeSum += depDelta; }
    bump(crosstab, `${anon(toucher)} × ${referrer}(${referrerId})`, (s) => { s.bumped++; });
  }

  if (Math.abs(delta) >= MIN_BUMP || (siteQuote && Math.abs(final.price - siteQuote) >= MIN_BUMP))
    rows.push({ customId, route, mileage, referrer: `${referrer}(${referrerId})`, booked: pt(e.firstOrderAt),
      priceAtBooking: atBooking.price, finalPrice: final.price, delta, depositDelta: depDelta,
      promiseVariance, daysToFinal: days.toFixed(1),
      vehicleChanged, toucher, outcome, siteQuote });
}

// ---------- 5. report ----------
const med = (arr) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

console.log(`\n===== POST-BOOKING PRICE CHANGES (bump threshold $${MIN_BUMP}, vehicle-change quarantined) =====`);
console.log("Per agent (anonymized; person shown is who touched the record at the bump):");
for (const [u, s] of [...agents].sort((a, b) => b[1].bumped - a[1].bumped))
  console.log(
    `  ${anon(u).padEnd(9)} orders:${String(s.n).padStart(4)}  bumped:${String(s.bumped).padStart(3)} (${((s.bumped / Math.max(1, s.n)) * 100).toFixed(0)}%)  ` +
    `median bump:$${med(s.deltas)}  total:$${s.bumpSum.toFixed(0)}  vehicle-change quarantined:${s.quarantined}`,
  );
console.log("\nBy lead source:");
for (const [src, s] of [...bySource].sort((a, b) => b[1].n - a[1].n))
  console.log(`  ${src.padEnd(30)} orders:${String(s.n).padStart(4)}  bumped:${s.bumped} (${((s.bumped / Math.max(1, s.n)) * 100).toFixed(0)}%)  median:$${med(s.deltas)}`);

const bumped = rows.filter((r) => r.delta >= MIN_BUMP && !r.vehicleChanged);
const cancelAfterBump = bumped.filter((r) => r.outcome === "canceled/lost").length;
console.log(`\nFlagged orders: ${bumped.length} bumps ≥ $${MIN_BUMP} (clean) · ${rows.filter((r) => r.vehicleChanged).length} quarantined for vehicle change`);
console.log(`Canceled/lost AFTER a bump: ${cancelAfterBump} of ${bumped.length} (status-name heuristic — verify against canonical map)`);
const quick = bumped.filter((r) => Number(r.daysToFinal) <= 3).length;
console.log(`Bumps within 3 days of booking (least defensible as market drift): ${quick} of ${bumped.length}`);

// ---- v2: customer-promise variance (web leads only — the brand-integrity number) ----
console.log(`\n===== CUSTOMER-PROMISE VARIANCE (web leads: final price vs the quote the SITE showed) =====`);
if (!promiseRows.length) console.log("  No booked web leads with a joined site quote yet.");
else {
  const pv = promiseRows.map((r) => r.promiseVariance);
  const over = promiseRows.filter((r) => r.promiseVariance >= MIN_BUMP);
  console.log(`  n:${promiseRows.length}  median variance:$${med(pv)}  over-promise ≥$${MIN_BUMP}: ${over.length} of ${promiseRows.length}`);
  for (const r of promiseRows.sort((a, b) => b.promiseVariance - a.promiseVariance))
    console.log(`    ${r.customId.padEnd(20)} ${r.route.padEnd(8)} site:$${String(r.siteQuote).padEnd(6)} final:$${String(r.finalPrice).padEnd(6)} variance:${r.promiseVariance >= 0 ? "+" : ""}$${r.promiseVariance}  ${r.referrer}`);
  console.log("  NOTE: this, not the booking adjustment, is what a customer would call a bait-and-switch.");
}

// ---- v2: where does the bump money land — broker fee (deposit) vs carrier pay ----
console.log(`\n===== BUMP MONEY SPLIT (orders where deposit was visible at booking AND final) =====`);
if (!feeSplit.n) console.log("  No bumped orders carried a readable deposit at both ends — cannot split.");
else {
  const carrier = feeSplit.priceSum - feeSplit.feeSum;
  console.log(`  n:${feeSplit.n}  total bump:$${feeSplit.priceSum.toFixed(0)}  into broker fee:$${feeSplit.feeSum.toFixed(0)}  into carrier pay:$${carrier.toFixed(0)}`);
  console.log("  Fee-side increases are revenue-motivated; carrier-side increases are cost pass-throughs (market rate moved).");
}

// ---- v2: how soon after booking (timing profile) ----
console.log(`\n===== BUMP TIMING (days from booking to final price) =====`);
for (const b of ["0-3d", "4-7d", "8-14d", "15d+"]) {
  const s = byDayBucket.get(b);
  console.log(`  ${b.padEnd(6)} bumps:${String(s?.bumped ?? 0).padStart(3)}  median:$${med(s?.deltas ?? [])}`);
}

console.log("\n===== AGENT × SOURCE CROSSTAB (PRIVATE — pattern check, never Ben-facing) =====");
for (const [k, s] of [...crosstab].sort((a, b) => b[1].bumped - a[1].bumped))
  console.log(`  ${k.padEnd(45)} bumps:${s.bumped}`);

console.log("\nAgent legend (PRIVATE — do not include in anything Ben-facing until you choose to):");
for (const [u, a] of label) console.log(`  ${a} = ${u}`);

const csvRows = rows.map((r) => ({ ...r, toucher: anon(r.toucher) }));
const hdr = Object.keys(csvRows[0] ?? { none: 1 });
writeFileSync(
  "price-integrity-flagged.csv",
  [hdr.join(","), ...csvRows.map((r) => hdr.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n"),
);
console.log(`\nWrote price-integrity-flagged.csv (${csvRows.length} rows) — move it to the AutoExpress folder, keep it out of the repo.`);
console.log("Read this before drawing conclusions: quarantine ≠ innocent, flags ≠ guilty. Review remote routes and long gaps by hand.");
