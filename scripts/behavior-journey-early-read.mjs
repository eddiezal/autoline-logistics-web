/**
 * Behavioral-journey EARLY READ — how the Aug 12/13 changes are tracking.
 *
 * Two site changes shipped mid-August and each has one number that decides
 * whether it worked:
 *
 *   Aug 12  Form Release 1 (fewer fields, fv="quote-r1-20260812" stamp)
 *           → completion rate on the NEW form vs the 22.0% baseline
 *             (54 of 245 starts, Jul 14–Aug 13 study window),
 *             plus field-level drop-off now that we can see it.
 *   Aug 13  Price-checker → quote handoff fix (commit 4f8182e: the CTAs had
 *           passed the wrong param names SINCE LAUNCH, so every click landed
 *           on an empty form) + the estimate-moment redesign (lock-this-price
 *           block under the anchor price).
 *           → PC→QUOTE handoff vs the 2.3% baseline — measured WITH the bug
 *             live, so the fix alone should move it
 *           → post-estimate exit vs the 87.0% baseline.
 *
 * This is deliberately NOT a full study refresh. The post window is a few
 * days. Every rate prints with a Wilson 95% interval and raw counts; nothing
 * here is a verdict. (Session lesson, four times over on 2026-08-17: a
 * trailing window that spans a configuration change does not forecast the
 * configuration you are now in — hence the hard PRE/POST split rather than
 * one blended window.)
 *
 * Definitions are the study's (behavioral-journey-spec): 30-min rolling sid,
 * conversion = lead doc joined by attribution.visitorId created within the
 * session +35min, double-submits folded (same vid within 10 min), test
 * submissions excluded (count printed, never the emails). One deliberate
 * cleanup vs the published text: "starts", "completions" and "non-starters"
 * are all SESSION-level totals from the same denominator, so
 * starts − completions = abandoned and reached − starts = never-started,
 * exactly. (The published study mixed transition counts into those totals —
 * the audit's blocking item; this script is the corrected arithmetic.)
 *
 * Usage: node scripts/behavior-journey-early-read.mjs
 *          [--split 2026-08-14] [--since 2026-07-14] [--verbose]
 *
 * Read-only. Prints counts, rates, field NAMES, PT dates — never a name,
 * email, phone or address.
 */
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

/* ---------------- args ---------------- */
const argVal = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
// Split = first full PT day with BOTH changes live (form shipped 8/12,
// handoff fix + estimate-moment block shipped 8/13 afternoon).
const SPLIT = new Date(`${argVal("--split", "2026-08-14")}T00:00:00-07:00`);
const SINCE = new Date(`${argVal("--since", "2026-07-14")}T00:00:00-07:00`);
const VERBOSE = process.argv.includes("--verbose");
const NOW = new Date();
const R1_FV = "quote-r1-20260812";

/* Published baselines (Jul 14 – Aug 13 study refresh) for side-by-side. */
const BASE = {
  reach: { p: 0.278, label: "27.8% (254/913)" },
  completion: { p: 0.220, label: "22.0% (54/245)" },
  handoff: { p: 0.023, label: "2.3% (measured WITH the param bug live)" },
  estExit: { p: 0.870, label: "87.0%" },
  startsPerWeek: 57,
};

const fmtPT = (d) => d.toLocaleString("en-US", {
  timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});
const dayPT = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const pct = (k, n) => (n ? `${((100 * k) / n).toFixed(1)}%` : "—");
function wilson(k, n) {
  if (!n) return "n=0";
  const z = 1.96, p = k / n, z2 = z * z;
  const den = 1 + z2 / n;
  const c = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return `${(100 * (c - half)).toFixed(1)}–${(100 * (c + half)).toFixed(1)}%`;
}

/* ---------------- fetch ---------------- */
console.log(`Early read — events since ${dayPT(SINCE)}, split at ${dayPT(SPLIT)} 00:00 PT, now ${fmtPT(NOW)} PT`);

const events = [];
{
  // Page through by ts to dodge the 10k default limits comfortably.
  let cursor = SINCE;
  for (;;) {
    const snap = await db.collection("site_events")
      .where("ts", ">=", cursor).orderBy("ts", "asc").limit(9000).get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const d = doc.data();
      const ts = d.ts?.toDate?.();
      if (!ts) continue;
      events.push({ ts, vid: d.vid, sid: d.sid, type: d.type, path: d.path ?? "", meta: d.meta ?? null, day: d.day });
    }
    const last = snap.docs[snap.docs.length - 1].data().ts?.toDate?.();
    if (!last || snap.size < 9000) break;
    cursor = new Date(last.getTime() + 1); // ms nudge; duplicate-safe enough at our volume
  }
}
events.sort((a, b) => a.ts - b.ts);
console.log(`  ${events.length} events`);

const leadSnap = await db.collection("leads")
  .where("createdAt", ">=", SINCE).orderBy("createdAt", "asc").limit(5000).get();
const leadsRaw = leadSnap.docs.map((d) => {
  const x = d.data();
  return {
    at: x.createdAt?.toDate?.(),
    vid: x.attribution?.visitorId ?? null,
    email: (x.contact?.email ?? "").toLowerCase(),
  };
}).filter((l) => l.at);

// Test submissions out; count printed, contents never.
const isTest = (l) => /test|zaldivar|example\.com/.test(l.email);
const testN = leadsRaw.filter(isTest).length;
let leads = leadsRaw.filter((l) => !isTest(l));
// Fold double-submits: same vid within 10 minutes.
leads.sort((a, b) => a.at - b.at);
const folded = [];
const lastByVid = new Map();
for (const l of leads) {
  const prev = l.vid ? lastByVid.get(l.vid) : null;
  if (prev && l.at - prev < 10 * 60_000) continue;
  folded.push(l);
  if (l.vid) lastByVid.set(l.vid, l.at);
}
console.log(`  ${leadsRaw.length} leads → ${testN} test excluded, ${leads.length - folded.length} double-submits folded → ${folded.length} used`);
leads = folded;

/* ---------------- sessions ---------------- */
const sessions = new Map(); // key → {events:[], vid}
for (const e of events) {
  if (!e.vid) continue;
  const key = `${e.vid}|${e.sid ?? "nosid:" + (e.day ?? dayPT(e.ts))}`;
  let s = sessions.get(key);
  if (!s) sessions.set(key, (s = { vid: e.vid, events: [] }));
  s.events.push(e);
}

// Price-checker paths derived from the data itself (estimate_shown with
// tool=route-checker), so a route rename can't silently misclassify.
const pcPaths = new Set();
for (const e of events) {
  if (e.type === "estimate_shown" && e.meta?.tool === "route-checker") pcPaths.add(e.path);
}
const stripLoc = (p) => p.replace(/^\/es(?=\/|$)/, "") || "/";
const isQuote = (p) => /^\/quote(\/|$)/.test(stripLoc(p));
console.log(`  price-checker paths observed: ${[...pcPaths].join(", ") || "(none — check tool meta)"}`);

// Conversion join: lead created in [session start, session end + 35min].
const leadsByVid = new Map();
for (const l of leads) {
  if (!l.vid) continue;
  if (!leadsByVid.has(l.vid)) leadsByVid.set(l.vid, []);
  leadsByVid.get(l.vid).push(l.at);
}
let joinedLeads = 0;
for (const s of sessions.values()) {
  const t0 = s.events[0].ts, t1 = s.events[s.events.length - 1].ts;
  s.start = t0;
  s.converted = (leadsByVid.get(s.vid) ?? []).some((at) => at >= t0 && at - t1 < 35 * 60_000);
  if (s.converted) joinedLeads++;

  s.quoteView = s.events.some((e) => e.type === "page_view" && isQuote(e.path));
  const started = s.events.filter((e) => e.type === "form_started");
  s.started = started.length > 0;
  s.fv = started.find((e) => e.meta?.fv)?.meta?.fv ?? (s.started ? null : undefined);
  s.persisted = s.events.some((e) => e.type === "lead_persisted");

  const est = s.events.filter((e) => e.type === "estimate_shown" && e.meta?.tool === "route-checker");
  s.sawPcEstimate = est.length > 0;
  if (s.sawPcEstimate) {
    const firstEst = est[0].ts;
    s.pcThenQuote = s.events.some((e) => e.ts > firstEst && e.type === "page_view" && isQuote(e.path));
    s.pcThenStart = s.events.some((e) => e.ts > firstEst && e.type === "form_started");
    s.endsOnEstimate = s.events[s.events.length - 1].type === "estimate_shown";
  }
}
console.log(`  ${sessions.size} sessions, ${joinedLeads} converted (joined), ${leads.length - joinedLeads} leads unmatched to a session`);

/* ---------------- windows ---------------- */
const inWin = (s, a, b) => s.start >= a && s.start < b;
const windows = [
  ["PRE  (baseline plumbing)", SINCE, SPLIT],
  ["POST (new form + fixed handoff)", SPLIT, NOW],
];

for (const [name, a, b] of windows) {
  const days = (Math.min(b, NOW) - a) / 864e5;
  const S = [...sessions.values()].filter((s) => inWin(s, a, b));
  const reach = S.filter((s) => s.quoteView);
  const starts = S.filter((s) => s.started);
  const comp = starts.filter((s) => s.converted);
  const pc = S.filter((s) => s.sawPcEstimate);
  const hand = pc.filter((s) => s.pcThenQuote);
  const handStart = pc.filter((s) => s.pcThenStart);
  const estExit = pc.filter((s) => s.endsOnEstimate);

  console.log(`\n===== ${name}  ${dayPT(a)} → ${dayPT(new Date(Math.min(b, NOW)))}  (${days.toFixed(1)}d, ${S.length} sessions) =====`);
  console.log(`  Quote funnel`);
  console.log(`    reached quote page      ${reach.length}`);
  console.log(`    started form            ${starts.length}  → reach-to-start ${pct(starts.length, reach.length)}  CI ${wilson(starts.length, reach.length)}   [baseline ${BASE.reach.label}]`);
  console.log(`    never started           ${reach.length - starts.length}  (reached − started, by construction)`);
  console.log(`    completed (lead joined) ${comp.length}  → completion ${pct(comp.length, starts.length)}  CI ${wilson(comp.length, starts.length)}   [baseline ${BASE.completion.label}]`);
  console.log(`    abandoned               ${starts.length - comp.length}  (started − completed, by construction)`);
  console.log(`    starts/week             ${(starts.length / days * 7).toFixed(1)}   [baseline ~${BASE.startsPerWeek}]`);
  console.log(`  Price checker (sessions with a route-checker estimate: ${pc.length})`);
  console.log(`    → quote page after est. ${hand.length}  = ${pct(hand.length, pc.length)}  CI ${wilson(hand.length, pc.length)}   [baseline ${BASE.handoff.label}]`);
  console.log(`    → started form after    ${handStart.length}  = ${pct(handStart.length, pc.length)}`);
  console.log(`    session ends on estimate ${estExit.length}  = ${pct(estExit.length, pc.length)}   [baseline ~${BASE.estExit.label}]`);
}

/* ---------------- form-version split (all data, stamp-defined) ---------------- */
console.log(`\n===== Completion by form version (stamp on form_started; window-independent) =====`);
const byFv = new Map();
for (const s of sessions.values()) {
  if (!s.started) continue;
  const k = s.fv ?? "(pre-R1, unstamped)";
  if (!byFv.has(k)) byFv.set(k, { n: 0, c: 0 });
  const g = byFv.get(k);
  g.n++; if (s.converted) g.c++;
}
for (const [k, g] of [...byFv.entries()].sort((x, y) => y[1].n - x[1].n)) {
  console.log(`  ${String(k).padEnd(24)} starts ${String(g.n).padStart(4)}  completed ${String(g.c).padStart(3)}  = ${pct(g.c, g.n)}  CI ${wilson(g.c, g.n)}`);
}

/* ---------------- field-level drop-off (R1 stamped sessions only) ---------------- */
console.log(`\n===== R1 field-level read (fv=${R1_FV}) =====`);
const focus = new Map(), complete = new Map(), lastField = new Map(), friction = new Map();
let r1Abandoned = 0;
for (const s of sessions.values()) {
  const ff = s.events.filter((e) => e.type === "form_field" && e.meta?.fv === R1_FV);
  if (!ff.length) continue;
  const seenFocus = new Set(), seenComplete = new Set();
  for (const e of ff) {
    if (e.meta.action === "focus") seenFocus.add(e.meta.field);
    if (e.meta.action === "complete") seenComplete.add(e.meta.field);
  }
  for (const f of seenFocus) focus.set(f, (focus.get(f) ?? 0) + 1);
  for (const f of seenComplete) complete.set(f, (complete.get(f) ?? 0) + 1);
  if (s.started && !s.converted) {
    r1Abandoned++;
    const lastF = [...ff].reverse().find((e) => e.meta.action === "focus")?.meta.field ?? "(none)";
    lastField.set(lastF, (lastField.get(lastF) ?? 0) + 1);
  }
  for (const e of s.events) {
    if (e.type === "form_friction" && e.meta?.fv === R1_FV) {
      const k = `${e.meta.kind}${e.meta.reason ? ":" + e.meta.reason : ""}`;
      friction.set(k, (friction.get(k) ?? 0) + 1);
    }
  }
}
console.log(`  Sessions touching a field (focus→complete rate):`);
for (const [f, n] of [...focus.entries()].sort((a, b) => b[1] - a[1])) {
  const c = complete.get(f) ?? 0;
  console.log(`    ${f.padEnd(18)} focused ${String(n).padStart(3)}  completed ${String(c).padStart(3)}  = ${pct(c, n)}`);
}
console.log(`  Last field focused before abandonment (${r1Abandoned} abandoned R1 sessions):`);
for (const [f, n] of [...lastField.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${f.padEnd(18)} ${n}`);
}
console.log(`  Friction events: ${friction.size ? "" : "none"}`);
for (const [k, n] of [...friction.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(30)} ${n}`);
}

/* ---------------- QC ---------------- */
console.log(`\n===== QC =====`);
const byDay = new Map();
for (const e of events) {
  const d = e.day ?? dayPT(e.ts);
  byDay.set(d, (byDay.get(d) ?? 0) + 1);
}
const daysList = [...byDay.keys()].sort();
const gaps = [];
for (let i = 1; i < daysList.length; i++) {
  const prev = new Date(daysList[i - 1]), cur = new Date(daysList[i]);
  if ((cur - prev) / 864e5 > 1) gaps.push(`${daysList[i - 1]}→${daysList[i]}`);
}
console.log(`  event days ${daysList[0]}…${daysList[daysList.length - 1]}, day gaps: ${gaps.length ? gaps.join(", ") : "none"}`);
const low = daysList.filter((d) => byDay.get(d) < 30);
console.log(`  days under 30 events (possible collection trouble): ${low.length ? low.map((d) => `${d}(${byDay.get(d)})`).join(", ") : "none"}`);
const persistedPost = [...sessions.values()].filter((s) => inWin(s, SPLIT, NOW) && s.persisted).length;
console.log(`  cross-check: POST sessions with lead_persisted event = ${persistedPost} (should sit near POST completed count)`);
if (VERBOSE) {
  const types = new Map();
  for (const e of events) types.set(e.type, (types.get(e.type) ?? 0) + 1);
  console.log(`  events by type: ${[...types.entries()].map(([t, n]) => `${t}=${n}`).join(", ")}`);
}
console.log(`\nRead this as an early read: the POST window is days, not weeks. If the`);
console.log(`handoff CI clears 2.3% it worked (the bug fix is mechanical); form-completion`);
console.log(`movement needs more starts before it means anything.`);
