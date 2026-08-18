/**
 * Preview the Monday weekly report against REAL data, without deploying,
 * without a dev server, and without sending anything.
 *
 * It imports the SAME module the cron route uses
 * (src/lib/reports/weeklyReport.mjs), so if this preview looks right, the email
 * is right — there is no second implementation to drift. That is the whole
 * reason the logic was pulled out of the route.
 *
 * Ad spend: this script does NOT call the Google Ads API — that client is
 * TypeScript and this runs on plain node. Pass spend by hand to check the money
 * figures, or run it with none to exercise the graceful-degradation path (every
 * spend figure renders as an em dash, never as $0, because $0 reads as a real
 * number). The live route gets spend from fetchAdsCostByDay automatically.
 *
 * Usage:
 *   node scripts/weekly-report-preview.mjs
 *   node scripts/weekly-report-preview.mjs --spend 1791,1736,1624,1123 --mtd 3537
 *   node scripts/weekly-report-preview.mjs --clean       # render what Ben receives
 *   node scripts/weekly-report-preview.mjs --send you@example.com
 *   node scripts/weekly-report-preview.mjs --raw         # skip P4 dedup (diagnostic)
 *   node scripts/weekly-report-preview.mjs --narrative narrative.json --clean --send you@example.com
 *
 * Writes weekly-report-preview.html in the repo root. --send also emails it to
 * you via Resend so you can edit and forward it from your own client.
 */
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { writeFileSync } from "node:fs";
import {
  computeFigures, renderWeeklyReport, ymd, prettyPT, money, cplOf, gcplOf, ptOffset,
} from "../src/lib/reports/weeklyReport.mjs";

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
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const CLEAN = argv.includes("--clean");
const CEILING = Number(arg("ceiling") ?? 7000);
const MTD_OVERRIDE = arg("mtd") != null ? Number(arg("mtd")) : null;
/** Oldest → newest, matching the four columns in the chart. */
const SPEND = (arg("spend") ?? "").split(",").map(Number).filter((x) => Number.isFinite(x) && x > 0);
const NOW = arg("now") ? new Date(`${arg("now")}T09:00:00${ptOffset(new Date())}`) : new Date();
const SEND_TO = arg("send");
const RAW = argv.includes("--raw");
const NARRATIVE_PATH = arg("narrative");
/* The four written blocks. Supplied, they render as prose; absent, as loud
   yellow placeholders. There is no rules-based middle ground on purpose — see
   the 2026-08-07 incident, where a route explained a number it had not
   measured. A human writes these or they stay visibly empty. */
let narrative = {};
if (NARRATIVE_PATH) {
  const { readFileSync } = await import("node:fs");
  try { narrative = JSON.parse(readFileSync(NARRATIVE_PATH, "utf8")); }
  catch (e) { console.error(`Could not read --narrative ${NARRATIVE_PATH}: ${e.message}`); process.exit(1); }
}

console.log(`\nReading leads ... (as of ${prettyPT(NOW)} Pacific)`);
const since = new Date(NOW.getTime() - 40 * 864e5);
const snap = await db.collection("leads")
  .where("createdAt", ">=", since).orderBy("createdAt", "desc").limit(2000).get();

const leads = snap.docs
  .map((d) => { const x = d.data(); return { at: x.createdAt?.toDate?.() ?? null, lead: x }; })
  .filter((x) => x.at);
console.log(`${snap.size} lead docs · ${leads.length} with a usable createdAt\n`);

/* Build a Pacific-keyed daily spend map from --spend by spreading each week's
   total evenly across its seven days. Even spreading is fine here: every figure
   the report derives from spend is a weekly or monthly TOTAL, so within-week
   distribution cancels out. Month-to-date is taken from --mtd when given. */
const byDay = new Map();
if (SPEND.length) {
  const startOfTodayPT = new Date(`${ymd(NOW)}T00:00:00${ptOffset(NOW)}`);
  SPEND.slice(-4).forEach((total, idx, arr) => {
    const back = arr.length - 1 - idx;
    const s = new Date(startOfTodayPT.getTime() - (back + 1) * 7 * 864e5);
    for (let i = 0; i < 7; i++) {
      const k = ymd(new Date(s.getTime() + i * 864e5));
      byDay.set(k, (byDay.get(k) ?? 0) + total / 7);
    }
  });
}

const f = computeFigures({ leads, byDay, now: NOW, ceiling: CEILING, unique: !RAW });
if (MTD_OVERRIDE != null) {
  f.mtd = MTD_OVERRIDE;
  f.projected = f.adDaysElapsed ? (f.mtd / f.adDaysElapsed) * f.adDaysTotal : 0;
  f.overUnder = f.projected - f.ceiling;
}

const adsNote = SPEND.length ? "" : "No --spend supplied, so spend is unknown in this preview";
const { subject, html, text, unfilled } = renderWeeklyReport(f, { adsNote, mode: CLEAN ? "clean" : "draft", narrative });

const W = 78, hr = () => console.log("=".repeat(W));
hr(); console.log("FIGURES"); hr();
console.log(`  reporting week   ${prettyPT(f.weekStart)} – ${prettyPT(f.weekEnd)}  (${ymd(f.weekStart)} → ${ymd(f.weekEnd)})`);
console.log(`  ad days          ${f.adDaysElapsed} of ${f.adDaysTotal} weekdays in ${f.monthName}`);
console.log(`  month to date    ${f.mtd ? money(f.mtd) : "—"} of ${money(f.ceiling)}   projected ${f.projected ? money(f.projected) : "—"}`);
console.log();
console.log(`  population       ${RAW ? "RAW lead records (--raw: diagnostic only)" : "P4 unique leads — the population /admin reports"}`);
console.log();
console.log("  " + "week".padEnd(9) + "total".padStart(7) + "web".padStart(6) + "calls".padStart(7) +
  "attrib".padStart(8) + "spend".padStart(9) + "blended".padStart(9) + "google".padStart(9));
console.log("  " + "-".repeat(W - 4));
for (const w of f.weeks) {
  console.log("  " + prettyPT(w.start).padEnd(9) + String(w.total).padStart(7) + String(w.web).padStart(6) +
    String(w.calls).padStart(7) + String(w.attributed).padStart(8) +
    (w.spend ? money(w.spend) : "—").padStart(9) +
    (w.spend ? money(cplOf(w)) : "—").padStart(9) +
    (w.spend && w.attributed ? money(gcplOf(w)) : "—").padStart(9));
}
console.log();
console.log("  " + "week".padEnd(9) + "raw".padStart(7) + "unique".padStart(8) + "collapsed".padStart(11));
console.log("  " + "-".repeat(35));
f.weeks.forEach((w, i) => {
  const raw = f.rawWeeks[i];
  console.log("  " + prettyPT(w.start).padEnd(9) + String(raw).padStart(7) +
    String(w.total).padStart(8) + String(raw - w.total).padStart(11));
});
const collapsed = f.rawWeeks.reduce((a, b) => a + b, 0) - f.totals4;
if (collapsed > 0) {
  console.log(`\n  ${collapsed} record(s) collapsed into existing lead entities across the four weeks.`);
  console.log(`  A repeat caller, or a form fill followed by a call, is ONE lead — not two.`);
}
console.log(`\n  subject: ${subject}`);
if (f.suspiciousZero) console.log(`\n  ⚠ ZERO LEADS in the reporting week — the live route flags this loudly and does not treat it as fact.`);

/* Sanity checks — the point of a preview is to catch a wrong number, not to
   admire a layout. */
hr(); console.log("CHECKS"); hr();
const checks = [];
const dayCount = Math.round((f.weekEnd - f.weekStart) / 864e5);
checks.push(["reporting week is 7 days", dayCount === 7 ? "ok" : `FAIL (${dayCount})`]);
checks.push(["week ends before today", f.weekEnd < NOW ? "ok" : "FAIL — week is not complete"]);
checks.push(["weeks do not overlap",
  f.weeks.every((w, i) => i === 0 || w.start.getTime() === f.weeks[i - 1].end.getTime() + 1) ? "ok" : "FAIL"]);
checks.push(["4-week total = sum of weeks",
  f.totals4 === f.weeks.reduce((a, w) => a + w.total, 0) ? "ok" : "FAIL"]);
checks.push(["web + calls = total per week",
  f.weeks.every((w) => w.web + w.calls === w.total) ? "ok" : "FAIL"]);
checks.push(["attributed <= total",
  f.weeks.every((w) => w.attributed <= w.total) ? "ok" : "FAIL"]);
checks.push(["no UTC dates in html", /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(html) ? "FAIL" : "ok"]);
checks.push(["no canvas/svg/script/img", /<(canvas|svg|script|img)\b/i.test(html) ? "FAIL" : "ok"]);
checks.push(["no payroll figure leaked", /\$?\s*700\s*(\/|per)?\s*(agent|week)/i.test(html) ? "FAIL" : "ok"]);
checks.push([CLEAN ? "no draft chrome (clean mode)" : "draft banner present",
  CLEAN ? (/DRAFT — not sent|DRAFT &mdash; not sent/.test(html) ? "FAIL" : "ok")
        : (/DRAFT/.test(html) ? "ok" : "FAIL")]);
const todos = (html.match(/&#9997;/g) ?? []).length;
checks.push(["narrative blocks filled",
  unfilled.length === 0 ? "ok (4 of 4)" : `${4 - unfilled.length} of 4 — missing: ${unfilled.join(", ")}`]);
checks.push(["placeholder count matches", todos === unfilled.length ? "ok" : `FAIL (${todos} boxes, ${unfilled.length} unfilled)`]);
let bad = 0;
for (const [name, res] of checks) {
  if (res.startsWith("FAIL")) bad++;
  console.log(`  ${res.startsWith("FAIL") ? "✗" : "✓"} ${name.padEnd(34)} ${res}`);
}

const out = "weekly-report-preview.html";
writeFileSync(out, html, "utf8");
console.log(`\n  wrote ${out} (${(html.length / 1024).toFixed(1)} KB) — open it in a browser`);
console.log(`  ${bad ? `${bad} CHECK(S) FAILED` : "all checks passed"}`);

if (SEND_TO) {
  if (bad) {
    console.log(`\n  REFUSING TO SEND — ${bad} check(s) failed. Fix them first.\n`);
    process.exit(1);
  }
  if (CLEAN && unfilled.length) {
    console.log(`\n  REFUSING TO SEND — --clean renders the version that goes to Ben, and ${unfilled.length}`);
    console.log(`  narrative block(s) are still empty: ${unfilled.join(", ")}.`);
    console.log(`  Supply them with --narrative, or drop --clean to send yourself the draft.\n`);
    process.exit(1);
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log("\n  RESEND_API_KEY not set in .env.local — cannot send.\n"); process.exit(1); }
  const { Resend } = await import("resend");
  const from = process.env.LEADS_FROM_EMAIL ?? "Auto Line Logistics <onboarding@resend.dev>";
  const { data, error } = await new Resend(key).emails.send({
    from, to: [SEND_TO],
    subject: `${CLEAN ? "" : "[DRAFT] "}${subject}`,
    text, html,
  });
  if (error) { console.log(`\n  SEND FAILED: ${error.message ?? JSON.stringify(error)}\n`); process.exit(1); }
  console.log(`\n  sent to ${SEND_TO} (id ${data?.id ?? "?"}).`);
  console.log(`  ${CLEAN
    ? "Clean mode — no draft banner, no yellow blocks. Ready to forward once you have added the narrative."
    : "Draft mode — the red banner and four yellow blocks are still in it. Fill them in, delete the banner and subject strip, then forward."}\n`);
}
process.exit(bad ? 1 : 0);
