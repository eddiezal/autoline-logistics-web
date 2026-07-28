/**
 * Mine the Route Price Checker demand data.
 *
 * Sources: route_price_checker_queries (every check: route, vehicle, prices
 * shown, status) + site_events (estimate_shown price anchors, locale).
 *
 * Answers: what routes are people checking, which vehicles, what prices did
 * we show, where did we FAIL to price (unmet demand), and how much of it
 * is Spanish-side.
 *
 * Usage: node scripts/mine-price-checker.mjs
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

// 3-digit ZIP prefix → state (coarse but reliable for lane grouping).
const ZIP3 = [
  [5, 5, "NY"], [6, 9, "PR"], [10, 27, "MA"], [28, 29, "RI"], [30, 38, "NH"], [39, 49, "ME"],
  [50, 59, "VT"], [60, 69, "CT"], [70, 89, "NJ"], [100, 149, "NY"], [150, 196, "PA"],
  [197, 199, "DE"], [200, 205, "DC"], [206, 219, "MD"], [220, 246, "VA"], [247, 268, "WV"],
  [270, 289, "NC"], [290, 299, "SC"], [300, 319, "GA"], [320, 349, "FL"], [350, 369, "AL"],
  [370, 385, "TN"], [386, 397, "MS"], [398, 399, "GA"], [400, 427, "KY"], [430, 459, "OH"],
  [460, 479, "IN"], [480, 499, "MI"], [500, 528, "IA"], [530, 549, "WI"], [550, 567, "MN"],
  [570, 577, "SD"], [580, 588, "ND"], [590, 599, "MT"], [600, 629, "IL"], [630, 658, "MO"],
  [660, 679, "KS"], [680, 693, "NE"], [700, 714, "LA"], [716, 729, "AR"], [730, 749, "OK"],
  [750, 799, "TX"], [800, 816, "CO"], [820, 831, "WY"], [832, 838, "ID"], [840, 847, "UT"],
  [850, 865, "AZ"], [870, 884, "NM"], [885, 885, "TX"], [889, 898, "NV"], [900, 961, "CA"],
  [962, 966, "AP"], [967, 968, "HI"], [970, 979, "OR"], [980, 994, "WA"], [995, 999, "AK"],
];
function zipState(zip) {
  const p = parseInt(String(zip ?? "").slice(0, 3), 10);
  if (!Number.isFinite(p)) return "??";
  for (const [lo, hi, st] of ZIP3) if (p >= lo && p <= hi) return st;
  return "??";
}

const snap = await db.collection("route_price_checker_queries").orderBy("createdAt", "asc").get();
console.log(`route_price_checker_queries: ${snap.size} total checks\n`);

const byStatus = {}, lanes = {}, vehicles = {}, failedLanes = {}, byDay = {};
const prices = [];
let firstTs = null, lastTs = null;

for (const d of snap.docs) {
  const q = d.data();
  const ts = q.createdAt?.toDate?.();
  if (ts) { firstTs = firstTs ?? ts; lastTs = ts; }
  const day = ts ? ts.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }) : "?";
  byDay[day] = (byDay[day] ?? 0) + 1;
  byStatus[q.status] = (byStatus[q.status] ?? 0) + 1;
  const lane = `${zipState(q.fromZip)} → ${zipState(q.toZip)}`;
  if (q.status === "ok") {
    lanes[lane] = (lanes[lane] ?? 0) + 1;
    vehicles[q.selectedVehicle] = (vehicles[q.selectedVehicle] ?? 0) + 1;
    const rec = q.prices?.[q.selectedVehicle]?.recommended;
    if (Number.isFinite(rec)) prices.push(rec);
  } else if (q.status === "unsupported_route" || q.status === "sd_error") {
    failedLanes[`${lane}  (${q.fromZip}→${q.toZip}, ${q.status})`] =
      (failedLanes[`${lane}  (${q.fromZip}→${q.toZip}, ${q.status})`] ?? 0) + 1;
  }
}

console.log(`Window: ${firstTs?.toISOString().slice(0, 10)} → ${lastTs?.toISOString().slice(0, 10)}`);
console.log("Status split:", byStatus, "\n");

const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

console.log("===== TOP 20 LANES CHECKED (state pairs, ok only) =====");
for (const [k, v] of top(lanes, 20)) console.log(`${String(v).padStart(5)}  ${k}`);

console.log("\n===== VEHICLE MIX =====");
for (const [k, v] of top(vehicles, 10)) console.log(`${String(v).padStart(5)}  ${k}`);

if (prices.length) {
  prices.sort((a, b) => a - b);
  const pct = (p) => prices[Math.floor(prices.length * p)];
  console.log("\n===== PRICES SHOWN (recommended, $) =====");
  console.log(`n=${prices.length}  p10=$${pct(0.1)}  median=$${pct(0.5)}  p90=$${pct(0.9)}`);
  const bands = { "<500": 0, "500-999": 0, "1000-1499": 0, "1500-1999": 0, "2000+": 0 };
  for (const p of prices) {
    if (p < 500) bands["<500"]++;
    else if (p < 1000) bands["500-999"]++;
    else if (p < 1500) bands["1000-1499"]++;
    else if (p < 2000) bands["1500-1999"]++;
    else bands["2000+"]++;
  }
  console.log("Bands:", bands);
}

console.log("\n===== TOP FAILED CHECKS (demand we couldn't price) =====");
for (const [k, v] of top(failedLanes, 15)) console.log(`${String(v).padStart(4)}  ${k}`);

console.log("\n===== LAST 14 DAYS (checks/day) =====");
for (const [k, v] of Object.entries(byDay).sort().slice(-14)) console.log(`${k}  ${v}`);

// ---- site_events: estimate anchors + locale + basic funnel ----
const ev = await db.collection("site_events").where("type", "==", "estimate_shown").get();
let es = 0; const anchors = []; const vids = new Set();
for (const d of ev.docs) {
  const e = d.data();
  if (e.locale === "es") es++;
  if (e.meta?.price) anchors.push(e.meta.price);
  if (e.vid) vids.add(e.vid);
}
console.log(`\n===== site_events: estimate_shown =====`);
console.log(`events=${ev.size}  unique visitors=${vids.size}  spanish=${es} (${ev.size ? (es / ev.size * 100).toFixed(0) : 0}%)`);
if (anchors.length) {
  anchors.sort((a, b) => a - b);
  console.log(`price anchors: median=$${anchors[Math.floor(anchors.length / 2)]}  min=$${anchors[0]}  max=$${anchors[anchors.length - 1]}`);
}
process.exit(0);
