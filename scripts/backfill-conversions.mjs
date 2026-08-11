/**
 * Offline conversion backfill for the 2026-08-07 → 08-10 gtag outage.
 *
 * CONTEXT: the cache-resurrection incident (see Analytics.tsx header) killed
 * client-side gtag — and with it GA4-imported Ads conversions — from Friday
 * 2026-08-07 AFTERNOON until the 8/10 ~7:30 PM PT fix deploy (08d8409).
 *
 * VERIFIED TIMELINE (8/11 reconciliation, per-campaign-per-day Firestore vs
 * Ads): last conversion that tracked was 8:46 AM PT Friday; first lead that
 * did NOT track was 3:39 PM PT Friday. So the bad cached build went live
 * between ~9 AM and ~3:30 PM Friday — NOT Friday night as first assumed.
 * Verified losses: exactly 9 paid web leads (3 S5 Friday afternoon;
 * 4 S5 + 2 S3 on Monday 8/10). Everything else in Aug 3–7 tracked, except
 * 3 "conversions" on Brand which were our own internal test submissions
 * (test pollution — see monday-read 8/11 addendum).
 *
 * WHAT THIS SCRIPT DOES: queries leads in the window (bounded on BOTH ends —
 * 8/7 lesson), keeps paid web leads with a gclid, excludes internal tests,
 * and writes a CSV in Google Ads' Click Conversions upload format. It does
 * NOT talk to Google — review the printed table, then upload in the Ads UI.
 * The default window covers the full verified loss window: a plain run
 * regenerates all 9 lost conversions in one CSV.
 *
 * ⚠️ DOUBLE-COUNT WARNING: the upload action ("Web lead (backfill)") is a
 * SEPARATE conversion action from lead_form_submit; Google does NOT dedup
 * across actions. Never widen the window without first reconciling
 * Firestore paid leads vs Ads conversions per campaign per day, and only
 * upload the verified gaps.
 *
 * ONE-TIME PREREQ (done 8/11, in Ads UI): import conversion action
 * "Web lead (backfill)" — Import from clicks, category Submit lead form,
 * Primary in the Submit lead forms goal, count One, value from upload
 * (default $239). New import actions take ~4h to start accepting uploads
 * ("still processing" preview error until then).
 *
 * THEN: Goals → Conversions → Uploads → select the CSV → Preview → Apply.
 * Diagnostics can take ~15 min; conversions appear under the CLICK date.
 *
 * Usage:
 *   node scripts/backfill-conversions.mjs                # verified loss window
 *   node scripts/backfill-conversions.mjs --start 2026-08-07T15:00:00-07:00 \
 *     --end 2026-08-10T19:30:00-07:00 --value 239 --action "Web lead (backfill)"
 */
import { writeFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });

const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : dflt;
};

// Verified loss window (see header): first missed lead 8/7 15:39 PT, fix
// deployed 8/10 ~19:30 PT. Default regenerates all 9 lost conversions.
const START = new Date(argVal("start", "2026-08-07T15:00:00-07:00"));
const END = new Date(argVal("end", "2026-08-10T19:30:00-07:00"));
const VALUE = Number(argVal("value", "239")); // matches lead_form_submit's median-fee value convention
const CURRENCY = argVal("currency", "USD");
const ACTION = argVal("action", "Web lead (backfill)");
const OUT = argVal("out", "backfill-conversions.csv");

if (Number.isNaN(START.getTime()) || Number.isNaN(END.getTime())) {
  console.error("Bad --start/--end. Use ISO with offset, e.g. 2026-08-07T15:00:00-07:00");
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) { console.error("Missing FIREBASE_PROJECT_ID"); process.exit(1); }
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

// Same internal-test markers as the weekly digest.
const TEST_RE = /\btest(ing)?\b|\bfake\b/i;
const isInternalTest = (d) => {
  const c = d.contact ?? {};
  return TEST_RE.test([c.firstName, c.lastName, c.email, c.notes].filter(Boolean).join(" "));
};

// Google Ads Click Conversions time format, rendered in PT to match the
// Parameters:TimeZone row. en-CA gives yyyy-MM-dd; hour12:false gives HH:mm:ss.
const fmtPT = (date) => {
  const d = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date).reduce((o, p) => ((o[p.type] = p.value), o), {});
  return `${d.year}-${d.month}-${d.day} ${d.hour}:${d.minute}:${d.second}`;
};

const snap = await db
  .collection("leads")
  .where("createdAt", ">=", START)
  .where("createdAt", "<=", END)
  .orderBy("createdAt", "asc")
  .get();

const rows = [];
const skipped = { noGclid: [], tests: [] };

for (const doc of snap.docs) {
  const d = doc.data();
  const created = d.createdAt?.toDate?.();
  if (!created) continue;
  const gclid = d.attribution?.gclid ?? null;
  const label = `${d.leadRef ?? doc.id}  ${fmtPT(created)} PT  ${d.contact?.firstName ?? "?"} ${d.contact?.lastName ?? "?"}  [${d.attribution?.utmCampaign ?? d.attribution?.utmSource ?? "untagged"}]`;
  if (isInternalTest(d)) { skipped.tests.push(label); continue; }
  if (!gclid) { skipped.noGclid.push(label); continue; }
  rows.push({ gclid, time: fmtPT(created), label });
}

console.log(`Window: ${fmtPT(START)} → ${fmtPT(END)} PT\n`);
console.log(`UPLOADABLE (paid web leads with gclid): ${rows.length}`);
for (const r of rows) console.log(`  ✓ ${r.label}`);
console.log(`\nSKIPPED — no gclid (organic/direct/referral; nothing to backfill): ${skipped.noGclid.length}`);
for (const l of skipped.noGclid) console.log(`  – ${l}`);
console.log(`\nSKIPPED — internal tests: ${skipped.tests.length}`);
for (const l of skipped.tests) console.log(`  – ${l}`);

if (!rows.length) {
  console.log("\nNothing to upload. No CSV written.");
  process.exit(0);
}

const csv = [
  "Parameters:TimeZone=America/Los_Angeles",
  "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
  ...rows.map((r) => `${r.gclid},${ACTION},${r.time},${VALUE},${CURRENCY}`),
].join("\n");

writeFileSync(OUT, csv);
console.log(`\nWrote ${OUT} (${rows.length} conversions @ $${VALUE} ${CURRENCY} → action "${ACTION}")`);
console.log("NOTE: reconcile before widening the window (see DOUBLE-COUNT WARNING in header).");
console.log("backfill-*.csv is gitignored — do not commit.");
process.exit(0);
