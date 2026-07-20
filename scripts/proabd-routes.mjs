/**
 * Top origin->destination lanes from website quote-form leads.
 *
 * Purpose: see what routes online demand actually asks for, so we prioritize
 * which S3 corridors to build/weight in Google Ads with data instead of guesses.
 *
 * Data source: Firestore `leads` collection (every website quote submission).
 * NOTE: this is the ONLINE funnel only -- it does NOT include phone leads,
 * repeat/broker business, or anything not captured by the site form. For the
 * complete cross-channel history (all of Ben's actual loads), pull a ProABD
 * dashboard export. But for AD strategy this is directly on-point: it's the
 * exact demand our ads -> website form will capture.
 *
 * State is derived server-side from ZIP (USPS prefix), so lanes are state-level.
 *
 * Usage:
 *   cd autoline-logistics-web
 *   node scripts/proabd-routes.mjs           # all-time
 *   node scripts/proabd-routes.mjs 180       # last 180 days only
 *
 * Requires FIREBASE_PROJECT_ID (+ FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY,
 * or gcloud ADC) in .env.local -- same setup as proabd-hourly-volume.mjs.
 */

import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error("Missing FIREBASE_PROJECT_ID in .env.local");
  process.exit(1);
}

if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  } else {
    initializeApp({ credential: applicationDefault(), projectId });
  }
}

const db = getFirestore();

const days = Number(process.argv[2]) || null;
let query = db.collection("leads");
if (days) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  query = query.where("createdAt", ">=", since);
}
const snap = await query.get();

const total = snap.size;
if (!total) {
  console.log("No leads found" + (days ? ` in the last ${days} days.` : "."));
  process.exit(0);
}

const laneCount = new Map(); // "CA->FL" -> count
const laneValue = new Map(); // "CA->FL" -> sum of estimate.price
const originCount = new Map();
const destCount = new Map();
const channelCount = new Map();
let caOut = 0, caIn = 0, caBoth = 0, caNeither = 0, unknownGeo = 0;
let minTs = Infinity, maxTs = -Infinity;
let priced = 0, priceSum = 0;

const S = (v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : "??");
const inc = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

for (const doc of snap.docs) {
  const d = doc.data();
  const o = S(d.origin?.state);
  const dst = S(d.destination?.state);
  const lane = `${o}->${dst}`;
  inc(laneCount, lane);
  inc(originCount, o);
  inc(destCount, dst);

  const price = Number(d.estimate?.price);
  if (Number.isFinite(price) && price > 0) {
    inc(laneValue, lane, price);
    priced++;
    priceSum += price;
  }

  const src =
    typeof d.attribution?.utmSource === "string" && d.attribution.utmSource.trim()
      ? d.attribution.utmSource.trim().toLowerCase()
      : "organic/direct";
  inc(channelCount, src);

  const oCA = o === "CA", dCA = dst === "CA";
  if (o === "??" || dst === "??") unknownGeo++;
  else if (oCA && dCA) caBoth++;
  else if (oCA) caOut++;
  else if (dCA) caIn++;
  else caNeither++;

  const ts =
    d.createdAt?.toDate?.()?.getTime?.() ??
    (d.submittedAt ? Date.parse(d.submittedAt) : NaN);
  if (Number.isFinite(ts)) {
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
  }
}

const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;
const fmtDate = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : "?");
const topN = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

console.log("");
console.log(`Website leads analyzed: ${total}`);
console.log(
  `Date range: ${fmtDate(minTs)} -> ${fmtDate(maxTs)}${days ? ` (last ${days} days)` : " (all-time)"}`,
);
console.log(`Leads with a price estimate: ${priced} (avg $${priced ? Math.round(priceSum / priced) : 0})`);
console.log("");

console.log("== TOP LANES (origin state -> destination state) ==");
console.log("Lane".padEnd(12), "Leads".padStart(6), "Share".padStart(8), "AvgQuote".padStart(10));
for (const [lane, c] of topN(laneCount, 20)) {
  const v = laneValue.get(lane);
  const avg = v ? `$${Math.round(v / c)}` : "-";
  console.log(lane.padEnd(12), String(c).padStart(6), pct(c).padStart(8), avg.padStart(10));
}
console.log("");

console.log("== CA DIRECTIONALITY (is Ben's LA fleet on the lane?) ==");
console.log(`CA -> out of state (outbound, self-serve):   ${caOut} (${pct(caOut)})`);
console.log(`into CA <- other state (inbound / backhaul): ${caIn} (${pct(caIn)})`);
console.log(`CA -> CA (intrastate):                       ${caBoth} (${pct(caBoth)})`);
console.log(`neither end in CA (pure broker):             ${caNeither} (${pct(caNeither)})`);
if (unknownGeo) console.log(`unknown geo (missing state):                 ${unknownGeo}`);
console.log("");

console.log("== TOP ORIGIN STATES ==");
for (const [s, c] of topN(originCount, 10)) console.log(`  ${s.padEnd(4)} ${String(c).padStart(5)}  ${pct(c)}`);
console.log("");
console.log("== TOP DESTINATION STATES ==");
for (const [s, c] of topN(destCount, 10)) console.log(`  ${s.padEnd(4)} ${String(c).padStart(5)}  ${pct(c)}`);
console.log("");
console.log("== LEAD SOURCE (utm_source) ==");
for (const [s, c] of topN(channelCount, 10)) console.log(`  ${s.padEnd(18)} ${String(c).padStart(5)}  ${pct(c)}`);
console.log("");
console.log("Reminder: WEBSITE funnel only. For all channels incl. phone +");
console.log("Ben's actual booked loads, pull a ProABD dashboard export.");

process.exit(0);
