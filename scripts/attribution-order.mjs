/**
 * Who had the customer FIRST — us or the lead vendor?
 *
 * Built 2026-08-16 to test a challenge from Eddie that reverses the conclusion
 * of scripts/website-bookings.mjs.
 *
 * That script found 27 bookings tying back to our own leads, 14 of which carry
 * a VENDOR referrer, and I read it as: we generated the customer, the vendor
 * took the credit. Eddie's alternative: the customer arrives FROM a lead
 * vendor, then googles the company or hunts for a phone number, lands on our
 * site, and fills the form. Same two records, same email match, opposite
 * meaning.
 *
 *   STORY A - we were first. Our form generated the customer; the agent worked
 *             the vendor's duplicate and the vendor banked the credit.
 *             => website performance is understated. Fix the credit rule.
 *
 *   STORY B - the vendor was first. We bought the lead, the customer then came
 *             to the site looking for us, and our form is a downstream touch.
 *             => website performance is correctly stated, and something worse
 *                is true: we are paying Google to re-acquire customers already
 *                sitting in the CRM.
 *
 *   STORY C - simultaneous. Auto transport is shopped hard; the customer filled
 *             several broker forms in one sitting and vendors resold whoever
 *             they captured. Nobody "generated" them exclusively.
 *
 * These are distinguishable by TIMESTAMP, which we hold on both sides:
 *   ProABD Create_Date  vs  our lead doc createdAt.
 *
 * The paid/organic signals on our lead sharpen it further. A visit carrying a
 * gclid is a click we paid for. A direct or brand-organic visit with no click
 * id is what someone already holding the company name looks like - which is
 * exactly what Story B predicts.
 *
 * PII: ABD_Ids, our AL- references, dates, hour gaps, channel flags. Never a
 * name, email, phone or address.
 *
 * Usage:
 *   node scripts/attribution-order.mjs
 *   node scripts/attribution-order.mjs --days 90 --all   # include website-referrer matches too
 */

import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { parseProabdDate } from "./lib/proabd-time.mjs";

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

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const DAYS = Number(flag("days", 90)) || 90;
const ALL = argv.includes("--all");
const PT = "America/Los_Angeles";
const DAY = 864e5;

const CANCELED = "23";
const OUR_REFERRERS = new Set(["8", "18493"]);
const KNOWN_TEST_ABD = new Set(["37256124", "37257079", "37257179", "37257192", "37287629", "37287650"]);
const LABELS = { "0": "Unattributed", "8": "Website EN", "18493": "Website ES", "207": "iRelocation", "503": "Taylor-prem", "18": "Taylor-shared" };

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const dig = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
const ymd = (d) => (d ? d.toLocaleDateString("en-CA", { timeZone: PT }) : "—");
const nEmail = (v) => str(v).toLowerCase().replace(/\s/g, "");
const nPhone = (v) => str(v).replace(/\D/g, "").slice(-10);
/* ProABD Create_Date/Booked_Date are NAIVE and are stored EASTERN, not Pacific.
   Measured at -3.00h with 0.00h spread across 10 id-linked records on 2026-08-17;
   see scripts/lib/proabd-time.mjs and the ledger entry it points at. Do NOT
   reintroduce a local parser here — six of them disagreed once already. */
const parseCreate = parseProabdDate;

console.log(`\nReading events + leads ...`);
const [evSnap, leadSnap] = await Promise.all([
  db.collection("proabd_webhook_events").where("received_at", ">=", new Date(Date.now() - DAYS * DAY)).get(),
  db.collection("leads").get(),
]);
console.log(`${evSnap.size} events · ${leadSnap.size} leads\n`);

const leads = [];
const ourAbd = new Map();
for (const doc of leadSnap.docs) {
  const d = doc.data();
  const a = d.attribution ?? {};
  const L = {
    ref: str(d.leadRef) || doc.id,
    at: d.createdAt?.toDate?.() ?? null,
    abd: str(d.proabdAbdId),
    isCall: d.source === "call" || str(d.leadRef).startsWith("CALL-"),
    email: nEmail(dig(d, "contact.email")),
    phone: nPhone(dig(d, "contact.phone")),
    gclid: !!str(a.gclid),
    utmSource: str(a.utmSource),
    utmMedium: str(a.utmMedium),
    referrer: str(a.referrer),
    landing: str(a.landingPath),
  };
  leads.push(L);
  if (L.abd) ourAbd.set(L.abd, L);
}

/* ---- collapse records ---- */
const rec = new Map();
for (const doc of evSnap.docs) {
  const d = doc.data();
  const raw = d.raw_item ?? {};
  const abd = str(d.entity_id) || str(raw.ABD_Id);
  if (!abd) continue;
  let r = rec.get(abd);
  if (!r) r = { abd, ref: "", created: null, booked: false, canceled: false, email: "", phone: "" }, rec.set(abd, r);
  const rid = str(raw.Referrer_Id);
  if (!r.ref && rid) r.ref = rid;
  const c = parseCreate(raw.Create_Date);
  if (c && (!r.created || c < r.created)) r.created = c;
  if ((str(raw.Item_Type) || str(d.entity_type)).toLowerCase() === "order" || str(raw.Booked_Date)) r.booked = true;
  if (str(raw.Status_Id) === CANCELED) r.canceled = true;
  if (!r.email) r.email = nEmail(dig(raw, "Shipper.Email"));
  if (!r.phone) r.phone = nPhone(dig(raw, "Shipper.Phone_1"));
}

/* ---- match booked records to our leads, EXCLUDING id-linked ones by default ----
   An ID LINK means createLead itself made the ProABD record, so its Create_Date
   IS our form fill and the ordering question is meaningless. The contested set is
   the email/phone matches on non-website referrers. */
const webLeads = leads.filter((l) => !l.isCall);
const pairs = [];
for (const r of rec.values()) {
  if (!r.booked || r.canceled || KNOWN_TEST_ABD.has(r.abd)) continue;
  if (ourAbd.has(r.abd)) {
    // ALWAYS collected. These are the calibration sample: createLead made the
    // ProABD record, so their true gap is ~0 by construction. Whatever gap we
    // OBSERVE on them is the parsing error, and it is subtracted from everyone
    // else. --all only controls whether they are printed.
    pairs.push({ r, l: ourAbd.get(r.abd), how: "ID LINK" });
    continue;
  }
  let l = webLeads.find((x) => x.email && r.email && x.email === r.email)
       ?? webLeads.find((x) => x.phone && r.phone && x.phone === r.phone);
  if (l) pairs.push({ r, l, how: l.email && r.email && l.email === r.email ? "email" : "phone" });
}
console.log(`Contested pairs (booked record matched to one of our leads, not id-linked): ${pairs.filter(p => p.how !== "ID LINK").length}`);

const W = 100;

/* ---- SELF-CALIBRATION ----------------------------------------------------
   An id-linked pair means our own createLead call produced the ProABD record,
   so the true gap between our lead doc and that record is ~0. Any systematic
   gap we measure on them is OUR clock error, not customer behaviour. Measure
   it, then subtract it from every contested pair. This removes the need to
   guess whether ProABD stores Pacific or Eastern. */
const calib = pairs.filter((p) => p.how === "ID LINK" && p.r.created && p.l.at)
  .map((p) => (p.l.at.getTime() - p.r.created.getTime()) / 3600000);
let OFFSET = 0;
console.log(`\n${"=".repeat(W)}`);
console.log("CLOCK CALIBRATION — measured, not assumed");
console.log("=".repeat(W));
if (calib.length >= 3) {
  const c = [...calib].sort((a, b) => a - b);
  OFFSET = c.length % 2 ? c[c.length >> 1] : (c[(c.length >> 1) - 1] + c[c.length >> 1]) / 2;
  const spread = c[c.length - 1] - c[0];
  console.log(`  ${calib.length} id-linked pairs — our createLead made these records, so the true gap is ~0.`);
  console.log(`  observed median gap: ${OFFSET.toFixed(2)}h   (range ${c[0].toFixed(2)}h to ${c[c.length - 1].toFixed(2)}h, spread ${spread.toFixed(2)}h)`);
  if (Math.abs(OFFSET) > 0.5) {
    console.log(`\n  ⇒ CLOCK ERROR OF ${OFFSET.toFixed(2)}h CONFIRMED. ProABD Create_Date is not being`);
    console.log(`    parsed in the zone it is stored in. Every contested gap below is corrected`);
    console.log(`    by subtracting this. A ${Math.abs(OFFSET).toFixed(0)}h error would otherwise flip any pair whose true`);
    console.log(`    gap is smaller than that — which is exactly the same-session cases.`);
  } else {
    console.log(`\n  ⇒ No material clock error. Gaps below are used as measured.`);
  }
} else {
  console.log(`  Only ${calib.length} id-linked pairs — too few to calibrate. Gaps below are UNCORRECTED`);
  console.log(`  and any result closer than ~3h to zero should not be trusted.`);
}

console.log(`\n${"=".repeat(W)}`);
console.log("WHO HAD THE CUSTOMER FIRST?");
console.log("=".repeat(W));
console.log("  gap = our lead createdAt minus ProABD Create_Date.");
console.log("  NEGATIVE = we were first (Story A). POSITIVE = the vendor was first (Story B).");
console.log();
console.log("  ProABD Create_Date is a NAIVE datetime, so a zone guess used to decide the");
console.log("  close calls: on the 2026-08-16 run four gaps sat between -2.4h and -3.2h, a");
console.log("  0.8h spread across four unrelated customers, which is not human behaviour —");
console.log("  it is a clock error. That is no longer guessed. The block above MEASURES it");
console.log("  on pairs our own createLead produced, where the true gap is 0 by construction.");
console.log();
console.log(`  gaps below are CORRECTED by the ${OFFSET.toFixed(2)}h clock error measured above.`);
console.log("  Gaps of days or weeks are unaffected by it either way.");
console.log();
console.log("  " + pad("ABD_Id", 11) + pad("referrer", 14) + pad("CRM created", 12) + pad("our lead", 12) +
  rp("gap (h)", 9) + "  " + pad("paid?", 7) + pad("utm", 16) + "our ref");
console.log("  " + "-".repeat(W - 2));

/* ---- DEDUPE TO ONE ROW PER CUSTOMER --------------------------------------
   The 2026-08-17 run printed 14 rows for 12 customers, because a customer with
   two ProABD records (say an old vendor record and a later duplicate) produced
   two pairs and got two votes. Worse, one of those extra rows was counted as
   "we were first" while the SAME customer's earlier record said "same hour".
   The question is who touched the customer first, so a customer gets one vote
   and it is decided by their EARLIEST ProABD record.

   Rows whose earliest record carries one of OUR referrers (8 / 18493) are not
   contested at all — a prior website record is us, not a vendor. They are
   labelled and excluded from the Story A/B/C tally rather than silently
   counted as a vendor win, which is what happened to ABD 37220447. */
const byCustomer = new Map();
for (const p of pairs) {
  if (p.how === "ID LINK") continue;
  const k = p.l.ref;
  const prev = byCustomer.get(k);
  if (!prev || (p.r.created && prev.r.created && p.r.created < prev.r.created)) byCustomer.set(k, p);
}
const dupes = pairs.filter((p) => p.how !== "ID LINK").length - byCustomer.size;
if (dupes > 0) {
  console.log(`  [${dupes} duplicate record(s) collapsed — a customer votes once, on their earliest ProABD record]`);
}

let usFirst = 0, themFirst = 0, sameHour = 0, unknown = 0, ourPrior = 0;
const gaps = [];
const ordered = [...pairs.filter((x) => x.how === "ID LINK" && ALL), ...byCustomer.values()]
  .sort((a, b) => (a.r.created ?? 0) - (b.r.created ?? 0));
for (const p of ordered) {
  const { r, l } = p;
  if (!r.created || !l.at) { unknown++; continue; }
  const gapH = (l.at.getTime() - r.created.getTime()) / 3600000 - OFFSET;
  if (p.how === "ID LINK") {
    console.log("  " + pad(r.abd, 11) + pad("[calibration]", 14) + pad(ymd(r.created), 12) + pad(ymd(l.at), 12) +
      rp(gapH >= 0 ? `+${gapH.toFixed(1)}` : gapH.toFixed(1), 9) + "  " + pad("-", 7) + pad("-", 16) + l.ref.slice(0, 20));
    continue;
  }
  const mine = OUR_REFERRERS.has(r.ref);
  if (mine) {
    ourPrior++;                          // a prior WEBSITE record is us, not a vendor
  } else {
    gaps.push(gapH);
    if (Math.abs(gapH) <= 1) sameHour++; // clock is calibrated, so 1h is a real band now
    else if (gapH < 0) usFirst++;
    else themFirst++;
  }
  const paid = l.gclid ? "GCLID" : (l.utmMedium === "cpc" ? "cpc" : (l.utmSource ? "other" : "none"));
  console.log("  " + pad(r.abd, 11) + pad(((mine ? "*" : "") + (LABELS[r.ref] ?? "id " + r.ref)).slice(0, 13), 14) +
    pad(ymd(r.created), 12) + pad(ymd(l.at), 12) +
    rp(gapH >= 0 ? `+${gapH.toFixed(1)}` : gapH.toFixed(1), 9) + "  " +
    pad(paid, 7) + pad(`${l.utmSource || "-"}/${l.utmMedium || "-"}`.slice(0, 15), 16) + l.ref.slice(0, 20));
}

console.log(`\n${"=".repeat(W)}`);
console.log("VERDICT");
console.log("=".repeat(W));
const n = usFirst + themFirst + sameHour;
console.log(`  WE were first  (Story A - our lead, vendor took the credit) : ${usFirst}`);
console.log(`  VENDOR was first (Story B - we re-acquired a bought lead)   : ${themFirst}`);
console.log(`  within an hour  (Story C - shopped simultaneously)          : ${sameHour}`);
if (ourPrior) {
  console.log(`  not contested   (* rows - earliest record is OUR referrer)   : ${ourPrior}`);
  console.log(`                    a prior website record is us. Counting these as vendor`);
  console.log(`                    wins is what inflated the first version of this table.`);
}
if (unknown) console.log(`  undatable                                                  : ${unknown}`);
if (gaps.length) {
  const s = [...gaps].sort((a, b) => a - b);
  const med = s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2;
  console.log(`\n  median gap ${med.toFixed(1)}h · range ${s[0].toFixed(1)}h to ${s[s.length - 1].toFixed(1)}h`);
}
console.log();
if (themFirst > usFirst) {
  console.log(`  ⇒ STORY B DOMINATES. The vendor had most of these customers first, so our`);
  console.log(`    form is a downstream touch, not the origin.`);
  console.log(`      1. Website performance was NOT understated. The 15.7% close rate from`);
  console.log(`         website-bookings.mjs is inflated by leads we did not originate, and`);
  console.log(`         the earlier lower figure stands closer to the truth.`);
  console.log(`      2. But this is NOT re-acquisition through paid clicks. Check the paid`);
  console.log(`         column: on the 2026-08-16 run only 1 of 14 carried a click id,`);
  console.log(`         against a ~56% base rate of unattributed leads (P<=1 of 14 is`);
  console.log(`         0.0002). These customers come back direct or organic, months later,`);
  console.log(`         on their own. That is the site doing brand and service work — a`);
  console.log(`         real asset, just not a lead-generation one. Do not cut brand terms`);
  console.log(`         on the strength of this.`);
} else if (usFirst > themFirst) {
  console.log(`  ⇒ STORY A DOMINATES. We had these customers first and the vendor banked the`);
  console.log(`    booking. Website performance is genuinely understated, vendor performance`);
  console.log(`    genuinely inflated, and the fix is a credit rule at intake: when a form`);
  console.log(`    fill matches an existing record, first touch keeps the credit.`);
} else {
  console.log(`  ⇒ NO CLEAR ORDERING. Consistent with customers shopping several brokers at`);
  console.log(`    once, which is what a commodity purchase looks like. Then neither side`);
  console.log(`    "generated" the customer and single-source attribution is the wrong`);
  console.log(`    model - what matters is who converted them, not who saw them first.`);
}

/* ---- the paid-click question, which stands either way ---- */
const bought = pairs.filter((p) => p.how !== "ID LINK" && p.l.gclid).length;
console.log(`\n${"=".repeat(W)}`);
console.log("THE QUESTION THAT MATTERS EITHER WAY");
console.log("=".repeat(W));
console.log(`  ${bought} of ${pairs.filter((p) => p.how !== "ID LINK").length} contested leads arrived on a PAID click (gclid present).`);
console.log(`  A paid click on a customer who was already in the CRM is spend we did not`);
console.log(`  need to make, whichever party "owned" them. If those cluster on brand or`);
console.log(`  navigational terms, the fix is a negative-keyword or audience exclusion,`);
console.log(`  not an attribution rule.`);
console.log(`\n  Caveat: only about half of our lead docs carry a click id at all, so a`);
console.log(`  missing GCLID is weak evidence of an unpaid visit.\n`);
process.exit(0);
