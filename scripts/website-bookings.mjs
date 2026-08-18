/**
 * Find EVERY booking that came from our website — by any path, across all time.
 *
 * Built 2026-08-16 because the data and the sales floor disagree, and the sales
 * floor is the better witness.
 *
 * source-comparison.mjs reports 0 website bookings in the 21-day-mature cohort
 * and 4 in the 14-day cohort. Nelson says he has booked website leads on
 * multiple occasions. At least one of those is wrong, and after a day of
 * finding my own measurement defects the prior belongs on the measurement.
 *
 * FIVE WAYS THE COUNT COULD BE WRONG, all tested here:
 *
 *   1. COHORT WINDOW. The study only counts records CREATED Jul 8 - Aug 2 and
 *      seasoned. Anything booked from a lead created after Aug 2 is invisible to
 *      it by construction — and that is the most recent fortnight, i.e. exactly
 *      what someone would remember. This script applies NO cohort filter.
 *
 *   2. REFERRER IS NOT THE ONLY EVIDENCE. A booked record whose ABD_Id matches
 *      a proabdAbdId on one of our own lead docs came from our form, whatever
 *      referrer it carries. That is stronger evidence than Referrer_Id and this
 *      script leads with it.
 *
 *   3. LOST LINKS. A record can be ours with a broken id link. Matching on
 *      normalised email, phone, and route+vehicle catches those.
 *
 *   4. PHONE-ORIGIN WEBSITE LEADS. A visitor reads the site and calls. To an
 *      agent that is a website lead; in the CRM it may carry no referrer at all.
 *      Referrer 0 books at ~27%, the highest of any bucket, and one agent
 *      creates most of it. Cross-checked against CallRail here.
 *
 *   5. STAGE MODELLING. If booking creates a SEPARATE order record rather than
 *      advancing the lead record, the lead stays a lead forever and the booking
 *      lands on a different ABD_Id. The Item_Type census at the end shows
 *      whether records change stage in place.
 *
 * PII: counts, dates, ABD_Ids, our own AL- lead references, state-level routes,
 * prices. Never a customer name, email, phone or address.
 *
 * Usage:
 *   node scripts/website-bookings.mjs
 *   node scripts/website-bookings.mjs --days 90
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
const PT = "America/Los_Angeles";
const DAY = 864e5;

const CANCELED = "23";
const OUR_REFERRERS = new Set(["8", "18493"]);
const KNOWN_TEST_ABD = new Set(["37256124", "37257079", "37257179", "37257192", "37287629", "37287650"]);
const LABELS = { "0": "Unattributed", "8": "Website EN", "18493": "Website ES", "207": "iRelocation", "503": "Taylor-prem", "18": "Taylor-shared" };
const PRICE_PATHS = ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price"];
const CARRIER_PATHS = ["Transport.Carrier_Pay", "Carrier_Pay"];

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const dig = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
const ymd = (d) => (d ? d.toLocaleDateString("en-CA", { timeZone: PT }) : "—");
const nEmail = (v) => str(v).toLowerCase().replace(/\s/g, "");
const nPhone = (v) => str(v).replace(/\D/g, "").slice(-10);
const nZip = (v) => str(v).replace(/\D/g, "").slice(0, 5);
const nVeh = (y, mk, md) => [str(y), str(mk).toLowerCase().replace(/\W/g, ""), str(md).toLowerCase().replace(/\W/g, "")].join("|");
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

console.log(`\nReading everything — no cohort filter, no seasoning ...`);
const [evSnap, leadSnap] = await Promise.all([
  db.collection("proabd_webhook_events").where("received_at", ">=", new Date(Date.now() - DAYS * DAY)).get(),
  db.collection("leads").get(),
]);
console.log(`${evSnap.size} events · ${leadSnap.size} lead docs\n`);

/* ---- our leads, indexed every way we can match them ---- */
const leads = [];
const ourAbd = new Map();
for (const doc of leadSnap.docs) {
  const d = doc.data();
  const isCall = d.source === "call" || str(d.leadRef).startsWith("CALL-");
  const L = {
    ref: str(d.leadRef) || doc.id,
    at: d.createdAt?.toDate?.() ?? null,
    abd: str(d.proabdAbdId),
    isCall,
    email: nEmail(dig(d, "contact.email")),
    phone: nPhone(dig(d, "contact.phone")),
    oZip: nZip(dig(d, "origin.zip")),
    dZip: nZip(dig(d, "destination.zip")),
    veh: nVeh(dig(d, "vehicle.year"), dig(d, "vehicle.make"), dig(d, "vehicle.model")),
  };
  leads.push(L);
  if (L.abd) ourAbd.set(L.abd, L);
}
const webLeads = leads.filter((l) => !l.isCall);
const callLeads = leads.filter((l) => l.isCall);
console.log(`  our lead docs: ${webLeads.length} web-form · ${callLeads.length} CallRail`);
console.log(`  carrying a ProABD id: ${[...ourAbd.keys()].length}\n`);

/* ---- collapse records ---- */
const rec = new Map();
const itemTypeByAbd = new Map();
for (const doc of evSnap.docs) {
  const d = doc.data();
  const raw = d.raw_item ?? {};
  const abd = str(d.entity_id) || str(raw.ABD_Id);
  if (!abd) continue;
  let r = rec.get(abd);
  if (!r) {
    r = { abd, ref: "", created: null, bookedAt: null, booked: false, canceled: false,
          price: null, carrier: null, moneyAt: 0, owner: "", firstAt: Infinity,
          email: "", phone: "", oZip: "", dZip: "", oState: "", dState: "", veh: "", types: new Set() };
    rec.set(abd, r);
  }
  const rid = str(raw.Referrer_Id);
  if (!r.ref && rid) r.ref = rid;
  const c = parseCreate(raw.Create_Date);
  if (c && (!r.created || c < r.created)) r.created = c;
  const b = parseCreate(raw.Booked_Date);
  if (b && (!r.bookedAt || b < r.bookedAt)) r.bookedAt = b;
  const it = str(raw.Item_Type);
  if (it) r.types.add(it.toLowerCase());
  if (it.toLowerCase() === "order" || str(raw.Booked_Date)) r.booked = true;
  if (str(raw.Status_Id) === CANCELED) r.canceled = true;
  const at = d.received_at?.toDate?.() ?? null;
  const t = at?.getTime() ?? 0;
  const u = str(raw.UserName);
  if (u && t < r.firstAt) { r.firstAt = t; r.owner = u; }
  const px = pickNum(raw, PRICE_PATHS);
  if (px != null && t >= r.moneyAt) { r.moneyAt = t; r.price = px; r.carrier = pickNum(raw, CARRIER_PATHS); }
  if (!r.email) r.email = nEmail(dig(raw, "Shipper.Email"));
  if (!r.phone) r.phone = nPhone(dig(raw, "Shipper.Phone_1"));
  if (!r.oZip) r.oZip = nZip(dig(raw, "Transport.Origin.Zipcode"));
  if (!r.dZip) r.dZip = nZip(dig(raw, "Transport.Destination.Zipcode"));
  if (!r.oState) r.oState = str(dig(raw, "Transport.Origin.State"));
  if (!r.dState) r.dState = str(dig(raw, "Transport.Destination.State"));
  if (!r.veh) { const v0 = Array.isArray(dig(raw, "Transport.Vehicles")) ? dig(raw, "Transport.Vehicles")[0] : null; if (v0) r.veh = nVeh(v0.v_year, v0.v_make, v0.v_model); }
}

const booked = [...rec.values()].filter((r) => r.booked && !r.canceled && !KNOWN_TEST_ABD.has(r.abd));
console.log(`  booked records in window: ${booked.length}\n`);

/* ---- attribute every booking to our leads by the strongest available evidence ---- */
function attribute(r) {
  if (ourAbd.has(r.abd)) return { how: "ID LINK", lead: ourAbd.get(r.abd) };
  for (const l of webLeads) if (l.email && r.email && l.email === r.email) return { how: "email", lead: l };
  for (const l of webLeads) if (l.phone && r.phone && l.phone === r.phone) return { how: "phone", lead: l };
  for (const l of webLeads) if (l.oZip && l.dZip && l.veh && l.oZip === r.oZip && l.dZip === r.dZip && l.veh === r.veh) return { how: "route+vehicle", lead: l };
  for (const l of callLeads) if (l.phone && r.phone && l.phone === r.phone) return { how: "CALLRAIL phone", lead: l };
  return null;
}
const attributed = [];
for (const r of booked) { const a = attribute(r); if (a) attributed.push({ r, ...a }); }

console.log("=".repeat(94));
console.log("1. BOOKINGS THAT TIE BACK TO ONE OF OUR OWN LEADS — by any evidence, any date");
console.log("=".repeat(94));
console.log(`  ${attributed.length} of ${booked.length} booked records tie to a lead we generated.\n`);
if (attributed.length) {
  console.log("  " + pad("ABD_Id", 12) + pad("booked", 12) + pad("referrer", 14) + pad("matched by", 15) + pad("our ref", 20) + pad("route", 9) + rp("fee", 8));
  attributed.sort((a, b) => (a.r.bookedAt ?? 0) - (b.r.bookedAt ?? 0)).forEach(({ r, how, lead }) => {
    const fee = r.price != null && r.carrier != null ? `$${(r.price - r.carrier).toFixed(0)}` : "—";
    console.log("  " + pad(r.abd, 12) + pad(ymd(r.bookedAt), 12) + pad((LABELS[r.ref] ?? "id " + r.ref).slice(0, 13), 14) +
      pad(how, 15) + pad(lead.ref.slice(0, 19), 20) + pad(`${r.oState}→${r.dState}`, 9) + rp(fee, 8));
  });
  const byRef = new Map(), byHow = new Map();
  for (const a of attributed) {
    byRef.set(LABELS[a.r.ref] ?? a.r.ref, (byRef.get(LABELS[a.r.ref] ?? a.r.ref) ?? 0) + 1);
    byHow.set(a.how, (byHow.get(a.how) ?? 0) + 1);
  }
  console.log(`\n  by referrer on the record : ` + [...byRef.entries()].map(([k, n]) => `${k} ${n}`).join(" · "));
  console.log(`  by matching evidence      : ` + [...byHow.entries()].map(([k, n]) => `${k} ${n}`).join(" · "));
  const outside = attributed.filter((a) => !OUR_REFERRERS.has(a.r.ref)).length;
  if (outside) {
    console.log(`\n  ⚠ ${outside} of these are booked leads WE GENERATED that do NOT carry a website`);
    console.log(`    referrer. Every count based on Referrer_Id alone misses them, including`);
    console.log(`    every website close rate reported today.`);
  }
}

/* ---- 2. why the cohort missed them ---- */
console.log(`\n${"=".repeat(94)}`);
console.log("2. WOULD THE STUDY COHORT HAVE SEEN THESE?");
console.log("=".repeat(94));
const COHORT_START = new Date("2026-07-08T00:00:00-07:00");
const C14 = new Date("2026-08-02T23:59:59-07:00");
const C21 = new Date("2026-07-26T23:59:59-07:00");
let inC14 = 0, inC21 = 0, tooNew = 0, tooOld = 0;
for (const { r } of attributed) {
  if (!r.created) continue;
  if (r.created < COHORT_START) tooOld++;
  else if (r.created > C14) tooNew++;
  else { inC14++; if (r.created <= C21) inC21++; }
}
console.log(`  created after Aug 2  (invisible to BOTH cohorts) : ${tooNew}`);
console.log(`  created before Jul 8 (invisible to both)         : ${tooOld}`);
console.log(`  inside the 14-day cohort                        : ${inC14}`);
console.log(`  inside the 21-day cohort                        : ${inC21}`);
console.log(`\n  Seasoning always hides the most recent weeks. That is the fortnight an`);
console.log(`  agent remembers most clearly, which is exactly how a measurement and a`);
console.log(`  person end up disagreeing while both are telling the truth.`);

/* ---- 3. does a record change stage in place? ---- */
console.log(`\n${"=".repeat(94)}`);
console.log("3. DOES A LEAD BECOME AN ORDER IN PLACE, OR DOES BOOKING MAKE A NEW RECORD?");
console.log("=".repeat(94));
const combos = new Map();
for (const r of rec.values()) {
  const k = [...r.types].sort().join("+") || "(none)";
  combos.set(k, (combos.get(k) ?? 0) + 1);
}
[...combos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([k, n]) => console.log(`  ${rp(n, 6)}  ${k}`));
const multi = [...rec.values()].filter((r) => r.types.size > 1).length;
console.log(`\n  records seen at more than one stage: ${multi} of ${rec.size}`);
console.log(multi > rec.size * 0.05
  ? "  => records DO advance in place. A booking keeps the lead's referrer."
  : "  => records rarely change stage. If booking creates a SEPARATE order record,\n     the order may carry no referrer and the original lead stays open forever —\n     which would understate every source's close rate and inflate the open book.");

/* ---- 4. the unattributed bookings ---- */
console.log(`\n${"=".repeat(94)}`);
console.log("4. BOOKINGS WITH NO TIE TO US — for contrast");
console.log("=".repeat(94));
const rest = booked.filter((r) => !attributed.some((a) => a.r.abd === r.abd));
const byRef2 = new Map();
for (const r of rest) byRef2.set(LABELS[r.ref] ?? r.ref, (byRef2.get(LABELS[r.ref] ?? r.ref) ?? 0) + 1);
console.log("  " + [...byRef2.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · "));
console.log(`\n  Ask the agent who booked them. If any are website customers, referrer is`);
console.log(`  not recording origin and the fix is at data entry, not in the analysis.\n`);
process.exit(0);
