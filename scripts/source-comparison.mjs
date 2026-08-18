/**
 * Lead-source comparison — website vs every other source Ben pays for.
 *
 * v4, 2026-08-16. v2 fixed the field vocabulary; v3 fixed the ANALYSIS;
 * v4 fixes a FALSE BLOCKER that v1-v3 all propagated.
 *
 * THE v4 CORRECTION
 * -----------------
 * Every earlier version printed "fee per source needs the unmapped Transport
 * fields" and named it an open ask with the CRM vendor. That was never true.
 * price-integrity.mjs and compare-quote-prices.mjs have been reading
 * Transport.Price, Transport.Carrier_Pay and Transport.Deposit out of THIS
 * SAME COLLECTION since 8/05 — with no .select() at all. This script could not
 * see them because its own .select() never asked. An inherited caveat became a
 * blocker, the blocker became a vendor dependency, and the vendor dependency
 * became a reason the economics "could not start yet". None of it was real.
 * Lesson: a caveat you did not personally verify is a hypothesis, not a fact.
 *
 * So v4 computes NET broker fee = price − carrier pay, per source, and reports
 * revenue per lead and (given --cost) contribution per lead. Mean, not median:
 * a median times a count is the wrong way to build a total on a skewed
 * distribution. Vendor cost per lead is still genuinely absent — but it lives
 * in Ben's invoices, not in the CRM.
 *
 * WHAT v3 ADDS AND WHY
 * --------------------
 * 1. TWO DENOMINATORS, both printed, each with a declared use:
 *      Close%    = booked / all records          <- the AFFORDABILITY number
 *      Resolved% = booked / (booked + lost)      <- the QUALITY number
 *    They tell opposite stories on the v2 data (website 7.8% vs iRelocation
 *    3.7% on the first; 11.8% vs 11.3% — i.e. a tie — on the second), because
 *    the share of records left sitting in Active differs enormously by source
 *    (iRelocation 67%, website 33%). Which one is right depends on whether
 *    those Active records are alive or abandoned, so v3 measures that too.
 *    RULE (pre-registered, do not choose after seeing the number):
 *      - Ceiling / "what can we afford per lead" -> Close% (all records).
 *        We pay for every lead, including the ones nobody worked.
 *      - "Is our lead better than theirs" -> Resolved%, because disposition
 *        hygiene differs by source and contaminates the raw denominator.
 *
 * 2. ACTIVE STALENESS — median days since the last webhook touch on records
 *    still Active. This is the tiebreaker between the two denominators:
 *      stale Actives  -> they are dead, Close% is the honest read
 *      fresh Actives  -> they are in flight, Resolved% is the honest read
 *
 * 3. THE TWO TONY TAYLOR PRODUCTS ARE SEPARATED AND LABELLED. They are not
 *    one partner with two ids — per Ben/Eddie, one is a premium exclusive
 *    feed and one is a cheaper feed shared with other brokers. Averaging them
 *    prices a product that nobody sells. The grouped row is retained ONLY to
 *    reconcile against the proabd-volume route and is marked do-not-quote.
 *    NOTE: that route currently counts 503 as "Taylor" and ignores 18, so it
 *    has been under-reporting Taylor volume by roughly two thirds.
 *
 * 4. BUMP PROXIES — days-to-book and post-booking touch count, by source.
 *    Post-booking price increases ("bumping": quote under the eventual carrier
 *    cost to win the booking, raise it when the real cost lands) were measured
 *    on 2026-08-05: 25% of orders, clustering 4-7 days after booking, 90% of
 *    them on purchased/shared sources. Bumping does not make those bookings
 *    fake — none cancelled — but it means vendor close rates were produced
 *    under a pricing policy we banned on website leads on 2026-08-10. Any
 *    comparison spanning that date compares two POLICIES, not two sources.
 *    These two columns are churn proxies only; the money lives in
 *    price-integrity.mjs, which reads the Transport fee/deposit fields.
 *
 * Verified from --probe (unchanged from v2):
 *   - TWO website referrers: 8 "Website" and 18493 "Website Spanish".
 *   - raw_item.Item_Type is better populated than entity_type.
 *   - Create_Date is on 100% of events, so records are dated by real creation.
 *
 * Usage (from autoline-logistics-web; needs FIREBASE_PROJECT_ID + ADC):
 *   node scripts/source-comparison.mjs
 *   node scripts/source-comparison.mjs --seasoned 14    # maturity window (default 14d)
 *   node scripts/source-comparison.mjs --include-legacy # add pre-Jul-8 records (biased)
 *   node scripts/source-comparison.mjs --probe          # re-print field vocabulary
 *   node scripts/source-comparison.mjs --audit          # diagnostics that can overturn the conclusions
 *   node scripts/source-comparison.mjs --cost 207=8.5,18=4,503=12,web=78
 *                                                       # acquisition cost per lead -> contribution per lead
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

const args = process.argv.slice(2);
const PROBE = args.includes("--probe");
const AUDIT = args.includes("--audit");
const INCLUDE_LEGACY = args.includes("--include-legacy");
const sIdx = args.indexOf("--seasoned");
const SEASONED_DAYS = sIdx >= 0 ? Number(args[sIdx + 1]) || 14 : 14;

const EVENTS_START = new Date("2026-07-08T00:00:00-07:00");
const CANCELED_ORDER_STATUS_ID = "23";
const LOST_STATUS_IDS = new Set(["5", "6", "12", "13", "25", "2581"]);

/** Website price-lock policy went live the evening of 2026-08-10. Records
 *  created before it were quoted under the old (bumpable) regime. */
const PRICE_LOCK_DATE = new Date("2026-08-10T18:00:00-07:00");

/** createLead went live 2026-07-14 8:01 PM PT (commit 537250b). Website leads
 *  created before this were entered by hand, so they carry NO proabdAbdId link
 *  even when the agent correctly tagged them referrer 8. Use the MECHANISM date,
 *  not the date the data happens to start — getting this wrong once already
 *  inflated a failure rate by 4x. */
const INTEGRATION_LIVE = new Date("2026-07-14T20:01:00-07:00");

/** The affordability ceiling this measurement governs. */
const MEDIAN_BOOKED_FEE = 245;      // src/lib/admin/targets.ts basis
const ASSUMED_CLOSE_RATE = 0.10;    // the assumption under the $25 ceiling
const CEILING_MIN_BOOKINGS = 12;    // pre-registered: below this, do not move the ceiling

/** Verified from --probe. Both website ids are OURS. */
const OUR_REFERRERS = new Set(["8", "18493"]);

/** TEST LEADS ARE IN THE PRODUCTION DATA and have been counted as real website
 *  leads in every version of this script. The lead-doc field census found
 *  attribution.utmSource="test" and utmTerm="testkeyword" live in `leads`, and
 *  ABD_Id 37257192 — the createLead ACCEPTANCE TEST from 2026-07-14, named in
 *  claude/proabd-createlead-integration-notes.md — is sitting in the cohort.
 *  compare-quote-prices.mjs has filtered these since it was written; this script
 *  never did. Website close rate is the smallest denominator in the account, so
 *  a handful of fakes moves it. */
const KNOWN_TEST_ABD = new Set(["37256124", "37257079", "37257179", "37257192", "37287629", "37287650"]);
const TEST_RE = /\btest(ing|keyword)?\b|\bfake\b|\bdummy\b/i;
const KEEP_TESTS = args.includes("--keep-tests");

/** Two Tony Taylor products, NOT one partner with two ids.
 *  Set from Ben/Eddie's account of what is bought; the observed pattern is
 *  consistent with it (the shared feed runs ~2x the volume at ~half the close
 *  rate, which is the signature of a lead resold to several brokers).
 *  If these are backwards, fix them HERE — nothing else needs to change. */
const LABELS = {
  "8":     "Website — English",
  "18493": "Website — Spanish",
  "207":   "iRelocation Auto 6 (purchased)",
  "503":   "Taylor — premium/exclusive",
  "18":    "Taylor — cheap/SHARED",
  "0":     "Not Selected",
};
const TAYLOR = new Set(["18", "503"]);
/** Sources believed to be resold to competing brokers — close rate is divided
 *  by however many brokers got the same lead, which is not a quality signal. */
const SHARED_FEEDS = new Set(["18", "207"]);

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const DAY = 864e5;

/** Money paths — IDENTICAL to price-integrity.mjs and compare-quote-prices.mjs,
 *  deliberately. Two scripts computing "the fee" from different key lists is how
 *  a project ends up with two different truths. */
const PRICE_PATHS = ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price", "Total_Tariff", "Tariff"];
const DEPOSIT_PATHS = ["Transport.Deposit", "Deposit"];
const CARRIER_PATHS = ["Transport.Carrier_Pay", "Carrier_Pay"];
const dig = (o, path) => path.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
function pickNum(raw, paths) {
  for (const p of paths) {
    const v = dig(raw, p);
    const n = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** --cost 207=8.50,18=4,503=12,web=78  → acquisition cost per lead by source.
 *  "web" covers both website referrer ids. Without these, Q2b (does the website
 *  BEAT a vendor) is not computable — only Q2a (is it above break-even). */
const COST = new Map();
const cIdx = process.argv.indexOf("--cost");
if (cIdx >= 0) {
  for (const pair of String(process.argv[cIdx + 1] ?? "").split(",")) {
    const [k, v] = pair.split("=");
    const n = Number(v);
    if (k && Number.isFinite(n)) {
      if (k.trim().toLowerCase() === "web") { COST.set("8", n); COST.set("18493", n); }
      else COST.set(k.trim(), n);
    }
  }
}

/** Dates print in PACIFIC, never UTC. toISOString() on an evening PT timestamp
 *  renders tomorrow's date — that exact bug mislabelled an 8/10 analysis as
 *  8/11 once already (claude/price-integrity-findings.md). */
const ymd = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

/** ProABD sends naive local datetimes; treat as Pacific (same as import-orders.mjs). */
/* ProABD Create_Date/Booked_Date are NAIVE and are stored EASTERN, not Pacific.
   Measured at -3.00h with 0.00h spread across 10 id-linked records on 2026-08-17;
   see scripts/lib/proabd-time.mjs and the ledger entry it points at. Do NOT
   reintroduce a local parser here — six of them disagreed once already. */
const parseCreate = parseProabdDate;

/** Conventional median — averages the middle pair on even n.
 *  (A floor-index shortcut produced a false "fee parity" headline on 8/10.
 *  Discrete-percentile shortcuts are banned in this codebase; see
 *  claude/price-integrity-findings.md.) */
function median(xs) {
  const v = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Linear-interpolation quantile (type 7), the conventional definition.
 *  Nearest-rank shortcuts are banned here for the same reason floor-index
 *  medians are: they silently misreport at small n. */
function quantile(xs, q) {
  const v = xs.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const h = (v.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return v[lo] + (h - lo) * (v[hi] - v[lo]);
}

/** Wilson score interval — correct at the small counts we actually have.
 *  A normal-approximation interval on 4/51 is nonsense. */
function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** Fisher's exact test, two-sided, in log space (n runs to ~1300, so a plain
 *  comb() overflows). Used instead of eyeballing whether two Wilson intervals
 *  overlap — overlapping intervals do NOT imply "no difference", and that
 *  exact error has already been caught once in this project by an audit. */
const LG = [0, 0];
function lgamma(n) { // ln(n!) for integer n, memoised
  if (LG[n] !== undefined) return LG[n];
  let v = LG[LG.length - 1];
  for (let i = LG.length; i <= n; i++) { v += Math.log(i); LG[i] = v; }
  return LG[n];
}
function fisherExact(a, b, c, d) {
  const n = a + b + c + d, r1 = a + b, c1 = a + c;
  const lp = (x) => lgamma(r1) - lgamma(x) - lgamma(r1 - x)
    + lgamma(n - r1) - lgamma(c1 - x) - lgamma(n - r1 - c1 + x)
    - (lgamma(n) - lgamma(c1) - lgamma(n - c1));
  const obs = lp(a);
  let p = 0;
  for (let x = Math.max(0, c1 - (n - r1)); x <= Math.min(r1, c1); x++) {
    const v = lp(x);
    if (v <= obs + 1e-9) p += Math.exp(v);
  }
  return Math.min(1, p);
}

// NO .select(). v1-v3 used one, and that is exactly why this script spent four
// versions claiming "fee per source needs the unmapped Transport fields" — the
// fields were arriving the whole time; our own query hid them. price-integrity.mjs
// and compare-quote-prices.mjs read Transport.Price / Transport.Carrier_Pay /
// Transport.Deposit from THIS collection with no select at all.
console.log(`\nReading proabd_webhook_events since ${ymd(EVENTS_START)} (full payload) ...`);
const snap = await db
  .collection("proabd_webhook_events")
  .where("received_at", ">=", EVENTS_START)
  .get();
console.log(`${snap.size} events.\n`);

if (PROBE) {
  const refs = new Map(), types = new Map();
  for (const doc of snap.docs) {
    const raw = doc.data().raw_item ?? {};
    const k = `${str(raw.Referrer_Id) || "?"} | ${str(raw.Referrer) || "(no label)"}`;
    refs.set(k, (refs.get(k) ?? 0) + 1);
    const t = str(raw.Item_Type) || "(none)";
    types.set(t, (types.get(t) ?? 0) + 1);
  }
  console.log("=== Referrer_Id | Referrer ===");
  [...refs.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(6)}  ${k}`));
  console.log("\n=== Item_Type ===");
  [...types.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(6)}  ${k}`));
  process.exit(0);
}

/* ---------------- Collapse events into records ---------------- */
const rec = new Map();
let unparseableDates = 0;
for (const doc of snap.docs) {
  const d = doc.data();
  const raw = d.raw_item ?? {};
  const abd = str(d.entity_id) || str(raw.ABD_Id);
  if (!abd) continue;
  let r = rec.get(abd);
  if (!r) {
    r = {
      abd, created: null, bookedAt: null, ref: "", refLabel: "",
      booked: false, canceled: false, lastStatus: "", lastStatusLabel: "", lastAt: null,
      touches: 0, postBookTouches: 0, refsSeen: new Set(),
      price: null, carrierPay: null, deposit: null, moneyAt: 0,
    };
    rec.set(abd, r);
  }
  r.touches++;

  const created = parseCreate(raw.Create_Date);
  if (created && (!r.created || created < r.created)) r.created = created;
  if (!created && str(raw.Create_Date)) unparseableDates++;

  const bookedAt = parseCreate(raw.Booked_Date);
  if (bookedAt && (!r.bookedAt || bookedAt < r.bookedAt)) r.bookedAt = bookedAt;

  const rid = str(raw.Referrer_Id);
  if (rid) r.refsSeen.add(rid);
  if (!r.ref && rid) { r.ref = rid; r.refLabel = str(raw.Referrer); }

  // Stage: Item_Type is the better-populated field; entity_type and Booked_Date corroborate.
  const stage = (str(raw.Item_Type) || str(d.entity_type)).toLowerCase();
  if (stage === "order" || str(raw.Booked_Date)) r.booked = true;

  const at = d.received_at?.toDate?.() ?? null;
  const sid = str(raw.Status_Id);
  if (sid && (!r.lastAt || (at && at >= r.lastAt))) { r.lastStatus = sid; r.lastStatusLabel = str(raw.Status); r.lastAt = at ?? r.lastAt; }
  if (sid === CANCELED_ORDER_STATUS_ID) r.canceled = true;

  // LATEST priced event wins — same convention as compare-quote-prices.mjs.
  const px = pickNum(raw, PRICE_PATHS);
  const t = at?.getTime() ?? 0;
  if (px != null && t >= r.moneyAt) {
    r.moneyAt = t;
    r.price = px;
    r.carrierPay = pickNum(raw, CARRIER_PATHS);
    r.deposit = pickNum(raw, DEPOSIT_PATHS);
  }
}
// Second pass for post-booking touches (needs each record's bookedAt settled first).
for (const doc of snap.docs) {
  const d = doc.data();
  const abd = str(d.entity_id) || str(d.raw_item?.ABD_Id);
  const r = abd && rec.get(abd);
  if (!r || !r.bookedAt) continue;
  const at = d.received_at?.toDate?.() ?? null;
  if (at && at > r.bookedAt) r.postBookTouches++;
}

/* ---------------- Population ---------------- */
const now = Date.now();
// (test exclusion is applied after the leads join below — see EXCLUDE_TESTS)
const cutoff = new Date(now - SEASONED_DAYS * DAY);
const all = [...rec.values()];
const legacy = all.filter((r) => r.created && r.created < EVENTS_START);
const inWindow = all.filter((r) =>
  r.created && r.created <= cutoff && (INCLUDE_LEGACY || r.created >= EVENTS_START));

/* ---------------- Sanity check + TEST-LEAD EXCLUSION ---------------- */
const leadSnap = await db.collection("leads")
  .select("proabdAbdId", "leadRef", "attribution.utmSource", "attribution.utmTerm",
          "attribution.utmCampaign", "attribution.locale").get();
const ourAbd = new Set();
const testAbd = new Set(KNOWN_TEST_ABD);
const localeOf = new Map();
for (const doc of leadSnap.docs) {
  const d = doc.data();
  const v = str(d.proabdAbdId);
  if (!v) continue;
  ourAbd.add(v);
  const a = d.attribution ?? {};
  const loc = str(a.locale);
  if (loc) localeOf.set(v, loc);
  if (TEST_RE.test(str(a.utmSource)) || TEST_RE.test(str(a.utmTerm)) ||
      TEST_RE.test(str(a.utmCampaign)) || TEST_RE.test(str(d.leadRef))) testAbd.add(v);
}
let matched = 0, underOurs = 0;
const underOther = new Map();
for (const r of all) {
  if (!ourAbd.has(r.abd)) continue;
  matched++;
  if (OUR_REFERRERS.has(r.ref)) underOurs++;
  else underOther.set(r.ref || "(none)", (underOther.get(r.ref || "(none)") ?? 0) + 1);
}

/* ---------------- Drop test leads from the cohort ---------------- */
const testHits = inWindow.filter((r) => testAbd.has(r.abd));
if (testHits.length && !KEEP_TESTS) {
  const byRef = new Map();
  for (const r of testHits) byRef.set(r.ref, (byRef.get(r.ref) ?? 0) + 1);
  for (let i = inWindow.length - 1; i >= 0; i--) if (testAbd.has(inWindow[i].abd)) inWindow.splice(i, 1);
  console.log(`\n⚠ EXCLUDED ${testHits.length} TEST record(s) from the cohort: ` +
    [...byRef.entries()].map(([k, n]) => `${LABELS[k] ?? "id " + k} ${n}`).join(", "));
  console.log(`  Detected via attribution.utmSource/utmTerm/utmCampaign/leadRef matching`);
  console.log(`  ${TEST_RE} plus the acceptance-test ABD_Ids named in the integration notes.`);
  console.log(`  Every earlier version of this script counted these as real leads.`);
  console.log(`  Re-run with --keep-tests to reproduce the old (contaminated) numbers.`);
} else if (!testHits.length) {
  console.log(`\n✓ No test records found in the cohort (checked utm fields, leadRef, and the`);
  console.log(`  6 acceptance-test ABD_Ids from claude/proabd-createlead-integration-notes.md).`);
}

/* ---------------- Aggregate ---------------- */
function bucket(records) {
  const a = {
    records: 0, booked: 0, canceled: 0, lost: 0, active: 0,
    staleDays: [], daysToBook: [], postBook: [],
    netFees: [], grossPrices: [], bookedWithPrice: 0, bookedWithCarrier: 0, feeUnknown: 0,
  };
  for (const r of records) {
    a.records++;
    if (r.booked && !r.canceled) {
      a.booked++;
      if (r.bookedAt && r.created) a.daysToBook.push((r.bookedAt - r.created) / DAY);
      if (r.bookedAt) a.postBook.push(r.postBookTouches);
      // NET broker fee = price - carrier pay. This is the multiplicand the
      // economics need; gross price is not. Deposit is a fallback proxy only.
      if (r.price != null) { a.bookedWithPrice++; a.grossPrices.push(r.price); }
      if (r.price != null && r.carrierPay != null) {
        a.bookedWithCarrier++;
        // DATA-QUALITY QUARANTINE. carrier pay EXACTLY equal to price is a
        // data-entry signature, not a zero-margin load: the broker fee was never
        // entered so carrier pay took the full price. Verified 2026-08-16 on
        // three Taylor-premium orders — round numbers, exact ties, empty deposit,
        // and all three DELIVERED. On every sound record deposit == net fee.
        // Keep the BOOKING (it happened); drop it from the FEE MEAN (unknown).
        if (r.price === r.carrierPay) a.feeUnknown++;
        else a.netFees.push(r.price - r.carrierPay);
      }
    } else if (r.canceled) a.canceled++;
    else if (LOST_STATUS_IDS.has(r.lastStatus)) a.lost++;
    else {
      a.active++;
      if (r.lastAt) a.staleDays.push((now - r.lastAt.getTime()) / DAY);
    }
  }
  a.resolved = a.booked + a.lost;
  return a;
}
const bySrc = new Map();
for (const r of inWindow) {
  const key = r.ref || "(none)";
  if (!bySrc.has(key)) bySrc.set(key, []);
  bySrc.get(key).push(r);
}

const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
const pct = (n, d) => (d ? (n / d * 100).toFixed(1) + "%" : "—");
const ci = (k, n) => { if (!n) return "—"; const [lo, hi] = wilson(k, n); return `${(lo * 100).toFixed(1)}-${(hi * 100).toFixed(1)}`; };
const num = (v, dp = 1) => (v === null ? "—" : v.toFixed(dp));
const dur = (v) => (v === null ? "—" : v.toFixed(1) + "d");
const nameOf = (id) => `${LABELS[id] ?? "id " + id}${SHARED_FEEDS.has(id) ? " *" : ""}`;

console.log(`Records created ${INCLUDE_LEGACY ? "(any date)" : "on/after 2026-07-08"} and seasoned >= ${SEASONED_DAYS}d (created on/before ${ymd(cutoff)})`);
console.log(`${inWindow.length} of ${all.length} records qualify.${legacy.length ? `  ${legacy.length} pre-Jul-8 records ${INCLUDE_LEGACY ? "INCLUDED (biased — see header)" : "excluded"}.` : ""}`);
if (unparseableDates) console.log(`⚠ ${unparseableDates} events had an unparseable Create_Date.`);

const W = 88;
const t1head = pad("Source", 30) + rp("Recs", 6) + rp("Bkd", 5) + rp("Close%", 8) + rp("95% CI", 13) + rp("Reslv%", 8) + rp("Lost", 6) + rp("Actv", 6) + rp("Cxl", 5);
const t1 = (label, a) =>
  pad(label.slice(0, 29), 30) + rp(a.records, 6) + rp(a.booked, 5) + rp(pct(a.booked, a.records), 8) +
  rp(ci(a.booked, a.records), 13) + rp(pct(a.booked, a.resolved), 8) + rp(a.lost, 6) + rp(a.active, 6) + rp(a.canceled, 5);

console.log(`\n=== OUTCOMES ===  Close% = booked/all (affordability).  Reslv% = booked/(booked+lost) (quality).`);
console.log(t1head);
console.log("-".repeat(W));

const ourRecords = [], taylorRecords = [];
const sorted = [...bySrc.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [id, recs] of sorted) {
  console.log(t1(`${nameOf(id)} (${id})`, bucket(recs)));
  if (OUR_REFERRERS.has(id)) ourRecords.push(...recs);
  if (TAYLOR.has(id)) taylorRecords.push(...recs);
}
console.log("-".repeat(W));
const ourAgg = bucket(ourRecords);
if (ourRecords.length) console.log(t1("> WEBSITE — both languages", ourAgg));
if (taylorRecords.length) console.log(t1("  (Taylor blended — DO NOT QUOTE)", bucket(taylorRecords)));
console.log(t1("ALL SOURCES", bucket(inWindow)));
console.log(`  * = feed believed resold to competing brokers; its close rate is divided across brokers.`);
console.log(`  Taylor blended row reconciles against the proabd-volume route only. The two Taylor`);
console.log(`  products are priced and sold differently — never average them into one number.`);

/* ---------------- Table 2: hygiene + bump proxies ---------------- */
console.log(`\n=== PIPELINE HYGIENE & BUMP PROXIES ===`);
console.log(pad("Source", 30) + rp("Actv%", 8) + rp("ActvStale", 11) + rp("DaysToBook", 12) + rp("PostBkTouch", 13));
console.log("-".repeat(W));
const t2 = (label, a) =>
  pad(label.slice(0, 29), 30) + rp(pct(a.active, a.records), 8) +
  rp(dur(median(a.staleDays)), 11) + rp(dur(median(a.daysToBook)), 12) +
  rp(num(median(a.postBook), 0), 13);
for (const [id, recs] of sorted) console.log(t2(`${nameOf(id)} (${id})`, bucket(recs)));
console.log("-".repeat(W));
if (ourRecords.length) console.log(t2("> WEBSITE — both languages", ourAgg));
console.log(t2("ALL SOURCES", bucket(inWindow)));
console.log(`  ActvStale  = median days since the last webhook touch on records still Active.`);
console.log(`               HIGH means those records are abandoned, not in flight — read Close%.`);
console.log(`               LOW  means they are genuinely working — read Reslv%.`);
console.log(`  PostBkTouch= median webhook events after Booked_Date. A churn proxy for post-booking`);
console.log(`               price movement ("bumping"). Proxy only — the money is in price-integrity.mjs.`);

/* ---------------- Is any gap real? ---------------- */
console.log(`\n=== IS ANY GAP REAL? ===  Fisher exact, two-sided, on Close% (all-records).`);
const arms = [...bySrc.entries()]
  .filter(([id, recs]) => recs.length >= 30 && !OUR_REFERRERS.has(id))
  .map(([id, recs]) => ({ id, label: nameOf(id), ...bucket(recs) }));
if (ourRecords.length) arms.unshift({ id: "web", label: "WEBSITE (both)", ...ourAgg });
const tests = [];
for (let i = 0; i < arms.length; i++) {
  for (let j = i + 1; j < arms.length; j++) {
    const A = arms[i], B = arms[j];
    tests.push({ A, B, p: fisherExact(A.booked, A.records - A.booked, B.booked, B.records - B.booked) });
  }
}
// EVERY pair is tested, so a raw p must never be read as a verdict. Benjamini-Hochberg
// over the whole family; the raw p is printed only so the correction is auditable.
// (An earlier build tagged raw p<0.05 "REAL DIFFERENCE" and that reached the client.)
const m = tests.length;
const ranked = [...tests].sort((a, b) => a.p - b.p);
let maxRank = 0;
ranked.forEach((t, k) => { if (t.p <= ((k + 1) / m) * 0.05) maxRank = k + 1; });
ranked.forEach((t, k) => { t.survives = k < maxRank; t.thr = ((k + 1) / m) * 0.05; });
for (const t of ranked) {
  console.log(`  ${pad(t.A.label.slice(0, 26), 27)} vs ${pad(t.B.label.slice(0, 26), 27)}` +
    ` p=${t.p.toFixed(3)}  BH thr ${t.thr.toFixed(4)}  ${t.survives ? "SURVIVES CORRECTION" : "not separable"}`);
}
console.log(`  ${m} pairwise tests, none pre-specified. Benjamini-Hochberg, FDR 0.05.`);
if (!ranked.some((t) => t.survives)) {
  console.log(`  NOTHING survives correction. No source may be reported as beating another.`);
}

/* ---------------- Idle-pipeline flag ---------------- */
if (ourAgg.active) {
  const stale = median(ourAgg.staleDays);
  console.log(`\n── Our own pipeline ──`);
  console.log(`  ${ourAgg.active} of ${ourAgg.records} website records are still Active at ${SEASONED_DAYS}d+, median ${num(stale)}d since last touch.`);
  console.log(`  Sales capacity is not the constraint (agents wait on leads), so unresolved website`);
  console.log(`  records are a working-discipline item, not a staffing one — and every one of them`);
  console.log(`  sits in the denominator of the close rate that governs our budget ceiling.`);
}

/* ---------------- Policy-era split ---------------- */
const preLock = ourRecords.filter((r) => r.created < PRICE_LOCK_DATE);
const postLock = ourRecords.filter((r) => r.created >= PRICE_LOCK_DATE);
console.log(`\n── Policy era (website only) ──`);
console.log(`  Price lock live ${ymd(PRICE_LOCK_DATE)}. Seasoned website records before it: ${preLock.length}; after: ${postLock.length}.`);
if (postLock.length < 5) {
  console.log(`  The seasoned cohort is therefore almost entirely PRE-LOCK. Treat today's website close`);
  console.log(`  rate as the last clean measurement of the old pricing regime — we will not get another.`);
  console.log(`  Expect it to FALL post-lock: we stopped winning bookings with quotes below carrier cost.`);
  console.log(`  That drop is the policy working, NOT the lead source degrading. Pre-registered here so`);
  console.log(`  it cannot be misread later.`);
}

/* ---------------- ECONOMICS: net contribution, measured not assumed ---------------- */
console.log(`\n=== ECONOMICS — net broker fee = price − carrier pay ===`);
console.log(`  Gross price is NOT the multiplicand. Mean (not median) is correct for totals.`);
const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
const money = (v) => (v == null ? "—" : `$${v.toFixed(2)}`);
const econHead = pad("Source", 30) + rp("Bkd", 5) + rp("w/price", 9) + rp("w/carrier", 11) +
  rp("meanNet", 10) + rp("medNet", 9) + rp("rev/lead", 10) + rp("cost/lead", 11) + rp("contrib/lead", 14);
console.log(econHead);
console.log("-".repeat(econHead.length));
const econRow = (label, id, a) => {
  const mn = mean(a.netFees);
  const revPerLead = mn == null ? null : (a.booked / a.records) * mn;
  const c = id && COST.has(id) ? COST.get(id) : null;
  const contrib = revPerLead == null || c == null ? null : revPerLead - c;
  return pad(label.slice(0, 29), 30) + rp(a.booked, 5) + rp(`${a.bookedWithPrice}`, 9) +
    rp(`${a.bookedWithCarrier}`, 11) + rp(money(mn), 10) + rp(money(median(a.netFees)), 9) +
    rp(money(revPerLead), 10) + rp(money(c), 11) + rp(contrib == null ? "—" : money(contrib), 14);
};
for (const [id, recs] of sorted) console.log(econRow(nameOf(id), id, bucket(recs)));
console.log("-".repeat(econHead.length));
if (ourRecords.length) console.log(econRow("> WEBSITE — both languages", "8", ourAgg));
const allAgg = bucket(inWindow);
console.log(econRow("ALL SOURCES", null, allAgg));
if (allAgg.feeUnknown) {
  console.log(`  ⚠ ${allAgg.feeUnknown} booked order(s) have carrier pay EXACTLY equal to price (net fee $0) with`);
  console.log(`    no deposit recorded. Treated as FEE UNKNOWN and excluded from every fee mean;`);
  console.log(`    still counted as bookings. Inspect with: node scripts/inspect-records.mjs --zero-fee`);
}
const covPrice = allAgg.booked ? allAgg.bookedWithPrice / allAgg.booked : 0;
const covCarrier = allAgg.booked ? allAgg.bookedWithCarrier / allAgg.booked : 0;
console.log(`  coverage on booked records: price ${pct(allAgg.bookedWithPrice, allAgg.booked)}, carrier pay ${pct(allAgg.bookedWithCarrier, allAgg.booked)}`);
if (covCarrier < 0.8) {
  console.log(`  ⚠ carrier-pay coverage below 80% — every net-fee figure above is computed on a`);
  console.log(`    SUBSET of bookings and may not represent the rest. Treat as provisional and`);
  console.log(`    check whether the missing records differ systematically (route, source, agent).`);
}
/* Fee DISTRIBUTION. A mean below the median means low outliers are dragging it —
 * on a price-locked channel those are absorbed carrier overruns, i.e. the explicit
 * cost of the promise. The price-integrity work asked for this as a "reserve
 * consumption" line; here it is. */
console.log(`\n  fee distribution (net broker fee per booked order):`);
console.log(`  ` + pad("Source", 28) + rp("min", 10) + rp("p25", 10) + rp("p75", 10) + rp("max", 10) + rp("<$0", 6) + rp("<$100", 8) + "  skew");
for (const [id, recs] of sorted) {
  const a = bucket(recs);
  if (!a.netFees.length) continue;
  const mn = mean(a.netFees), md = median(a.netFees);
  const neg = a.netFees.filter((v) => v < 0).length;
  const low = a.netFees.filter((v) => v < 100).length;
  console.log(`  ` + pad(nameOf(id).slice(0, 27), 28) +
    rp(money(Math.min(...a.netFees)), 10) + rp(money(quantile(a.netFees, 0.25)), 10) +
    rp(money(quantile(a.netFees, 0.75)), 10) + rp(money(Math.max(...a.netFees)), 10) +
    rp(neg, 6) + rp(low, 8) + `  ${mn < md ? "LEFT — low outliers present" : "right"}`);
}
console.log(`  A LEFT-skewed fee distribution means some orders finished at an unusually low`);
console.log(`  fee. On website orders that is the price lock working as designed (we absorb`);
console.log(`  rather than bump). On a purchased feed it is not — investigate those orders.`);

if (!COST.size) {
  console.log(`\n  cost/lead is blank: pass --cost 207=8.50,18=4,503=12,web=78 to compute contribution.`);
  console.log(`  Without vendor cost per lead, Q2a (are we above break-even) is answerable and`);
  console.log(`  Q2b (do we BEAT a vendor) is not. Those numbers are Ben's invoices, not ProABD.`);
}

/* ---------------- Ceiling read ---------------- */
console.log(`\n── Affordability ceiling (src/lib/admin/targets.ts) ──`);
const [clo, chi] = wilson(ourAgg.booked, ourAgg.records);
const rate = ourAgg.records ? ourAgg.booked / ourAgg.records : 0;
const measuredNet = mean(ourAgg.netFees);
const BASIS = measuredNet ?? MEDIAN_BOOKED_FEE;
const fmt = (r) => `$${(BASIS * r).toFixed(2)}`;
if (measuredNet != null) {
  console.log(`  basis: $${measuredNet.toFixed(2)} MEASURED mean net broker fee (website, n=${ourAgg.bookedWithCarrier}) x close rate`);
  console.log(`  (the declared basis was $${MEDIAN_BOOKED_FEE} median GROSS fee — superseded by measurement)`);
} else
console.log(`  basis: $${MEDIAN_BOOKED_FEE} median booked broker fee x close rate  [NO measured net fee available]`);
console.log(`  assumed ${(ASSUMED_CLOSE_RATE * 100).toFixed(1)}%  -> ${fmt(ASSUMED_CLOSE_RATE)}   (the current $25 ceiling)`);
console.log(`  measured ${(rate * 100).toFixed(1)}% -> ${fmt(rate)}   on ${ourAgg.booked} bookings / ${ourAgg.records} records`);
console.log(`  95% CI ${(clo * 100).toFixed(1)}-${(chi * 100).toFixed(1)}% -> ${fmt(clo)} to ${fmt(chi)}`);
if (ourAgg.booked < CEILING_MIN_BOOKINGS) {
  console.log(`\n  VERDICT: HOLD the $25 ceiling. ${ourAgg.booked} bookings is below the pre-registered`);
  console.log(`  minimum of ${CEILING_MIN_BOOKINGS}, and the interval above spans a range too wide to govern a budget.`);
  console.log(`  Moving it on this sample would be picking a number, not measuring one.`);
} else {
  const excludes = ASSUMED_CLOSE_RATE < clo || ASSUMED_CLOSE_RATE > chi;
  console.log(`\n  VERDICT: ${excludes ? "ELIGIBLE TO MOVE" : "HOLD"} — the 95% CI ${excludes ? "excludes" : "still includes"} the assumed ${(ASSUMED_CLOSE_RATE * 100).toFixed(0)}%.`);
  if (excludes) console.log(`  Any change requires a ledger entry naming this cohort, its size, and Close% as the denominator.`);
}

/* ---------------- Locale from OUR lead docs, not the referrer id ---------------- */
if (localeOf.size) {
  const byLoc = new Map();
  for (const r of ourRecords) {
    // "(no attribution)" conflates two very different things, so split them:
    //   NO LEAD DOC  -> this ProABD record did not come from our form at all.
    //                   Someone set referrer 8 by hand. It does not belong in
    //                   the website denominator.
    //   NO ATTRIB    -> our form did create it, but the attribution block is
    //                   missing (ad blocker, direct nav, consent declined).
    //                   It belongs, we just cannot attribute the click.
    const k = localeOf.get(r.abd)
      || (ourAbd.has(r.abd) ? "(lead doc, no attrib)" : "(NO LEAD DOC — not our form?)");
    if (!byLoc.has(k)) byLoc.set(k, []);
    byLoc.get(k).push(r);
  }
  console.log(`\n── Website by LOCALE (attribution.locale on our own lead docs) ──`);
  console.log(`  Referrer 18493 marks leads that took the ES routing path. attribution.locale`);
  console.log(`  marks what language the visitor actually used. They are not the same thing.`);
  console.log(`  STATISTICS WARNING: on the 2026-08-16 data all 4 website bookings fell in the`);
  console.log(`  "en" row and none elsewhere, which looks decisive and is NOT. Fisher exact on`);
  console.log(`  with-attribution vs without gives p=0.117, and a run of 20 zeroes at the site`);
  console.log(`  average of 8.9% happens about 1 time in 6. Do not report this split as a`);
  console.log(`  finding until the booking count is far higher.`);
  console.log(`  ` + pad("locale", 20) + rp("Recs", 6) + rp("Bkd", 5) + rp("Close%", 9) + rp("meanNet", 10));
  for (const [k, recs] of [...byLoc.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const a = bucket(recs);
    const mn = a.netFees.length ? a.netFees.reduce((s2, v) => s2 + v, 0) / a.netFees.length : null;
    console.log(`  ` + pad(k.slice(0, 29), 30) + rp(a.records, 6) + rp(a.booked, 5) + rp(pct(a.booked, a.records), 9) +
      rp(mn == null ? "—" : `$${mn.toFixed(2)}`, 10));
  }

  /* ---- The denominator question, and the trap in it ---- */
  const noDoc = ourRecords.filter((r) => !ourAbd.has(r.abd));
  const hasDoc = ourRecords.filter((r) => ourAbd.has(r.abd));
  if (noDoc.length) {
    const hd = bucket(hasDoc), nd = bucket(noDoc);
    console.log(`\n  ── Which of these belong in the denominator? ──`);
    console.log(`  has a lead doc (verifiably our form) : ${hd.records} recs, ${hd.booked} booked = ${pct(hd.booked, hd.records)}`);
    console.log(`  NO lead doc                          : ${nd.records} recs, ${nd.booked} booked = ${pct(nd.booked, nd.records)}`);
    console.log(`\n  ⚠ FORKING-PATH WARNING. Every booking sits in one subgroup, so dropping ANY`);
    console.log(`    zero-booking subgroup raises the rate: 45 recs -> ${pct(4, 45)}, 36 -> ${pct(4, 36)}, 20 -> ${pct(4, 20)}.`);
    console.log(`    Choosing the denominator AFTER seeing that is the exact error this project`);
    console.log(`    has already made once. The rule must come first:`);
    console.log(`      affordability asks what we can pay for a lead OUR MARKETING GENERATED,`);
    console.log(`      so the denominator is leads we can tie to a form fill — IF the unlinked`);
    console.log(`      records are genuinely not ours. If they are ours with a broken link,`);
    console.log(`      excluding them overstates performance. So: go and look.`);
    const preI = noDoc.filter((r) => r.created < INTEGRATION_LIVE).length;
    console.log(`\n  Created BEFORE createLead went live (${ymd(INTEGRATION_LIVE)}): ${preI} of ${noDoc.length}`);
    if (preI === noDoc.length) {
      console.log(`  => ALL of them predate the integration. These are hand-keyed website leads`);
      console.log(`     from before the link existed — historical residue, same event that`);
      console.log(`     produced the referrer-0 bucket. They are genuinely ours, so KEEP them`);
      console.log(`     in the denominator and treat the whole pre-${ymd(INTEGRATION_LIVE)} window as a separate era.`);
    } else if (preI === 0) {
      console.log(`  => NONE predate the integration. Every one was created while the link was`);
      console.log(`     working and still has no lead doc — so they did NOT come from our form.`);
      console.log(`     Someone set referrer 8 by hand on leads from somewhere else. These do`);
      console.log(`     NOT belong in the website denominator, and referrer 8 is not a clean`);
      console.log(`     channel marker after all.`);
    } else {
      console.log(`  => MIXED: ${preI} pre-integration (residue, keep) and ${noDoc.length - preI} post (someone hand-set`);
      console.log(`     referrer 8 while the link was working — those do not belong). Split them.`);
    }
    console.log(`\n  The ${noDoc.length} record(s) to look up in ProABD (ABD_Id · created · referrer):`);
    noDoc.sort((a, b) => a.created - b.created).forEach((r) =>
      console.log(`    ${pad(r.abd, 12)} ${ymd(r.created)}  ${LABELS[r.ref] ?? "id " + r.ref}${r.created < INTEGRATION_LIVE ? "   (pre-integration)" : "   << POST-integration"}`));
  }
}

console.log("\n── Sanity check — BOTH DIRECTIONS ──");
console.log(`  A one-directional check was quoted as "Referrer_Id is a clean channel marker"`);
console.log(`  for a whole working day. It is not. A->B does not give you B->A.`);
console.log(`\n  [->] Do OUR leads land under referrer 8/18493?`);
console.log(`       our leads carrying a ProABD id : ${ourAbd.size}`);
console.log(`       of those, found in events      : ${matched}`);
console.log(`       labelled 8 or 18493            : ${underOurs}  ${matched ? `(${Math.round(underOurs / matched * 100)}%)` : ""}`);
{
  const hasDocN = ourRecords.filter((r) => ourAbd.has(r.abd)).length;
  console.log(`\n  [<-] Does referrer 8/18493 contain ONLY our leads?  << the converse, never tested before`);
  console.log(`       seasoned website records       : ${ourRecords.length}`);
  console.log(`       traceable to one of our leads  : ${hasDocN}  (${pct(hasDocN, ourRecords.length)})`);
  console.log(`       NOT traceable                  : ${ourRecords.length - hasDocN}  (${pct(ourRecords.length - hasDocN, ourRecords.length)})`);
  if (hasDocN < ourRecords.length) {
    console.log(`\n  ⇒ Referrer 8 is a clean marker in ONE direction only. Everything of ours`);
    console.log(`    lands there, but not everything there is ours. Any statement of the form`);
    console.log(`    "referrer 8 = our website channel" is wrong by ${pct(ourRecords.length - hasDocN, ourRecords.length)} of records.`);
  }
}
if (underOther.size) {
  console.log(`  ⚠ some of ours sit under other referrers:`);
  [...underOther.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`      ${rp(n, 5)}  ${LABELS[k] ?? "id " + k}`));
  console.log(`    If this is large, Referrer_Id is not a clean channel marker — check with Brian.`);
}

/* ---------------- --audit: the numbers that can overturn all of this ---------------- */
if (AUDIT) {
  console.log(`\n${"=".repeat(W)}`);
  console.log(`=== AUDIT MODE — diagnostics for the assumptions the conclusions rest on ===`);
  console.log(`${"=".repeat(W)}`);

  // A1. Maturity bias. If our records are systematically YOUNGER than a vendor's,
  //     they have had less time to book and our close rate is depressed by
  //     construction. Seasoning >=14d bounds this but does not remove it.
  console.log(`\n[A1] RECORD MATURITY BY SOURCE  (days from creation to now)`);
  console.log(`     If website records are younger than vendor records, our close rate is`);
  console.log(`     biased DOWN and the measured gap is understated (or reversed).`);
  console.log(`     ` + pad("Source", 30) + rp("n", 6) + rp("p10", 8) + rp("median", 9) + rp("p90", 8) + "   created p90..p10");
  const spans = [];
  for (const [id, recs] of sorted) {
    const ages = recs.map((r) => (now - r.created.getTime()) / DAY);
    const p10 = quantile(ages, 0.1), p50 = quantile(ages, 0.5), p90 = quantile(ages, 0.9);
    const dateAt = (age) => ymd(new Date(now - age * DAY)).slice(5);
    if (recs.length >= 30) spans.push({ id, lo: p10, hi: p90 });
    console.log(`     ` + pad(nameOf(id).slice(0, 29), 30) + rp(recs.length, 6) +
      rp(num(p10), 8) + rp(num(p50), 9) + rp(num(p90), 8) + `   ${dateAt(p90)} .. ${dateAt(p10)}`);
  }
  // Sources delivered in SEQUENTIAL windows cannot be compared to each other at all:
  // source is then perfectly confounded with calendar period, and no amount of extra
  // data collected the same way fixes it.
  const disjoint = [];
  for (let i = 0; i < spans.length; i++)
    for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i], b = spans[j];
      const overlap = Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
      const width = Math.min(a.hi - a.lo, b.hi - b.lo);
      if (overlap < 0.25 * width) disjoint.push(`${LABELS[a.id] ?? a.id} vs ${LABELS[b.id] ?? b.id}`);
    }
  if (disjoint.length) {
    console.log(`\n     *** CONFOUND: these source pairs barely share a delivery window, so`);
    console.log(`     *** SOURCE IS CONFOUNDED WITH CALENDAR PERIOD and they cannot be compared:`);
    disjoint.forEach((d) => console.log(`         ${d}`));
    console.log(`     *** More data collected the same way does NOT fix this. Only concurrent`);
    console.log(`     *** delivery, or a within-period design, makes these comparable.`);
  }

  // A2. THE SURVIVORSHIP CHECK. "Median days-to-book is 0.8d, therefore an 18-day-old
  //     Active record is dead" is a survivorship argument: it is computed only on
  //     records that DID book. The honest question is what share of bookings happen
  //     LATE. If a meaningful share book after day 14, Active records retain option
  //     value and the all-records denominator is too harsh.
  console.log(`\n[A2] DAYS-TO-BOOK DISTRIBUTION  (booked records only — this is survivorship)`);
  console.log(`     ` + pad("Source", 30) + rp("n", 5) + rp("p50", 7) + rp("p75", 7) + rp("p90", 7) + rp("max", 8) + rp(">14d", 10));
  const dtbRow = (label, a) => {
    if (!a.daysToBook.length) return;
    const late = a.daysToBook.filter((d) => d > 14).length;
    console.log(`     ` + pad(label.slice(0, 29), 30) + rp(a.daysToBook.length, 5) +
      rp(num(quantile(a.daysToBook, 0.5)), 7) + rp(num(quantile(a.daysToBook, 0.75)), 7) +
      rp(num(quantile(a.daysToBook, 0.9)), 7) + rp(num(Math.max(...a.daysToBook)), 8) +
      rp(`${late} (${pct(late, a.daysToBook.length)})`, 10));
  };
  for (const [id, recs] of sorted) dtbRow(nameOf(id), bucket(recs));
  dtbRow("ALL SOURCES", bucket(inWindow));
  console.log(`     VERDICT RULE: if ">14d" is near 0%, Active records really are dead and`);
  console.log(`     Close% is honest. If it is above ~10%, the Active bucket has real option`);
  console.log(`     value, BOTH denominators are wrong, and this needs a survival estimate.`);

  // A3. What is actually sitting in "Active"? If vendors dispose of leads with
  //     status codes absent from LOST_STATUS_IDS, their Active% is an artifact of
  //     OUR incomplete status map and the whole hygiene story collapses.
  console.log(`\n[A3] WHAT IS IN THE "ACTIVE" BUCKET  (last status of unresolved records)`);
  console.log(`     Any status here that MEANS lost but is missing from LOST_STATUS_IDS`);
  console.log(`     (currently ${[...LOST_STATUS_IDS].join(", ")}) invalidates the hygiene comparison.`);
  const actCensus = new Map();
  for (const r of inWindow) {
    if (r.canceled) continue;
    if (r.booked) continue;
    if (LOST_STATUS_IDS.has(r.lastStatus)) continue;
    const k = `${r.lastStatus || "(none)"} | ${r.lastStatusLabel || "(no label)"}`;
    if (!actCensus.has(k)) actCensus.set(k, { n: 0, bySrc: new Map() });
    const e = actCensus.get(k);
    e.n++;
    e.bySrc.set(r.ref, (e.bySrc.get(r.ref) ?? 0) + 1);
  }
  const totalActive = [...actCensus.values()].reduce((acc, e) => acc + e.n, 0);
  console.log(`     ` + pad("Status_Id | Status", 46) + rp("n", 6) + rp("share", 8) + "   most concentrated in");
  [...actCensus.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 25).forEach(([k, e]) => {
    const top = [...e.bySrc.entries()].sort((a, b) => b[1] - a[1])[0];
    console.log(`     ` + pad(k.slice(0, 45), 46) + rp(e.n, 6) + rp(pct(e.n, totalActive), 8) +
      `   ${top ? `${(LABELS[top[0]] ?? "id " + top[0]).slice(0, 26)} ${pct(top[1], e.n)}` : ""}`);
  });

  // A4. Referrer stability. r.ref takes the FIRST event's Referrer_Id, and Firestore
  //     does not guarantee chronological doc order. If any record carries more than
  //     one Referrer_Id, source assignment is arbitrary for that record.
  const conflicted = inWindow.filter((r) => r.refsSeen.size > 1);
  console.log(`\n[A4] REFERRER STABILITY`);
  console.log(`     records whose events disagree on Referrer_Id: ${conflicted.length} of ${inWindow.length} (${pct(conflicted.length, inWindow.length)})`);
  if (conflicted.length) {
    const pairs = new Map();
    for (const r of conflicted) {
      const k = [...r.refsSeen].sort().join(" <-> ");
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
    [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      .forEach(([k, n]) => console.log(`       ${rp(n, 5)}  ${k}`));
    console.log(`     Non-zero means source assignment is order-dependent — fix before quoting.`);
  }
  const noStatus = inWindow.filter((r) => !r.lastStatus).length;
  console.log(`     records with no Status_Id on any event: ${noStatus} (${pct(noStatus, inWindow.length)}) — these default to Active.`);

  // A5. Reproducibility.
  console.log(`\n[A5] REPRODUCIBILITY`);
  console.log(`     Cohort boundary is computed from the wall clock at run time`);
  console.log(`     (now = ${ymd(new Date(now))}, seasoning cutoff = ${ymd(cutoff)}).`);
  console.log(`     Re-running on a different day yields a different cohort. Pin the date`);
  console.log(`     before comparing two runs.`);
  console.log(`${"=".repeat(W)}`);
}

console.log("\n── Caveats governing use ──");
console.log("  · CORRECTED v4: the Transport money fields were NEVER unmapped. They arrive on");
console.log("    proabd_webhook_events.raw_item.Transport.* and always did; v1-v3 hid them with");
console.log("    their own .select(). No vendor request was ever needed for fee data.");
console.log("  · Vendor COST per lead is still missing, and it is not in ProABD at all — it is");
console.log("    Ben's invoices. Pass it with --cost. A shared feed at half the close rate can");
console.log("    still be the better buy at a quarter the price.");
console.log("  · Our channel is ~6 weeks old; vendors have years of process behind them.");
console.log("  · Shared feeds are sold to several brokers at once. Their close rate measures");
console.log("    our share of a contested lead, not the lead's quality. Do not compare a");
console.log("    shared feed to an exclusive one without pricing that in.");
console.log("  · Bump exposure by source lives in price-integrity.mjs and its 8/05 findings;");
console.log("    the churn columns here are a proxy and must not be quoted as a bump rate.\n");
process.exit(0);
