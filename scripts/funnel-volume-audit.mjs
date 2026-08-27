/**
 * FUNNEL-VOLUME AUDIT — Gate 4 of value-bidding readiness (2026-08-27).
 *
 * QUESTION (from claude/value-bidding-readiness-spec.md): what are the
 * trailing-30d volumes AND lead→stage delays for each candidate funnel stage,
 * so we can choose the DEEPEST stage that still clears Google's lead-gen
 * guidance (~15 conversions/30d at the chosen stage) with a delay short
 * enough for the bidder to learn (value adjustments are readable only ~±7
 * days after the original conversion; our uploads run daily, so the stage
 * needs to resolve within a few days for most records)?
 *
 * The bidding population is WEBSITE leads (referrer 8 EN, 18493 ES) — those
 * are the records Google Ads can influence. Purchased feeds are printed for
 * context only; they never feed the bidder.
 *
 * CANDIDATE STAGES — all machine-derived from the webhook mirror (Goodhart
 * guard from the spec: a human-applied "qualified" status that feeds bidding
 * becomes an incentive; prefer definitions derived from objective events):
 *   L  lead            record exists (Create_Date)
 *   Q1 priced          first event carrying a Transport price — an agent
 *                      built a real quote for this record
 *   Q2 status-moved    first event where Status_Id differs from the record's
 *                      first observed status (incl. none→some) — the record
 *                      was TOUCHED by disposition workflow
 *   Q3 next-day touch  first webhook event on a later PT day than creation —
 *                      weakest proxy (any CRM activity), printed for bounds
 *   B  booked          Booked_Date present or Item_Type=order
 *   X  lost            last status in the lost set (terminal; context only)
 *
 * CLOCKS (do not mix silently): Create_Date/Booked_Date are ProABD naive
 * Eastern → parseProabdDate. Q-stage times are webhook received_at (UTC,
 * near-real-time mirror). Q-delays therefore measure "mirror observed the
 * transition", which for a live webhook is minutes-to-hours off the true
 * time — acceptable at day granularity, noted here per the ledger doctrine.
 * Mirror history starts 2026-07-08; no Q-stage can be observed before that.
 *
 * MATURITY: delay distributions and reach-% are computed ONLY on records
 * created ≥21 days ago (Law 7 — a 3-day-old record hasn't had time to reach
 * anything). Trailing-30d stage VOLUMES count stage events by stage date,
 * whatever the record's age.
 *
 * PII: prints ABD ids, dates, counts, statuses. NEVER names/emails/phones.
 * READ ONLY — no writes anywhere.
 *
 * Usage (from autoline-logistics-web; needs FIREBASE_PROJECT_ID + creds):
 *   node scripts/funnel-volume-audit.mjs
 *   node scripts/funnel-volume-audit.mjs --days 30      # volume window
 *   node scripts/funnel-volume-audit.mjs --mature 21    # maturity cutoff
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
const dIdx = args.indexOf("--days");
const VOL_DAYS = dIdx >= 0 ? Number(args[dIdx + 1]) || 30 : 30;
const mIdx = args.indexOf("--mature");
const MATURE_DAYS = mIdx >= 0 ? Number(args[mIdx + 1]) || 21 : 21;

const DAY = 864e5;
const now = new Date();
const VOL_START = new Date(now.getTime() - VOL_DAYS * DAY);
const MATURE_CUTOFF = new Date(now.getTime() - MATURE_DAYS * DAY);
const EVENTS_START = new Date("2026-07-08T00:00:00-07:00"); // mirror history start

// Field vocabulary — same constants as source-comparison.mjs. If these ever
// change, change them THERE first and copy; two vocabularies = two truths.
const CANCELED_ORDER_STATUS_ID = "23";
const LOST_STATUS_IDS = new Set(["5", "6", "12", "13", "25", "2581"]);
const WEBSITE = new Set(["8", "18493"]);
const PAID = new Set(["207", "503", "18", "15315"]); // iRelo, TaylorP, TaylorS, LiveTr
const LABELS = { "8": "WebEN", "18493": "WebES", "207": "iRelo", "503": "TaylorP", "18": "TaylorS", "15315": "LiveTr", "0": "NotSel" };
const KNOWN_TEST_ABD = new Set(["37256124", "37257079", "37257179", "37257192", "37287629", "37287650", "37362879"]);
const PRICE_PATHS = ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price", "Total_Tariff", "Tariff"];

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const ptDay = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const dig = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
function priceOf(raw) {
  for (const p of PRICE_PATHS) {
    const v = dig(raw, p);
    const n = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
/** Conventional median (averages middle pair) — floor-index shortcuts banned here. */
function median(xs) {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
/** Type-7 linear-interpolation quantile — nearest-rank shortcuts banned here. */
function quantile(xs, q) {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const h = (v.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return v[lo] + (h - lo) * (v[hi] - v[lo]);
}
const f1 = (n) => (n == null ? "—" : n.toFixed(1));
const pct = (k, n) => (n ? ((100 * k) / n).toFixed(0) + "%" : "—");

// NO .select() — full payloads, deliberately (the v1-v3 source-comparison
// lesson: our own .select() hid fields that were arriving the whole time).
console.log(`\nFUNNEL-VOLUME AUDIT (Gate 4) · volume window ${VOL_DAYS}d · maturity cutoff ${MATURE_DAYS}d · reading events since ${ptDay(EVENTS_START)} ...`);
const snap = await db.collection("proabd_webhook_events").where("received_at", ">=", EVENTS_START).get();
console.log(`${snap.size} events.`);

/* ---- Collapse events into per-record stage timelines ---- */
const rec = new Map();
const docs = snap.docs
  .map((doc) => doc.data())
  .sort((a, b) => (a.received_at?.toMillis?.() ?? 0) - (b.received_at?.toMillis?.() ?? 0)); // chronological, so "first" means first

for (const d of docs) {
  const raw = d.raw_item ?? {};
  const abd = str(d.entity_id) || str(raw.ABD_Id);
  if (!abd || KNOWN_TEST_ABD.has(abd)) continue;
  let r = rec.get(abd);
  if (!r) {
    r = { abd, ref: "", created: null, bookedAt: null, booked: false,
          firstStatus: null, statusMovedAt: null, lastStatus: "",
          pricedAt: null, firstTouchAt: null, nextDayTouchAt: null, canceled: false };
    rec.set(abd, r);
  }
  const at = d.received_at?.toDate?.() ?? null;
  const rid = str(raw.Referrer_Id);
  if (!r.ref && rid) r.ref = rid;

  const created = parseProabdDate(raw.Create_Date);
  if (created && (!r.created || created < r.created)) r.created = created;

  const bookedAt = parseProabdDate(raw.Booked_Date);
  if (bookedAt && (!r.bookedAt || bookedAt < r.bookedAt)) r.bookedAt = bookedAt;
  const stage = (str(raw.Item_Type) || str(d.entity_type)).toLowerCase();
  if (stage === "order" || str(raw.Booked_Date)) r.booked = true;

  const sid = str(raw.Status_Id);
  if (sid) {
    if (r.firstStatus === null) r.firstStatus = sid;
    else if (sid !== r.firstStatus && !r.statusMovedAt && at) r.statusMovedAt = at;
    r.lastStatus = sid;
    if (sid === CANCELED_ORDER_STATUS_ID) r.canceled = true;
  }

  if (!r.pricedAt && priceOf(raw) != null && at) r.pricedAt = at;

  if (at) {
    if (!r.firstTouchAt) r.firstTouchAt = at;
    else if (!r.nextDayTouchAt && ptDay(at) !== ptDay(r.firstTouchAt)) r.nextDayTouchAt = at;
  }
}

const all = [...rec.values()].filter((r) => r.created && r.created >= EVENTS_START);
const web = all.filter((r) => WEBSITE.has(r.ref));
const paid = all.filter((r) => PAID.has(r.ref));
console.log(`${all.length} records (tests excluded) · website ${web.length} · purchased ${paid.length} · other ${all.length - web.length - paid.length}\n`);

/* Stage accessors: [key, label, timeOf(record)] */
const STAGES = [
  ["L",  "lead (created)",     (r) => r.created],
  ["Q1", "priced (quote built)",(r) => r.pricedAt],
  ["Q2", "status-moved",       (r) => r.statusMovedAt],
  ["Q3", "next-day touch",     (r) => r.nextDayTouchAt],
  ["B",  "booked",             (r) => (r.booked ? (r.bookedAt ?? null) : null)],
];

const hr = (c = "=") => console.log(c.repeat(100));

/* ---- [1] Trailing-30d stage volumes (by stage date) ---- */
hr();
console.log(`[1] STAGE VOLUME, trailing ${VOL_DAYS}d (events counted by STAGE date, any record age)`);
console.log(`    The ≥15/30d bar applies to the WEBSITE column — that is the population the bidder learns on.`);
console.log("stage".padEnd(24) + "website".padStart(9) + "  ≥15?" + "purchased".padStart(12) + "all".padStart(7));
console.log("-".repeat(60));
for (const [k, label, timeOf] of STAGES) {
  const cnt = (set) => set.filter((r) => { const t = timeOf(r); return t && t >= VOL_START; }).length;
  const w = cnt(web);
  console.log(`${k.padEnd(4)}${label.padEnd(20)}` + String(w).padStart(9) + (w >= 15 ? "   ✓  " : "   ✗  ") + String(cnt(paid)).padStart(10) + String(cnt(all)).padStart(7));
}
console.log(`(B counts records with a parseable Booked_Date in-window; booked-without-date records exist and are noted in [3].)`);

/* ---- [2] Delay distributions on MATURE records (created ≥21d ago) ---- */
hr();
console.log(`[2] LEAD→STAGE DELAY, website records created ${ptDay(EVENTS_START)} .. ${ptDay(MATURE_CUTOFF)} (≥${MATURE_DAYS}d old)`);
console.log(`    Value adjustments are bidder-readable ~±7 days after the conversion; daily uploads land D+1.`);
console.log(`    So a usable stage wants MOST records resolving ≤3d and the bulk ≤7d.`);
const matureWeb = web.filter((r) => r.created <= MATURE_CUTOFF);
console.log(`${matureWeb.length} mature website records.\n`);
console.log("stage".padEnd(24) + "reached".padStart(9) + "reach%".padStart(8) + "med d".padStart(8) + "p75".padStart(7) + "p90".padStart(7) + "≤3d".padStart(7) + "≤7d".padStart(7));
console.log("-".repeat(76));
for (const [k, label, timeOf] of STAGES) {
  if (k === "L") continue;
  const delays = [];
  let reached = 0;
  for (const r of matureWeb) {
    const t = timeOf(r);
    if (!t) continue;
    reached++;
    delays.push((t - r.created) / DAY);
  }
  const le = (d) => delays.filter((x) => x <= d).length;
  console.log(`${k.padEnd(4)}${label.padEnd(20)}` + String(reached).padStart(9) + pct(reached, matureWeb.length).padStart(8) +
    f1(median(delays)).padStart(8) + f1(quantile(delays, 0.75)).padStart(7) + f1(quantile(delays, 0.9)).padStart(7) +
    pct(le(3), delays.length).padStart(7) + pct(le(7), delays.length).padStart(7));
}
console.log(`\nNegative delays are possible on Q stages (mirror can first see a record after a status already moved) —`);
console.log(`treat sub-zero as 0-day. Q-stage clock is received_at (see header CLOCKS note).`);

/* ---- [3] Weekly trend, website population (is ≥15 sustained or a one-week spike?) ---- */
hr();
console.log(`[3] WEBSITE STAGE EVENTS BY WEEK (last 8 weeks, by stage date) — the bar must hold WEEKLY ≈ 3-4/wk`);
const weeks = [];
for (let i = 7; i >= 0; i--) {
  const end = new Date(now.getTime() - i * 7 * DAY);
  const start = new Date(end.getTime() - 7 * DAY);
  weeks.push({ start, end, label: ptDay(start).slice(5) });
}
console.log("stage".padEnd(24) + weeks.map((w) => w.label.padStart(9)).join(""));
console.log("-".repeat(24 + weeks.length * 9));
for (const [k, label, timeOf] of STAGES) {
  const row = weeks.map((w) => web.filter((r) => { const t = timeOf(r); return t && t >= w.start && t < w.end; }).length);
  console.log(`${k.padEnd(4)}${label.padEnd(20)}` + row.map((n) => String(n).padStart(9)).join(""));
}
const noDateBooked = web.filter((r) => r.booked && !r.bookedAt).length;
if (noDateBooked) console.log(`note: ${noDateBooked} website record(s) booked without a parseable Booked_Date (counted in [2] reach but not in dated columns).`);

/* ---- [4] Status vocabulary of the moved records (what would "qualified" MEAN?) ---- */
hr();
console.log(`[4] FIRST-MOVE STATUS CENSUS, website records — what Status_Id do records move TO first?`);
console.log(`    This is the raw material for a "qualified" definition. Lost statuses are terminal, not qualified.`);
const firstMove = new Map();
for (const r of web) {
  if (!r.statusMovedAt) continue;
  const k = `${r.lastStatus || "?"}${LOST_STATUS_IDS.has(r.lastStatus) ? " (LOST)" : r.lastStatus === CANCELED_ORDER_STATUS_ID ? " (CANCELED)" : ""}`;
  firstMove.set(k, (firstMove.get(k) ?? 0) + 1);
}
if (!firstMove.size) console.log("  (no website records with an observed status move — Q2 is not derivable from this mirror)");
for (const [k, n] of [...firstMove.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  last Status_Id ${k}`);

/* ---- Verdict framework (pre-registered in the spec, restated so the output is self-contained) ---- */
hr();
console.log(`HOW TO READ THIS (Gate 4 rule, from claude/value-bidding-readiness-spec.md):
 - Choose the DEEPEST stage where the WEBSITE column in [1] is ≥15/30d, [3] shows it sustained
   (not one spike week), and [2] shows median delay ≤~3d with the bulk ≤7d.
 - Expected outcome: B (booked) fails volume (~3/mo paid) — confirming architecture A needs a
   qualified stage — and the decision is WHICH Q definition clears the bar. Q1 (priced) is the
   most objective candidate: it means an agent engaged and produced a quote. Q3 is the weakest
   and sets an upper bound only.
 - If NO Q stage clears ≥15/30d sustained: architecture B (expected value at lead time) becomes
   the default, and this script's numbers size how long until A becomes available.
 - Whatever stage is chosen: freeze its definition in the spec BEFORE it becomes a bidding
   target, then re-run this weekly during rollout to watch the distribution (Goodhart guard).`);
