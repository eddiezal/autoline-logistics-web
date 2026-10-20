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
 * Usage (gcloud ADC):  node scripts/booking-delay-curve.mjs
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
const EVENTS_START = new Date("2026-07-08T00:00:00-07:00");
const SEASON_DAYS = 21;
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
    .select("entity_id", "received_at", "raw_item.ABD_Id", "raw_item.Referrer_Id", "raw_item.Create_Date", "raw_item.Booked_Date", "raw_item.Item_Type")
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
    if (!r) { r = { abd, created: null, bookedAt: null, firstOrderSeen: null, ref: "" }; rec.set(abd, r); }
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
const seasonCut = now - SEASON_DAYS * DAY;
const BUCKETS = [0, 1, 2, 3, 5, 7, 10, 14, 21]; // "within N days" (calendar days, floor of delay)
const out = {};
let negative = 0, noCreate = 0;
for (const r of rec.values()) {
  if (testAbd.has(r.abd)) continue;
  if (!r.created) { noCreate++; continue; }
  if (r.created.getTime() > seasonCut) continue;
  // Booking time: Booked_Date when present; else the first time the record was
  // seen as an order (mirror clock, upper bound on the true time).
  const bookedAt = r.bookedAt ?? r.firstOrderSeen;
  const g = GROUP(r.ref);
  const o = (out[g] ??= { source: g, leads: 0, booked: 0, delays: [] });
  o.leads++;
  if (!bookedAt) continue;
  let delayDays = (bookedAt.getTime() - r.created.getTime()) / DAY;
  if (delayDays < -0.5) { negative++; continue; } // booked before created: data error, skip
  if (delayDays < 0) delayDays = 0;
  o.booked++;
  o.delays.push(delayDays);
}

const pct = (x) => `${Math.round(x * 100)}%`;
console.log(`\nSeasoned (created ≥${SEASON_DAYS}d ago), tests excluded. Skipped: ${noCreate} no Create_Date, ${negative} booked-before-created.\n`);
console.log("Share of eventual bookings landed within N days of the lead (cumulative):");
console.log(`${"source".padEnd(16)} ${"leads".padStart(6)} ${"booked".padStart(6)} ${"close".padStart(6)} ` + BUCKETS.map((b) => `≤${b}d`.padStart(5)).join(" ") + "   median  p90  max");
const result = { readAt: new Date(now).toISOString(), seasonDays: SEASON_DAYS, buckets: BUCKETS, sources: {} };
const all = { source: "ALL", leads: 0, booked: 0, delays: [] };
for (const o of Object.values(out)) { all.leads += o.leads; all.booked += o.booked; all.delays.push(...o.delays); }
for (const o of [...Object.values(out).sort((a, b) => b.booked - a.booked), all]) {
  const ds = o.delays.slice().sort((a, b) => a - b);
  const n = ds.length;
  const cum = BUCKETS.map((b) => (n ? ds.filter((d) => d < b + 1).length / n : null));
  const q = (p) => (n ? ds[Math.min(n - 1, Math.floor(p * n))] : null);
  result.sources[o.source] = { leads: o.leads, booked: o.booked, close: o.leads ? o.booked / o.leads : null, cumulative: Object.fromEntries(BUCKETS.map((b, i) => [b, cum[i]])), medianDays: q(0.5), p90Days: q(0.9), maxDays: n ? ds[n - 1] : null };
  console.log(
    `${o.source.padEnd(16)} ${String(o.leads).padStart(6)} ${String(o.booked).padStart(6)} ${(o.leads ? pct(o.booked / o.leads) : "—").padStart(6)} ` +
    cum.map((c) => (c == null ? "—" : pct(c)).padStart(5)).join(" ") +
    `   ${n ? q(0.5).toFixed(1) : "—"}d  ${n ? q(0.9).toFixed(1) : "—"}d  ${n ? ds[n - 1].toFixed(1) : "—"}d`,
  );
}

// Same-day detail for ALL: hours, since "same day" may mean minutes.
const hrs = all.delays.filter((d) => d < 1).map((d) => d * 24).sort((a, b) => a - b);
if (hrs.length) {
  const h = (p) => hrs[Math.min(hrs.length - 1, Math.floor(p * hrs.length))].toFixed(1);
  console.log(`\nSame-day bookings (${hrs.length} of ${all.delays.length}): median ${h(0.5)}h, p75 ${h(0.75)}h, p90 ${h(0.9)}h after the lead.`);
}

writeFileSync("../booking-delay-curve.json", JSON.stringify(result, null, 2));
console.log("\nWrote ../booking-delay-curve.json");
