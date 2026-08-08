/**
 * Diagnostic: why did the Fri 2026-08-07 weekly digest report 0 leads?
 *
 * Runs the EXACT query the digest runs, then the query it SHOULD run,
 * and dumps the raw stored types of the two timestamp fields.
 *
 * Usage:  node scripts/digest-diag.mjs
 * Requires FIREBASE_PROJECT_ID in .env.local + gcloud ADC (same as leads-today.mjs).
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

console.log("\nproject:", projectId);

// The digest ran at 2026-08-07T15:01:11.329Z. Reproduce its exact window.
const digestRanAt = new Date("2026-08-07T15:01:11.329Z");
const sevenDaysAgo = new Date(digestRanAt.getTime() - 7 * 24 * 60 * 60 * 1000);
console.log("window:", sevenDaysAgo.toISOString(), "->", digestRanAt.toISOString());

// ---- 1. THE DIGEST'S QUERY, verbatim -------------------------------------
try {
  const snap = await db
    .collection("leads")
    .where("submittedAt", ">=", sevenDaysAgo)
    .orderBy("submittedAt", "desc")
    .limit(500)
    .get();
  console.log(`\n[A] digest query  where submittedAt >= Date  ->  ${snap.size} docs`);
  for (const d of snap.docs.slice(0, 5)) {
    console.log("      ", d.data().leadRef, "|", d.data().submittedAt);
  }
} catch (err) {
  console.log("\n[A] digest query THREW:", err.code ?? "", err.message);
}

// ---- 2. Same idea but comparing string-to-string --------------------------
try {
  const snap = await db
    .collection("leads")
    .where("submittedAt", ">=", sevenDaysAgo.toISOString())
    .orderBy("submittedAt", "desc")
    .limit(500)
    .get();
  console.log(`\n[B] where submittedAt >= ISO string  ->  ${snap.size} docs`);
  for (const d of snap.docs.slice(0, 5)) {
    console.log("      ", d.data().leadRef, "|", d.data().submittedAt);
  }
} catch (err) {
  console.log("\n[B] string query THREW:", err.code ?? "", err.message);
}

// ---- 3. The query it SHOULD run: createdAt (real server Timestamp) --------
try {
  const snap = await db
    .collection("leads")
    .where("createdAt", ">=", sevenDaysAgo)
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();
  console.log(`\n[C] where createdAt >= Date  ->  ${snap.size} docs   <-- what the digest should have said`);
  for (const d of snap.docs) {
    const x = d.data();
    console.log("      ", String(x.leadRef).padEnd(18), x.createdAt?.toDate?.()?.toISOString() ?? "?", "|", x.contact?.email ?? "");
  }
} catch (err) {
  console.log("\n[C] createdAt query THREW:", err.code ?? "", err.message);
}

// ---- 4. Raw stored types on the 5 newest docs -----------------------------
const recent = await db.collection("leads").orderBy("createdAt", "desc").limit(5).get();
console.log(`\n[D] stored field types (5 newest of ${recent.size}):`);
for (const d of recent.docs) {
  const x = d.data();
  const t = (v) =>
    v == null ? "MISSING"
    : typeof v?.toDate === "function" ? "Timestamp"
    : typeof v;
  console.log(
    "      ", String(x.leadRef).padEnd(18),
    "createdAt=" + t(x.createdAt).padEnd(10),
    "submittedAt=" + t(x.submittedAt).padEnd(10),
    JSON.stringify(x.submittedAt),
  );
}

// ---- 5. Total collection size --------------------------------------------
const all = await db.collection("leads").count().get();
console.log(`\n[E] total docs in 'leads': ${all.data().count}`);
console.log("");
process.exit(0);
