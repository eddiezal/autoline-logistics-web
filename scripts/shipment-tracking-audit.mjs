/**
 * Shipment tracking audit: how much do we actually know about a car after pickup?
 *
 * Reads the `shipments` collection (portal feed, built from ProABD webhook events)
 * and `proabd_webhook_events`, and answers, per shipment and on average:
 *   - did the status ever reach In Transit / Delivered (i.e. did an agent flip it)?
 *   - how long after booking did the In Transit flip land?
 *   - how many status transitions did we observe per order?
 *   - do we hold anything beyond status: SD order link, VIN, driver, carrier,
 *     location, ETA, photos?
 *   - how stale are still-open orders (booked > N days ago, never moved)?
 *
 * Read only. Usage: node scripts/shipment-tracking-audit.mjs [--days 90] [--stale 14]
 * Requires .env.local with FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 * (same as scripts/inspect-shipments.mjs).
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

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? Number(process.argv[i + 1]) : d; };
const DAYS = arg("--days", 90);
const STALE = arg("--stale", 14);
const since = new Date(Date.now() - DAYS * 864e5);
const ms = (a, b) => (new Date(b) - new Date(a));
const hrs = (x) => (x / 36e5);
const median = (xs) => { const a = [...xs].sort((p, q) => p - q); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null; };
const pct = (n, d) => d ? `${((100 * n) / d).toFixed(0)}%` : "n/a";
const fmtH = (h) => h == null ? "n/a" : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`;

// ── shipments ─────────────────────────────────────────────────────────
const snap = await db.collection("shipments").get();
const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  .filter((s) => !/^ALL-TEST/.test(s.id) && s.customer?.email !== "eddiezal28@gmail.com");
const recent = all.filter((s) => s.bookedAt && new Date(s.bookedAt) >= since);
const pool = recent.length ? recent : all;
const label = recent.length ? `booked in the last ${DAYS} days` : "all time (no bookedAt in window)";

const byStatus = {};
for (const s of pool) byStatus[s.status ?? "?"] = (byStatus[s.status ?? "?"] ?? 0) + 1;

const reachedTransit = pool.filter((s) => ["inTransit", "delivered", "completed"].includes(s.status));
const reachedDelivered = pool.filter((s) => ["delivered", "completed"].includes(s.status));
const withPickedUp = pool.filter((s) => (s.milestones ?? []).some((m) => m.type === "pickedUp"));
const withDelivered = pool.filter((s) => (s.milestones ?? []).some((m) => m.type === "delivered"));

const bookToPickup = pool.map((s) => {
  const p = (s.milestones ?? []).find((m) => m.type === "pickedUp");
  return s.bookedAt && p ? hrs(ms(s.bookedAt, p.at)) : null;
}).filter((x) => x != null && x >= 0);
const pickupToDelivered = pool.map((s) => {
  const p = (s.milestones ?? []).find((m) => m.type === "pickedUp");
  const d = (s.milestones ?? []).find((m) => m.type === "delivered");
  return p && d ? hrs(ms(p.at, d.at)) : null;
}).filter((x) => x != null && x >= 0);

// Beyond-status data: anything the portal could show that isn't a ProABD status flip.
const has = (k) => pool.filter((s) => {
  const v = s[k];
  return v != null && !(Array.isArray(v) && v.length === 0) && !(typeof v === "object" && Object.keys(v).length === 0);
}).length;
const richness = {
  sdOrderGuid: has("sdOrderGuid"),
  vin: pool.filter((s) => s.vehicle?.vin).length,
  driver: has("driver"),
  carrier: has("carrier"),
  currentLocation: has("currentLocation"),
  eta: has("eta"),
  pickupPhotos: has("pickupPhotos"),
  transitPhotos: has("transitPhotos"),
  deliveryPhotos: has("deliveryPhotos"),
  scheduledPickup: has("scheduledPickup"),
};

// Stale: booked, never moved, older than STALE days.
const staleCut = Date.now() - STALE * 864e5;
const stale = pool.filter((s) => (s.status === "booked" || s.status === "prep") && s.bookedAt && new Date(s.bookedAt).getTime() < staleCut);

// Pickup-vs-delivery same event: agent flipped straight to Delivered (never marked In Transit).
const skippedTransit = pool.filter((s) => {
  const p = (s.milestones ?? []).find((m) => m.type === "pickedUp");
  const d = (s.milestones ?? []).find((m) => m.type === "delivered");
  return p && d && p.at === d.at;
});

// ── webhook transitions per order ─────────────────────────────────────
// Count distinct Status_Id values observed per ABD id (how many state changes we ever saw).
const ids = new Set(pool.map((s) => s.proabdAbdId).filter(Boolean));
const transitions = new Map();
let evCount = 0;
const evSnap = await db.collection("proabd_webhook_events").where("received_at", ">=", since).get();
for (const d of evSnap.docs) {
  const e = d.data();
  const raw = e.raw_item ?? {};
  const abd = String(e.entity_id ?? raw.ABD_Id ?? "");
  const st = String(raw.Status_Id ?? "");
  if (!ids.has(abd) || !st) continue;
  evCount++;
  if (!transitions.has(abd)) transitions.set(abd, new Set());
  transitions.get(abd).add(st);
}
const distinctStatuses = [...transitions.values()].map((s) => s.size);

const newestEv = await db.collection("proabd_webhook_events").orderBy("received_at", "desc").limit(1).get();
const lastDelivery = newestEv.docs[0]?.get("received_at")?.toDate?.() ?? null;

// ── report ────────────────────────────────────────────────────────────
console.log(`\nSHIPMENT TRACKING AUDIT  (${label}; ${pool.length} shipments, tests excluded)`);
console.log(`last webhook delivery: ${lastDelivery ? lastDelivery.toISOString() + "  (" + fmtH(hrs(Date.now() - lastDelivery)) + " ago)" : "never"}\n`);

console.log("Status now:", byStatus);
console.log(`\nReached In Transit or later:   ${reachedTransit.length}/${pool.length}  (${pct(reachedTransit.length, pool.length)})`);
console.log(`Reached Delivered or later:    ${reachedDelivered.length}/${pool.length}  (${pct(reachedDelivered.length, pool.length)})`);
console.log(`Has a pickedUp milestone:      ${withPickedUp.length}   (stamped when an AGENT flipped status, not when the truck moved)`);
console.log(`Has a delivered milestone:     ${withDelivered.length}`);
console.log(`Flipped straight to Delivered: ${skippedTransit.length}   (never marked In Transit; customer had no in-transit window at all)`);
console.log(`Stale (booked/prep > ${STALE}d, never moved): ${stale.length}`);

console.log(`\nBooking → In Transit flip:     median ${fmtH(median(bookToPickup))}   n=${bookToPickup.length}`);
console.log(`In Transit → Delivered flip:   median ${fmtH(median(pickupToDelivered))}   n=${pickupToDelivered.length}`);
console.log(`Distinct ProABD statuses seen per order (last ${DAYS}d events): median ${median(distinctStatuses) ?? "n/a"}, orders with events: ${transitions.size}, events matched: ${evCount}`);

console.log(`\nBeyond a status flip, how many shipments hold:`);
for (const [k, v] of Object.entries(richness)) console.log(`  ${k.padEnd(16)} ${String(v).padStart(4)} / ${pool.length}  ${pct(v, pool.length)}`);

console.log(`\nInterpretation:`);
console.log(`  What the customer can see after pickup today = the status an agent set, the booking price, the coordinator's name.`);
console.log(`  Live location, driver, ETA and photos require sdOrderGuid (SD link) + SD_SHIPPER_ENRICH=true + SD prod credentials. Count above shows how many have the link.`);

if (stale.length) {
  console.log(`\nStale orders (first 15):`);
  for (const s of stale.slice(0, 15)) console.log(`  ${s.id}  ${s.status}  booked ${s.bookedAt?.slice(0, 10)}  ${s.origin?.state ?? "?"}→${s.destination?.state ?? "?"}  ${s.coordinator?.name ?? "-"}`);
}
process.exit(0);
