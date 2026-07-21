/**
 * Today's leads at a glance (Pacific Time), test submissions separated.
 *
 * Usage:
 *   cd autoline-logistics-web
 *   node scripts/leads-today.mjs        # today (PT)
 *   node scripts/leads-today.mjs 2      # last 2 days
 *
 * Requires FIREBASE_PROJECT_ID in .env.local + gcloud ADC.
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

const days = Number(process.argv[2]) || 1;
// Start of "today" in Pacific Time, going back (days-1) further days.
const nowPT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
const startPT = new Date(nowPT); startPT.setHours(0, 0, 0, 0); startPT.setDate(startPT.getDate() - (days - 1));
// Convert that PT wall-clock back to a real Date (approx: PT offset from the same trick)
const offsetMs = new Date().getTime() - nowPT.getTime();
const since = new Date(startPT.getTime() + offsetMs);

const snap = await db.collection("leads").where("createdAt", ">=", since).orderBy("createdAt", "asc").get();

const TEST_MARKERS = [/eddiezal28@gmail\.com/i, /zaldivarlabs\.com/i, /\btest(ing)?\b/i];
const isTest = (d) => {
  const hay = [d.contact?.email, d.contact?.firstName + " " + (d.contact?.lastName ?? ""), d.contact?.notes]
    .filter(Boolean).join(" | ");
  return TEST_MARKERS.some((re) => re.test(hay));
};

const fmt = (d) => {
  const t = d.createdAt?.toDate?.() ?? new Date(d.submittedAt);
  const time = t.toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit" });
  const route = `${d.origin?.state ?? "??"} ${d.origin?.zip ?? ""} -> ${d.destination?.state ?? "??"} ${d.destination?.zip ?? ""}`;
  const src = d.attribution?.utmSource
    ? `${d.attribution.utmSource}/${d.attribution.utmMedium ?? "?"}${d.attribution?.backfilled ? " (backfilled)" : ""}`
    : d.attribution?.gclid ? "paid (gclid)" : /google\./i.test(d.attribution?.referrer ?? "") ? "google organic" : d.attribution?.referrer ? "referral" : "direct";
  const price = d.estimate?.price ? `$${d.estimate.price}` : "-";
  // Post-cutover (2026-07-20) assignment lives in proabdAssignedAgent
  // (stamped by the webhook); older leads have the round-robin assignedAgent.
  const agent =
    d.proabdAssignedAgent?.userName?.split(" ")[0] ??
    d.assignedAgent?.firstName ??
    "(pending webhook)";
  return `${time}  ${String(d.leadRef).padEnd(18)} ${route.padEnd(28)} ${String(price).padStart(7)}  ${src.padEnd(16)} -> ${agent}`;
};

const real = [], tests = [];
for (const doc of snap.docs) (isTest(doc.data()) ? tests : real).push(doc.data());

console.log(`\nWindow: last ${days} day(s), Pacific Time. Total submissions: ${snap.size}`);
console.log(`\nREAL LEADS: ${real.length}`);
for (const d of real) console.log("  " + fmt(d));
console.log(`\nTEST SUBMISSIONS (yours): ${tests.length}`);
for (const d of tests) console.log("  " + fmt(d));
console.log("");
process.exit(0);
