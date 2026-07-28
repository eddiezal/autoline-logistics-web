/**
 * Webhook-stall check: leads that reached ProABD (proabdAbdId stamped by
 * createLead) but never received the webhook's assignment stamp-back
 * (proabdAssignedAgent) are proof the Export API subscription is silent —
 * every new ProABD lead generates insert+update events, and the stamp-back
 * runs on every delivery.
 *
 * Usage: node scripts/check-webhook-stall.mjs
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

// Last webhook delivery (for reference).
const newestEv = await db
  .collection("proabd_webhook_events")
  .orderBy("received_at", "desc")
  .limit(1)
  .get();
const lastDelivery = newestEv.docs[0]?.get("received_at")?.toDate?.() ?? null;
console.log(`Last webhook delivery: ${lastDelivery ? lastDelivery.toISOString() : "never"}\n`);

// Recent leads, newest first (single-field orderBy, no index needed).
const snap = await db.collection("leads").orderBy("createdAt", "desc").limit(30).get();

const fmt = (ts) => (ts?.toDate ? ts.toDate().toISOString() : ts ?? "—");
let reachedProabdAfterStall = 0;
let stampedAfterStall = 0;

console.log("ref              created(UTC)          abdId      assignedAgent        stampedAt");
console.log("─".repeat(100));
for (const d of snap.docs) {
  const l = d.data();
  const created = l.createdAt?.toDate?.() ?? null;
  const agent = l.proabdAssignedAgent?.userName ?? null;
  console.log(
    `${(l.leadRef ?? d.id).padEnd(17)}${fmt(l.createdAt).slice(0, 19).padEnd(22)}` +
    `${(l.proabdAbdId ?? "—").padEnd(11)}${(agent ?? "NOT STAMPED").padEnd(21)}` +
    `${fmt(l.proabdAssignmentUpdatedAt).slice(0, 19)}`,
  );
  if (lastDelivery && created && created > lastDelivery && l.proabdAbdId) {
    reachedProabdAfterStall++;
    if (agent) stampedAfterStall++;
  }
}

console.log("\n===== verdict =====");
console.log(
  `Leads created AFTER the last webhook delivery that reached ProABD: ${reachedProabdAfterStall}`,
);
console.log(`...of those, stamped by a webhook event: ${stampedAfterStall}`);
if (reachedProabdAfterStall > 0 && stampedAfterStall === 0) {
  console.log(
    "→ CONFIRMED STALL: new ProABD records exist but zero events arrived for them.",
  );
} else if (reachedProabdAfterStall === 0) {
  console.log("→ Inconclusive: no new ProABD-synced leads since the last delivery.");
} else {
  console.log("→ Webhook appears to be delivering (at least partially).");
}
process.exit(0);
