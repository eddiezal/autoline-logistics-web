/**
 * Record inspector — answers "what IS this record?" from data we already hold.
 *
 * Built 2026-08-16 for three open questions the source-comparison run produced:
 *
 *  1. ORPHANS. 9 of 45 seasoned website records carry referrer 8/18493 but have
 *     no lead doc. 4 predate the createLead integration (hand-keyed, ours). 5 do
 *     NOT — created while the link was working and still untraceable. Only 2
 *     post-integration leads lack a proabdAbdId, so 5 orphans do not reconcile
 *     with 2 orphan leads: at least 3 never came from our form.
 *
 *     The Jul 20 coincidence is the one to settle: orphan record 37267612 and an
 *     unlinked lead doc were both created 2026-07-20. If they are the SAME lead,
 *     createLead SUCCEEDED and only the stamp-back failed (GOTCHA 2 — ProABD
 *     serves its JSON response with a non-JSON Content-Type, which already bit
 *     us live on AL-260715-PVB5C1). That makes it a link-recording bug, not an
 *     integration failure, and puts the true createLead failure rate near zero.
 *
 *  2. ZERO-FEE ORDERS. Taylor-premium — the supposedly exclusive feed — has a
 *     $0.00 minimum net broker fee and 2 orders under $100. On an exclusive feed
 *     that should not happen. Either the margin was given away, or the price /
 *     carrier-pay fields are wrong on those records.
 *
 *  3. Anything else worth a second look, via --ids.
 *
 * HOW THE MATCHING WORKS — and why it does not print anyone's details.
 * The question "is this record the same person as that lead?" needs identity
 * fields to answer. So the script answers it FOR you: it normalises email,
 * phone, and route+vehicle on both sides, compares them, and reports MATCHED /
 * NO MATCH with the matching basis and the lead's own reference (AL-...). No
 * customer name, email, phone or street address is ever printed. That is also
 * stricter than eyeballing, because a normalised comparison does not get tired.
 *
 * Usage (from autoline-logistics-web):
 *   node scripts/inspect-records.mjs --orphans     # the 9 unlinked website records
 *   node scripts/inspect-records.mjs --zero-fee    # booked orders with net fee < $100
 *   node scripts/inspect-records.mjs --ids 37267612,37260175
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
const ORPHANS = argv.includes("--orphans");
const ZERO_FEE = argv.includes("--zero-fee");
const idIdx = argv.indexOf("--ids");
const WANT = idIdx >= 0 ? String(argv[idIdx + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : [];
const FEE_FLOOR = 100;
const PT = "America/Los_Angeles";

const EVENTS_START = new Date("2026-07-08T00:00:00-07:00");
const INTEGRATION_LIVE = new Date("2026-07-14T20:01:00-07:00");
const OUR_REFERRERS = new Set(["8", "18493"]);
/** Acceptance-test records from claude/proabd-createlead-integration-notes.md.
 *  v1 of this script did not filter them and diagnosed all three as real. */
const KNOWN_TEST_ABD = new Set(["37256124", "37257079", "37257179", "37257192", "37287629", "37287650"]);
const KEEP_TESTS = argv.includes("--keep-tests");
const LABELS = { "0": "Not Selected", "8": "Website EN", "18493": "Website ES", "207": "iRelocation", "18": "Taylor-shared", "503": "Taylor-premium" };
const PRICE_PATHS = ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price", "Total_Tariff", "Tariff"];
const DEPOSIT_PATHS = ["Transport.Deposit", "Deposit"];
const CARRIER_PATHS = ["Transport.Carrier_Pay", "Carrier_Pay"];

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const dig = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
const ymd = (d) => (d ? d.toLocaleDateString("en-CA", { timeZone: PT }) : "—");
const money = (v) => (v == null ? "—" : `$${Number(v).toFixed(2)}`);
function pickNum(raw, paths) {
  for (const p of paths) {
    const v = dig(raw, p);
    const n = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
/* ProABD Create_Date/Booked_Date are NAIVE and are stored EASTERN, not Pacific.
   Measured at -3.00h with 0.00h spread across 10 id-linked records on 2026-08-17;
   see scripts/lib/proabd-time.mjs and the ledger entry it points at. Do NOT
   reintroduce a local parser here — six of them disagreed once already. */
const parseCreate = parseProabdDate;

/* ---- normalisers: identity is COMPARED, never displayed ---- */
const nEmail = (v) => str(v).toLowerCase().replace(/\s/g, "");
const nPhone = (v) => str(v).replace(/\D/g, "").slice(-10);
const nZip = (v) => str(v).replace(/\D/g, "").slice(0, 5);
const nVeh = (y, mk, md) => [str(y), str(mk).toLowerCase().replace(/\W/g, ""), str(md).toLowerCase().replace(/\W/g, "")].join("|");

console.log(`\nReading proabd_webhook_events + leads ...`);
const [evSnap, leadSnap] = await Promise.all([
  db.collection("proabd_webhook_events").where("received_at", ">=", EVENTS_START).get(),
  db.collection("leads").get(),
]);
console.log(`${evSnap.size} events · ${leadSnap.size} leads\n`);

/* ---- collapse ProABD records ---- */
const rec = new Map();
for (const doc of evSnap.docs) {
  const d = doc.data();
  const raw = d.raw_item ?? {};
  const abd = str(d.entity_id) || str(raw.ABD_Id);
  if (!abd) continue;
  let r = rec.get(abd);
  if (!r) {
    r = { abd, ref: "", created: null, bookedAt: null, firstUser: "", firstAt: Infinity,
          statuses: [], price: null, carrier: null, deposit: null, moneyAt: 0,
          email: "", phone: "", oZip: "", dZip: "", oState: "", dState: "", veh: "", booked: false };
    rec.set(abd, r);
  }
  const rid = str(raw.Referrer_Id);
  if (!r.ref && rid) r.ref = rid;
  const c = parseCreate(raw.Create_Date);
  if (c && (!r.created || c < r.created)) r.created = c;
  const b = parseCreate(raw.Booked_Date);
  if (b && (!r.bookedAt || b < r.bookedAt)) r.bookedAt = b;
  if ((str(raw.Item_Type) || str(d.entity_type)).toLowerCase() === "order" || str(raw.Booked_Date)) r.booked = true;

  const at = d.received_at?.toDate?.() ?? null;
  const t = at?.getTime() ?? 0;
  const u = str(raw.UserName);
  if (u && t < r.firstAt) { r.firstAt = t; r.firstUser = u; }
  const st = str(raw.Status);
  if (st && !r.statuses.some((x) => x.s === st)) r.statuses.push({ s: st, at });

  const px = pickNum(raw, PRICE_PATHS);
  if (px != null && t >= r.moneyAt) {
    r.moneyAt = t; r.price = px;
    r.carrier = pickNum(raw, CARRIER_PATHS);
    r.deposit = pickNum(raw, DEPOSIT_PATHS);
  }
  if (!r.email) r.email = nEmail(dig(raw, "Shipper.Email"));
  if (!r.phone) r.phone = nPhone(dig(raw, "Shipper.Phone_1"));
  if (!r.oZip) r.oZip = nZip(dig(raw, "Transport.Origin.Zipcode"));
  if (!r.dZip) r.dZip = nZip(dig(raw, "Transport.Destination.Zipcode"));
  if (!r.oState) r.oState = str(dig(raw, "Transport.Origin.State"));
  if (!r.dState) r.dState = str(dig(raw, "Transport.Destination.State"));
  if (!r.veh) {
    const v0 = Array.isArray(dig(raw, "Transport.Vehicles")) ? dig(raw, "Transport.Vehicles")[0] : null;
    if (v0) r.veh = nVeh(v0.v_year, v0.v_make, v0.v_model);
  }
}

/* ---- index our leads by every identity we can normalise ---- */
const leads = [];
for (const doc of leadSnap.docs) {
  const d = doc.data();
  leads.push({
    ref: str(d.leadRef) || doc.id,
    at: d.createdAt?.toDate?.() ?? null,
    abd: str(d.proabdAbdId),
    email: nEmail(dig(d, "contact.email")),
    phone: nPhone(dig(d, "contact.phone")),
    oZip: nZip(dig(d, "origin.zip")),
    dZip: nZip(dig(d, "destination.zip")),
    veh: nVeh(dig(d, "vehicle.year"), dig(d, "vehicle.make"), dig(d, "vehicle.model")),
  });
}
function matchLead(r) {
  for (const l of leads) if (l.email && r.email && l.email === r.email) return { l, how: "EMAIL" };
  for (const l of leads) if (l.phone && r.phone && l.phone === r.phone) return { l, how: "PHONE" };
  for (const l of leads) {
    if (!l.oZip || !l.dZip || !l.veh) continue;
    if (l.oZip === r.oZip && l.dZip === r.dZip && l.veh === r.veh) return { l, how: "ROUTE+VEHICLE" };
  }
  return null;
}

/* ---- pick the target set ---- */
const ourAbd = new Set(leads.filter((l) => l.abd).map((l) => l.abd));
let targets = [];
let heading = "";
if (ORPHANS || (!ZERO_FEE && !WANT.length)) {
  const cutoff = new Date(Date.now() - 14 * 864e5);
  targets = [...rec.values()].filter((r) =>
    OUR_REFERRERS.has(r.ref) && r.created && r.created >= EVENTS_START && r.created <= cutoff && !ourAbd.has(r.abd));
  heading = `ORPHANS — website-referrer records with no lead doc (${targets.length})`;
} else if (ZERO_FEE) {
  targets = [...rec.values()].filter((r) =>
    r.booked && r.price != null && r.carrier != null && (r.price - r.carrier) < FEE_FLOOR);
  heading = `LOW / ZERO FEE — booked orders with net broker fee under $${FEE_FLOOR} (${targets.length})`;
} else {
  targets = WANT.map((id) => rec.get(id)).filter(Boolean);
  heading = `REQUESTED RECORDS (${targets.length} of ${WANT.length} found)`;
}
const testDropped = targets.filter((r) => KNOWN_TEST_ABD.has(r.abd)).length;
if (testDropped && !KEEP_TESTS) targets = targets.filter((r) => !KNOWN_TEST_ABD.has(r.abd));
targets.sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
if (testDropped) console.log(`(excluded ${testDropped} known acceptance-test record(s) — --keep-tests to show them)\n`);

console.log("=".repeat(96));
console.log(heading);
console.log("=".repeat(96));
if (!targets.length) { console.log("  none found.\n"); process.exit(0); }

let matchedCount = 0;
for (const r of targets) {
  const m = matchLead(r);
  if (m) matchedCount++;
  const net = r.price != null && r.carrier != null ? r.price - r.carrier : null;
  console.log(`\n  ABD_Id ${r.abd}   created ${ymd(r.created)}   ${LABELS[r.ref] ?? "referrer " + r.ref}` +
    `${r.created && r.created < INTEGRATION_LIVE ? "   (PRE-integration)" : ""}`);
  console.log(`    created by       : ${r.firstUser || "(no username on first event)"}`);
  console.log(`    route            : ${r.oState || "?"} → ${r.dState || "?"}`);
  console.log(`    booked           : ${r.booked ? `yes, ${ymd(r.bookedAt)}` : "no"}`);
  if (r.price != null) {
    console.log(`    price ${rp(money(r.price), 10)}   carrier ${rp(money(r.carrier), 10)}   deposit ${rp(money(r.deposit), 10)}   NET FEE ${rp(money(net), 10)}`);
  }
  console.log(`    status history   : ${r.statuses.map((x) => x.s).join(" → ") || "(none)"}`);
  if (m) {
    console.log(`    ✅ MATCHES OUR LEAD ${m.l.ref}  (by ${m.how}, lead created ${ymd(m.l.at)})`);
    console.log(`       ${m.l.abd ? `that lead ALREADY carries proabdAbdId ${m.l.abd}` : "that lead carries NO proabdAbdId — the link was never stamped back"}`);
    if (!m.l.abd) {
      // The cause depends ENTIRELY on which side of the integration date this sits.
      // v1 asserted "stamp-back failed" for every match, which is impossible before
      // 2026-07-14 20:01 — there was no createLead call to stamp anything back.
      if (r.created && r.created < INTEGRATION_LIVE) {
        console.log(`       ⇒ PRE-integration: createLead did not exist yet, so this is NOT a`);
        console.log(`         stamp-back failure. An agent re-keyed the lead by hand from the`);
        console.log(`         notification. Genuinely ours — keep it in the website denominator.`);
      } else {
        console.log(`       ⇒ POST-integration: createLead SUCCEEDED and the STAMP-BACK failed —`);
        console.log(`         a link-recording bug (GOTCHA 2, non-JSON Content-Type on the response).`);
      }
    }
  } else {
    console.log(`    ❌ NO MATCH against any of our ${leads.length} lead docs (email, phone, route+vehicle).`);
    console.log(`       ⇒ this record did not come from our form. Someone set the referrer by hand.`);
  }
}

console.log(`\n${"=".repeat(96)}`);
console.log(`SUMMARY: ${matchedCount} of ${targets.length} matched one of our leads; ${targets.length - matchedCount} did not.`);
if (ORPHANS || (!ZERO_FEE && !WANT.length)) {
  console.log(`\n  MATCHED   ⇒ ours, link-recording bug. Fix the stamp-back; keep them in the`);
  console.log(`              website denominator. Close rate stays as reported.`);
  console.log(`  NO MATCH  ⇒ not ours. Referrer 8 is being hand-set on non-website leads, so`);
  console.log(`              the website denominator is INFLATED and the close rate UNDERSTATED.`);
  console.log(`              Fix is a data-entry convention, not code.`);
  console.log(`\n  Either way the pre-registered rule still holds the ceiling at $25 until 12`);
  console.log(`  bookings — this changes which number is right, not what we do this week.`);
}
console.log();
process.exit(0);
