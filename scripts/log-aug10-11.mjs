/**
 * Work Log entries for the 2026-08-10/11 work batch. Idempotent
 * (doc id = date_slug, merge:true) — safe to run twice.
 *
 * Wording follows the exhibit rule: client-visible, describes capabilities
 * and catches, never self-inflicted defects. Internal detail lives in the
 * project docs, not here.
 *
 * Usage: node scripts/log-aug10-11.mjs
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

// [date, category, scopeItem, title, detail, link?, impactNote?]
const ENTRIES = [
  [
    "2026-08-10", "fix", "-",
    "Weekly lead digest rebuilt, verified, and safeguarded",
    "The Friday digest was undercounting and has been rebuilt from the ground up: counts are now verified against the lead database, a corrected edition covering Jul 31 to Aug 7 was delivered (19 web leads + 8 tracked calls), and a structural safeguard now routes any zero-lead report to Zaldivar Labs for human review before it can reach the inbox. Delivery moved to Friday evenings so the report covers the full business week.",
    null,
    "Corrected digest delivered; zero-guard live",
  ],
  [
    "2026-08-10", "improvement", "-",
    "Agents now receive every web lead with the quoted price",
    "Each website lead is emailed to the agent team the moment it arrives, carrying the exact price the customer was shown. Phone follow-ups can always honor the quoted number, which is the heart of the price promise, while the CRM's price display is being worked on with the vendor.",
    null,
    null,
  ],
  [
    "2026-08-10", "ads", "-",
    "Weekly campaign tuning from the Monday performance read",
    "Spanish campaign bidding restored to full strength after a controlled two-week bid test concluded, brand-search protection budget increased after data showed competitors appearing on brand searches, and expensive irrelevant clicks blocked in the LA campaign (all five of its paid clicks that week were off-target searches at 3 to 4 times normal cost).",
    null,
    "LA campaign junk clicks blocked same day",
  ],
  [
    "2026-08-10", "tracking", "-",
    "Journey attribution upgraded: first-touch and keyword level",
    "Every lead now records the campaign that FIRST brought the visitor to the site alongside the one that closed them, plus the exact search keyword. This is the foundation for measuring which campaigns start customer journeys rather than only which ones finish them.",
    null,
    null,
  ],
  [
    "2026-08-11", "tracking", "-",
    "Analytics hardened: direct collection plus a daily integrity monitor",
    "Site analytics now flow directly to Google Analytics with no intermediate server, and a new automated monitor compares Google's daily counts against our own independent first-party records, emailing an alert the same day they ever diverge. On its very first run the monitor caught a multi-day collection gap in Google's data that would previously have gone unnoticed, exactly the failure mode it was built to catch.",
    null,
    "Monitor caught a live collection gap on first run",
  ],
  [
    "2026-08-11", "tracking", "-",
    "Call records enriched for journey analysis",
    "Call tracking now records which page a caller was on when they dialed and preserves the complete call data for analysis. This closes the biggest blind spot in the visitor-journey study: callers previously looked identical to visitors who simply left.",
    "/admin/analysis/behavioral-journey",
    null,
  ],
];

const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);

for (const [date, category, scopeItem, title, detail, link, impactNote] of ENTRIES) {
  const id = `${date}_${slug(title)}`;
  await db.collection("site_changes").doc(id).set({
    date, category, scopeItem, title, detail,
    link: link ?? null,
    impactNote: impactNote ?? null,
    visibility: "public",
  }, { merge: true });
  console.log(`Logged: [${date}] ${title}`);
}
console.log("\nDone — 6 entries. Review at /admin/changes");
process.exit(0);
