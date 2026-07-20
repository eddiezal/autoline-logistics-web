/**
 * Retroactively correct lead attribution using gclid as ground truth.
 *
 * WHY: until 2026-07-20 (commit e3e92ae) the quote form never sent UTM
 * params, so every Google Ads lead was stored with utmSource=null and
 * rendered as "Google (organic)" / "Direct" in agent emails. BUT gclid
 * capture (URL + 60-day cookie) worked the whole time, and a gclid only
 * exists on a Google Ads click. Therefore:
 *
 *   attribution.gclid present + utmSource missing  => provably PAID
 *     -> backfill utmSource="google", utmMedium="cpc", backfilled flag
 *   google referrer + no gclid                     => genuinely organic
 *     -> left untouched (was labeled correctly)
 *
 * Campaign-level backfill (gclid -> campaign id) would need the Google Ads
 * API click_view report (90-day window) — deliberate non-goal here.
 *
 * Usage:
 *   cd autoline-logistics-web
 *   node scripts/backfill-attribution.mjs           # DRY RUN (default)
 *   node scripts/backfill-attribution.mjs --apply   # actually write
 *
 * Requires FIREBASE_PROJECT_ID in .env.local + gcloud ADC (same setup as
 * proabd-routes.mjs / proabd-hourly-volume.mjs).
 */

import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");

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
const snap = await db.collection("leads").get();

let total = 0;
let toBackfill = [];
let alreadyTagged = 0;
let organicGoogle = 0;
let otherReferral = 0;
let direct = 0;
let previouslyBackfilled = 0;

const S = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

for (const doc of snap.docs) {
  total++;
  const d = doc.data();
  const a = d.attribution ?? {};
  const gclid = S(a.gclid);
  const utmSource = S(a.utmSource);
  const referrer = S(a.referrer);

  if (a.backfilled) {
    previouslyBackfilled++;
    continue;
  }
  if (utmSource) {
    alreadyTagged++;
    continue;
  }
  if (gclid) {
    toBackfill.push({
      ref: doc.ref,
      leadRef: d.leadRef ?? doc.id,
      submittedAt: d.submittedAt ?? "?",
      gclid,
    });
    continue;
  }
  if (referrer && /google\./i.test(referrer)) organicGoogle++;
  else if (referrer) otherReferral++;
  else direct++;
}

console.log("");
console.log(`Mode: ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes — use --apply)"}`);
console.log(`Total leads scanned:            ${total}`);
console.log(`Already utm-tagged (post-fix):  ${alreadyTagged}`);
console.log(`Previously backfilled:          ${previouslyBackfilled}`);
console.log(`PAID, missing utm (gclid set):  ${toBackfill.length}  <-- the correction`);
console.log(`Google organic (ref, no gclid): ${organicGoogle}`);
console.log(`Other referral:                 ${otherReferral}`);
console.log(`Direct / unknown:               ${direct}`);
console.log("");

if (toBackfill.length) {
  console.log("Leads to correct -> utm_source=google, utm_medium=cpc:");
  for (const l of toBackfill) {
    console.log(`  ${String(l.leadRef).padEnd(20)} ${l.submittedAt}  gclid=${l.gclid.slice(0, 18)}...`);
  }
}

if (APPLY && toBackfill.length) {
  console.log("");
  let written = 0;
  for (const l of toBackfill) {
    await l.ref.update({
      "attribution.utmSource": "google",
      "attribution.utmMedium": "cpc",
      "attribution.backfilled": true,
      "attribution.backfilledAt": FieldValue.serverTimestamp(),
      "attribution.backfillReason": "gclid-present-pre-utm-fix-e3e92ae",
    });
    written++;
  }
  console.log(`Backfilled ${written} lead(s). Original gclid/referrer untouched;`);
  console.log(`backfilled flag set so this is auditable and re-runs are no-ops.`);
} else if (!APPLY && toBackfill.length) {
  console.log("");
  console.log("Dry run only. Re-run with --apply to write these corrections.");
} else {
  console.log("Nothing to correct.");
}

process.exit(0);
