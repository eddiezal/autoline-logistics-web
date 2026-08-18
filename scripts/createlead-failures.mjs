/**
 * Why do some website leads never reach ProABD?
 *
 * v2, 2026-08-16 — CORRECTS A HEADLINE FIGURE v1 GOT WRONG BY ~4x.
 *
 * ── THE v1 ERROR ─────────────────────────────────────────────────────────────
 * v1 filtered leads from 2026-07-08, the date the WEBHOOK STREAM began, and
 * reported "12.4% of website leads never reach ProABD." But the createLead
 * integration did not go live until **2026-07-14 8:01 PM PT** (commit 537250b,
 * per claude/proabd-createlead-integration-notes.md). Leads created before that
 * moment COULD NOT carry a proabdAbdId — there was no integration to stamp one.
 *
 * Of v1's 13 "failures": 10 predate the integration entirely, 1 is launch day
 * (live at 8:01 PM, so a daytime lead predates it), and **2 are genuine** —
 * Jul 20 and Aug 12. The real rate is roughly 2-4%, not 12.4%.
 *
 * Two v1 conclusions collapse with it:
 *   · "gclid missing on 0% of unlinked vs 53.3% of linked" looked decisive
 *     (P≈5e-05). But Google Ads was still being rebuilt in early July, so
 *     pre-launch leads have no gclid BY CONSTRUCTION. Same date confound.
 *   · "status field on 13 of 13 unlinked" was never compared against LINKED
 *     leads. If every lead has one it is a generic status field and proves
 *     nothing. v1 simply omitted the control.
 *
 * Lesson, and it is the second instance today: pick the date that matches the
 * MECHANISM, not the date the data happens to start.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * v2 therefore:
 *   0. Enumerates what fields lead docs actually carry, instead of guessing.
 *      (v1 guessed locale/lang/language and got "(unset)" on all 105 — the
 *      Spanish hypothesis was never tested, only mis-tested.)
 *   1. Splits every rate at the integration-live timestamp and reports the
 *      post-launch number as the headline.
 *   2. Prints the FULL day table with denominators, not only failure days.
 *   3. Compares field presence and status values between linked and unlinked
 *      POST-LAUNCH leads only.
 *
 * PII: counts, rates, dates, field names and presence. Values only for keys on
 * a safe allowlist. Never a name, email, phone or address.
 *
 * Usage:
 *   node scripts/createlead-failures.mjs
 *   node scripts/createlead-failures.mjs --days 60
 *   node scripts/createlead-failures.mjs --census    # just the lead-doc field list
 */

import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
const CENSUS_ONLY = argv.includes("--census");
const PT = "America/Los_Angeles";

/** The date that matters. Not when the data starts — when the MECHANISM starts. */
const INTEGRATION_LIVE = new Date("2026-07-14T20:01:00-07:00");

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const pad = (s, n) => String(s).padEnd(n);
const rp = (s, n) => String(s).padStart(n);
const pct = (n, d) => (d ? (n / d * 100).toFixed(1) + "%" : "—");
const ymd = (d) => d.toLocaleDateString("en-CA", { timeZone: PT });
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v.toDate instanceof Function);

const PII = /(name|email|mail|phone|cell|tel|address|addr|street|city|zip|postal|contact|customer|shipper|ip\b)/i;
const SAFE = /(locale|lang|status|source|tier|stage|type|state|version|referrer|gclid|utm|medium|campaign|device|sync|error|fail|abd|test)/i;

console.log(`\nReading leads (last ${DAYS}d) ...`);
const snap = await db.collection("leads").where("createdAt", ">=", new Date(Date.now() - DAYS * 864e5)).get();

/* ---------- 0. FIELD CENSUS — stop guessing at field names ---------- */
const census = new Map();
const walk = (o, prefix, depth) => {
  if (depth > 2 || !isObj(o)) return;
  for (const [k, v] of Object.entries(o)) {
    const p = prefix ? `${prefix}.${k}` : k;
    let f = census.get(p);
    if (!f) { f = { n: 0, vals: new Set() }; census.set(p, f); }
    const s = str(v);
    if (s && s !== "null") {
      f.n++;
      if (SAFE.test(p) && !PII.test(p) && f.vals.size < 6 && !isObj(v)) f.vals.add(s.slice(0, 20));
    }
    if (isObj(v)) walk(v, p, depth + 1);
  }
};

const rows = [];
for (const doc of snap.docs) {
  const d = doc.data();
  if (d.source === "call" || str(d.leadRef).startsWith("CALL-")) continue;
  const t = d.createdAt?.toDate?.() ?? null;
  if (!t) continue;
  walk(d, "", 0);
  rows.push({ id: doc.id, t, d, linked: !!str(d.proabdAbdId), post: t >= INTEGRATION_LIVE });
}

console.log(`\n${"=".repeat(78)}\n[0] LEAD-DOC FIELD CENSUS (${rows.length} web-form leads)\n${"=".repeat(78)}`);
console.log(`  v1 guessed at locale/lang/language and got "(unset)" on every record — the`);
console.log(`  Spanish hypothesis was never tested, only mis-tested. Here is what exists.`);
console.log(`  ${pad("field", 34)}${rp("populated", 10)}${rp("%", 8)}  values (safe keys only)`);
[...census.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 60).forEach(([k, f]) => {
  const vals = f.vals.size ? [...f.vals].join(", ") : (PII.test(k) ? "(withheld)" : "");
  console.log(`  ${pad(k.slice(0, 33), 34)}${rp(f.n, 10)}${rp(pct(f.n, rows.length), 8)}  ${vals.slice(0, 44)}`);
});
if (CENSUS_ONLY) process.exit(0);

/* ---------- 1. THE SPLIT THAT v1 MISSED ---------- */
const pre = rows.filter((r) => !r.post);
const post = rows.filter((r) => r.post);
const preUn = pre.filter((r) => !r.linked);
const postUn = post.filter((r) => !r.linked);

console.log(`\n${"=".repeat(78)}\n[1] BEFORE vs AFTER the integration went live (${ymd(INTEGRATION_LIVE)} 8:01 PM PT)\n${"=".repeat(78)}`);
console.log(`  ${pad("cohort", 34)}${rp("leads", 8)}${rp("unlinked", 10)}${rp("rate", 9)}`);
console.log(`  ${pad("BEFORE integration existed", 34)}${rp(pre.length, 8)}${rp(preUn.length, 10)}${rp(pct(preUn.length, pre.length), 9)}   <- not failures`);
console.log(`  ${pad("AFTER — the real failure rate", 34)}${rp(post.length, 8)}${rp(postUn.length, 10)}${rp(pct(postUn.length, post.length), 9)}   <- THE HEADLINE`);
console.log(`  ${pad("v1's conflated figure", 34)}${rp(rows.length, 8)}${rp(preUn.length + postUn.length, 10)}${rp(pct(preUn.length + postUn.length, rows.length), 9)}   <- wrong, ~4x inflated`);

/* ---------- 2. FULL day table, denominators visible ---------- */
console.log(`\n${"=".repeat(78)}\n[2] EVERY DAY — v1 printed only failure days, hiding the denominator\n${"=".repeat(78)}`);
const byDay = new Map();
for (const r of rows) {
  const k = ymd(r.t);
  if (!byDay.has(k)) byDay.set(k, { n: 0, bad: 0, post: r.post });
  const e = byDay.get(k);
  e.n++;
  if (!r.linked) e.bad++;
  if (r.post) e.post = true;
}
console.log(`  ${pad("day", 12)}${rp("leads", 7)}${rp("unlinked", 10)}  ${pad("era", 8)}bar`);
for (const k of [...byDay.keys()].sort()) {
  const e = byDay.get(k);
  console.log(`  ${pad(k, 12)}${rp(e.n, 7)}${rp(e.bad, 10)}  ${pad(k < ymd(INTEGRATION_LIVE) ? "pre" : "post", 8)}${e.bad ? "█".repeat(e.bad) : ""}`);
}

if (!postUn.length) {
  console.log(`\n  ZERO post-launch failures. The integration is working; v1's finding was an`);
  console.log(`  artifact start to finish. Referrer-0 records early in July are hand-keyed`);
  console.log(`  website leads from before the integration existed — a historical residue,`);
  console.log(`  not an ongoing bug. Nothing to fix here; look elsewhere for what referrer-0`);
  console.log(`  is made of TODAY.\n`);
  process.exit(0);
}

/* ---------- 3. POST-LAUNCH comparison, with the control v1 omitted ---------- */
console.log(`\n${"=".repeat(78)}\n[3] POST-LAUNCH ONLY — linked vs unlinked, ${postUn.length} failure(s)\n${"=".repeat(78)}`);
if (postUn.length < 5) {
  console.log(`  ⚠ ${postUn.length} failure(s). Nothing below is a rate — treat every line as a`);
  console.log(`    case note on individual records, never as a pattern.`);
}
const postLinked = post.filter((r) => r.linked);
const fields = [...census.keys()].filter((k) => !PII.test(k)).slice(0, 40);
console.log(`  ${pad("field", 34)}${rp("linked", 10)}${rp("unlinked", 11)}${rp("gap", 10)}`);
for (const k of fields) {
  const get = (r) => str(k.split(".").reduce((x, kk) => (x == null ? x : x[kk]), r.d));
  const a = postLinked.filter((r) => get(r)).length / (postLinked.length || 1);
  const b = postUn.filter((r) => get(r)).length / (postUn.length || 1);
  if (a === b) continue;
  const gap = (b - a) * 100;
  console.log(`  ${pad(k.slice(0, 33), 34)}${rp((a * 100).toFixed(0) + "%", 10)}${rp((b * 100).toFixed(0) + "%", 11)}${rp(gap.toFixed(0) + "pp", 10)}${Math.abs(gap) > 40 ? "  <<<" : ""}`);
}

/* ---------- 4. IS THE FAILURE RECORDED? now WITH the control ---------- */
console.log(`\n${"=".repeat(78)}\n[4] IS THE FAILURE RECORDED? (v1 checked unlinked only — no control)\n${"=".repeat(78)}`);
const statusVals = (set) => {
  const m = new Map();
  for (const r of set) m.set(str(r.d.status) || "(none)", (m.get(str(r.d.status) || "(none)") ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
console.log(`  status on post-launch LINKED  : ${statusVals(postLinked).map(([k, n]) => `${k}=${n}`).join(" · ")}`);
console.log(`  status on post-launch UNLINKED: ${statusVals(postUn).map(([k, n]) => `${k}=${n}`).join(" · ")}`);
const errFields = new Set();
for (const r of postUn) for (const k of Object.keys(r.d)) if (/error|fail/i.test(k)) errFields.add(k);
console.log(`  fields matching /error|fail/ on unlinked docs: ${errFields.size ? [...errFields].join(", ") : "NONE"}`);
if (!errFields.size) {
  console.log(`\n  Nothing records the failure. createLead returns HTTP 200 even when it fails`);
  console.log(`  (GOTCHA 1 — success is Status===1001, never res.ok), so a 2098 leaves the lead`);
  console.log(`  doc without a proabdAbdId and tells nobody. Even at ${pct(postUn.length, post.length)} that is worth fixing:`);
  console.log(`    1. Stamp proabdError + proabdErrorAt when Status !== 1001. You cannot`);
  console.log(`       diagnose what is never written down — this whole detour is the proof.`);
  console.log(`    2. Retry with backoff; some failures are transient.`);
  console.log(`    3. Alert on any lead >15 min old with no proabdAbdId. At this rate that is`);
  console.log(`       a near-silent alert, not noise.`);
}
console.log();
process.exit(0);
