/**
 * Channel mix pull for the quarterly deck's "new customer base" slide.
 *
 * Part 1 — website leads since the ads relaunch (Jul 17), classified by
 *          acquisition channel from lead.attribution.
 * Part 2 — whole-CRM source mix from ProABD webhook events (since Jul 8):
 *          unique records by Referrer_Id, and how many reached ORDER stage
 *          (directional close-rate by source; small sample, label it so).
 *
 * Usage: node scripts/channel-mix.mjs
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

const RELAUNCH = new Date("2026-07-17T00:00:00-07:00");

// ---------- Part 1: website lead channel mix ----------
const leadsSnap = await db.collection("leads").orderBy("createdAt", "desc").limit(400).get();
const mix = {};
const bump = (k) => (mix[k] = (mix[k] ?? 0) + 1);
let total = 0, esCount = 0;

for (const d of leadsSnap.docs) {
  const l = d.data();
  const created = l.createdAt?.toDate?.();
  if (!created || created < RELAUNCH) continue;
  const ref = (l.leadRef ?? d.id).toString();
  const a = l.attribution ?? {};
  total++;
  if (a.locale === "es") esCount++;

  if (ref.startsWith("CALL-")) { bump("phone (tracked call)"); continue; }
  const src = (a.utmSource ?? "").toLowerCase();
  const med = (a.utmMedium ?? "").toLowerCase();
  const referrer = (a.referrer ?? "").toLowerCase();
  if (a.gclid || (src === "google" && med === "cpc")) bump("paid search (Google Ads)");
  else if (src) bump(`other tagged (${src})`);
  else if (referrer.includes("google") || referrer.includes("bing.") || referrer.includes("duckduckgo") || referrer.includes("yahoo")) bump("organic search (brand)");
  else if (referrer.includes("chatgpt") || referrer.includes("openai") || referrer.includes("perplexity")) bump("AI referral");
  else if (referrer) bump(`referral (${referrer.replace(/https?:\/\//, "").split("/")[0]})`);
  else bump("direct (typed / bookmark / text link)");
}

console.log(`===== Part 1: website leads since Jul 17 (n=${total}) =====`);
for (const [k, v] of Object.entries(mix).sort((a, b) => b[1] - a[1])) {
  console.log(`${String(v).padStart(4)}  ${(v / total * 100).toFixed(0).padStart(3)}%  ${k}`);
}
console.log(`Spanish-locale share: ${esCount} (${total ? (esCount / total * 100).toFixed(0) : 0}%)`);

// ---------- Part 2: whole-CRM source mix from ProABD events ----------
const evSnap = await db.collection("proabd_webhook_events").get();
const byAbd = new Map();
for (const d of evSnap.docs) {
  const raw = d.get("raw_item") ?? {};
  const abd = d.get("entity_id");
  if (!abd) continue;
  const rec = byAbd.get(abd) ?? { referrer: null, refId: null, reachedOrder: false, isLeadStage: false };
  const refName = typeof raw.Referrer === "string" && raw.Referrer ? raw.Referrer : rec.referrer;
  const refId = raw.Referrer_Id != null ? String(raw.Referrer_Id) : rec.refId;
  const statusId = String(raw.Status_Id ?? "");
  const orderStage = d.get("entity_type") === "order" || (Number(statusId) >= 14 && Number(statusId) <= 24);
  byAbd.set(abd, {
    referrer: refName, refId,
    reachedOrder: rec.reachedOrder || orderStage,
    isLeadStage: true,
  });
}
const bySource = {};
for (const rec of byAbd.values()) {
  const key = rec.referrer ?? `id:${rec.refId ?? "unknown"}`;
  const s = (bySource[key] = bySource[key] ?? { records: 0, orders: 0 });
  s.records++;
  if (rec.reachedOrder) s.orders++;
}
console.log(`\n===== Part 2: CRM records by source (events since Jul 8, n=${byAbd.size} unique records) =====`);
console.log("records  orders  order%  source");
for (const [k, v] of Object.entries(bySource).sort((a, b) => b[1].records - a[1].records)) {
  console.log(`${String(v.records).padStart(7)}  ${String(v.orders).padStart(6)}  ${v.records ? (v.orders / v.records * 100).toFixed(0).padStart(5) : "    -"}%  ${k}`);
}
console.log("\nNote: Part 2 covers only records with webhook activity since Jul 8 (plus the Jul 22-27 gap), so shares are directional, not lifetime.");
process.exit(0);
