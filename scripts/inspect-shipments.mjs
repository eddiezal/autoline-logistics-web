/**
 * Spot-check the `shipments` collection after the ProABD sweep runs.
 * Prints the most recently synced docs + collection counts so we can
 * verify the parser's output before flipping SHIPMENTS_SOURCE=firestore.
 *
 * Usage: node scripts/inspect-shipments.mjs [count]
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

const n = Math.min(Number(process.argv[2]) || 5, 25);

const snap = await db
  .collection("shipments")
  .orderBy("updatedFromProabdAt", "desc")
  .limit(n)
  .get();

for (const d of snap.docs) {
  const s = d.data();
  const veh = s.vehicle ?? {};
  const c = s.customer ?? {};
  console.log(`\n── ${d.id} ─────────────────────────────`);
  console.log(`  status:       ${s.status}  (ProABD: ${s.proabdStatusId} ${s.proabdStatusText ?? ""})`);
  console.log(`  customer:     ${c.name?.first ?? ""} ${c.name?.last ?? ""} <${c.email || "NO EMAIL"}> locale=${c.locale}`);
  console.log(`  route:        ${s.origin?.city || "?"}, ${s.origin?.state || "?"} ${s.origin?.zip || ""} → ${s.destination?.city || "?"}, ${s.destination?.state || "?"} ${s.destination?.zip || ""}`);
  console.log(`  vehicle:      ${veh.year || "?"} ${veh.make || "?"} ${veh.model || "?"} (${veh.condition})`);
  console.log(`  price:        $${((s.priceLockedCents ?? 0) / 100).toFixed(2)}  deposit: ${s.proabdDepositCents != null ? "$" + (s.proabdDepositCents / 100).toFixed(2) : "—"}  carrier: ${s.proabdCarrierName || "—"}`);
  console.log(`  bookedAt:     ${s.bookedAt ?? "—"}   createdAt: ${s.createdAt ?? "—"}`);
  console.log(`  coordinator:  ${s.coordinator?.name ?? "—"}  tier: ${s.tier}  milestones: ${(s.milestones ?? []).length}  sdOrderGuid: ${s.sdOrderGuid ?? "—"}`);
  console.log(`  abdId:        ${s.proabdAbdId}`);
}

const [shipTotal, evUnparsed, evTotal, newestEv] = await Promise.all([
  db.collection("shipments").count().get(),
  db.collection("proabd_webhook_events").where("parsed", "==", false).count().get(),
  db.collection("proabd_webhook_events").count().get(),
  db.collection("proabd_webhook_events").orderBy("received_at", "desc").limit(1).get(),
]);
console.log(`\n===== counts =====`);
console.log({
  shipments: shipTotal.data().count,
  webhook_events_unparsed: evUnparsed.data().count,
  webhook_events_total: evTotal.data().count,
  last_webhook_delivery:
    newestEv.docs[0]?.get("received_at")?.toDate?.()?.toISOString() ?? "never",
});
process.exit(0);
