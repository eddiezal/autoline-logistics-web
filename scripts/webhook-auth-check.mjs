/**
 * Webhook auth verification: shows the last 15 ProABD export events with
 * their `verified` flag. Run AFTER Superflo appends ?secret= to the URL.
 *
 * Expected: events received after the switch show verified: true.
 * Once confirmed, set PROABD_WEBHOOK_DEBUG_MODE=false in Vercel + redeploy.
 *
 * Usage: node scripts/webhook-auth-check.mjs
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

const snap = await db.collection("proabd_webhook_events")
  .orderBy("received_at", "desc")
  .limit(15)
  .get();

console.log("\nLast 15 export events (newest first, Pacific Time):\n");
let latestVerified = null;
for (const doc of snap.docs) {
  const d = doc.data();
  const t = d.received_at?.toDate?.();
  const pt = t?.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) ?? "?";
  const v = d.verified === true;
  if (latestVerified === null) latestVerified = v;
  console.log(`  ${pt}  verified=${v ? "TRUE " : "false"}  ${String(d.entity_type ?? "?").padEnd(6)} ${d.action ?? "?"}  ABD ${d.entity_id ?? "?"}`);
}
console.log("");
console.log(latestVerified
  ? "LATEST EVENT IS AUTHENTICATED. Safe to set PROABD_WEBHOOK_DEBUG_MODE=false in Vercel and redeploy."
  : "Latest event still unauthenticated. Either no events have arrived since Brian's change (ProABD batches only fire on record activity) or the secret didn't match. Have an agent touch any record in ProABD to force an event, wait ~5 min, run again.");
process.exit(0);
