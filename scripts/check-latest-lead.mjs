/**
 * Print the newest 3 lead docs' attribution: last-touch vs firstTouch.
 *
 * Built 2026-08-10 to verify the first-touch UTM instrumentation
 * (attribution.firstTouch, attribution.utmTerm) after deploy. Reusable
 * any time you need to eyeball what attribution a fresh lead carried.
 *
 * Usage:
 *   node scripts/check-latest-lead.mjs        # newest 3
 *   node scripts/check-latest-lead.mjs 10     # newest 10
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

const n = Math.min(Number(process.argv[2]) || 3, 25);
const snap = await getFirestore().collection("leads")
  .orderBy("createdAt", "desc").limit(n).get();

for (const d of snap.docs) {
  const x = d.data();
  const when = x.createdAt?.toDate?.()?.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }) ?? "?";
  const a = x.attribution ?? {};
  console.log(`\n${x.leadRef}  ${when} PT  ${x.contact?.email ?? ""}`);
  console.log("  last-touch :", JSON.stringify({
    src: a.utmSource ?? null,
    med: a.utmMedium ?? null,
    campaign: a.utmCampaign ?? null,
    term: a.utmTerm ?? null,
    gclid: a.gclid ? "yes" : null,
  }));
  console.log("  firstTouch :", JSON.stringify(a.firstTouch ?? null));
  console.log("  visitorId  :", a.visitorId ?? null);
}
console.log("");
process.exit(0);
