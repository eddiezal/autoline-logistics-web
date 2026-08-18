/**
 * Service quality by agent — measuring the three burn mechanisms.
 *
 * CONTEXT (2026-08-17). Ginger and Renee told Eddie directly that they cannot get
 * reviews because they are intentionally burning their customers. Named
 * mechanisms: bumping the price after booking, overpromising pickup dates, and
 * going dark after the deal is signed. Ben knows and wants it fixed.
 *
 * This script exists so the conversation runs on measurement rather than on
 * recollection. It is deliberately NOT an accusation engine: it prints the same
 * three metrics for every agent, with the team baseline beside them, and it names
 * what it cannot see.
 *
 * WHY THIS IS MEASURABLE AT ALL
 * -----------------------------
 * We receive EVERY webhook event per record, not just the latest state. So for
 * one ABD_Id we hold a time-ordered trajectory: what the price was when the
 * record appeared, what it became, and when each status moved. Bumping is not an
 * inference from a single snapshot — it is visible directly as a price that rose
 * after the record existed.
 *
 *   [1] BUMPING      first observed price vs last observed price per record.
 *                    Reported as: share of booked records whose price ROSE, and
 *                    the median rise. Decreases reported separately (absorbing
 *                    carrier cost is the opposite behaviour and worth crediting).
 *
 *   [2] PROMISE GAP  promised pickup/ship date vs the date the record actually
 *                    reached a picked-up/in-transit status. Field names are NOT
 *                    confirmed for this account, so the script PROBES candidate
 *                    paths and tells you which exist rather than assuming. If
 *                    none exist it says so and skips — it does not fabricate.
 *
 *   [3] GOING DARK   two proxies from event timing, both available today:
 *                      responsiveness = hours from record creation to the FIRST
 *                                       status movement
 *                      silence        = longest gap between consecutive status
 *                                       movements on records not yet resolved
 *                    A true first-contact timestamp is still an open ask with
 *                    Brian; until it lands these are proxies, and status movement
 *                    is a LOWER bound on neglect (an agent can call without
 *                    touching the record).
 *
 * CONFOUNDS, STATED UP FRONT
 *   · A price rise is not automatically a bump. Customers add vehicles, change
 *     routes, or disclose an inoperable car. Where spec fields exist the script
 *     reports rises on SAME-SPEC records separately; that column is the honest one.
 *   · Agents do not hold comparable mixes. Referral and website leads behave
 *     differently from a shared vendor feed, so every metric is also broken out
 *     by bucket. Compare like with like or not at all.
 *   · Creator is not always owner. UserName on the earliest event is who made the
 *     record; the person who worked it can differ. Both are reported.
 *   · n per agent is small. Rates carry Wilson intervals and are suppressed below
 *     --min. Two agents differing by a few records is not a finding.
 *
 * PII: counts, rates, hours, dollar deltas, ABD_Ids, staff usernames. Never a
 * customer name, email, phone, address, or a specific route tied to a record.
 *
 * Usage:
 *   node scripts/service-quality-by-agent.mjs
 *   node scripts/service-quality-by-agent.mjs --days 120 --min 8
 *   node scripts/service-quality-by-agent.mjs --probe     # field discovery only
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
const DAYS = flag("days", 120);
const MIN_N = flag("min", 6);
const PROBE_ONLY = argv.includes("--probe");
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
const PT = "America/Los_Angeles";

const CANCELED = "23";
const LOST_STATUS_IDS = new Set(["5", "6", "12", "13", "25", "2581"]);
const KNOWN_TEST_ABD = new Set(["37256124", "37257079", "37257179", "37257192", "37287629", "37287650"]);
const REFERRAL = "0", WEBSITE = new Set(["8", "18493"]), VENDORS = new Set(["207", "18", "503"]);

/* Copied verbatim from source-comparison.mjs so two scripts cannot compute two
   different "prices". If these ever change, change them in both. */
const PRICE_PATHS = ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price", "Total_Tariff", "Tariff"];
const CARRIER_PATHS = ["Transport.Carrier_Pay", "Carrier_Pay"];

/* UNCONFIRMED for this account — probed, never assumed. */
const PROMISE_DATE_PATHS = ["Transport.First_Available_Date", "Transport.Ship_Date", "Transport.Pickup_Date",
  "Transport.Estimated_Pickup_Date", "Transport.Available_Date", "First_Available_Date", "Ship_Date", "Pickup_Date"];
const ACTUAL_PICKUP_PATHS = ["Transport.Actual_Pickup_Date", "Transport.Picked_Up_Date", "Transport.Dispatch_Date",
  "Actual_Pickup_Date", "Picked_Up_Date", "Dispatch_Date"];
const SPEC_PATHS = ["Transport.Vehicles", "Transport.Vehicle_Count", "Transport.Origin_Zip", "Transport.Destination_Zip",
  "Transport.Trailer_Type", "Transport.Operable"];

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const dig = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const pick = (o, paths) => { for (const p of paths) { const v = dig(o, p); if (str(v)) return v; } return undefined; };
const num = (o, paths) => { for (const p of paths) { const v = Number(dig(o, p)); if (Number.isFinite(v) && v > 0) return v; } return null; };
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
const pct = (n, d) => (d ? (n / d * 100).toFixed(1) + "%" : "—");
const money = (v) => (v == null ? "—" : (v < 0 ? "-$" : "$") + Math.abs(v).toFixed(0));
const ymd = (d) => (d ? d.toLocaleDateString("en-CA", { timeZone: PT }) : "—");
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

/* ---------------- Load, preserving event order ---------------- */
const START = new Date(Date.now() - DAYS * 864e5);
console.log(`\nReading proabd_webhook_events since ${ymd(START)} (PT), full payload ...`);
const snap = await db.collection("proabd_webhook_events").where("received_at", ">=", START).get();
console.log(`${snap.size} events.\n`);

const rec = new Map();
const fieldHits = new Map();
for (const doc of snap.docs) {
  const d = doc.data();
  const raw = d.raw_item ?? {};
  const abd = str(d.entity_id) || str(raw.ABD_Id);
  if (!abd || KNOWN_TEST_ABD.has(abd)) continue;
  const at = d.received_at?.toDate?.()?.getTime() ?? null;
  if (at == null) continue;

  for (const p of [...PROMISE_DATE_PATHS, ...ACTUAL_PICKUP_PATHS, ...SPEC_PATHS]) {
    if (str(dig(raw, p))) fieldHits.set(p, (fieldHits.get(p) ?? 0) + 1);
  }

  let r = rec.get(abd);
  if (!r) { r = { abd, ref: "", created: null, creator: "", firstAt: Infinity, touchers: new Set(), events: [], booked: false, canceled: false }; rec.set(abd, r); }
  const rid = str(raw.Referrer_Id); if (!r.ref && rid) r.ref = rid;
  const c = parseProabdDate(raw.Create_Date); if (c && (!r.created || c < r.created)) r.created = c;
  const u = str(raw.UserName);
  if (u) { r.touchers.add(u); if (at < r.firstAt) { r.firstAt = at; r.creator = u; } }
  if ((str(raw.Item_Type) || str(d.entity_type)).toLowerCase() === "order" || str(raw.Booked_Date)) r.booked = true;
  if (str(raw.Status_Id) === CANCELED) r.canceled = true;
  r.events.push({
    at, status: str(raw.Status_Id), price: num(raw, PRICE_PATHS), carrier: num(raw, CARRIER_PATHS),
    promise: parseProabdDate(pick(raw, PROMISE_DATE_PATHS)), actual: parseProabdDate(pick(raw, ACTUAL_PICKUP_PATHS)),
    spec: SPEC_PATHS.map((p) => str(dig(raw, p))).join("|"),
  });
}
for (const r of rec.values()) r.events.sort((a, b) => a.at - b.at);

/* ---------------- Field probe ---------------- */
const W = 96, hr = (c = "=") => console.log(c.repeat(W));
hr(); console.log("[0] FIELD PROBE — what this account actually sends"); hr();
console.log("  Field names for pickup promises are NOT confirmed for this account. Probed, not assumed.\n");
const probe = (label, paths) => {
  const found = paths.filter((p) => fieldHits.has(p));
  console.log(`  ${pad(label, 22)}${found.length ? found.map((p) => `${p} (${fieldHits.get(p)})`).join(", ") : "NONE FOUND"}`);
  return found;
};
const promiseFields = probe("promised pickup", PROMISE_DATE_PATHS);
const actualFields = probe("actual pickup", ACTUAL_PICKUP_PATHS);
const specFields = probe("spec (for same-spec)", SPEC_PATHS);
if (!promiseFields.length || !actualFields.length) {
  console.log(`\n  ⚠ [2] PROMISE GAP CANNOT BE MEASURED from webhook payloads as they arrive today.`);
  console.log(`    That is a finding, not a failure: overpromising is currently UNFALSIFIABLE from`);
  console.log(`    our data, which is itself worth telling Brian. Run scripts/proabd-field-census.mjs`);
  console.log(`    to see the full key space before concluding the field does not exist under`);
  console.log(`    another name.`);
}
if (!specFields.length) console.log(`\n  ⚠ No spec fields — the same-spec bumping column will be unavailable.`);
if (PROBE_ONLY) { console.log(); process.exit(0); }

const preCohort = [...rec.values()].filter((r) => r.created && r.creator && r.created < COHORT_START);
const all = [...rec.values()].filter((r) => r.created && r.creator && r.created >= COHORT_START);
const AGENTS = [...new Set(all.map((r) => r.creator))].sort();
const bucketOf = (r) => (r.ref === REFERRAL ? "referral" : WEBSITE.has(r.ref) ? "website" : VENDORS.has(r.ref) ? "vendor" : "other");
const lastStatus = (r) => { for (let i = r.events.length - 1; i >= 0; i--) if (r.events[i].status) return r.events[i].status; return ""; };
const resolved = (r) => r.booked || LOST_STATUS_IDS.has(lastStatus(r)) || r.canceled;

console.log(`\n  cohort: records created >= ${ymd(COHORT_START)}  ->  ${all.length}`);
console.log(`  agents: ${AGENTS.length}   event window: ${DAYS}d\n`);
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


/* ================= [1] BUMPING ================= */
hr(); console.log("[1] BUMPING — did the price RISE after the record existed?"); hr();
console.log(`  Measured inside the first ${AGE_CAP_D} days of each record's life, so every record`);
console.log("  gets equal exposure. Raw first-vs-last across unequal lifespans is biased.");
console.log("  Price trajectory across events for one ABD_Id. A rise after booking is the");
console.log("  mechanism described. A FALL is the opposite behaviour — absorbing carrier cost");
console.log("  rather than passing it on — and is reported because it deserves credit.\n");

function bumpStats(set) {
  let rose = 0, fell = 0, flat = 0, sameSpecRose = 0, sameSpecN = 0;
  const rises = [];
  for (const r of set) {
    const cut = r.created.getTime() + AGE_CAP_D * 864e5;
    const priced = r.events.filter((e) => e.price != null && e.at <= cut);
    if (priced.length < 2) continue;
    const first = priced[0], last = priced[priced.length - 1];
    const d = last.price - first.price;
    const specStable = specFields.length ? first.spec === last.spec : null;
    if (specStable === true) { sameSpecN++; if (d > 0.5) sameSpecRose++; }
    if (d > 0.5) { rose++; rises.push(d); } else if (d < -0.5) fell++; else flat++;
  }
  return { n: rose + fell + flat, rose, fell, flat, medRise: med(rises), sameSpecRose, sameSpecN };
}
console.log("  " + pad("agent", 20) + pad("bucket", 10) + rp("n", 6) + rp("rose", 7) + rp("share", 8) + rp("95% CI", 15) + rp("med rise", 10) + rp("fell", 7) + rp("same-spec rose", 16));
console.log("  " + "-".repeat(W - 4));
const bumpRows = [];
for (const a of [...AGENTS, "**TEAM**"]) {
  for (const b of ["referral", "website", "vendor", "ALL"]) {
    const set = all.filter((r) => (a === "**TEAM**" || r.creator === a) && (b === "ALL" || bucketOf(r) === b));
    const s = bumpStats(set);
    if (!s.n) continue;
    if (b !== "ALL" && s.n < MIN_N) continue;
    const ci = wilson(s.rose, s.n);
    if (b === "ALL") bumpRows.push({ a, ...s });
    console.log("  " + pad(a.slice(0, 19), 20) + pad(b, 10) + rp(s.n, 6) + rp(s.rose, 7) +
      rp(s.n >= MIN_N ? pct(s.rose, s.n) : "n<" + MIN_N, 8) +
      rp(s.n >= MIN_N ? `${(ci[0] * 100).toFixed(0)}–${(ci[1] * 100).toFixed(0)}%` : "—", 15) +
      rp(money(s.medRise), 10) + rp(s.fell, 7) +
      rp(s.sameSpecN ? `${s.sameSpecRose}/${s.sameSpecN}` : "n/a", 16));
  }
}
console.log("\n  READ: compare each agent against **TEAM** on the ALL row, then check the bucket");
console.log("  rows — a vendor-heavy mix can drive a rise share on its own. The same-spec column");
console.log("  is the one that survives the 'customer changed the order' objection.");
if (!specFields.length) console.log("  ⚠ same-spec unavailable this run, so every rise below is only a CANDIDATE bump.");

/* ================= [2] PROMISE GAP ================= */
hr(); console.log("[2] PROMISE GAP — promised pickup vs actual"); hr();
if (promiseFields.length && actualFields.length) {
  console.log("  " + pad("agent", 20) + rp("n", 6) + rp("med gap (d)", 14) + rp("late >2d", 11) + rp("share", 9));
  console.log("  " + "-".repeat(W - 4));
  for (const a of [...AGENTS, "**TEAM**"]) {
    const set = all.filter((r) => a === "**TEAM**" || r.creator === a);
    const gaps = [];
    for (const r of set) {
      const p = r.events.find((e) => e.promise)?.promise;
      const act = [...r.events].reverse().find((e) => e.actual)?.actual;
      if (p && act) gaps.push((act.getTime() - p.getTime()) / 864e5);
    }
    if (gaps.length < MIN_N && a !== "**TEAM**") continue;
    const late = gaps.filter((g) => g > 2).length;
    console.log("  " + pad(a.slice(0, 19), 20) + rp(gaps.length, 6) +
      rp(med(gaps) == null ? "—" : med(gaps).toFixed(1), 14) + rp(late, 11) + rp(pct(late, gaps.length), 9));
  }
} else {
  console.log("  SKIPPED — the fields do not arrive. See [0].");
  console.log("  Do NOT substitute a proxy here. An overpromising claim with no promised-date field");
  console.log("  behind it is exactly the kind of unverified premise that has cost this project");
  console.log("  eight retracted findings. Ask Brian for the field, then re-run.");
}

/* ================= [3] GOING DARK ================= */
hr(); console.log("[3] GOING DARK — responsiveness and silence"); hr();
console.log("  responsiveness = hours from record creation to the FIRST status movement");
console.log("  silence        = longest gap (days) between status movements on UNRESOLVED records");
console.log("  Both are LOWER bounds on neglect: an agent can phone a customer without touching");
console.log("  the record, so these understate attention. A true first-contact timestamp is still");
console.log("  an open ask with Brian.\n");
console.log("  " + pad("agent", 20) + rp("recs", 7) + rp("med resp (h)", 14) + rp(">24h no touch", 15) + rp("share", 8) + rp("med silence (d)", 17));
console.log("  " + "-".repeat(W - 4));
for (const a of [...AGENTS, "**TEAM**"]) {
  const set = all.filter((r) => a === "**TEAM**" || r.creator === a);
  const resp = [], sil = [];
  let slow = 0, respN = 0;
  for (const r of set) {
    const moves = [];
    let prev = null;
    for (const e of r.events) { if (e.status && e.status !== prev) { moves.push(e.at); prev = e.status; } }
    if (moves.length >= 2) {
      const h = (moves[1] - moves[0]) / 3600000;
      resp.push(h); respN++; if (h > 24) slow++;
    }
    if (!resolved(r) && moves.length >= 2) {
      // Silence measured inside the age cap only, so a 120-day-old record cannot
      // out-score a 30-day-old one purely by having existed longer.
      const cut = r.created.getTime() + AGE_CAP_D * 864e5;
      const m = moves.filter((t) => t <= cut);
      if (m.length >= 2) {
        let g = 0; for (let i = 1; i < m.length; i++) g = Math.max(g, m[i] - m[i - 1]);
        g = Math.max(g, Math.min(Date.now(), cut) - m[m.length - 1]);
        sil.push(g / 864e5);
      }
    }
  }
  if (respN < MIN_N && a !== "**TEAM**") continue;
  console.log("  " + pad(a.slice(0, 19), 20) + rp(set.length, 7) +
    rp(med(resp) == null ? "—" : med(resp).toFixed(1), 14) + rp(slow, 15) + rp(pct(slow, respN), 8) +
    rp(med(sil) == null ? "—" : med(sil).toFixed(1), 17));
}

/* ================= [4] CANCELLATION — does burning show up as churn? =================
   THE PIVOTAL TEST, and it needs no new fields, no vendor ask and no referral data.
   Close rate flatters an agent who wins deals by overpromising and bumping, because
   the damage lands AFTER the booking. If burned customers cancel more, then:
     · the close-rate advantage Ginger and Renee hold over Nelson is partly fake, and
     · the "better service might cost bookings" risk that makes a referral bonus
       possibly net-negative shrinks or disappears.
   This is the number that decides whether the whole picture resolves. */
hr(); console.log("[4] CANCELLATION — the test that resolves the close-rate paradox"); hr();
console.log("  Nelson has the LOWEST close rate and the BEST referral yield. Either he is worse");
console.log("  at selling, or the others are booking deals that do not survive. Cancellations");
console.log("  separate those two readings, and the data is already here.\n");
console.log("  " + pad("agent", 20) + rp("booked", 9) + rp("canceled", 10) + rp("cancel rate", 14) + rp("95% CI", 16) + rp("net booked", 12));
console.log("  " + "-".repeat(W - 4));
const cancelRows = [];
for (const a of [...AGENTS, "**TEAM**"]) {
  const set = all.filter((r) => a === "**TEAM**" || r.creator === a);
  const everBooked = set.filter((r) => r.booked);
  const canc = everBooked.filter((r) => r.canceled).length;
  if (everBooked.length < MIN_N && a !== "**TEAM**") continue;
  const ci = wilson(canc, everBooked.length);
  cancelRows.push({ a, n: everBooked.length, canc });
  console.log("  " + pad(a.slice(0, 19), 20) + rp(everBooked.length, 9) + rp(canc, 10) +
    rp(pct(canc, everBooked.length), 14) +
    rp(`${(ci[0] * 100).toFixed(0)}–${(ci[1] * 100).toFixed(0)}%`, 16) +
    rp(everBooked.length - canc, 12));
}
console.log("\n  READ: if the agents with the higher close rates ALSO cancel more, their advantage");
console.log("  is bookings that did not hold, and net-booked is the honest scoreboard. If cancel");
console.log("  rates are flat, Nelson really is slower to close and the trade-off risk is real.");
console.log("  Either answer is decision-grade. A flat result is NOT a null result here.");
console.log("\n  ⚠ Status 23 is the only cancellation signal we map. A customer who simply goes");
console.log("    quiet after a bump may never be marked canceled at all, which would make every");
console.log("    rate below an UNDERCOUNT — and would understate it most for whoever burns most.");

/* ================= [5] SPEED vs OUTCOME — pricing the responsiveness gap ============= */
hr(); console.log("[5] SPEED vs OUTCOME — what does a slow first touch actually cost?"); hr();
console.log("  The responsiveness gap (7.7% vs ~14%) is the one clean agent finding. This turns");
console.log("  it into money by splitting close rate on first-touch latency.\n");
const bands = [[0, 1, "< 1h"], [1, 4, "1–4h"], [4, 24, "4–24h"], [24, Infinity, "> 24h"]];
console.log("  " + pad("first touch", 14) + rp("seasoned", 10) + rp("booked", 8) + rp("close", 9) + rp("95% CI", 16) + rp("net of cancels", 16));
console.log("  " + "-".repeat(W - 4));
const firstTouchH = (r) => {
  const moves = []; let prev = null;
  for (const e of r.events) { if (e.status && e.status !== prev) { moves.push(e.at); prev = e.status; } }
  return moves.length >= 2 ? (moves[1] - moves[0]) / 3600000 : null;
};
const seasonedSet = all.filter((r) => (Date.now() - r.created.getTime()) / 864e5 >= AGE_CAP_D);
for (const [lo, hi, lab] of bands) {
  const set = seasonedSet.filter((r) => { const h = firstTouchH(r); return h != null && h >= lo && h < hi; });
  if (!set.length) continue;
  const bk = set.filter((r) => r.booked && !r.canceled).length;
  const bkGross = set.filter((r) => r.booked).length;
  const ci = wilson(bkGross, set.length);
  console.log("  " + pad(lab, 14) + rp(set.length, 10) + rp(bkGross, 8) + rp(pct(bkGross, set.length), 9) +
    rp(`${(ci[0] * 100).toFixed(1)}–${(ci[1] * 100).toFixed(1)}%`, 16) + rp(pct(bk, set.length), 16));
}
console.log("\n  ⚠ REVERSE CAUSATION IS THE OBVIOUS OBJECTION and it is a strong one: agents touch");
console.log("    promising leads first, so fast-touch leads may close better because they were");
console.log("    better, not because they were fast. Treat any gap here as an UPPER BOUND on the");
console.log("    value of speed. The only clean test is the randomised contact-protocol trial in");
console.log("    claude/lead-source-study-protocol.md §7 — this number sizes whether it is worth");
console.log("    running, it does not substitute for it.");
console.log("  Even as an upper bound it is useful: if the gap is small, the responsiveness");
console.log("  finding is a service signal only. If it is large, slow first touch is also the");
console.log("  biggest close-rate lever in the account and pays for itself immediately.");

/* ================= [6] PROBABLE UNRECORDED CANCELLATIONS =================
   [4] says the cancel field is not being used, but it cannot say what the TRUE rate
   is — that came from assuming one agent's book is right, which is exactly the kind
   of single-source assumption that has cost this project a day of retractions.
   This detector pins it from the data instead. A booking that was real and completed
   reaches a delivered/closed status. A booking that quietly died goes DORMANT: no
   status movement for longer than the delivery horizon, never delivered, never
   canceled. That signature is a probable-unrecorded cancellation. */
hr(); console.log("[6] PROBABLE UNRECORDED CANCELLATIONS — pinning the true rate"); hr();
const DORMANT_D = flag("dormant", 45);
console.log(`  A booking that completed reaches a delivered/closed status. One that quietly`);
console.log(`  died goes dormant. Flagged = booked, no status movement for ${DORMANT_D}+ days, never`);
console.log(`  delivered, never marked canceled. Only records old enough to have resolved are`);
console.log(`  eligible, so this is not counting deals still in flight.\n`);
/* Terminal states we would expect a completed job to reach. Deliberately broad:
   over-including terminal codes makes the detector CONSERVATIVE (fewer flags). */
const DELIVERED_STATUS = new Set(["15", "16", "17", "18", "19", "20", "21", "22", "24"]);
console.log("  " + pad("agent", 20) + rp("booked", 9) + rp("eligible", 10) + rp("marked", 8) +
  rp("dormant", 9) + rp("implied rate", 14) + rp("95% CI", 15));
console.log("  " + "-".repeat(W - 4));
let anyEligible = 0;
for (const a of [...AGENTS, "**TEAM**"]) {
  const set = all.filter((r) => a === "**TEAM**" || r.creator === a);
  const booked = set.filter((r) => r.booked);
  const eligible = booked.filter((r) => (Date.now() - r.created.getTime()) / 864e5 >= DORMANT_D);
  if (!eligible.length) continue;
  anyEligible += a === "**TEAM**" ? 0 : eligible.length;
  const marked = eligible.filter((r) => r.canceled).length;
  const dormant = eligible.filter((r) => {
    if (r.canceled) return false;
    const st = new Set(r.events.map((e) => e.status).filter(Boolean));
    if ([...st].some((x) => DELIVERED_STATUS.has(x))) return false;
    const lastMove = Math.max(...r.events.filter((e) => e.status).map((e) => e.at), r.created.getTime());
    return (Date.now() - lastMove) / 864e5 >= DORMANT_D;
  }).length;
  const implied = marked + dormant, ci = wilson(implied, eligible.length);
  console.log("  " + pad(a.slice(0, 19), 20) + rp(booked.length, 9) + rp(eligible.length, 10) +
    rp(marked, 8) + rp(dormant, 9) + rp(pct(implied, eligible.length), 14) +
    rp(`${(ci[0] * 100).toFixed(0)}–${(ci[1] * 100).toFixed(0)}%`, 15));
}
console.log(`\n  IMPLIED RATE = marked + dormant. Read the columns against each other:`);
console.log(`    marked high, dormant low   -> that agent disposes records properly.`);
console.log(`    marked ~0, dormant high    -> cancellations are happening and going unrecorded.`);
console.log(`    both low                   -> genuinely few cancellations. Believe it only if`);
console.log(`                                  the eligible count is large.`);
console.log(`  If the IMPLIED rates converge across agents while the MARKED rates do not, the`);
console.log(`  spread in [4] is a reporting artifact and the implied rate is the number to use`);
console.log(`  for the haircut on every value-per-lead figure in the project.`);
console.log(`\n  ⚠ DELIVERED_STATUS is a GUESS at which codes mean completed: ${[...DELIVERED_STATUS].join(", ")}.`);
console.log(`    Verify against the status census in source-comparison.mjs --audit before trusting`);
console.log(`    the dormant column. A missing terminal code inflates dormant; an over-broad set`);
console.log(`    suppresses it. The set above errs broad, so dormant is a FLOOR.`);
console.log(`  ⚠ Not proof of cancellation. A dormant booking may be a delivered job whose final`);
console.log(`    status never synced — which is itself a data problem worth the same attention.`);

/* ================= REFERRAL SCOREBOARD ================= */
hr(); console.log("REFERRAL SCOREBOARD — the lagging indicator, for cross-reference only"); hr();
console.log("  Referrals are the OUTPUT of good service, not an input to manage. Shown here so");
console.log("  the three metrics above can be checked against the thing they should predict.\n");
console.log("  " + pad("agent", 20) + rp("referral recs", 15) + rp("share", 9) + rp("bookings(all)", 15) + rp("share", 9));
console.log("  " + "-".repeat(W - 4));
const tRef = all.filter((r) => bucketOf(r) === "referral").length;
const tBk = all.filter((r) => r.booked && !r.canceled).length;
for (const a of AGENTS) {
  const mine = all.filter((r) => r.creator === a);
  const rf = mine.filter((r) => bucketOf(r) === "referral").length;
  const bk = mine.filter((r) => r.booked && !r.canceled).length;
  console.log("  " + pad(a.slice(0, 19), 20) + rp(rf, 15) + rp(pct(rf, tRef), 9) + rp(bk, 15) + rp(pct(bk, tBk), 9));
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
    console.log(`  ${p > 0.05
      ? "EVEN — routing cannot explain the referral difference. Equal inputs, unequal output."
      : "UNEVEN — control for assignment before attributing referral differences to service."}`);
  }
}
console.log("\n  If one agent holds a normal share of bookings and an outsized share of referrals,");
console.log("  the difference is service, and the metrics above should show where.");

/* ================= WHAT THIS CANNOT SEE ================= */
hr(); console.log("WHAT THIS CANNOT SEE — read before using any number above"); hr();
console.log("  1. Tone. The single most likely way to burn a customer is how they are spoken to,");
console.log("     and none of it reaches Firestore. Absence of a signal here is not absence of a");
console.log("     problem; call recordings and the agents' own accounts outrank this script.");
console.log("  2. First contact. Status movement is a proxy. Brian's timestamps replace it.");
console.log("  3. Quotes given verbally. A price promised on the phone and never entered leaves");
console.log("     no trace, so verbal bumping is invisible here by construction.");
console.log("  4. Intent. A price rise is a price rise. This script cannot distinguish a bump");
console.log("     from an honest carrier-cost pass-through, and should never be quoted as if it");
console.log("     can. It narrows where to look; the agents already said what they are doing.");
console.log("  5. Small n. Every per-agent cell here is dozens of records at best. Use this to");
console.log("     structure a conversation, never as a performance score on its own.\n");
process.exit(0);
