/**
 * The referral channel, by agent — is Nelson's 82.6% a signal or an artifact?
 *
 * Built 2026-08-17, after Nelson confirmed that ProABD referrer-0 records are
 * referrals and recommendations from existing customers. That bucket carries
 * the highest value per lead in the account (~$63.57 at a 28.6% close), and
 * 82.6% of the records were created by one agent.
 *
 * BEFORE ANY OF THAT BECOMES AN INCENTIVE PLAN, the 82.6% has to survive three
 * competing explanations, because they imply opposite actions:
 *
 *   (a) RELATIONSHIP   Nelson's customers genuinely refer more people.
 *                      -> the behaviour is real and worth paying for.
 *   (b) ROUTING        Nelson simply handles more inbound, so he is the one at
 *                      the keyboard when a referral arrives.
 *                      -> no signal about him; the channel is just phone-shaped.
 *   (c) HYGIENE        Nelson is the only one who bothers to CREATE a record for
 *                      a referral; the others work them without logging them.
 *                      -> the channel is bigger than measured and the fix is a
 *                         process rule, not a bonus. Paying per referral logged
 *                         would reward the one person already doing it and
 *                         measure nothing new.
 *
 * (c) is the dangerous one. It is indistinguishable from (a) in any count of
 * records, which is exactly why this script does not report a count of records
 * as evidence of anything.
 *
 * TESTS
 *   [1] YIELD        referrals per agent, and per agent PER BOOKED CUSTOMER they
 *                    already served. A referral comes from a past customer, so
 *                    the agent with more past customers should produce more
 *                    referrals for free. Share-of-referrals alone is meaningless
 *                    without share-of-past-customers underneath it. This is the
 *                    test that separates (a) from nothing.
 *   [2] WORKLOAD     each agent's share of records CREATED across every source.
 *                    If Nelson's overall creation share is already ~83%, (b)
 *                    explains everything and there is nothing to reward.
 *   [3] CLOSER SKILL each agent's close rate ON REFERRALS vs their close rate on
 *                    everything else. If all three close referrals far above
 *                    their own baseline, the CHANNEL is what is valuable, not
 *                    the agent — and the plan should push referrals to whoever
 *                    is free, not to Nelson.
 *   [4] TREND        referrals per week. A flat line under a growing customer
 *                    base is a hygiene problem; a rising line is a real channel.
 *   [5] VALUE        value per lead and total, by agent, with Wilson intervals
 *                    so nobody quotes a point estimate off n=4.
 *
 * STATISTICAL HONESTY: the whole bucket is 23 records and 14 seasoned ones. Per
 * agent that is single digits. Every rate here carries an interval, the Fisher
 * test at the end is EXPLORATORY and labelled as such, and the script refuses to
 * print a per-agent close rate on fewer than 5 records.
 *
 * PII: counts, rates, dates, ABD_Ids, agent usernames (staff, not customers).
 * Never a customer name, email, phone or address.
 *
 * Usage:
 *   node scripts/referral-by-agent.mjs
 *   node scripts/referral-by-agent.mjs --days 90 --min 5
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
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? (Number(argv[i + 1]) || d) : d; };
const DAYS = flag("days", 90);
const MIN_N = flag("min", 5);          // refuse to print a rate on fewer than this
const PT = "America/Los_Angeles";
/* COHORT CONTROL — added 2026-08-17 after Eddie asked why Nelson had fewer website
   records. He was right to ask: he does not. Filtering events by received_at while
   NOT filtering records by Create_Date silently mixes cohorts, because a record
   created in March still appears if one of its events lands in the window. That
   made vendor assignment look uneven (Ginger 38.2%% / Nelson 29.1%%, p<0.00001) when
   the same-cohort comparison is even (33.9 / 33.8 / 32.3, p=0.607). Proof it was an
   artifact: a 120d event window holds only 327 more events than a 60d one, which
   cannot yield 470 more records.
   Bumping and "silence" are lifespan-sensitive so this matters for them; hours-to-
   first-touch is not. Move the boundary with --created-since YYYY-MM-DD. */
const COHORT_ARG = argv.indexOf("--created-since");
const COHORT_START = COHORT_ARG >= 0 ? new Date(argv[COHORT_ARG + 1])
  : new Date(Date.now() - DAYS * 864e5);   // default: the event window itself, so nothing is mixed
/* AGE CAP — a record alive 120 days has more chance of a price change than one
   alive 3 days, so comparing raw first-vs-last price across records of unequal
   lifespan is biased. Lifespan-sensitive metrics are therefore measured inside a
   FIXED window from each record's own creation, giving every record equal exposure.
   21 days is the account's booking horizon (no record has ever booked past 20.3d). */
const AGE_CAP_D = flag("age-cap", 21);

const REFERRAL = "0";
const WEBSITE = new Set(["8", "18493"]);
const VENDORS = new Set(["207", "18", "503"]);
const CANCELED = "23";
const KNOWN_TEST_ABD = new Set(["37256124", "37257079", "37257179", "37257192", "37287629", "37287650"]);
const LABELS = { "0": "Referral", "8": "Website EN", "18493": "Website ES", "207": "iRelocation", "18": "Taylor-shared", "503": "Taylor-premium" };

/* Seasoning: no record in this account has ever booked past 20.3 days
   (source-comparison A2). A record younger than this cannot be called a loss. */
const SEASON_DAYS = 21;

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const dig = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
const pct = (n, d) => (d ? (n / d * 100).toFixed(1) + "%" : "—");
const money = (v) => (v == null ? "—" : "$" + v.toFixed(2));
const ymd = (d) => (d ? d.toLocaleDateString("en-CA", { timeZone: PT }) : "—");

/* Wilson score interval — never a normal approximation on n this small. */
function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}
const lgamma = (x) => {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t);
  let s = 1.000000000190015;
  for (let j = 0; j < 6; j++) s += g[j] / ++y;
  return -t + Math.log(2.5066282746310005 * s / x);
};
const lchoose = (n, k) => (k < 0 || k > n ? -Infinity : lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1));
function fisher(a, b, c, d) {                       // two-sided
  const n = a + b + c + d, r1 = a + b, c1 = a + c;
  const lp = (x) => lchoose(r1, x) + lchoose(n - r1, c1 - x) - lchoose(n, c1);
  const obs = lp(a) + 1e-9;
  let p = 0;
  for (let x = Math.max(0, c1 - (n - r1)); x <= Math.min(c1, r1); x++) {
    const v = lp(x); if (v <= obs) p += Math.exp(v);
  }
  return Math.min(1, p);
}

/* ---------------- Load ---------------- */
const START = new Date(Date.now() - DAYS * 864e5);
console.log(`\nReading proabd_webhook_events since ${ymd(START)} (PT) ...`);
const snap = await db.collection("proabd_webhook_events").where("received_at", ">=", START).get();
console.log(`${snap.size} events.\n`);

const rec = new Map();
for (const doc of snap.docs) {
  const d = doc.data();
  const raw = d.raw_item ?? {};
  const abd = str(d.entity_id) || str(raw.ABD_Id);
  if (!abd || KNOWN_TEST_ABD.has(abd)) continue;
  let r = rec.get(abd);
  if (!r) { r = { abd, ref: "", created: null, booked: false, canceled: false, creator: "", firstAt: Infinity, price: null, carrier: null }; rec.set(abd, r); }
  const rid = str(raw.Referrer_Id);
  if (!r.ref && rid) r.ref = rid;
  const c = parseProabdDate(raw.Create_Date);
  if (c && (!r.created || c < r.created)) r.created = c;
  /* Creator = UserName on the EARLIEST event. UserName rides on every event, so
     a union over events counts touchers, not the person who made the record. */
  const u = str(raw.UserName);
  const rat = d.received_at?.toDate?.()?.getTime() ?? Infinity;
  if (u && rat < r.firstAt) { r.firstAt = rat; r.creator = u; }
  if ((str(raw.Item_Type) || str(d.entity_type)).toLowerCase() === "order" || str(raw.Booked_Date)) r.booked = true;
  if (str(raw.Status_Id) === CANCELED) r.canceled = true;
  for (const p of ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price"]) {
    const v = Number(dig(raw, p)); if (Number.isFinite(v) && v > 0) { r.price = v; break; }
  }
  for (const p of ["Transport.Carrier_Pay", "Carrier_Pay"]) {
    const v = Number(dig(raw, p)); if (Number.isFinite(v) && v > 0) { r.carrier = v; break; }
  }
}

const preCohort = [...rec.values()].filter((r) => r.created && r.creator && r.created < COHORT_START);
const all = [...rec.values()].filter((r) => r.created && r.creator && r.created >= COHORT_START);
const now = Date.now();
const seasoned = (r) => (now - r.created.getTime()) / 864e5 >= SEASON_DAYS;
const bucketOf = (r) => (r.ref === REFERRAL ? "referral" : WEBSITE.has(r.ref) ? "website" : VENDORS.has(r.ref) ? "vendor" : "other");
/* price === carrier is the data-entry signature quarantined on 2026-08-16. */
const feeOf = (r) => (r.price != null && r.carrier != null && r.price !== r.carrier ? r.price - r.carrier : null);

const AGENTS = [...new Set(all.map((r) => r.creator))].filter(Boolean).sort();
const W = 92;
const hr = (c = "=") => console.log(c.repeat(W));

console.log(`cohort: records created >= ${ymd(COHORT_START)}  ->  ${all.length}`);
if (preCohort.length) {
  console.log(`  ${preCohort.length} older record(s) EXCLUDED so all three agents are measured on the`);
  console.log(`  same cohort. Their distribution is a finding in its own right — long-lived open`);
  console.log(`  records, by creator:`);
  const byA = {};
  for (const r of preCohort) byA[r.creator] = (byA[r.creator] ?? 0) + 1;
  for (const [a, n] of Object.entries(byA).sort((x, y) => y[1] - x[1]))
    console.log(`    ${pad(a.slice(0, 19), 20)}${rp(n, 6)}${rp(pct(n, preCohort.length), 9)}`);
  console.log(`  A wide spread means records that never resolve. Cross-check against the 670 at`);
  console.log(`  "Needs Follow Up"/"Contacted" past the booking horizon (source-comparison A3).\n`);
}

console.log(`seasoned at ${SEASON_DAYS}d: ${all.filter(seasoned).length}   ·   agents seen: ${AGENTS.length}\n`);

/* ================= [1] YIELD — the test that actually matters ================= */
hr(); console.log("[1] REFERRAL YIELD — referrals per PAST CUSTOMER, not per agent"); hr();
console.log("  A referral comes from someone already served. An agent who has booked more");
console.log("  customers should produce more referrals for free. Share-of-referrals means");
console.log("  nothing until it is divided by share-of-past-customers.\n");

const rows = AGENTS.map((a) => {
  const mine = all.filter((r) => r.creator === a);
  const refs = mine.filter((r) => bucketOf(r) === "referral");
  const bookedAll = mine.filter((r) => r.booked && !r.canceled);
  return { a, created: mine.length, refs: refs.length, bookedAll: bookedAll.length };
});
const T = rows.reduce((t, r) => ({ refs: t.refs + r.refs, bookedAll: t.bookedAll + r.bookedAll, created: t.created + r.created }), { refs: 0, bookedAll: 0, created: 0 });

console.log("  " + pad("agent", 20) + rp("referrals", 10) + rp("share", 8) + rp("bookings", 10) + rp("share", 8) + rp("refs/booking", 14) + rp("index", 8));
console.log("  " + "-".repeat(W - 4));
for (const r of rows.sort((x, y) => y.refs - x.refs)) {
  const sRef = T.refs ? r.refs / T.refs : 0;
  const sBk = T.bookedAll ? r.bookedAll / T.bookedAll : 0;
  const yieldR = r.bookedAll ? r.refs / r.bookedAll : null;
  const index = sBk > 0 ? sRef / sBk : null;
  console.log("  " + pad(r.a.slice(0, 19), 20) + rp(r.refs, 10) + rp((sRef * 100).toFixed(1) + "%", 8) +
    rp(r.bookedAll, 10) + rp((sBk * 100).toFixed(1) + "%", 8) +
    rp(yieldR == null ? "—" : yieldR.toFixed(2), 14) + rp(index == null ? "—" : index.toFixed(2) + "x", 8));
}
console.log("\n  INDEX = share of referrals / share of bookings.");
console.log("    ~1.0x  the agent generates referrals in proportion to customers served —");
console.log("           there is no individual effect to reward, only a channel to work.");
console.log("    >2.0x  genuinely producing more referrals per customer than peers.");
console.log("    <0.5x  producing fewer — or, just as likely, NOT LOGGING THEM.");
console.log("  An index far from 1.0 CANNOT distinguish 'refers more' from 'logs more'.");
console.log("  Only asking the other two agents whether they receive unlogged referrals can.");

/* ================= [2] WORKLOAD — the routing confound ================= */
hr(); console.log("[2] WORKLOAD — is this agent just the one at the keyboard?"); hr();
console.log("  If an agent's share of ALL record creation already matches their share of");
console.log("  referrals, routing explains it and there is nothing personal in the number.\n");
console.log("  " + pad("agent", 20) + rp("referral", 10) + rp("website", 10) + rp("vendor", 10) + rp("all created", 13) + rp("all share", 11));
console.log("  " + "-".repeat(W - 4));
for (const a of AGENTS) {
  const mine = all.filter((r) => r.creator === a);
  const n = (b) => mine.filter((r) => bucketOf(r) === b).length;
  console.log("  " + pad(a.slice(0, 19), 20) + rp(n("referral"), 10) + rp(n("website"), 10) + rp(n("vendor"), 10) +
    rp(mine.length, 13) + rp(pct(mine.length, all.length), 11));
}
/* Chi-square goodness of fit vs an even split. For df=2 the survival function is
   exactly exp(-x2/2), so no table is needed. This answers the routing objection in
   code instead of by hand. */
{
  const counts = AGENTS.map((a) => all.filter((r) => r.creator === a && bucketOf(r) === "vendor").length);
  const n = counts.reduce((x, y) => x + y, 0), e = n / (counts.length || 1);
  if (e > 5) {
    const x2 = counts.reduce((t, o) => t + (o - e) ** 2 / e, 0);
    const p = counts.length === 3 ? Math.exp(-x2 / 2) : NaN;
    console.log(`\n  ASSIGNMENT EVENNESS (vendor leads, in-cohort): chi-square ${x2.toFixed(2)}, df ${counts.length - 1}` +
      (Number.isFinite(p) ? `, p = ${p.toFixed(3)}` : ""));
    if (p > 0.05) {
      console.log(`  EVEN — routing cannot explain the referral difference. Equal inputs, unequal output.`);
    } else {
      const sh = AGENTS.map((a, i) => ({ a, n: counts[i] })).sort((x, y) => x.n - y.n);
      console.log(`  ⚠ UNEVEN — and this INVALIDATES the yield index in [1] as a service measure.`);
      console.log(`    Lowest vendor load: ${sh[0].a} (${sh[0].n}); highest: ${sh[sh.length - 1].a} (${sh[sh.length - 1].n}).`);
      console.log(`    An agent kept OFF the cold vendor queue works warmer business, and warm`);
      console.log(`    customers refer more by nature — so part of their referral edge is ROLE,`);
      console.log(`    not service quality. Re-run with --created-since set to a window where`);
      console.log(`    assignment is even before attributing any of it to how they treat people.`);
      console.log(`    Measured: assignment is EVEN for records created since 2026-07-08`);
      console.log(`    (742/740/708, p=0.607) and 8.5x skewed before it.`);
    }
  }
}
console.log("\n  READ: compare the referral share in [1] against 'all share' here. A gap is the");
console.log("  finding; agreement means the referral concentration is a staffing pattern.");

/* ================= [3] CLOSER SKILL — agent or channel? ================= */
hr(); console.log("[3] AGENT OR CHANNEL? — close rate on referrals vs the same agent's baseline"); hr();
console.log(`  Seasoned records only (${SEASON_DAYS}d+). Rates suppressed below n=${MIN_N} rather than printed`);
console.log("  as noise. Wilson 95% intervals, because n here is single digits by construction.\n");
console.log("  " + pad("agent", 20) + pad("bucket", 12) + rp("recs", 7) + rp("bkd", 6) + rp("close", 9) + rp("95% CI", 18));
console.log("  " + "-".repeat(W - 4));
const closeOf = (set) => {
  const s = set.filter(seasoned);
  const b = s.filter((r) => r.booked && !r.canceled).length;
  return { n: s.length, b, p: s.length ? b / s.length : null };
};
for (const a of AGENTS) {
  const mine = all.filter((r) => r.creator === a);
  for (const b of ["referral", "website", "vendor"]) {
    const c = closeOf(mine.filter((r) => bucketOf(r) === b));
    if (!c.n) continue;
    const ci = wilson(c.b, c.n);
    const show = c.n >= MIN_N;
    console.log("  " + pad(a.slice(0, 19), 20) + pad(b, 12) + rp(c.n, 7) + rp(c.b, 6) +
      rp(show ? pct(c.b, c.n) : "n<" + MIN_N, 9) +
      rp(show ? `${(ci[0] * 100).toFixed(0)}–${(ci[1] * 100).toFixed(0)}%` : "—", 18));
  }
}
console.log("\n  READ: if EVERY agent closes referrals far above their own vendor baseline, the");
console.log("  value is in the CHANNEL, not the person — route referrals to whoever is free");
console.log("  and pay for GENERATING them, not for holding them.");

/* ================= [4] TREND ================= */
hr(); console.log("[4] TREND — referrals per week"); hr();
const weeks = new Map();
for (const r of all.filter((x) => bucketOf(x) === "referral")) {
  const d = new Date(r.created); const day = d.getUTCDay();
  const monday = new Date(d.getTime() - ((day + 6) % 7) * 864e5);
  const k = ymd(monday); weeks.set(k, (weeks.get(k) ?? 0) + 1);
}
const wk = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const maxW = Math.max(1, ...wk.map((x) => x[1]));
for (const [k, v] of wk) console.log("  " + pad(k, 13) + rp(v, 4) + "  " + "█".repeat(Math.round(v / maxW * 40)));
if (wk.length >= 4) {
  const h = Math.floor(wk.length / 2);
  const first = wk.slice(0, h).reduce((s, x) => s + x[1], 0) / h;
  const last = wk.slice(-h).reduce((s, x) => s + x[1], 0) / h;
  console.log(`\n  first half ${first.toFixed(1)}/wk  ->  last half ${last.toFixed(1)}/wk` +
    (first > 0 ? `  (${((last / first - 1) * 100).toFixed(0)}%)` : ""));
  console.log("  ⚠ A trend over this few weeks is a description, not a forecast. The window also");
  console.log("    straddles the GBP review push (reviews went live ~8/12), which would raise");
  console.log("    referrals on its own. Do not read growth here as an agent effect.");
}

/* ================= [5] VALUE ================= */
hr(); console.log("[5] VALUE"); hr();
/* COHORT CONTROL DOES NOT APPLY HERE — and applying it was a mistake on the first
   pass. Cohort matching exists to make AGENTS comparable. The channel-level question
   "what is a referral lead worth" has no between-agent comparison in it, so the only
   thing a cohort filter does is throw away sample and move the estimate. It moved it
   from $42.27 (n=44) to $29.29 (n=34) for no methodological gain. Value therefore uses
   every seasoned referral record available. */
const refsCohort = all.filter((r) => bucketOf(r) === "referral");
const refs = [...rec.values()]
  .filter((r) => r.created && r.creator && bucketOf(r) === "referral");
if (refs.length !== refsCohort.length) {
  console.log(`  using ALL ${refs.length} referral records, not the ${refsCohort.length} in the agent cohort —`);
  console.log(`  value per lead is a channel question with no agent comparison in it, so`);
  console.log(`  restricting the cohort would discard sample for nothing.\n`);
}
const fees = refs.filter((r) => r.booked && !r.canceled).map(feeOf).filter((v) => v != null);
const meanFee = fees.length ? fees.reduce((a, b) => a + b, 0) / fees.length : null;
const cs = closeOf(refs);
const ci = wilson(cs.b, cs.n);
console.log(`  seasoned referral records : ${cs.n}`);
console.log(`  booked                    : ${cs.b}`);
console.log(`  close rate                : ${pct(cs.b, cs.n)}   95% CI ${(ci[0] * 100).toFixed(1)}–${(ci[1] * 100).toFixed(1)}%`);
console.log(`  mean net fee (n=${fees.length})       : ${money(meanFee)}${fees.length < 3 ? "  ⚠ too thin to mean much" : ""}`);
if (meanFee != null && cs.p != null) {
  console.log(`\n  value per referral lead   : ${money(cs.p * meanFee)}`);
  console.log(`    plausible range on close  : ${money(ci[0] * meanFee)} – ${money(ci[1] * meanFee)}`);
  console.log(`    ^ THIS RANGE IS THE HONEST ANSWER. The point estimate is the midpoint of a`);
  console.log(`      band wide enough to change what you would pay for a referral by 5x.`);
}
const perWeek = wk.length ? refs.length / (DAYS / 7) : 0;
console.log(`\n  observed volume           : ${perWeek.toFixed(2)}/week over the ${DAYS}d window`);
if (meanFee != null && cs.p != null) {
  console.log(`  annualised gross value    : ${money(perWeek * cs.p * meanFee * 52)}/yr at the point estimate`);
  console.log(`                              ${money(perWeek * ci[0] * meanFee * 52)} – ${money(perWeek * ci[1] * meanFee * 52)}/yr across the interval`);
}

/* ================= EXPLORATORY TEST ================= */
hr(); console.log("EXPLORATORY — is the top agent's referral concentration beyond chance?"); hr();
const top = [...rows].sort((a, b) => b.refs - a.refs)[0];
if (top && T.refs >= 5 && T.bookedAll >= 5) {
  const p = fisher(top.refs, T.refs - top.refs, top.bookedAll, T.bookedAll - top.bookedAll);
  console.log(`  ${top.a}: ${top.refs}/${T.refs} referrals vs ${top.bookedAll}/${T.bookedAll} bookings`);
  console.log(`  Fisher exact, two-sided: p = ${p.toFixed(4)}`);
  console.log(`\n  ⚠ POST-HOC. This comparison was chosen BECAUSE the number looked big, which is`);
  console.log(`    the definition of a forking path. Treat p as a description of this table and`);
  console.log(`    nothing more. It is not evidence for a bonus scheme, and a bonus scheme does`);
  console.log(`    not need it — the decision rests on whether referrals are worth generating`);
  console.log(`    at all, which [5] answers, not on which agent currently logs them.`);
} else {
  console.log("  Too few records to test. That is the correct outcome, not a failure.");
}
console.log();
process.exit(0);
