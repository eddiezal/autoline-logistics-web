/**
 * Backfill attribution.gclid (+ gbraid/wbraid) on call leads from the raw
 * CallRail payload preserved in callrail_webhook_events (kept since 8/10).
 *
 * The webhook never stored the click id before 2026-09-28. This copies it
 * onto existing call lead docs so historical paid calls carry the same
 * attribution shape as form leads.
 *
 * Usage:  node scripts/backfill-call-gclid.mjs            # dry run
 *         node scripts/backfill-call-gclid.mjs --apply
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
const APPLY = process.argv.includes("--apply");
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

const snap = await db.collection("leads").where("source", "==", "call").get();
let calls = 0, already = 0, noRaw = 0, noId = 0, planned = 0, written = 0;
const batchWrites = [];
for (const doc of snap.docs) {
  const x = doc.data();
  calls++;
  if (str(x.attribution?.gclid) || str(x.attribution?.gbraid) || str(x.attribution?.wbraid)) { already++; continue; }
  const callId = str(x.callMeta?.callrailId);
  const rawSnap = callId ? await db.collection("callrail_webhook_events").doc(callId).get() : null;
  const raw = rawSnap?.exists ? rawSnap.data()?.raw ?? null : null;
  if (!raw) { noRaw++; continue; }
  const ids = { gclid: str(raw.gclid), gbraid: str(raw.gbraid), wbraid: str(raw.wbraid) };
  if (!ids.gclid && !ids.gbraid && !ids.wbraid) { noId++; continue; }
  planned++;
  batchWrites.push({ ref: doc.ref, ids });
}
console.log(`call leads ${calls} · already have a click id ${already} · no raw payload ${noRaw} · raw has no click id ${noId} · to backfill ${planned}`);
if (APPLY) {
  for (let i = 0; i < batchWrites.length; i += 400) {
    const b = db.batch();
    for (const w of batchWrites.slice(i, i + 400)) {
      b.set(w.ref, { attribution: { gclid: w.ids.gclid, gbraid: w.ids.gbraid, wbraid: w.ids.wbraid }, gclidBackfilledAt: new Date().toISOString() }, { merge: true });
      written++;
    }
    await b.commit();
  }
  console.log(`written ${written}`);
} else if (planned) {
  console.log("dry run; re-run with --apply to write");
}
