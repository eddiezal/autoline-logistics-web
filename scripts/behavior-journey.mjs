/**
 * Behavioral journey analysis — within-session Markov (Phase 0 + 1).
 *
 * Spec: claude/behavioral-journey-spec.md (2026-08-10). Models sessions as
 * sequences through page/action states with two absorbing states
 * (CONVERTED, EXIT), then reports the transition matrix, absorption
 * probabilities, exit hot spots, and form completion.
 *
 * DESCRIPTIVE, NOT CAUSAL. P(convert | saw estimate) is selection-biased:
 * people who ask for prices were already hotter. This ranks where
 * attention and drop-off live; it does not prove interventions.
 *
 * Usage:
 *   node scripts/behavior-journey.mjs             # last 30 days
 *   node scripts/behavior-journey.mjs --days 45   # events exist since 7/22
 *
 * Requires FIREBASE_PROJECT_ID in .env.local + gcloud ADC.
 */
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const DAYS = Number(flag("days")) || 30;
const MIN_CELL = 20; // suppress probabilities on thinner support (spec rule)

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) { console.error("Missing FIREBASE_PROJECT_ID"); process.exit(1); }
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const since = new Date(Date.now() - DAYS * 864e5);
console.log(`\nBEHAVIORAL JOURNEY — last ${DAYS} days (since ${since.toISOString().slice(0, 10)})`);
console.log("Descriptive, not causal. Probabilities on <" + MIN_CELL + " observations print as '·'.\n");

// ---------- state mapping --------------------------------------------------
function pageState(path) {
  const p = (path ?? "").replace(/^\/es(?=\/|$)/, "") || "/";
  if (p === "/") return "HOME";
  if (p === "/quote") return "QUOTE";
  if (p.startsWith("/tools/route-price-checker")) return "PRICE_CHECKER";
  if (p.startsWith("/tools/ship-vs-drive")) return "SHIP_VS_DRIVE";
  if (p.startsWith("/tools")) return "TOOLS_OTHER";
  if (p.startsWith("/corridors")) return "CORRIDOR";
  if (p.startsWith("/blog")) return "BLOG";
  if (p.startsWith("/resources")) return "GUIDES";
  if (/^\/(price|damage|people)-promise/.test(p)) return "PROMISES";
  if (p.startsWith("/anti-scam")) return "ANTI_SCAM";
  return "OTHER";
}
function eventState(e) {
  switch (e.type) {
    case "page_view": return pageState(e.path);
    case "form_started": return "FORM_STARTED";
    case "estimate_shown": return "ESTIMATE_SHOWN";
    case "tool_result": return "TOOL_RESULT";
    case "estimate_email_captured": return "EMAIL_CAPTURED";
    default: return null; // unknown types: counted in QC, excluded from chains
  }
}
const ts = (e) => e.ts?.toDate?.() ?? (e.ts ? new Date(e.ts) : null);

// ---------- load events ----------------------------------------------------
const evSnap = await db.collection("site_events")
  .where("ts", ">=", since).limit(20000).get();
const events = evSnap.docs.map((d) => d.data());
if (events.length === 20000) console.log("⚠ event LIMIT HIT (20k) — counts are floors\n");

// ---------- load + dedupe conversions -------------------------------------
const INTERNAL = [/eddiezal28@gmail\.com/i, /@zaldivarlabs\.com/i, /@superflosystems\.com/i, /\btest(ing)?\b/i];
const isInternal = (d) => {
  const hay = [d.contact?.email, `${d.contact?.firstName ?? ""} ${d.contact?.lastName ?? ""}`, d.contact?.notes]
    .filter(Boolean).join(" | ");
  return INTERNAL.some((re) => re.test(hay));
};
const leadSnap = await db.collection("leads")
  .where("createdAt", ">=", since).orderBy("createdAt", "asc").limit(1000).get();
const rawLeads = leadSnap.docs.map((d) => d.data())
  .filter((d) => !(d.source === "call" || String(d.leadRef ?? "").startsWith("CALL-")))
  .filter((d) => !isInternal(d));
// dedupe double-submits: same vid within 2 minutes counts once
const leads = [];
for (const l of rawLeads) {
  const t = l.createdAt?.toDate?.();
  const vid = l.attribution?.visitorId;
  if (!t) continue;
  const dup = leads.find((p) => p.vid && vid && p.vid === vid && Math.abs(p.t - t) < 120000);
  if (dup) { dup.dupes++; continue; }
  leads.push({ t, vid, ref: l.leadRef, dupes: 0 });
}
const dupeCount = leads.reduce((s, l) => s + l.dupes, 0);
const leadsByVid = new Map();
for (const l of leads) {
  if (!l.vid) continue;
  (leadsByVid.get(l.vid) ?? leadsByVid.set(l.vid, []).get(l.vid)).push(l);
}

// ---------- sessionize -----------------------------------------------------
const sessions = new Map(); // sid -> {vid, events:[]}
let orphans = 0, unknownTypes = 0;
for (const e of events) {
  if (!e.sid) { orphans++; continue; }
  if (eventState(e) === null && e.type) unknownTypes++;
  const s = sessions.get(e.sid) ?? { vid: e.vid ?? null, events: [] };
  s.events.push(e);
  if (!s.vid && e.vid) s.vid = e.vid;
  sessions.set(e.sid, s);
}
for (const s of sessions.values()) s.events.sort((a, b) => (ts(a) ?? 0) - (ts(b) ?? 0));

// ---------- build chains ---------------------------------------------------
const CONVERT_PAD_MS = 35 * 60 * 1000; // session end + rolling-window pad
const chains = [];
let converted = 0, singleEvent = 0;
const evPerSession = [];
for (const [, s] of sessions) {
  const seq = [];
  for (const e of s.events) {
    const st = eventState(e);
    if (!st) continue;
    if (seq[seq.length - 1] !== st) seq.push(st); // collapse consecutive repeats
  }
  if (!seq.length) continue;
  evPerSession.push(s.events.length);
  if (s.events.length === 1) singleEvent++;
  const start = ts(s.events[0]), end = ts(s.events[s.events.length - 1]);
  let didConvert = false;
  if (s.vid && start && end) {
    for (const l of leadsByVid.get(s.vid) ?? []) {
      if (l.t >= start && l.t <= new Date(end.getTime() + CONVERT_PAD_MS)) { didConvert = true; break; }
    }
  }
  if (didConvert) converted++;
  seq.push(didConvert ? "CONVERTED" : "EXIT");
  chains.push(seq);
}

// ---------- Phase 0: QC ----------------------------------------------------
evPerSession.sort((a, b) => a - b);
const pct = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0;
const dayCov = new Set(events.map((e) => e.day ?? ts(e)?.toISOString().slice(0, 10)).filter(Boolean));
console.log("── PHASE 0: DATA QUALITY ──────────────────────────────");
console.log(`  events: ${events.length}   sessions: ${chains.length}   orphan events (no sid): ${orphans}   unknown types: ${unknownTypes}`);
console.log(`  events/session: p50=${pct(evPerSession, 0.5)}  p90=${pct(evPerSession, 0.9)}  max=${evPerSession[evPerSession.length - 1] ?? 0}   single-event sessions: ${singleEvent} (${(100 * singleEvent / (chains.length || 1)).toFixed(0)}%)`);
console.log(`  distinct days with events: ${dayCov.size} of ${DAYS}`);
console.log(`  web leads in window: ${rawLeads.length} raw -> ${leads.length} deduped (${dupeCount} double-submits folded)`);
console.log(`  sessions labeled CONVERTED: ${converted}   (leads w/o a matching session = direct-to-form fast paths, beacon loss, or pre-window sessions: ${leads.length - converted})`);
const qcOk = chains.length >= 300 && converted >= 15;
console.log(`  GO/NO-GO: ${qcOk ? "GO — enough support for a first-order read" : "⚠ THIN — treat everything below as directional only"}\n`);

// ---------- Phase 1: transitions ------------------------------------------
const trans = new Map(); // "A→B" -> n
const outTotals = new Map(); // A -> n
const bump = (a, b) => {
  trans.set(`${a}→${b}`, (trans.get(`${a}→${b}`) ?? 0) + 1);
  outTotals.set(a, (outTotals.get(a) ?? 0) + 1);
};
for (const seq of chains) {
  bump("START", seq[0]);
  for (let i = 0; i < seq.length - 1; i++) bump(seq[i], seq[i + 1]);
}

const states = [...new Set([...outTotals.keys(),
  ...[...trans.keys()].map((k) => k.split("→")[1])])].filter((s) => s !== "START");
const nonAbsorbing = states.filter((s) => s !== "CONVERTED" && s !== "EXIT");

// entry table
console.log("── ENTRIES (START → state) ────────────────────────────");
const entries = [...trans.entries()].filter(([k]) => k.startsWith("START→"))
  .map(([k, n]) => [k.split("→")[1], n]).sort((a, b) => b[1] - a[1]);
for (const [st, n] of entries) {
  // conversion rate of chains entering at st
  const conv = chains.filter((c) => c[0] === st && c[c.length - 1] === "CONVERTED").length;
  const rate = n >= MIN_CELL ? (100 * conv / n).toFixed(1) + "%" : "·";
  console.log(`  ${st.padEnd(16)} ${String(n).padStart(5)} sessions   converts: ${String(conv).padStart(3)}  (${rate})`);
}

// top transitions
console.log("\n── TOP TRANSITIONS (count, P from source) ─────────────");
const topT = [...trans.entries()].filter(([k]) => !k.startsWith("START"))
  .sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [k, n] of topT) {
  const [a] = k.split("→");
  const tot = outTotals.get(a) ?? 0;
  const p = tot >= MIN_CELL ? (100 * n / tot).toFixed(1) + "%" : "·";
  console.log(`  ${k.padEnd(34)} ${String(n).padStart(5)}   ${p}`);
}

// ---------- absorption probabilities (value iteration) --------------------
const pConv = new Map(states.map((s) => [s, s === "CONVERTED" ? 1 : 0]));
for (let iter = 0; iter < 200; iter++) {
  let delta = 0;
  for (const s of nonAbsorbing) {
    const tot = outTotals.get(s) ?? 0;
    if (!tot) continue;
    let v = 0;
    for (const t of states) {
      const n = trans.get(`${s}→${t}`) ?? 0;
      if (n) v += (n / tot) * (pConv.get(t) ?? 0);
    }
    delta = Math.max(delta, Math.abs(v - (pConv.get(s) ?? 0)));
    pConv.set(s, v);
  }
  if (delta < 1e-9) break;
}

console.log("\n── ABSORPTION: P(eventually convert | in state) ───────");
const visits = new Map();
for (const seq of chains) for (const st of seq) visits.set(st, (visits.get(st) ?? 0) + 1);
for (const s of nonAbsorbing.sort((a, b) => (pConv.get(b) ?? 0) - (pConv.get(a) ?? 0))) {
  const n = visits.get(s) ?? 0;
  const p = n >= MIN_CELL ? (100 * (pConv.get(s) ?? 0)).toFixed(1) + "%" : "·";
  console.log(`  ${s.padEnd(16)} ${p.padStart(7)}   (${n} visits)`);
}

// exit hot spots
console.log("\n── EXIT HOT SPOTS (state → EXIT) ──────────────────────");
const exits = nonAbsorbing.map((s) => {
  const n = trans.get(`${s}→EXIT`) ?? 0;
  const tot = outTotals.get(s) ?? 0;
  return [s, n, tot ? n / tot : 0];
}).sort((a, b) => b[1] - a[1]).slice(0, 10);
for (const [s, n, r] of exits) {
  const tot = outTotals.get(s) ?? 0;
  const p = tot >= MIN_CELL ? (100 * r).toFixed(1) + "%" : "·";
  console.log(`  ${s.padEnd(16)} ${String(n).padStart(5)} exits   ${p} of departures`);
}

// funnel reads
const withForm = chains.filter((c) => c.includes("FORM_STARTED"));
const formConv = withForm.filter((c) => c[c.length - 1] === "CONVERTED").length;
const withEst = chains.filter((c) => c.includes("ESTIMATE_SHOWN"));
const estConv = withEst.filter((c) => c[c.length - 1] === "CONVERTED").length;
const noEst = chains.filter((c) => !c.includes("ESTIMATE_SHOWN"));
const noEstConv = noEst.filter((c) => c[c.length - 1] === "CONVERTED").length;
console.log("\n── FUNNEL READS (descriptive; selection bias applies) ─");
console.log(`  form_started sessions: ${withForm.length} -> converted ${formConv} (${withForm.length ? (100 * formConv / withForm.length).toFixed(1) : 0}% completion)`);
console.log(`  saw estimate:    ${withEst.length} sessions -> ${estConv} converted (${withEst.length ? (100 * estConv / withEst.length).toFixed(1) : 0}%)`);
console.log(`  no estimate:     ${noEst.length} sessions -> ${noEstConv} converted (${noEst.length ? (100 * noEstConv / noEst.length).toFixed(1) : 0}%)`);
console.log("");
process.exit(0);
