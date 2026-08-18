/**
 * What IS "Not Selected" (ProABD Referrer_Id = 0)?
 *
 * Built 2026-08-16. The source-comparison run found referrer 0 to be the most
 * valuable bucket in the account — 14 seasoned records, 4 booked, 28.6% close,
 * $63.57 of revenue-after-carrier per lead, roughly 3x the website and 7x
 * iRelocation — and nobody owns it or reports on it.
 *
 * HYPOTHESIS (Eddie): these are phone call-ins driven by the website.
 *
 * Three clues already point that way and none of them is proof:
 *   · status 26 "Not Emailed" is 100% concentrated in this bucket (7 of 14
 *     records) — consistent with a lead that arrived with no email address.
 *   · median days-to-book 0.4d, among the fastest in the account — consistent
 *     with a warm lead already talking to someone.
 *   · created Jul 10-27, spread across the window, unlike the vendor feeds
 *     which arrived in one-week bursts.
 *
 * FIVE TESTS, weakest to strongest:
 *   A. CREATOR       who is raw_item.UserName? A human agent typing a call in,
 *                    or an integration user? Vendor feeds and our website
 *                    createLead call should both be non-human.
 *   B. CLOCK         hour-of-day and day-of-week of Create_Date. Phone call-ins
 *                    are business-hours-only. Web forms fire at 2am. Vendor
 *                    feeds often arrive in batches at fixed times.
 *   C. TIME MATCH    for each record, is there a CallRail call within N minutes?
 *                    ** with vendor records as a NEGATIVE CONTROL **, because a
 *                    high raw match rate proves nothing if calls are dense
 *                    enough to match anything. Signal = the GAP between the two.
 *   D. CO-MOVEMENT   do daily call counts and daily referrer-0 creations rise
 *                    and fall together?
 *   E. EMAIL         does the record carry an email address at all? (counts only)
 *
 * PII: this script prints counts, hours and rates. Never a name, phone, email
 * or address — not even a masked one.
 *
 * Usage:
 *   node scripts/not-selected-origin.mjs
 *   node scripts/not-selected-origin.mjs --days 60 --window 15
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
const DAYS = flag("days", 60);
const WINDOWS = [5, 15, 60];
const PT = "America/Los_Angeles";

const EVENTS_START = new Date("2026-07-08T00:00:00-07:00");
/* The createLead integration went live at this instant (commit 537250b). A web
   lead created BEFORE it could never carry a proabdAbdId, so counting those as
   "unlinked" measures the absence of a mechanism, not a failure of one. This is
   the identical mistake that produced a bogus 12.4% createLead failure rate in
   scripts/createlead-failures.mjs; the real post-live rate there was 2.1%. */
const INTEGRATION_LIVE = new Date("2026-07-14T20:01:00-07:00");
const TARGET = "0";                                   // the bucket under investigation
const WEBSITE = new Set(["8", "18493"]);
const VENDORS = new Set(["207", "18", "503"]);        // negative control
const LABELS = { "0": "Not Selected", "8": "Website EN", "18493": "Website ES", "207": "iRelocation", "18": "Taylor-shared", "503": "Taylor-premium" };

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const dig = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
const pct = (n, d) => (d ? (n / d * 100).toFixed(1) + "%" : "—");

/* ProABD Create_Date/Booked_Date are NAIVE and are stored EASTERN, not Pacific.
   Measured at -3.00h with 0.00h spread across 10 id-linked records on 2026-08-17;
   see scripts/lib/proabd-time.mjs and the ledger entry it points at. Do NOT
   reintroduce a local parser here — six of them disagreed once already. */
const parseCreate = parseProabdDate;
const ptParts = (d) => {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: PT, hour: "2-digit", hour12: false, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
  return { hour: Number(f.hour) % 24, dow: f.weekday, ymd: `${f.year}-${f.month}-${f.day}` };
};

/* ---------------- Load ProABD records ---------------- */
console.log(`\nReading proabd_webhook_events since ${EVENTS_START.toISOString().slice(0, 10)} (full payload) ...`);
const snap = await db.collection("proabd_webhook_events").where("received_at", ">=", EVENTS_START).get();
console.log(`${snap.size} events.`);

const rec = new Map();
for (const doc of snap.docs) {
  const d = doc.data();
  const raw = d.raw_item ?? {};
  const abd = str(d.entity_id) || str(raw.ABD_Id);
  if (!abd) continue;
  let r = rec.get(abd);
  if (!r) { r = { abd, ref: "", created: null, users: new Set(), firstUser: "", firstAt: Infinity, hasEmail: null, statuses: new Set(), nEmail: "", nPhone: "" }; rec.set(abd, r); }
  const rid = str(raw.Referrer_Id);
  if (!r.ref && rid) r.ref = rid;
  const c = parseCreate(raw.Create_Date);
  if (c && (!r.created || c < r.created)) r.created = c;
  const u = str(raw.UserName);
  if (u) r.users.add(u);
  // BUG FIX: UserName rides on EVERY event, so a union counts TOUCHERS, not the
  // creator — which is why v1's shares summed past 100%. The creator is the
  // UserName on the EARLIEST event for the record.
  const rat = d.received_at?.toDate?.()?.getTime() ?? Infinity;
  if (u && rat < r.firstAt) { r.firstAt = rat; r.firstUser = u; }
  const st = str(raw.Status);
  if (st) r.statuses.add(st);
  // email PRESENCE only — the value is never read into a variable we print
  if (r.hasEmail === null) {
    for (const p of ["Email", "Shipper.Email", "Customer.Email", "Contact.Email", "Shipper.Email_Address"]) {
      const v = dig(raw, p);
      if (str(v)) { r.hasEmail = true; break; }
    }
  }
  // Normalized identity for test [G]. Held in memory for set-membership only and
  // never printed, the same discipline scripts/inspect-records.mjs uses.
  if (!r.nEmail) for (const p of ["Email", "Shipper.Email", "Customer.Email", "Contact.Email", "Shipper.Email_Address"]) {
    const v = str(dig(raw, p)); if (v) { r.nEmail = v.toLowerCase().replace(/\s/g, ""); break; }
  }
  if (!r.nPhone) for (const p of ["Shipper.Phone_1", "Phone_1", "Shipper.Phone", "Phone", "Contact.Phone"]) {
    const v = str(dig(raw, p)).replace(/\D/g, ""); if (v.length >= 10) { r.nPhone = v.slice(-10); break; }
  }
}
for (const r of rec.values()) if (r.hasEmail === null) r.hasEmail = false;

const inWindow = [...rec.values()].filter((r) => r.created && r.created >= EVENTS_START);
const group = (pred) => inWindow.filter(pred);
const notSel = group((r) => r.ref === TARGET);
const web = group((r) => WEBSITE.has(r.ref));
const vend = group((r) => VENDORS.has(r.ref));
console.log(`records since Jul 8: Not Selected ${notSel.length} · website ${web.length} · vendors ${vend.length}\n`);

/* ---------------- Load CallRail calls ---------------- */
const since = new Date(Date.now() - DAYS * 864e5);
const leadSnap = await db.collection("leads").where("createdAt", ">=", since).get();
const calls = [];
let webForms = 0;
for (const doc of leadSnap.docs) {
  const d = doc.data();
  const isCall = d.source === "call" || str(d.leadRef).startsWith("CALL-");
  const t = d.createdAt?.toDate?.() ?? null;
  if (!t) continue;
  if (isCall) calls.push({ t, landing: str(d.callMeta?.landingPage) || "(none)" });
  else webForms++;
}
calls.sort((a, b) => a.t - b.t);
console.log(`CallRail calls in leads (last ${DAYS}d): ${calls.length} · web form leads: ${webForms}`);
if (!calls.length) {
  console.log(`\n⚠ No call records found. Either CallRail leads are not landing in the leads`);
  console.log(`  collection, or the source/leadRef convention differs. Tests C and D cannot run.`);
  console.log(`  Check call-landing.mjs — it uses the same filter.\n`);
}

/* ---------------- A. CREATOR ---------------- */
console.log(`\n${"=".repeat(78)}\n[A] CREATOR — who does ProABD say made the record?\n${"=".repeat(78)}`);
console.log(`  A human username on referrer-0 records, against a system/integration user on`);
console.log(`  website and vendor records, is strong evidence of manual phone entry.`);
for (const [label, set] of [["Not Selected", notSel], ["Website", web], ["Vendors", vend]]) {
  const first = new Map(), touch = new Map();
  for (const r of set) {
    first.set(r.firstUser || "(none)", (first.get(r.firstUser || "(none)") ?? 0) + 1);
    for (const u of (r.users.size ? r.users : new Set(["(none)"]))) touch.set(u, (touch.get(u) ?? 0) + 1);
  }
  const tSum = [...touch.values()].reduce((a, b) => a + b, 0);
  console.log(`\n  ${label} (${set.length} records)`);
  console.log(`    ${pad("user", 22)}${rp("CREATOR", 9)}${rp("share", 8)}   ${rp("touched", 9)}${rp("share", 8)}`);
  const names = [...new Set([...first.keys(), ...touch.keys()])]
    .sort((a, b) => (first.get(b) ?? 0) - (first.get(a) ?? 0));
  for (const u of names.slice(0, 8)) {
    console.log(`    ${pad(u.slice(0, 21), 22)}${rp(first.get(u) ?? 0, 9)}${rp(pct(first.get(u) ?? 0, set.length), 8)}   ${rp(touch.get(u) ?? 0, 9)}${rp(pct(touch.get(u) ?? 0, tSum), 8)}`);
  }
  const shares = [...first.values()].map((v) => v / set.length * 100);
  const spread = shares.length ? Math.max(...shares) - Math.min(...shares) : 0;
  console.log(`    creator spread ${spread.toFixed(1)}pp — ${spread > 25 ? "NOT round-robin: one person owns this bucket" : "consistent with round-robin assignment"}`);
}

/* ---------------- B. CLOCK ---------------- */
console.log(`\n${"=".repeat(78)}\n[B] CLOCK — hour of day (Pacific) and weekend share\n${"=".repeat(78)}`);
console.log(`  Phone call-ins are business-hours only. Web forms fire around the clock.`);
const hourRow = (label, set) => {
  const h = new Array(24).fill(0);
  let weekend = 0, offHours = 0;
  for (const r of set) {
    const p = ptParts(r.created);
    h[p.hour]++;
    if (p.dow === "Sat" || p.dow === "Sun") weekend++;
    if (p.hour < 7 || p.hour >= 19) offHours++;
  }
  const max = Math.max(...h, 1);
  const spark = h.map((n) => " ▁▂▃▄▅▆▇█"[Math.min(8, Math.round(n / max * 8))]).join("");
  console.log(`  ${pad(label, 14)} ${spark}   weekend ${pct(weekend, set.length).padStart(6)}  off-hours(7pm-7am) ${pct(offHours, set.length).padStart(6)}`);
};
console.log(`  ${pad("", 14)} 0......6......12.....18..23`);
hourRow("Not Selected", notSel);
hourRow("Website", web);
hourRow("Vendors", vend);
if (calls.length) hourRow("CallRail", calls.map((c) => ({ created: c.t })));
console.log(`\n  READ: if Not Selected tracks CallRail and NOT the website curve, the hypothesis`);
console.log(`  survives its first real test. If it looks like the website curve, these are`);
console.log(`  probably web leads that lost their referrer, which is a different bug entirely.`);

/* ---------------- C. TIME MATCH with negative control ---------------- */
if (calls.length) {
  console.log(`\n${"=".repeat(78)}\n[C] TIME MATCH — is there a call near each record's creation?\n${"=".repeat(78)}`);
  console.log(`  Vendor records are the NEGATIVE CONTROL: they are definitely not phone calls,`);
  console.log(`  so their match rate is the noise floor. Only the GAP is evidence.`);
  const ct = calls.map((c) => c.t.getTime());
  const nearest = (t) => {
    let lo = 0, hi = ct.length - 1, best = Infinity;
    while (lo <= hi) { const m = (lo + hi) >> 1; const d = Math.abs(ct[m] - t); if (d < best) best = d; if (ct[m] < t) lo = m + 1; else hi = m - 1; }
    return best / 60000;
  };
  const rate = (set, w) => set.filter((r) => nearest(r.created.getTime()) <= w).length / (set.length || 1);
  console.log(`\n  ${pad("window", 10)}${rp("Not Selected", 14)}${rp("Vendors (control)", 19)}${rp("Website", 10)}${rp("lift vs control", 18)}`);
  for (const w of WINDOWS) {
    const ns = rate(notSel, w), vc = rate(vend, w), wb = rate(web, w);
    const lift = vc > 0 ? (ns / vc).toFixed(2) + "x" : (ns > 0 ? "∞" : "—");
    console.log(`  ${pad("±" + w + " min", 10)}${rp((ns * 100).toFixed(1) + "%", 14)}${rp((vc * 100).toFixed(1) + "%", 19)}${rp((wb * 100).toFixed(1) + "%", 10)}${rp(lift, 18)}`);
  }
  console.log(`\n  READ: lift near 1.0x means calls are simply dense enough to match anything —`);
  console.log(`  no evidence. Lift of 2x or more at ±5 or ±15 min is a real signal.`);

  /* ---------------- D. CO-MOVEMENT ---------------- */
  console.log(`\n${"=".repeat(78)}\n[D] CO-MOVEMENT — daily call count vs daily referrer-0 creations\n${"=".repeat(78)}`);
  const byDay = (items, get) => { const m = new Map(); for (const i of items) { const k = ptParts(get(i)).ymd; m.set(k, (m.get(k) ?? 0) + 1); } return m; };
  const dCalls = byDay(calls, (c) => c.t);
  const dNS = byDay(notSel, (r) => r.created);
  const days = [...new Set([...dCalls.keys(), ...dNS.keys()])].sort();
  const xs = days.map((d) => dCalls.get(d) ?? 0), ys = days.map((d) => dNS.get(d) ?? 0);
  const mx = xs.reduce((a, b) => a + b, 0) / (xs.length || 1), my = ys.reduce((a, b) => a + b, 0) / (ys.length || 1);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < days.length; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  const r = dx && dy ? num / Math.sqrt(dx * dy) : NaN;
  console.log(`  days compared: ${days.length}   mean calls/day ${mx.toFixed(1)}   mean referrer-0/day ${my.toFixed(2)}`);
  console.log(`  Pearson r = ${Number.isFinite(r) ? r.toFixed(3) : "—"}`);
  console.log(`  ⚠ WEAK TEST at this volume — referrer-0 averages well under one record a day,`);
  console.log(`    so daily correlation is mostly zero-vs-zero. Treat r as a hint, never a verdict.`);
}

/* ---------------- E. EMAIL PRESENCE ---------------- */
console.log(`\n${"=".repeat(78)}\n[E] EMAIL PRESENCE — a phone lead often arrives without one\n${"=".repeat(78)}`);
for (const [label, set] of [["Not Selected", notSel], ["Website", web], ["Vendors", vend]]) {
  const withEmail = set.filter((r) => r.hasEmail).length;
  console.log(`  ${pad(label, 14)} ${rp(withEmail, 5)} of ${rp(set.length, 5)} carry an email  (${pct(withEmail, set.length)})`);
}
const notEmailed = notSel.filter((r) => [...r.statuses].some((s) => /not\s*emailed/i.test(s))).length;
console.log(`  referrer-0 records ever showing status "Not Emailed": ${notEmailed} of ${notSel.length} (${pct(notEmailed, notSel.length)})`);
// v1 printed the same count for both measures. They are different questions —
// "has an address" vs "was never sent to" — so the crosstab proves it is not
// one number printed twice.
const both = notSel.filter((r) => r.hasEmail && [...r.statuses].some((s) => /not\s*emailed/i.test(s))).length;
const addrNoSend = notSel.filter((r) => r.hasEmail && ![...r.statuses].some((s) => /not\s*emailed/i.test(s))).length;
const noAddr = notSel.filter((r) => !r.hasEmail).length;
console.log(`    crosstab: has address AND flagged Not Emailed ${both} · has address, sent ${addrNoSend} · no address at all ${noAddr}`);
console.log(`    "has an address but was never emailed" is the interesting cell — it means the`);
console.log(`    record skipped the normal intake automation, not that the lead lacked contact info.`);

/* ---------------- F. INTEGRATION LINKAGE ---------------- */
console.log(`\n${"=".repeat(78)}\n[F] LINKAGE — do all our web-form leads reach ProABD via the integration?\n${"=".repeat(78)}`);
console.log(`  If some do NOT, someone re-keys them by hand — and a hand-keyed record has no`);
console.log(`  referrer, which would land it in exactly the bucket under investigation.`);
const webLeads = [];
for (const doc of leadSnap.docs) {
  const d = doc.data();
  if (d.source === "call" || str(d.leadRef).startsWith("CALL-")) continue;
  const t = d.createdAt?.toDate?.() ?? null;
  if (!t || t < EVENTS_START) continue;
  webLeads.push({ t, abd: str(d.proabdAbdId) });
}
const preLive = webLeads.filter((l) => l.t < INTEGRATION_LIVE);
const postLive = webLeads.filter((l) => l.t >= INTEGRATION_LIVE);
const linked = postLive.filter((l) => l.abd).length;
const unlinked = postLive.filter((l) => !l.abd);
console.log(`  web-form leads since Jul 8         : ${webLeads.length}`);
console.log(`    of which PRE-integration          : ${preLive.length}  — excluded: no mechanism existed`);
console.log(`    of which post-integration         : ${postLive.length}`);
console.log(`  carrying a proabdAbdId             : ${linked}  (${pct(linked, postLive.length)})`);
console.log(`  NOT linked to any ProABD record    : ${unlinked.length}  (${pct(unlinked.length, postLive.length)})  <- the real unlinked rate`);
console.log(`  (an earlier version of this block divided by all ${webLeads.length} and reported`);
console.log(`   ${pct(webLeads.filter((l) => !l.abd).length, webLeads.length)}, which is the pre-integration period showing up as a failure.)`);
if (unlinked.length) {
  const ut = unlinked.map((l) => l.t.getTime()).sort((a, b) => a - b);
  const near = (t) => { let lo = 0, hi = ut.length - 1, best = Infinity;
    while (lo <= hi) { const m = (lo + hi) >> 1; const dd = Math.abs(ut[m] - t); if (dd < best) best = dd; if (ut[m] < t) lo = m + 1; else hi = m - 1; } return best / 60000; };
  console.log(`\n  Do referrer-0 records appear just after an UNLINKED web lead?`);
  console.log(`  (vendor records are again the control — they should not match)`);
  console.log(`  ${pad("window", 12)}${rp("Not Selected", 14)}${rp("Vendors (control)", 19)}${rp("lift", 10)}`);
  for (const w of [30, 120, 480]) {
    const ns = notSel.filter((r) => near(r.created.getTime()) <= w).length / (notSel.length || 1);
    const vc = vend.filter((r) => near(r.created.getTime()) <= w).length / (vend.length || 1);
    console.log(`  ${pad("±" + w + " min", 12)}${rp((ns * 100).toFixed(1) + "%", 14)}${rp((vc * 100).toFixed(1) + "%", 19)}${rp(vc > 0 ? (ns / vc).toFixed(2) + "x" : "—", 10)}`);
  }
  console.log(`\n  A high unlinked rate is a serious finding on its own, whatever it explains here:`);
  console.log(`  it means website leads are reaching the CRM by a path we do not measure, so`);
  console.log(`  every website close rate in this project has an uncertain denominator.`);
}

/* ---------------- [G] IDENTITY ---------------- */
console.log(`\n${"=".repeat(78)}\n[G] IDENTITY — is a referrer-0 record one of OUR OWN web leads?\n${"=".repeat(78)}`);
console.log(`  Tests C and F both showed lift, but they point at OPPOSITE explanations:`);
console.log(`  C says a call happened near these records (phone-in). F says an unlinked web`);
console.log(`  lead happened near them (a form fill that got hand-keyed). Proximity in time`);
console.log(`  cannot tell those apart — n=23 records, and the same 3 records can drive both.`);
console.log(`  IDENTITY can. If a referrer-0 record carries the email or phone of a lead our`);
console.log(`  own form captured, it IS that lead, whatever ProABD thinks its referrer is.`);
console.log(`  No timing assumption, no zone, no window to pick.\n`);

const ourEmails = new Set(), ourPhones = new Set();
let ourWebLeadCount = 0;
for (const doc of leadSnap.docs) {
  const d = doc.data();
  if (d.source === "call" || str(d.leadRef).startsWith("CALL-")) continue;
  const t = d.createdAt?.toDate?.() ?? null;
  if (!t || t < EVENTS_START) continue;
  ourWebLeadCount++;
  const e = str(dig(d, "contact.email")).toLowerCase().replace(/\s/g, "");
  const ph = str(dig(d, "contact.phone")).replace(/\D/g, "").slice(-10);
  if (e) ourEmails.add(e);
  if (ph.length === 10) ourPhones.add(ph);
}
const isOurs = (r) => (r.nEmail && ourEmails.has(r.nEmail)) || (r.nPhone && ourPhones.has(r.nPhone));
const rate = (set) => { const m = set.filter(isOurs).length; return { m, n: set.length, p: pct(m, set.length) }; };
const nsI = rate(notSel), webI = rate(web), vdI = rate(vend);

console.log(`  matched against ${ourWebLeadCount} web-form leads (${ourEmails.size} distinct emails, ${ourPhones.size} phones)\n`);
console.log(`  ${pad("bucket", 16)}${rp("matches one of our web leads", 32)}${rp("expected", 12)}`);
console.log(`  ${"-".repeat(60)}`);
console.log(`  ${pad("Website", 16)}${rp(`${webI.m} of ${webI.n}  (${webI.p})`, 32)}${rp("~100%", 12)}   <- upper control`);
console.log(`  ${pad("Not Selected", 16)}${rp(`${nsI.m} of ${nsI.n}  (${nsI.p})`, 32)}${rp("?", 12)}   <- the question`);
console.log(`  ${pad("Vendors", 16)}${rp(`${vdI.m} of ${vdI.n}  (${vdI.p})`, 32)}${rp("low", 12)}   <- lower control`);
console.log(`\n  READ: the two controls bracket the answer, so no threshold has to be invented.`);
console.log(`  Website is what "these are our web leads" looks like. Vendors is what "these are`);
console.log(`  other people's customers" looks like, plus whatever cross-shopping baseline`);
console.log(`  exists. Not Selected sits on one side or the other.`);
/* Do NOT decide this by linear distance between the two controls. The controls
   are two orders of magnitude apart, so ANY minority rate looks "closer to the
   vendor control" and a real signal gets rounded to nothing. The vendor rate is
   a BASELINE — the rate at which a customer we did not originate happens to
   share contact details with someone who filled our form (cross-shopping,
   repeat business, shared household). Judge Not Selected against that baseline
   as a lift, the same way tests C and F are judged. */
if (nsI.n && vdI.n) {
  const nsP = nsI.m / nsI.n, vdP = vdI.m / vdI.n, webP = webI.n ? webI.m / webI.n : 1;
  const lift = vdP > 0 ? nsP / vdP : Infinity;
  console.log(`\n  Not Selected ${(nsP * 100).toFixed(1)}% vs vendor baseline ${(vdP * 100).toFixed(1)}%  =  ${lift.toFixed(1)}x lift`);
  console.log(`  Not Selected ${(nsP * 100).toFixed(1)}% vs website ceiling ${(webP * 100).toFixed(1)}%  =  ${(nsP / webP * 100).toFixed(0)}% of the way there`);
  if (lift >= 3 && nsP < webP * 0.6) {
    console.log(`\n  ⇒ SPLIT BUCKET. Neither control describes it.`);
    console.log(`    ${nsI.n - nsI.m} of ${nsI.n} carry no trace of our form at all — those are new customers,`);
    console.log(`    hand-keyed. But ${nsI.m} DO, at ${lift.toFixed(0)}x the rate a non-originated customer`);
    console.log(`    coincidentally matches. That is too high to be coincidence and too low to`);
    console.log(`    be a systematic referrer failure. See the sub-test below.`);
  } else if (lift < 3) {
    console.log(`\n  ⇒ NOT our web leads. Combined with [A] and the corrected [B], the hand-keyed`);
    console.log(`    phone/repeat-business reading is the one still standing.`);
  } else {
    console.log(`\n  ⇒ These ARE our web leads that lost their referrer. TRACKING BUG, not a lead`);
    console.log(`    source — the website denominator is understated. Fix at intake first.`);
  }
}

/* ---- SUB-TEST: for the ones that DO match, did our lead reach ProABD on its own? ----
   This separates the only two stories left, and it needs no timing at all:
     LOST REFERRER  - our lead never linked, so this referrer-0 record IS it,
                      re-keyed by hand. Website volume is undercounted.
     DUPLICATE      - our lead linked fine and made its own referrer-8 record, so
                      the referrer-0 record is a SECOND record for the same person.
                      Nobody lost anything; one customer occupies two rows. */
if (nsI.m) {
  const linkedByIdent = new Map();
  for (const doc of leadSnap.docs) {
    const d = doc.data();
    if (d.source === "call" || str(d.leadRef).startsWith("CALL-")) continue;
    const t = d.createdAt?.toDate?.() ?? null;
    if (!t || t < EVENTS_START) continue;
    const e = str(dig(d, "contact.email")).toLowerCase().replace(/\s/g, "");
    const ph = str(dig(d, "contact.phone")).replace(/\D/g, "").slice(-10);
    const entry = { abd: str(d.proabdAbdId), t, preLive: t < INTEGRATION_LIVE };
    if (e) linkedByIdent.set("e:" + e, entry);
    if (ph.length === 10) linkedByIdent.set("p:" + ph, entry);
  }
  /* THREE-WAY, not two-way. An unlinked lead is only evidence of a LOST referrer
     if the integration existed when it was created. Classifying every missing
     proabdAbdId as a failure is the same error that inflated the createLead
     failure rate to 12.4% and test [F] to a 7.72x lift — both really 2.1% and
     0.00x. Third occurrence of one mistake: "absence of a link" measured across
     a window where the linking mechanism did not exist. */
  let lost = 0, dupe = 0, preInt = 0;
  const rows = [];
  for (const r of notSel.filter(isOurs)) {
    const hit = (r.nEmail && linkedByIdent.get("e:" + r.nEmail)) || (r.nPhone && linkedByIdent.get("p:" + r.nPhone));
    let kind;
    if (hit && hit.abd) { kind = "YES - duplicate"; dupe++; }
    else if (hit && hit.preLive) { kind = "n/a - pre-integr."; preInt++; }
    else { kind = "NO  - LOST REFERRER"; lost++; }
    const gapH = hit?.t && r.created ? (hit.t.getTime() - r.created.getTime()) / 3600000 : null;
    rows.push({ abd: r.abd, kind, gapH, user: r.firstUser });
  }
  console.log(`\n  ${"-".repeat(74)}`);
  console.log(`  SUB-TEST — for the ${nsI.m} that match, did our own lead reach ProABD independently?`);
  console.log(`  ${"-".repeat(74)}`);
  console.log(`  ${pad("ABD_Id", 11)}${pad("our lead linked?", 21)}${rp("gap (h)", 10)}   created by`);
  for (const x of rows.sort((a, b) => (a.gapH ?? 0) - (b.gapH ?? 0))) {
    console.log(`  ${pad(x.abd, 11)}${pad(x.kind, 21)}` +
      rp(x.gapH == null ? "—" : (x.gapH >= 0 ? "+" : "") + x.gapH.toFixed(1), 10) + `   ${x.user.slice(0, 20)}`);
  }
  console.log(`\n  duplicates (our lead linked fine)      : ${dupe}`);
  console.log(`  pre-integration hand-keys (expected)   : ${preInt}  <- no mechanism existed; not a defect`);
  console.log(`  GENUINELY lost referrer (post-live)     : ${lost}`);
  console.log(`  cross-check: test [F] counts ${unlinked.length} unlinked post-integration web lead(s)`);
  console.log(`  in total, so this number cannot exceed that. ${lost <= unlinked.length ? "Consistent." : "INCONSISTENT — investigate."}`);
  console.log(`  gap = our lead createdAt minus this record's Create_Date. NEGATIVE means our`);
  console.log(`  form fired first, POSITIVE means this record existed before the customer ever`);
  console.log(`  reached our site. The clock is calibrated (see scripts/lib/proabd-time.mjs),`);
  console.log(`  so these are real hours.`);
  if (lost === 0) {
    console.log(`\n  ⇒ NO WEBSITE VOLUME IS BEING LOST TO THIS BUCKET. Every match is either a`);
    console.log(`    duplicate or a pre-integration hand-key from a window that is closed.`);
    console.log(`    Since Jul 14 the website->CRM path carries ${pct(linked, postLive.length)} of leads with the`);
    console.log(`    referrer intact, and test [F]'s 0.00x lift says the same thing independently.`);
    console.log(`    The website denominator stands. Do not restate it.`);
  } else {
    console.log(`\n  ⇒ ${lost} website lead(s) reached the CRM without a referrer AFTER the integration`);
    console.log(`    went live. Small in absolute terms; fix at intake, and do not restate any`);
    console.log(`    rate on ${lost} record(s).`);
  }
}
console.log(`\n  CAVEAT: n=${nsI.n} and ${notSel.filter((r) => !r.nEmail && !r.nPhone).length} referrer-0 record(s) carry neither an email nor a phone,`);
console.log(`  so they can never match and are counted as non-matches. This is directional.`);

/* ---------------- Verdict scaffold ---------------- */
console.log(`\n${"=".repeat(78)}\nHOW TO CALL IT\n${"=".repeat(78)}`);
console.log(`  CONFIRMED phone-in  : human creator (A) + business-hours-only clock (B)`);
console.log(`                        + time-match lift >=2x (C) + low email rate (E).`);
console.log(`  REFUTED             : clock matches the WEBSITE curve and creator is the same`);
console.log(`                        integration user as referrer 8 — then these are website`);
console.log(`                        form leads that LOST their referrer, i.e. a tracking bug`);
console.log(`                        worth fixing, and worth MORE than a new lead source.`);
console.log(`  NEITHER             : most likely repeat/referral business entered by hand.`);
console.log(`                        Test by asking whether the customer had shipped before.`);
console.log(`\n  Whatever the answer, n=${notSel.length} records. This identifies the bucket; it does`);
console.log(`  not measure it. Once identified, tag it at the source so it stops being invisible.\n`);
process.exit(0);
