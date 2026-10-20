/**
 * BOOKING-DELAY CURVE (2026-10-20, read-only).
 *
 * Question: of the leads that ever book, how long after the lead arrives does
 * the booking land? Per source. This decides whether an in-progress month can
 * be read before its leads are 14 days old (the mature-cohort rule), and how
 * to project the month's finish from bookings seen so far.
 *
 * Record reduction is the tier1-source-economics.mjs one: created = earliest
 * Create_Date (Eastern, via proabd-time), booked = earliest Booked_Date.
 * Seasoned records only (created ≥ 21 days ago) so the tail is not truncated
 * by the read date. Tests excluded the same way.
 *
 * Writes ../booking-delay-curve.json (AutoExpress root, outside the repo).
 *
 * Usage (gcloud ADC):
 *   node scripts/booking-delay-curve.mjs                 # curve, 45-day seasoning (default)
 *   node scripts/booking-delay-curve.mjs --season 21     # shorter seasoning (more cohorts, faster-looking curve)
 *   node scripts/booking-delay-curve.mjs --backtest      # + forecast each past month at day 3/7/14 after month end
 *                                                        #   from the curve measured on earlier cohorts only
 *   node scripts/booking-delay-curve.mjs --phone-check   # + where Google phone bookings land (hand-keyed vs website)
 *
 * Added 2026-10-20 PM after the second-opinion review: 45-day seasoning (the
 * 21-day read was right-censored: iRelo still books 7% after day 21),
 * backtest, and the phone-booking mapping check.
 */
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { writeFileSync } from "node:fs";
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

const DAY = 864e5;
const argv = process.argv.slice(2);
const argNum = (flag, dflt) => { const i = argv.indexOf(flag); return i >= 0 ? Number(argv[i + 1]) || dflt : dflt; };
const EVENTS_START = new Date("2026-07-08T00:00:00-07:00");
const SEASON_DAYS = argNum("--season", 45);
const BACKTEST = argv.includes("--backtest");
const PHONE_CHECK = argv.includes("--phone-check");
const PT = "America/Los_Angeles";
const ptMonth = (d) => d.toLocaleDateString("en-CA", { timeZone: PT }).slice(0, 7);
const phoneKey = (raw) => {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits.length === 10 ? digits : null;
};
const KNOWN_TEST_ABD = new Set(["37256124", "37257079", "37257179", "37257192", "37287629", "37287650", "37362879"]);
const TEST_RE = /\btest(ing|keyword)?\b|\bfake\b|\bdummy\b/i;
const LABELS = {
  "207": "iRelocation", "15315": "LiveTransport", "503": "Taylor premium", "18": "Taylor shared",
  "8": "Website EN", "18493": "Website ES", "0": "Hand-keyed",
};
const GROUP = (ref) => (ref === "8" || ref === "18493" ? "Website" : LABELS[ref] ?? `ref ${ref || "?"}`);
const str = (v) => (v === undefined || v === null ? "" : String(v).trim());

console.log("Reading proabd_webhook_events since 2026-07-08 (paged) ...");
const rec = new Map();
let last = null, nEv = 0;
for (;;) {
  let q = db.collection("proabd_webhook_events").where("received_at", ">=", EVENTS_START).orderBy("received_at", "asc")
    .select("entity_id", "received_at", "raw_item.ABD_Id", "raw_item.Referrer_Id", "raw_item.Create_Date", "raw_item.Booked_Date", "raw_item.Item_Type", "raw_item.Shipper.Phone_1")
    .limit(3000);
  if (last) q = q.startAfter(last);
  const snap = await q.get();
  if (snap.empty) break;
  for (const doc of snap.docs) {
    nEv++;
    const d = doc.data(), raw = d.raw_item ?? {};
    const abd = str(d.entity_id) || str(raw.ABD_Id);
    if (!abd || KNOWN_TEST_ABD.has(abd)) continue;
    let r = rec.get(abd);
    if (!r) { r = { abd, created: null, bookedAt: null, firstOrderSeen: null, ref: "", phone: null }; rec.set(abd, r); }
    if (!r.phone) r.phone = phoneKey(raw.Shipper?.Phone_1);
    const at = d.received_at?.toDate?.() ?? null;
    const c = parseProabdDate(raw.Create_Date); if (c && (!r.created || c < r.created)) r.created = c;
    const b = parseProabdDate(raw.Booked_Date); if (b && (!r.bookedAt || b < r.bookedAt)) r.bookedAt = b;
    const rid = str(raw.Referrer_Id); if (!r.ref && rid) r.ref = rid;
    const isOrder = str(raw.Item_Type).toLowerCase() === "order" || !!str(raw.Booked_Date);
    if (isOrder && at && !r.firstOrderSeen) r.firstOrderSeen = at;
  }
  last = snap.docs[snap.docs.length - 1];
  if (snap.size < 3000) break;
}
console.log(`${nEv} events, ${rec.size} records.`);

const testAbd = new Set();
const leadSnap = await db.collection("leads").select("proabdAbdId", "leadRef", "attribution.utmSource", "attribution.utmTerm", "attribution.utmCampaign").get();
for (const doc of leadSnap.docs) {
  const d = doc.data(), v = str(d.proabdAbdId); if (!v) continue;
  const a = d.attribution ?? {};
  if ([a.utmSource, a.utmTerm, a.utmCampaign, d.leadRef].some((x) => TEST_RE.test(str(x)))) testAbd.add(v);
}

const now = Date.now();
const BUCKETS = [0, 1, 2, 3, 5, 7, 10, 14, 21, 28, 35]; // "within N days" (calendar days, floor of delay)
const pct = (x) => `${Math.round(x * 100)}%`;

/** Per-record delay rows for records created in [from, to), tests excluded. */
function cohortRows(fromMs, toMs) {
  const rows = [];
  for (const r of rec.values()) {
    if (testAbd.has(r.abd) || !r.created) continue;
    const c = r.created.getTime();
    if (c < fromMs || c >= toMs) continue;
    const bookedAt = r.bookedAt ?? r.firstOrderSeen;
    let delay = bookedAt ? (bookedAt.getTime() - c) / DAY : null;
    if (delay != null && delay < -0.5) delay = null;       // booked before created: data error
    if (delay != null && delay < 0) delay = 0;
    rows.push({ group: GROUP(r.ref), ref: r.ref, created: c, delay, bookedAt: bookedAt?.getTime() ?? null, abd: r.abd, phone: r.phone });
  }
  return rows;
}

/** Cumulative share of bookings landed within N days, per group, from rows (bookings only). */
function curveFrom(rows) {
  const by = new Map();
  for (const x of rows) {
    const g = by.get(x.group) ?? { leads: 0, delays: [] };
    g.leads++; if (x.delay != null) g.delays.push(x.delay);
    by.set(x.group, g);
  }
  const out = {};
  for (const [g, v] of by) {
    const ds = v.delays.sort((a, b) => a - b), n = ds.length;
    out[g] = { leads: v.leads, booked: n, cum: (d) => (n ? ds.filter((x) => x < d + 1).length / n : null), ds };
  }
  return out;
}

const seasonCut = now - SEASON_DAYS * DAY;
const seasoned = cohortRows(0, seasonCut);
const curve = curveFrom(seasoned);
const allDs = seasoned.filter((x) => x.delay != null).map((x) => x.delay).sort((a, b) => a - b);

console.log(`\nSeasoned (created ≥${SEASON_DAYS}d ago), tests excluded.\n`);
console.log("Share of eventual bookings landed within N days of the lead (cumulative):");
console.log(`${"source".padEnd(16)} ${"leads".padStart(6)} ${"booked".padStart(6)} ${"close".padStart(6)} ` + BUCKETS.map((b) => `≤${b}d`.padStart(5)).join(" ") + "   median  p90  max");
const result = { readAt: new Date(now).toISOString(), seasonDays: SEASON_DAYS, buckets: BUCKETS, sources: {} };
const q = (ds, p) => (ds.length ? ds[Math.min(ds.length - 1, Math.floor(p * ds.length))] : null);
const line = (name, leads, ds) => {
  const n = ds.length;
  const cum = BUCKETS.map((b) => (n ? ds.filter((d) => d < b + 1).length / n : null));
  result.sources[name] = { leads, booked: n, close: leads ? n / leads : null, cumulative: Object.fromEntries(BUCKETS.map((b, i) => [b, cum[i]])), medianDays: q(ds, 0.5), p90Days: q(ds, 0.9), maxDays: n ? ds[n - 1] : null };
  console.log(`${name.padEnd(16)} ${String(leads).padStart(6)} ${String(n).padStart(6)} ${(leads ? pct(n / leads) : "—").padStart(6)} ` + cum.map((c) => (c == null ? "—" : pct(c)).padStart(5)).join(" ") + `   ${n ? q(ds, 0.5).toFixed(1) : "—"}d  ${n ? q(ds, 0.9).toFixed(1) : "—"}d  ${n ? ds[n - 1].toFixed(1) : "—"}d`);
};
for (const [g, v] of Object.entries(curve).sort((a, b) => b[1].booked - a[1].booked)) line(g, v.leads, v.ds);
line("ALL", seasoned.length, allDs);
const hrs = allDs.filter((d) => d < 1).map((d) => d * 24).sort((a, b) => a - b);
if (hrs.length) console.log(`\nSame-day bookings (${hrs.length} of ${allDs.length}): median ${q(hrs, 0.5).toFixed(1)}h, p75 ${q(hrs, 0.75).toFixed(1)}h, p90 ${q(hrs, 0.9).toFixed(1)}h after the lead.`);

/* ---------------- --backtest ----------------
 * For each complete PT month M with leads: curve = cohorts created before M
 * (seasoned relative to M's start, same SEASON_DAYS); read at day 3 / 7 / 14
 * after M's last day; expected = booked-by-then ÷ settled share, where
 * settled share = Σ leads_d × curve(age_d) ÷ Σ leads_d. Compare to bookings
 * known today (itself still censored for recent months: flagged). */
if (BACKTEST) {
  console.log(`\nBACKTEST: expected eventual bookings vs known-today, per lead month, read N days after month end`);
  const months = [...new Set(cohortRows(0, now).map((x) => ptMonth(new Date(x.created))))].sort();
  const thisMonth = ptMonth(new Date(now));
  const CURVE_FOR = (g) => (g === "LiveTransport" || g === "Taylor shared" ? "iRelocation" : g === "Hand-keyed" ? "Website" : g);
  result.backtest = [];
  for (const m of months) {
    if (m >= thisMonth) continue;
    const mStart = new Date(`${m}-01T00:00:00-07:00`).getTime();
    const mEnd = new Date(new Date(mStart).getFullYear(), new Date(mStart).getMonth() + 1, 1).getTime();
    const prior = curveFrom(cohortRows(0, mStart - SEASON_DAYS * DAY));
    const rows = cohortRows(mStart, mEnd);
    const ageKnown = (now - mEnd) / DAY;
    for (const g of ["Website", "iRelocation", "LiveTransport", "Hand-keyed"]) {
      const gr = rows.filter((x) => x.group === g);
      if (!gr.length) continue;
      const cv = prior[CURVE_FOR(g)] ?? prior[g];
      const known = gr.filter((x) => x.delay != null).length;
      const parts = [];
      for (const d of [3, 7, 14]) {
        const asOf = mEnd + d * DAY;
        const seen = gr.filter((x) => x.bookedAt != null && x.bookedAt <= asOf).length;
        let settled = null;
        if (cv && cv.booked >= 10) {
          let num = 0;
          for (const x of gr) num += cv.cum(Math.max(0, Math.floor((asOf - x.created) / DAY))) ?? 0;
          settled = num / gr.length;
        }
        const exp = settled ? seen / settled : null;
        parts.push(`d${d}: seen ${String(seen).padStart(3)} → exp ${exp == null ? "  —" : String(Math.round(exp)).padStart(3)}`);
        result.backtest.push({ month: m, source: g, readDay: d, seen, settledShare: settled, expected: exp, knownToday: known });
      }
      console.log(`  ${m} ${g.padEnd(13)} leads ${String(gr.length).padStart(5)} · ${parts.join(" · ")} · known today ${known}${ageKnown < 45 ? " (still open)" : ""}${cv && cv.booked >= 10 ? "" : "  [no prior curve: n<10]"}`);
    }
  }
}

/* ---------------- --phone-check ----------------
 * Do Google phone bookings land in "Hand-keyed" (agent-created, referrer 0)?
 * Join CRM records to CallRail calls by phone (±3 days), then classify the
 * call as Google (gclid or source/campaign says Google Ads) or not. */
if (PHONE_CHECK) {
  console.log(`\nPHONE CHECK: CRM records whose Shipper phone matches a tracked call within 3 days`);
  const crSnap = await db.collection("callrail_webhook_events").orderBy("receivedAt", "asc")
    .select("raw.customer_phone_number", "raw.callernum", "raw.start_time", "raw.created_at", "raw.gclid", "raw.source", "raw.campaign", "raw.spam").get();
  const calls = new Map(); // phone -> [{at, google}]
  for (const doc of crSnap.docs) {
    const raw = doc.data().raw ?? {};
    if (raw.spam === true) continue;
    const at = new Date(raw.start_time ?? raw.created_at ?? 0).getTime();
    const key = phoneKey(raw.customer_phone_number) ?? phoneKey(raw.callernum);
    if (!key || !at) continue;
    const google = (typeof raw.gclid === "string" && raw.gclid) || /google ads|adwords|paid/i.test(`${raw.source ?? ""} ${raw.campaign ?? ""}`);
    (calls.get(key) ?? calls.set(key, []).get(key)).push({ at, google: !!google });
  }
  const tally = {};
  for (const x of cohortRows(0, now)) {
    const t = (tally[x.group] ??= { records: 0, booked: 0, callMatch: 0, callBooked: 0, googleCall: 0, googleBooked: 0 });
    t.records++; if (x.delay != null) t.booked++;
    const cs = x.phone ? calls.get(x.phone) : null;
    if (!cs) continue;
    const near = cs.filter((c) => Math.abs(c.at - x.created) <= 3 * DAY);
    if (!near.length) continue;
    t.callMatch++; if (x.delay != null) t.callBooked++;
    if (near.some((c) => c.google)) { t.googleCall++; if (x.delay != null) t.googleBooked++; }
  }
  console.log(`  ${"source".padEnd(16)} ${"records".padStart(8)} ${"booked".padStart(7)} ${"call-matched".padStart(13)} ${"of which booked".padStart(16)} ${"Google call".padStart(12)} ${"booked".padStart(7)}`);
  for (const [g, t] of Object.entries(tally).sort((a, b) => b[1].records - a[1].records)) {
    console.log(`  ${g.padEnd(16)} ${String(t.records).padStart(8)} ${String(t.booked).padStart(7)} ${String(t.callMatch).padStart(13)} ${String(t.callBooked).padStart(16)} ${String(t.googleCall).padStart(12)} ${String(t.googleBooked).padStart(7)}`);
  }
  result.phoneCheck = tally;
  console.log(`  Read: Hand-keyed rows with a Google call match are Google Ads bookings currently credited to "free". Website rows with a call match are form leads who also called.`);
}

writeFileSync("../booking-delay-curve.json", JSON.stringify(result, null, 2));
console.log("\nWrote ../booking-delay-curve.json");
