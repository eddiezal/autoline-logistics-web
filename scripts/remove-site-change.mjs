/**
 * Delete Work Ledger entries by document id.
 *
 * Usage:  node scripts/remove-site-change.mjs <id> [<id> ...]
 * Ids look like 2026-08-18_some-slug (printed by add-site-change and list-site-changes --ids).
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
const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!ids.length) { console.error("pass at least one id"); process.exit(1); }
for (const id of ids) {
  const ref = db.collection("site_changes").doc(id);
  const snap = await ref.get();
  if (!snap.exists) { console.log(`skip (not found): ${id}`); continue; }
  await ref.delete();
  console.log(`deleted: [${snap.data().date}] ${snap.data().title}`);
}
