/**
 * S1 assist analysis — does the research campaign feed leads it never
 * gets credit for?
 *
 * Built 2026-08-10 to decide S1's budget (relaunch notes §7.4). Last-click
 * says S1 produced 2 leads in 30d ($575/conv). The S1 thesis says its
 * researchers convert LATER via direct/organic/brand and the credit lands
 * elsewhere. This script measures that three ways, all from Firestore:
 *
 *   [1] Last-touch attribution per campaign id (baseline, mirrors Ads)
 *   [2] First-touch vs last-touch divergence on the lead docs themselves
 *       (uses whatever first-touch fields exist; reports if none do)
 *   [3] Estimate-email captures that later became leads (email join).
 *       Captures come from the Route Price Checker = S1's landing page,
 *       so capture->lead conversions are S1's deferred harvest.
 *
 * It also probes one sample doc per collection first and adapts to the
 * fields it actually finds, printing what it could and could not join.
 * Campaign ids are printed raw — match them in the Ads UI (the id appears
 * as campaignId= in the URL when you click into a campaign).
 *
 * Usage:
 *   node scripts/s1-assist.mjs              # last 30 days
 *   node scripts/s1-assist.mjs --days 60
 *
 * Requires FIREBASE_PROJECT_ID in .env.local + gcloud ADC.
 */
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const DAYS = Number(flag("days")) || 30;

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) { console.error("Missing FIREBASE_PROJECT_ID"); process.exit(1); }
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const since = new Date(Date.now() - DAYS * 864e5);
console.log(`\nS1 assist analysis — window: last ${DAYS} days (since ${since.toISOString().slice(0, 10)})`);

// ---------- helpers --------------------------------------------------------
const INTERNAL = [/eddiezal28@gmail\.com/i, /@zaldivarlabs\.com/i, /@superflosystems\.com/i, /\btest(ing)?\b/i];
const isInternal = (d) => {
  const hay = [d.contact?.email, `${d.contact?.firstName ?? ""} ${d.contact?.lastName ?? ""}`, d.contact?.notes]
    .filter(Boolean).join(" | ");
  return INTERNAL.some((re) => re.test(hay));
};
const isCall = (d) => d.source === "call" || String(d.leadRef ?? "").startsWith("CALL-");
const dateOf = (d) => d.createdAt?.toDate?.() ?? (d.submittedAt ? new Date(d.submittedAt) : null);
const email = (d) => (d.contact?.email ?? d.email ?? "").trim().toLowerCase();
const days1 = (ms) => Math.round(ms / 864e5 * 10) / 10;

function probe(name, doc) {
  if (!doc) { console.log(`  [probe] ${name}: collection empty or unreadable`); return; }
  const keys = (o, pfx = "") =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === "object" && !v.toDate && !Array.isArray(v) && pfx.split(".").length < 2
        ? [`${pfx}${k}.{${Object.keys(v).join(",")}}`]
        : [`${pfx}${k}`]);
  console.log(`  [probe] ${name}: ${keys(doc).join(" · ")}`);
}

// ---------- load leads -----------------------------------------------------
const leadSnap = await db.collection("leads")
  .where("createdAt", ">=", since).orderBy("createdAt", "desc").limit(1000).get();
const allLeads = leadSnap.docs.map((d) => d.data());
const leads = allLeads.filter((d) => !isCall(d) && !isInternal(d));
probe("leads", allLeads[0]);
console.log(`  Leads in window: ${allLeads.length} raw -> ${leads.length} real web form leads\n`);

// ---------- [1] last-touch by campaign ------------------------------------
console.log("[1] LAST-TOUCH attribution (what Ads sees, roughly)");
const byCampaign = {};
for (const l of leads) {
  const a = l.attribution ?? {};
  const key = a.utmCampaign
    ? `campaign ${a.utmCampaign}`
    : a.gclid ? "paid (gclid, no utm)"
    : /google\./i.test(a.referrer ?? "") ? "google organic"
    : a.utmSource ? `${a.utmSource}/${a.utmMedium ?? "?"}`
    : a.referrer ? "referral" : "direct";
  (byCampaign[key] ??= []).push(l);
}
for (const [k, ls] of Object.entries(byCampaign).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${k.padEnd(34)} ${String(ls.length).padStart(3)}   ${ls.slice(0, 4).map((l) => l.leadRef).join(", ")}${ls.length > 4 ? ", ..." : ""}`);
}

// ---------- [2] first-touch vs last-touch ---------------------------------
console.log("\n[2] FIRST-TOUCH vs last-touch on lead docs");
const sampleAttr = leads.find((l) => l.attribution)?.attribution;
const ftFields = sampleAttr
  ? Object.keys(sampleAttr).filter((k) => /first/i.test(k))
  : [];
if (!ftFields.length) {
  console.log("  No first-touch fields found on lead.attribution (keys: " +
    (sampleAttr ? Object.keys(sampleAttr).join(", ") : "none") + ")");
  console.log("  -> first-touch divergence not measurable from lead docs alone.");
} else {
  console.log(`  First-touch fields present: ${ftFields.join(", ")}`);
  let divergent = 0;
  for (const l of leads) {
    const a = l.attribution ?? {};
    const ft = a.firstTouch ?? a.firstTouchUtm ?? null;
    const ftCampaign = ft?.utmCampaign ?? a.firstTouchCampaign;
    if (ftCampaign && ftCampaign !== a.utmCampaign) {
      divergent++;
      console.log(`    ${l.leadRef}: first ${ftCampaign} -> last ${a.utmCampaign ?? "(unpaid)"}`);
    }
  }
  if (!divergent) console.log("  No leads with a first-touch campaign different from last-touch.");
}

// ---------- [3] estimate captures -> later leads --------------------------
console.log("\n[3] ESTIMATE CAPTURES -> later leads (email join; captures = Route Price Checker = S1 landing)");
let captures = [];
try {
  // captures can precede the lead window — look back further
  const capSince = new Date(since.getTime() - 30 * 864e5);
  const capSnap = await db.collection("estimate_captures")
    .where("createdAt", ">=", capSince).orderBy("createdAt", "desc").limit(1000).get();
  captures = capSnap.docs.map((d) => d.data());
  probe("estimate_captures", captures[0]);
} catch (err) {
  console.log("  Could not query estimate_captures:", err.message);
}
if (captures.length) {
  const capByEmail = new Map();
  for (const c of captures) {
    const e = email(c);
    if (e && !capByEmail.has(e)) capByEmail.set(e, c);
  }
  console.log(`  Captures: ${captures.length} (${capByEmail.size} unique emails, window extended 30d back)`);
  let converted = 0;
  for (const l of leads) {
    const e = email(l);
    const c = e && capByEmail.get(e);
    if (!c) continue;
    const cd = dateOf(c), ld = dateOf(l);
    if (cd && ld && cd <= ld) {
      converted++;
      const src = c.attribution?.utmCampaign ? `campaign ${c.attribution.utmCampaign}` : (c.attribution?.utmSource ?? c.utmSource ?? "attr unknown");
      console.log(`    ${l.leadRef}  captured ${days1(ld - cd)}d earlier  (capture source: ${src})`);
    }
  }
  console.log(`  Capture->lead conversions in window: ${converted}` +
    (converted ? "" : "   (0 — either the loop is young or researchers aren't returning yet)"));
} else {
  console.log("  No captures found in window.");
}

// ---------- [4] site_events probe (session-level S1 traffic) --------------
console.log("\n[4] site_events probe (S1 sessions that didn't convert yet)");
try {
  const s = await db.collection("site_events").orderBy("__name__").limit(3).get();
  const docs = s.docs.map((d) => d.data());
  probe("site_events", docs[0]);
  // find a usable timestamp field, then count recent events by name + campaign
  const tsField = docs[0]?.ts ? "ts" : docs[0]?.createdAt ? "createdAt" : docs[0]?.timestamp ? "timestamp" : null;
  if (!tsField) {
    console.log("  No recognizable timestamp field — skipping counts. If leads and site_events share a session/anonymous id, a session join is the v2 of this script.");
  } else {
    const evSnap = await db.collection("site_events")
      .where(tsField, ">=", since).limit(5000).get();
    const evs = evSnap.docs.map((d) => d.data());
    const byEvent = {};
    for (const e of evs) {
      // schema confirmed 8/10 via probe: event name = `type`,
      // campaign = `attr.campaignId` (same shape as estimate_captures.attr)
      const name = e.type ?? e.event ?? e.name ?? "?";
      const camp = e.attr?.campaignId ?? e.attr?.utm_campaign ?? "(none)";
      const k = `${name} | ${camp}`;
      byEvent[k] = (byEvent[k] ?? 0) + 1;
    }
    console.log(`  ${evs.length} events in window${evs.length === 5000 ? " (LIMIT HIT — counts are a floor)" : ""}; by event | campaign:`);
    for (const [k, n] of Object.entries(byEvent).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
      console.log(`    ${k.padEnd(48)} ${n}`);
    }
    // CORRECTION (8/10, second look): WEB leads DO carry a join key —
    // attribution.visitorId (alv_vid) matches site_events.vid. The earlier
    // "no join key" claim came from probing a CALL lead (different writer,
    // different shape). Section [5] below does the real join.
  }
} catch (err) {
  console.log("  Could not read site_events:", err.message);
}

// ---------- [5] retroactive session join: vid -> prior touches ------------
// For each web lead with attribution.visitorId, pull that visitor's full
// site_events history and reconstruct which campaigns touched them BEFORE
// the session that converted. This works on EXISTING data (site_events
// attr capture began 2026-07-28) — no schema change needed.
console.log("\n[5] SESSION HISTORY per lead (site_events.vid = lead.attribution.visitorId)");
try {
  const withVid = leads.filter((l) => l.attribution?.visitorId);
  console.log(`  Leads carrying a visitorId: ${withVid.length} of ${leads.length}`);
  let assisted = 0, multiTouch = 0, checked = 0;
  for (const l of withVid) {
    const vid = l.attribution.visitorId;
    const ld = dateOf(l);
    if (!ld) continue;
    // equality-only query (no composite index needed); time-filter client-side
    const evSnap = await db.collection("site_events")
      .where("vid", "==", vid).limit(300).get();
    checked++;
    const prior = evSnap.docs.map((d) => d.data())
      .filter((e) => {
        const t = e.ts?.toDate?.() ?? (e.ts ? new Date(e.ts) : null);
        return t && t < ld;
      });
    const campaigns = [...new Set(prior.map((e) => e.attr?.campaignId).filter(Boolean))];
    const sessions = new Set(prior.map((e) => e.sid).filter(Boolean)).size;
    const last = l.attribution?.utmCampaign ?? null;
    const earlierOther = campaigns.filter((c) => c !== last);
    if (sessions > 1) multiTouch++;
    if (earlierOther.length) {
      assisted++;
      console.log(`    ${l.leadRef}  last=${last ?? "(unpaid)"}  prior sessions=${sessions}  earlier campaign(s)=${earlierOther.join(",")}`);
    }
  }
  console.log(`  Checked ${checked} leads: ${multiTouch} converted on a return visit (2+ sessions), ` +
    `${assisted} had a PRIOR paid campaign different from their last touch.`);
  console.log("  (History only reaches back to 2026-07-28 when attr capture began — counts are floors.)");
} catch (err) {
  console.log("  Session join failed:", err.message);
}

console.log(`
HOW TO READ THIS
  - [1] is the baseline: leads whose LAST touch was each campaign.
  - [3] is S1's hidden yield: every capture->lead pair is a lead that S1
    (via the price checker) started and something else finished.
  - S1's true cost per influenced lead ~= S1 30d spend / (direct S1 leads
    + capture->lead conversions + first-touch divergent leads).
  - Decision rule agreed 8/10: near $110 -> S1 keeps $60/day. Above ~$250
    even with assists -> cut to $40, give S5 $20 as next Monday's lever.
`);
process.exit(0);
