/** Diagnose cohort leads with no confirmed assignee — v2, targeted queries. */
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

const COHORT_START = new Date("2026-07-14T07:00:00Z");
const TEST_MARKERS = [/eddiezal28@gmail\.com/i, /zaldivarlabs\.com/i, /\btest(ing)?\b/i];
const isTest = (d) => {
  const hay = [d.contact?.email, (d.contact?.firstName ?? "") + " " + (d.contact?.lastName ?? ""), d.contact?.notes]
    .filter(Boolean).join(" | ");
  return TEST_MARKERS.some((re) => re.test(hay));
};
const fmtPT = (t) => t?.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) ?? "?";

const leadsSnap = await db.collection("leads").where("createdAt", ">=", COHORT_START).get();
const candidates = [];
for (const doc of leadsSnap.docs) {
  const d = doc.data();
  if (isTest(d)) continue;
  const blocked = !d.origin?.state || !d.destination?.state;
  if (blocked) continue;
  if (d.proabdAssignedAgent?.userName) continue; // stamped = fine
  candidates.push(d);
}
console.log(`Cohort docs: ${leadsSnap.size}; candidates without stamped assignee: ${candidates.length}`);

for (const d of candidates) {
  const abd = d.proabdAbdId ? String(d.proabdAbdId) : null;
  let events = 0, user = null;
  if (abd) {
    const ev = await db.collection("proabd_webhook_events")
      .where("entity_id", "==", abd)
      .select("raw_item.UserName", "received_at").get();
    events = ev.size;
    let lastAt = 0;
    for (const e of ev.docs) {
      const x = e.data();
      const at = x.received_at?.toDate?.()?.getTime() ?? 0;
      const u = x.raw_item?.UserName;
      if (u && at >= lastAt) { user = u; lastAt = at; }
    }
  }
  if (user) { console.log(`OK (webhook-observed): ${d.leadRef} -> ${user}`); continue; }
  console.log(JSON.stringify({
    ref: d.leadRef,
    created: fmtPT(d.createdAt?.toDate?.()),
    isCall: String(d.leadRef ?? "").startsWith("CALL-"),
    abdId: abd ?? "(none)",
    syncedAt: d.proabdSyncedAt ? fmtPT(d.proabdSyncedAt.toDate?.()) : "(never)",
    webhookEvents: events,
    legacyAgent: d.assignedAgent?.firstName ?? null,
    src: d.attribution?.utmSource ?? (d.attribution?.gclid ? "gclid" : "organic/direct"),
    price: d.estimate?.price ?? null,
  }));
}
process.exit(0);
