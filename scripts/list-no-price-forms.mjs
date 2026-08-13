/**
 * List valid quote-form leads that never saw a price (estimate.price missing).
 *
 * Mirrors the admin page's "N valid forms saw no price" decision card exactly:
 *   cohort  = leads createdAt >= Jul 14 2026 00:00 PT (PROABD_START)
 *   forms   = leadRef not starting "CALL"
 *   valid   = origin.state AND destination.state resolved (blocked excluded)
 *   tests   = excluded via the shared TEST_MARKERS regex
 *   noPrice = estimate.price is not a number > 0
 *
 * Purpose: answer "pattern or noise?" — is the pricing engine failing on a
 * route class (oversized vehicles, odd corridors) or scattered API hiccups?
 *
 * Usage:
 *   cd autoline-logistics-web
 *   node scripts/list-no-price-forms.mjs
 *
 * Requires FIREBASE_PROJECT_ID in .env.local + gcloud ADC. Read-only.
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

const PROABD_START = new Date("2026-07-14T07:00:00Z"); // Jul 14 00:00 PT — admin cohort start

const TEST_MARKERS = [/eddiezal28@gmail\.com/i, /zaldivarlabs\.com/i, /\btest(ing)?\b/i];
const isTest = (d) => {
  const hay = [d.contact?.email, d.contact?.firstName + " " + (d.contact?.lastName ?? ""), d.contact?.notes]
    .filter(Boolean).join(" | ");
  return TEST_MARKERS.some((re) => re.test(hay));
};

const snap = await db.collection("leads")
  .where("createdAt", ">=", PROABD_START)
  .orderBy("createdAt", "asc")
  .get();

const ptTime = (d) => {
  const t = d.createdAt?.toDate?.() ?? new Date(d.submittedAt);
  return t.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
};

const rows = [];
let forms = 0, priced = 0, blocked = 0, calls = 0, tests = 0;
for (const doc of snap.docs) {
  const d = doc.data();
  const ref = String(d.leadRef ?? "");
  if (ref.startsWith("CALL")) { calls++; continue; }
  if (isTest(d)) { tests++; continue; }
  const oState = d.origin?.state || "";
  const dState = d.destination?.state || "";
  if (!oState || !dState) { blocked++; continue; } // invalid/international — separate card
  forms++;
  const price = typeof d.estimate?.price === "number" && d.estimate.price > 0 ? d.estimate.price : null;
  if (price !== null) { priced++; continue; }
  rows.push(d);
}

console.log(`\nCohort since Jul 14 (PT): ${forms} valid forms · ${priced} priced · ${rows.length} saw NO price`);
console.log(`(excluded from cohort: ${calls} calls · ${tests} tests · ${blocked} blocked/invalid)\n`);

for (const d of rows) {
  const v = d.vehicle ?? {};
  const veh = [v.year, v.make, v.model].filter(Boolean).join(" ") || "?";
  const route = `${d.origin?.state} ${d.origin?.zip ?? ""} -> ${d.destination?.state} ${d.destination?.zip ?? ""}`;
  const est = d.estimate ?? {};
  console.log(`${ptTime(d)}  ${String(d.leadRef).padEnd(18)} ${route.padEnd(24)} ${String(v.type ?? "?").padEnd(10)} ${veh}`);
  console.log(`             tier=${d.tier ?? "?"}  estimate.source=${est.source ?? "(absent)"}  low/high=${est.low ?? "-"}/${est.high ?? "-"}  conf=${est.confidence ?? "-"}  sdType=${est.sdVehicleType ?? "-"}`);
  const agent = d.proabdAssignedAgent?.userName ?? "(unassigned)";
  const notes = (d.contact?.notes ?? "").trim();
  console.log(`             agent=${agent}${notes ? `  notes="${notes.slice(0, 80)}"` : ""}\n`);
}

// Pattern summary
const by = (fn) => {
  const m = new Map();
  for (const d of rows) { const k = fn(d) ?? "?"; m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(" · ");
};
console.log("── Patterns ──");
console.log(`by estimate.source : ${by((d) => d.estimate?.source ?? "(absent)")}`);
console.log(`by vehicle.type    : ${by((d) => d.vehicle?.type)}`);
console.log(`by state pair      : ${by((d) => `${d.origin?.state}->${d.destination?.state}`)}`);
console.log(`by tier            : ${by((d) => d.tier)}`);
console.log("");
process.exit(0);
