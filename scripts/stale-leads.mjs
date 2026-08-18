/**
 * Lead triage — the money already bought and not yet collected.
 *
 * v2, 2026-08-16. v1 WAS UNUSABLE AND ITS CORE METRIC WAS WRONG.
 *
 * ── WHAT v1 GOT WRONG ────────────────────────────────────────────────────────
 * v1 ranked by "days since last touch" and flagged 1,105 records as urgent.
 * That is not a triage list, it is the whole book. Worse, the metric itself
 * was invalid: the staleness values repeat EXACTLY across dozens of records —
 * 40+ all at 15.4d, 46+ all at 13.5d, each group sharing one owner and one
 * status. Those people did not all touch those leads in the same second.
 *
 * "Last touch" was measuring when ProABD last PUSHED US A BATCH OF EVENTS for
 * that record, not when a human worked it. It described our data pipeline and
 * was read as agent behaviour.
 *
 * v2 therefore ranks on fields that are per-record and real:
 *   Create_Date (100% populated) · Status (current state) · Price
 * Staleness is still printed, marked unreliable, and never sorted on.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * RANKING: expected dollars still winnable.
 *   value_at_risk = estimated broker fee × P(a booking is still ahead | age)
 * Fee uses the fitted model from claude/pricing-strategy-theory-and-roadmap.md
 * (fee = $149 + 9.1% of carrier pay, r=0.73), inverted from total price.
 * The survival term comes from the measured days-to-book curve: p50 0.8d,
 * p75 4.8d, p90 13.9d, max 20.3d. A 3-day-old $2,000 load outranks a
 * 15-day-old $600 one, which is the whole point of a triage list.
 *
 * A LIST NOBODY CAN WORK IS NOT A TRIAGE LIST. Output is capped (default 25
 * per agent). The cap is stated, never silent.
 *
 * PII: ABD_Id, dates, state-level route, price, status, owner. Never a name,
 * email, phone or street address. Paste the ABD_Id into ProABD for contact.
 *
 * Usage:
 *   node scripts/stale-leads.mjs                    # top 25 per agent
 *   node scripts/stale-leads.mjs --top 10           # short morning list
 *   node scripts/stale-leads.mjs --agent Nelson
 *   node scripts/stale-leads.mjs --csv > triage.csv # everything, unranked cap
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
const DAYS = Number(flag("days", 60)) || 60;
const TOP = Number(flag("top", 25)) || 25;
const AGENT = flag("agent", null);
const CSV = argv.includes("--csv");

const HORIZON_DAYS = 21;
const PT = "America/Los_Angeles";
const DAY = 864e5;
const CANCELED_ORDER_STATUS_ID = "23";
const LOST_STATUS_IDS = new Set(["5", "6", "12", "13", "25", "2581"]);
const KNOWN_TEST_ABD = new Set(["37256124", "37257079", "37257179", "37257192", "37287629", "37287650"]);
const LABELS = {
  "0": "Unattributed", "8": "Website EN", "18493": "Website ES",
  "207": "iRelocation", "503": "Taylor-prem", "18": "Taylor-shared",
};
/** Measured close rate by source — drives expected value, not just price. */
const CLOSE = { "8": 0.098, "18493": 0.05, "207": 0.037, "503": 0.080, "18": 0.040, "0": 0.286 };
const CLOSE_DEFAULT = 0.048;

/** Statuses meaning real progress. Anything else at age is untouched work. */
const PROGRESSED = /contact|hold|call back|quote sent|follow/i;
const NEVER_WORKED = /^(new|not quoted|not emailed|new quote)/i;

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const dig = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
const ymd = (d) => (d ? d.toLocaleDateString("en-CA", { timeZone: PT }) : "—");
/* ProABD Create_Date/Booked_Date are NAIVE and are stored EASTERN, not Pacific.
   Measured at -3.00h with 0.00h spread across 10 id-linked records on 2026-08-17;
   see scripts/lib/proabd-time.mjs and the ledger entry it points at. Do NOT
   reintroduce a local parser here — six of them disagreed once already. */
const parseCreate = parseProabdDate;
function pickNum(raw, paths) {
  for (const p of paths) {
    const v = dig(raw, p);
    const n = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
const PRICE_PATHS = ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price"];

/** Share of bookings already elapsed by age a — from the measured curve. */
function bookedByAge(a) {
  if (a >= 20.3) return 1;
  if (a >= 13.9) return 0.90 + 0.10 * (a - 13.9) / (20.3 - 13.9);
  if (a >= 4.8) return 0.75 + 0.15 * (a - 4.8) / (13.9 - 4.8);
  if (a >= 0.8) return 0.50 + 0.25 * (a - 0.8) / (4.8 - 0.8);
  return 0.50 * (a / 0.8);
}
/** Fitted fee model inverted from total price: fee = (149 + 0.091*price)/1.091. */
const feeFromPrice = (p) => (p == null ? 247 : (149 + 0.091 * p) / 1.091);

console.error(`Reading proabd_webhook_events (last ${DAYS}d) ...`);
const snap = await db.collection("proabd_webhook_events")
  .where("received_at", ">=", new Date(Date.now() - DAYS * DAY)).get();
console.error(`${snap.size} events.`);

const rec = new Map();
for (const doc of snap.docs) {
  const d = doc.data();
  const raw = d.raw_item ?? {};
  const abd = str(d.entity_id) || str(raw.ABD_Id);
  if (!abd || KNOWN_TEST_ABD.has(abd)) continue;
  let r = rec.get(abd);
  if (!r) {
    r = { abd, ref: "", created: null, lastAt: null, lastStatus: "", lastLabel: "",
          owner: "", booked: false, canceled: false, price: null, oState: "", dState: "" };
    rec.set(abd, r);
  }
  const rid = str(raw.Referrer_Id);
  if (!r.ref && rid) r.ref = rid;
  const c = parseCreate(raw.Create_Date);
  if (c && (!r.created || c < r.created)) r.created = c;
  if ((str(raw.Item_Type) || str(d.entity_type)).toLowerCase() === "order" || str(raw.Booked_Date)) r.booked = true;
  const at = d.received_at?.toDate?.() ?? null;
  const sid = str(raw.Status_Id);
  if (sid && (!r.lastAt || (at && at >= r.lastAt))) {
    r.lastStatus = sid; r.lastLabel = str(raw.Status); r.lastAt = at ?? r.lastAt;
    const u = str(raw.UserName);
    if (u) r.owner = u;
  }
  if (sid === CANCELED_ORDER_STATUS_ID) r.canceled = true;
  const px = pickNum(raw, PRICE_PATHS);
  if (px != null) r.price = px;
  if (!r.oState) r.oState = str(dig(raw, "Transport.Origin.State"));
  if (!r.dState) r.dState = str(dig(raw, "Transport.Destination.State"));
}

const now = Date.now();
const open = [...rec.values()].filter((r) =>
  r.created && !r.booked && !r.canceled && !LOST_STATUS_IDS.has(r.lastStatus) &&
  (!AGENT || r.owner.toLowerCase().includes(AGENT.toLowerCase())));
for (const r of open) {
  r.age = (now - r.created.getTime()) / DAY;
  r.stale = r.lastAt ? (now - r.lastAt.getTime()) / DAY : r.age;
  r.remaining = Math.max(0, 1 - bookedByAge(r.age));
  r.close = CLOSE[r.ref] ?? CLOSE_DEFAULT;
  r.atRisk = feeFromPrice(r.price) * r.close * r.remaining;
  r.neverWorked = NEVER_WORKED.test(r.lastLabel);
}
const live = open.filter((r) => r.age <= HORIZON_DAYS).sort((a, b) => b.atRisk - a.atRisk);
const dead = open.filter((r) => r.age > HORIZON_DAYS);

if (CSV) {
  console.log("bucket,abd_id,created,age_days,status,never_worked,owner,source,route,price,value_at_risk");
  for (const [b, set] of [["LIVE", live], ["PAST_WINDOW", dead]])
    for (const r of set)
      console.log([b, r.abd, ymd(r.created), r.age.toFixed(1), `"${r.lastLabel}"`, r.neverWorked ? 1 : 0,
        `"${r.owner}"`, `"${LABELS[r.ref] ?? r.ref}"`, `"${r.oState}->${r.dState}"`,
        r.price ?? "", r.atRisk.toFixed(2)].join(","));
  process.exit(0);
}

const W = 92;
const money = (v) => `$${v.toFixed(0)}`;
console.log(`\n${"=".repeat(W)}`);
console.log(`LEAD TRIAGE${AGENT ? ` — ${AGENT}` : ""}   ${ymd(new Date(now))}`);
console.log(`${"=".repeat(W)}`);
console.log(`  ${open.length} open · ${live.length} inside the ${HORIZON_DAYS}-day booking window · ${dead.length} past it`);
console.log(`  Ranked by DOLLARS STILL WINNABLE = est. fee × source close rate × booking`);
console.log(`  probability remaining at this age. Not by "last touched" — see below.`);

const byAgent = new Map();
for (const r of live) {
  const k = r.owner || "(unassigned)";
  if (!byAgent.has(k)) byAgent.set(k, []);
  byAgent.get(k).push(r);
}
for (const [agent, rows] of [...byAgent.entries()].sort((a, b) =>
  b[1].reduce((s, r) => s + r.atRisk, 0) - a[1].reduce((s, r) => s + r.atRisk, 0))) {
  const total = rows.reduce((s, r) => s + r.atRisk, 0);
  const shown = rows.slice(0, TOP);
  console.log(`\n${"─".repeat(W)}`);
  console.log(`${agent}   ${rows.length} open in-window · ${money(total)} still winnable · showing top ${shown.length}`);
  console.log(`${"─".repeat(W)}`);
  console.log(`  ` + pad("ABD_Id", 12) + rp("age", 6) + rp("$risk", 8) + "  " + pad("status", 22) + pad("source", 14) + pad("route", 9) + rp("price", 8));
  for (const r of shown) {
    console.log(`  ` + pad(r.abd, 12) + rp(r.age.toFixed(1) + "d", 6) + rp(money(r.atRisk), 8) + "  " +
      pad(r.lastLabel.slice(0, 21), 22) + pad((LABELS[r.ref] ?? r.ref).slice(0, 13), 14) +
      pad(`${r.oState}→${r.dState}`, 9) + rp(r.price ? `$${r.price.toFixed(0)}` : "—", 8) +
      (r.neverWorked ? "  NEVER WORKED" : ""));
  }
  if (rows.length > shown.length) {
    const rest = rows.slice(TOP).reduce((s, r) => s + r.atRisk, 0);
    console.log(`  … ${rows.length - shown.length} more, ${money(rest)} of remaining value. --top ${rows.length} to see all.`);
  }
}

/* ---- never-worked records: the clearest failure ---- */
const never = live.filter((r) => r.neverWorked && r.age > 1);
if (never.length) {
  console.log(`\n${"─".repeat(W)}\nNEVER WORKED — still at intake status, over a day old (${never.length})\n${"─".repeat(W)}`);
  console.log(`  Half of all bookings happen inside the first day. These had no first touch.`);
  const byOwner = new Map();
  for (const r of never) byOwner.set(r.owner || "(none)", (byOwner.get(r.owner || "(none)") ?? 0) + 1);
  [...byOwner.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([k, n]) => console.log(`    ${rp(n, 5)}  ${k}`));
  console.log(`  combined value still winnable: ${money(never.reduce((s, r) => s + r.atRisk, 0))}`);
}

/* ---- past the window ---- */
console.log(`\n${"─".repeat(W)}\nPAST THE ${HORIZON_DAYS}-DAY WINDOW — ${dead.length} records that will not book\n${"─".repeat(W)}`);
const tally = (fn, label) => {
  const m = new Map();
  for (const r of dead) m.set(fn(r), (m.get(fn(r)) ?? 0) + 1);
  console.log(`  by ${label}: ` + [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([k, n]) => `${k} ${n}`).join(" · "));
};
tally((r) => r.lastLabel || "(none)", "status");
tally((r) => r.owner || "(none)", "owner");
tally((r) => LABELS[r.ref] ?? r.ref, "source");
const windowDays = Math.min(DAYS, 30);
const recentDead = dead.filter((r) => r.age <= HORIZON_DAYS + windowDays).length;
console.log(`\n  ${(recentDead / windowDays).toFixed(1)} records/day crossing from open to never-going-to-book.`);
console.log(`  Drive that to zero by contacting them before day ${HORIZON_DAYS}, not by closing faster.`);

/* ---- the metric warning ---- */
console.log(`\n${"=".repeat(W)}`);
console.log(`WHY THIS DOES NOT RANK BY "LAST TOUCHED"`);
console.log(`${"=".repeat(W)}`);
console.log(`  v1 of this report did, and flagged 1,105 records as urgent — the whole book.`);
console.log(`  The metric was also invalid: staleness values repeat EXACTLY across dozens of`);
console.log(`  records (40+ at 15.4d, 46+ at 13.5d), each group one owner and one status.`);
console.log(`  Nobody touches forty leads in the same second. "Last touch" is when ProABD`);
console.log(`  last pushed us a BATCH of events, not when a human worked the record.`);
console.log(`  It measures our data pipeline. v2 ranks on age, status and price instead.`);
console.log(`\n  Consequence: we still cannot measure agent response time from this feed.`);
console.log(`  That gap is already recorded in claude/formfill-optimization-spec.md`);
console.log(`  ("agent_first_contact untrackable — Brian/Export-API limitation") and it`);
console.log(`  blocks the contact-protocol RCT in claude/lead-source-study-protocol.md §9.`);
console.log(`\n  Paste any ABD_Id into ProABD for contact details.`);
console.log(`  --top N per agent · --agent <name> · --csv for the full list\n`);
process.exit(0);
