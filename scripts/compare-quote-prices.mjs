/**
 * Website quote vs agent price — same lead, both numbers.
 *
 * Joins leads (our SD-derived quote incl. 22.5% markup, estimate.price)
 * to ProABD webhook events (agent's Transport.Price + Carrier_Pay) via
 * ABD_Id. Uses the latest priced event per record, quote OR order stage,
 * so unbooked quotes count too.
 *
 * Usage: node scripts/compare-quote-prices.mjs
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

const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

// 1) Website leads that reached ProABD with a real quote from us.
const leadsSnap = await db.collection("leads").get();
const byAbd = new Map();
for (const d of leadsSnap.docs) {
  const l = d.data();
  const abdId = l.proabdAbdId;
  const ourPrice = num(l.estimate?.price);
  if (!abdId || ourPrice <= 0) continue;
  byAbd.set(String(abdId), {
    ref: l.leadRef ?? d.id,
    created: l.createdAt?.toDate?.()?.toISOString().slice(0, 10) ?? "",
    tier: l.tier ?? "",
    route: `${l.origin?.state ?? "?"}→${l.destination?.state ?? "?"}`,
    ourPrice,
    agentPrice: 0,
    carrierPay: 0,
    stage: "",
    statusId: "",
    receivedAt: 0,
  });
}

// 2) Latest priced ProABD event per record.
const evSnap = await db.collection("proabd_webhook_events").get();
for (const d of evSnap.docs) {
  const abdId = d.get("entity_id");
  if (!abdId || !byAbd.has(abdId)) continue;
  const rec = byAbd.get(abdId);
  const raw = d.get("raw_item") ?? {};
  const price = num(raw?.Transport?.Price);
  if (price <= 0) continue;
  const t = d.get("received_at")?.toDate?.()?.getTime() ?? 0;
  if (t < rec.receivedAt) continue;
  rec.receivedAt = t;
  rec.agentPrice = price;
  rec.carrierPay = num(raw?.Transport?.Carrier_Pay);
  rec.stage = d.get("entity_type") ?? "";
  rec.statusId = String(raw?.Status_Id ?? "");
}

// 3) Report.
const rows = [...byAbd.values()]
  .filter((r) => r.agentPrice > 0)
  .sort((a, b) => (a.created < b.created ? 1 : -1));

console.log(
  "ref               date        route    tier       ours      agent      diff     diff%   carrierPay  stage",
);
console.log("─".repeat(112));
const diffs = [];
for (const r of rows) {
  const diff = r.agentPrice - r.ourPrice;
  const pct = (diff / r.ourPrice) * 100;
  diffs.push(pct);
  console.log(
    `${r.ref.padEnd(18)}${r.created.padEnd(12)}${r.route.padEnd(9)}${r.tier.padEnd(10)}` +
    `$${r.ourPrice.toFixed(0).padStart(6)}  $${r.agentPrice.toFixed(0).padStart(6)}  ` +
    `${(diff >= 0 ? "+" : "-")}$${Math.abs(diff).toFixed(0).padStart(5)}  ${pct >= 0 ? "+" : ""}${pct.toFixed(1).padStart(6)}%  ` +
    `$${r.carrierPay.toFixed(0).padStart(7)}   ${r.stage}${r.statusId ? ":" + r.statusId : ""}`,
  );
}

if (diffs.length) {
  const sorted = [...diffs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const higher = diffs.filter((x) => x > 2).length;
  const lower = diffs.filter((x) => x < -2).length;
  const close = diffs.length - higher - lower;
  console.log("\n===== summary =====");
  console.log(`compared:        ${diffs.length} website leads with both prices`);
  console.log(`agent higher:    ${higher}  (agent quoted >2% above our number)`);
  console.log(`within ±2%:      ${close}`);
  console.log(`agent lower:     ${lower}`);
  console.log(`median diff:     ${median >= 0 ? "+" : ""}${median.toFixed(1)}%`);
  console.log(`mean diff:       ${mean >= 0 ? "+" : ""}${mean.toFixed(1)}%`);
} else {
  console.log("\nNo overlapping records with prices on both sides yet.");
}
console.log(
  "\nNote: 'ours' = website quote incl. 22.5% markup over SD carrier estimate.",
);
console.log(
  "'carrierPay' = what the agent set as carrier cost (agent margin = agent - carrierPay).",
);
process.exit(0);
