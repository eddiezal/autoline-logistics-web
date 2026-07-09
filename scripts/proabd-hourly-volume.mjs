/**
 * Hourly ProABD webhook event volume for the last 48 hours.
 *
 * Purpose: check whether our webhook stream had gaps during the same window
 * Nelson said leads were delayed (2026-07-08 and 2026-07-09). If our stream
 * ALSO had gaps, the disruption was pipeline-wide (Superflo or Ben-side
 * config). If our stream was steady, routing was diverted on Ben's account
 * without affecting the actual event feed.
 *
 * Also breaks down by:
 *  - Referrer_Id (Taylor 503 vs everything else)
 *  - Item_Type (lead/quote/order)
 *
 * Usage:
 *   cd autoline-logistics-web
 *   node scripts/proabd-hourly-volume.mjs
 *
 * Requires FIREBASE_PROJECT_ID in .env.local + gcloud ADC or service account.
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

const now = new Date();
const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

console.log(`Query window: ${fortyEightHoursAgo.toISOString()} → ${now.toISOString()}`);
console.log("");

const snapshot = await db
  .collection("proabd_webhook_events")
  .where("received_at", ">=", fortyEightHoursAgo)
  .orderBy("received_at", "asc")
  .get();

console.log(`Total events: ${snapshot.size}`);
console.log("");

// Bucket by hour (Pacific Time so it matches Ben's operating window)
const hourly = new Map();

for (const doc of snapshot.docs) {
  const data = doc.data();
  const receivedAt = data.received_at?.toDate();
  if (!receivedAt) continue;

  const raw = data.raw_item ?? {};
  const referrerId = raw.Referrer_Id ?? "unknown";
  const itemType = raw.Item_Type ?? "unknown";

  // Format hour key in Pacific Time
  const hourKey = receivedAt.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });

  if (!hourly.has(hourKey)) {
    hourly.set(hourKey, { total: 0, taylor: 0, other: 0, byType: {} });
  }
  const bucket = hourly.get(hourKey);
  bucket.total++;
  if (referrerId === "503") bucket.taylor++;
  else bucket.other++;
  bucket.byType[itemType] = (bucket.byType[itemType] ?? 0) + 1;
}

// Print table
console.log("Hourly breakdown (Pacific Time):");
console.log("".padEnd(24), "Total", "Taylor(503)", "Other", "  ByType");
console.log("=".repeat(80));

const sortedKeys = [...hourly.keys()].sort();
for (const key of sortedKeys) {
  const b = hourly.get(key);
  const typeStr = Object.entries(b.byType).map(([k, v]) => `${k}:${v}`).join(",");
  console.log(
    key.padEnd(24),
    String(b.total).padStart(5),
    String(b.taylor).padStart(11),
    String(b.other).padStart(5),
    "  " + typeStr,
  );
}

console.log("");
console.log("Look for hours with 0 or very low counts to spot the disruption window.");
console.log("Nelson said: 2026-07-08 leads didn't arrive until 4 PM PT.");
console.log("Ginger said: 2026-07-09 leads didn't arrive until late.");

// Also: gap detection
console.log("");
console.log("Gaps of 60+ minutes with 0 events:");
let lastEventTime = null;
for (const doc of snapshot.docs) {
  const t = doc.data().received_at?.toDate();
  if (!t) continue;
  if (lastEventTime) {
    const gapMinutes = (t.getTime() - lastEventTime.getTime()) / 60000;
    if (gapMinutes >= 60) {
      const gapStart = lastEventTime.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
      const gapEnd = t.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
      console.log(`  ${Math.round(gapMinutes)}min gap: ${gapStart} → ${gapEnd}`);
    }
  }
  lastEventTime = t;
}

process.exit(0);
