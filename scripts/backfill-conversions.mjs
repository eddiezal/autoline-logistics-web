/**
 * Offline conversion backfill for the 2026-08-07 → 08-10 gtag outage.
 *
 * CONTEXT: the cache-resurrection incident (see Analytics.tsx header) killed
 * client-side gtag — and with it GA4-imported Ads conversions — from Friday
 * 2026-08-07 AFTERNOON until the 8/10 ~7:30 PM PT fix deploy (08d8409).
 *
 * VERIFIED TIMELINE (8/10 evening reconciliation, per-campaign-per-day Firestore vs
 * Ads): last conversion that tracked was 8:46 AM PT Friday; first lead that
 * did NOT track was 3:39 PM PT Friday. So the bad cached build went live
 * between ~9 AM and ~3:30 PM Friday — NOT Friday night as first assumed.
 * Verified losses: exactly 9 paid web leads (3 S5 Friday afternoon;
 * 4 S5 + 2 S3 on Monday 8/10). Everything else in Aug 3–7 tracked, except
 * 3 "conversions" on Brand which were our own internal test submissions
 * (test pollution — see monday-read 8/10-evening addendum).
 *
 * WHAT THIS SCRIPT DOES: queries leads in the window (bounded on BOTH ends —
 * 8/7 lesson), keeps paid web leads with a gclid, excludes internal tests,
 * and writes a CSV in Google Ads' Click Conversions upload format. It does
 * NOT talk to Google — review the printed table, then upload in the Ads UI.
 * Windows are NAMED and ledgered in WINDOWS below (upload status included);
 * a bare run lists them and writes nothing.
 *
 * ⚠️ DOUBLE-COUNT WARNING: the upload action ("Web lead (backfill)") is a
 * SEPARATE conversion action from lead_form_submit; Google does NOT dedup
 * across actions. Never widen the window without first reconciling
 * Firestore paid leads vs Ads conversions per campaign per day, and only
 * upload the verified gaps.
 *
 * ONE-TIME PREREQ (done 8/10 evening, in Ads UI): import conversion action
 * "Web lead (backfill)" — Import from clicks, category Submit lead form,
 * Primary in the Submit lead forms goal, count One, value from upload
 * (default $239). New import actions take ~4h to start accepting uploads
 * ("still processing" preview error until then).
 *
 * THEN: Goals → Conversions → Uploads → select the CSV → Preview → Apply.
 * Diagnostics can take ~15 min; conversions appear under the CLICK date.
 *
 * Usage:
 *   node scripts/backfill-conversions.mjs                    # lists windows + status, writes nothing
 *   node scripts/backfill-conversions.mjs --window csp-outage
 *   node scripts/backfill-conversions.mjs --start 2026-08-07T15:00:00-07:00 \
 *     --end 2026-08-10T19:30:00-07:00 --value 239 --action "Web lead (backfill)"
 *
 * SAFETY CHANGE 2026-08-11 evening: a bare run used to default to the
 * Aug 7–10 window — which is ALREADY UPLOADED. Regenerating that CSV left
 * a double-count one careless upload away. Now: no default window. Bare
 * runs print the known incident windows with their upload status and exit.
 * Already-uploaded windows refuse to generate without --force.
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

// Known incident windows. Keep every window here FOREVER with its upload
// status — this list is the double-count ledger.
//
// ⚠ HARD-LEARNED RULE (Google support case 7-8363000040761): after creating
// a NEW conversion action, wait a FULL 6 HOURS before the first upload.
// We uploaded 4.5h after creating "Web lead (backfill)" — Google accepted
// all rows ("# OK" in results) but never restated them into reports, and
// dedup then blocked every re-upload with "No changes". Recovery required
// a support case + re-upload with each Conversion Time shifted +1 second
// (their instruction; dedup keys on gclid+action+timestamp).
const WINDOWS = {
  "aug7-outage": {
    start: "2026-08-07T15:00:00-07:00",
    end: "2026-08-10T19:30:00-07:00",
    status:
      "✅ UPLOADED 2026-08-11 12:43 + 12:51 AM PT (9 conversions: backfill-conversions.csv ×6 + backfill-week1.csv ×3). DO NOT re-upload. " +
      "⚠ HISTORY: the ×6 file was uploaded 4.5h after the action was created (inside the 6h propagation window) — accepted but never restated; " +
      "re-uploaded 2026-08-13 as backfill-conversions-retry.csv with times +1s per Google support case 7-8363000040761. " +
      "WATCH: expected Aug 7–11 end state = 12 Conversions / 13 all-conv. If it ever reads ~18 (the stuck originals restating on top of the retry), " +
      "upload RETRACTIONS for the +1s copies, citing the case.",
    uploaded: true,
  },
  "csp-outage": {
    // Outage #3: Google moved gtag collect endpoints; our CSP blocked them
    // (see claude/incident-2026-08-11-csp-collect-endpoints.md). Starts one
    // second after aug7-outage's inclusive end; ends at the CSP-fix deploy
    // (~7:40 PM PT Tue, padded to 19:45). GRAY ZONE: any lead after
    // ~19:20 PT on 8/11 must be cross-checked against GA4 before upload —
    // if GA4 caught it post-fix, uploading it here DOUBLE-COUNTS (Google
    // does not dedup across conversion actions).
    start: "2026-08-10T19:30:01-07:00",
    end: "2026-08-11T19:45:00-07:00",
    status: "✅ UPLOADED 2026-08-11 ~9:25 PM PT (backfill-csp-outage.csv, 2 successful: Brand 8:07 AM + S5 11:30 AM). DO NOT re-upload. 1 known permanent miss: AL-260811-7LYTF8 (S5 by UTM, no gclid captured).",
    uploaded: true,
  },
};

const windowName = argVal("window", null);
const startArg = argVal("start", null);
const endArg = argVal("end", null);
const force = args.includes("--force");

if (!windowName && !(startArg && endArg)) {
  console.log("No window selected — nothing generated. Known incident windows:\n");
  for (const [name, w] of Object.entries(WINDOWS)) {
    console.log(`  --window ${name}`);
    console.log(`      ${w.start} → ${w.end}`);
    console.log(`      ${w.status}\n`);
  }
  console.log("Or explicit bounds: --start <ISO+offset> --end <ISO+offset>");
  console.log("Reconcile Firestore vs Ads per campaign per day BEFORE any upload.");
  process.exit(1);
}

let startStr = startArg, endStr = endArg;
if (windowName) {
  const w = WINDOWS[windowName];
  if (!w) {
    console.error(`Unknown window "${windowName}". Known: ${Object.keys(WINDOWS).join(", ")}`);
    process.exit(1);
  }
  if (w.uploaded && !force) {
    console.error(`REFUSING: window "${windowName}" is already uploaded — ${w.status}`);
    console.error("Re-uploading double-counts. If you really need to regenerate the CSV (not upload!), add --force.");
    process.exit(1);
  }
  startStr = w.start;
  endStr = w.end;
}

const START = new Date(startStr);
const END = new Date(endStr);
const VALUE = Number(argVal("value", "239")); // matches lead_form_submit's median-fee value convention
const CURRENCY = argVal("currency", "USD");
const ACTION = argVal("action", "Web lead (backfill)");
const OUT = argVal("out", windowName ? `backfill-${windowName}.csv` : "backfill-conversions.csv");

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
