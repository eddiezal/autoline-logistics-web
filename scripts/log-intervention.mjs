/**
 * Intervention ledger — structured record of account/site changes for
 * later pre/post analysis. NOT an experiment registry: entries have no
 * randomized control, and structure does not create causal identification.
 * What this buys: captured decision-time baselines, pre-registered
 * machine-readable decision rules, exposure-based review gates, and an
 * append-only review history that can't quietly rewrite what was decided.
 *
 * Collections:
 *   interventions/{id}                 — the decision record (immutable after create)
 *   interventions/{id}/reviews/{ts}    — append-only checkpoint/final/restatement reviews
 *   measurement_incidents/{id}         — tracking outages, backfills, reporting corrections
 *                                        (kept SEPARATE: they change measurement, not customers)
 *
 * Usage (from autoline-logistics-web; requires FIREBASE_PROJECT_ID in .env.local + gcloud ADC):
 *   node scripts/log-intervention.mjs ../ledger/s3-budget-raise-20260812.json   # create
 *   node scripts/log-intervention.mjs --review s3-budget-raise-20260812 ../ledger/review.json
 *   node scripts/log-intervention.mjs --incident ../ledger/incident.json
 *   node scripts/log-intervention.mjs --list
 *
 * Entry JSON schema (validated below; see REQUIRED/ENUMS):
 * {
 *   "id": "s3-budget-raise-20260812",         // slug; doc id
 *   "executed_at": "2026-08-12T19:45:00-07:00", // when the change was made (PT ISO)
 *   "effective_date": "2026-08-13",           // first CLEAN serving day (a change made
 *                                             //  Wed evening contaminates Wed's row)
 *   "entity": "campaign:S3",                  // campaign:S3 | site:price-checker | tracking:ga4 | ...
 *   "lever": "budget",                        // see LEVERS
 *   "from": "60/day", "to": "75/day",
 *   "executed_by": "eddie",
 *   "registration_type": "prospective",       // prospective | retrospective
 *   "snapshot_quality": "captured",           // captured | reconstructed | incomplete
 *   "evidence_source": "ads-ui 8/12 + monday-read doc",
 *   "hypothesis": "...", "max_exposure_usd": 200,
 *   "snapshot": {                             // decision-time data. NUMERATORS AND
 *     "window": "2026-07-30..2026-08-12",     // DENOMINATORS, never bare ratios.
 *     "spend_usd": 1289, "conversions": 4, "clicks": 430, "serving_days": 10,
 *     "conversion_action_set": "primary (lead_form_submit + FTPC)",
 *     "attribution_basis": "google-ads click, click-date",
 *     "data_source": "ads-ui", "settlement_status": "2 S3 restatements pending (pre-change clicks)",
 *     "notes": "..."
 *   },
 *   "review_gates": {                         // ALL applicable gates must pass before an
 *     "earliest_review_date": "2026-08-24",   // economic verdict. Calendar dates may trigger
 *     "minimum_serving_days": 8,              // CHECKPOINTS only.
 *     "minimum_post_change_spend_usd": 650,
 *     "settlement_lag_days": 3
 *   },
 *   "decision_rule": {
 *     "prose": "human explanation",
 *     "primary_metric": "confirmed_google_ads_cpl",
 *     "continue_if": { ... }, "revert_if": { ... }, "guardrails": { ... }
 *   },
 *   "confounders": ["incident:2026-08-11-csp", "intervention:s5-budget-raise-20260810"],
 *   "amendments": [ { "date": "...", "what": "...", "where_documented": "..." } ]
 * }
 *
 * Review JSON: { "review_type": "checkpoint|final|restatement|reconsideration",
 *   "data_cutoff": "2026-08-14", "gates_satisfied": {...}, "findings": "...",
 *   "verdict": "continue|revert|extend|n/a", "data": {...} }
 *
 * Incident JSON: { "id", "started_at", "ended_at", "kind": "tracking_outage|backfill|
 *   reporting_correction|restatement", "affected": ["ga4","ads-conversions"],
 *   "description", "resolution", "doc": "claude/incident-....md" }
 *
 * Design rules (hard-learned, external audit 8/13):
 *  - Create refuses to overwrite: the original registration is append-only.
 *  - Reviews live in a subcollection, each with its own timestamp + data cutoff.
 *  - Conflict detector warns when another OPEN intervention touches the same entity.
 *  - Retrospective seeds must say so; never manufacture a precise baseline
 *    that was not actually recorded at the time.
 */

import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

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

const LEVERS = ["budget", "bid_cap", "bid_strategy", "negatives", "keywords", "pause", "enable",
  "ad_copy", "landing_page", "site_feature", "tracking", "form", "pricing", "other"];
const REG_TYPES = ["prospective", "retrospective"];
const SNAP_QUALITY = ["captured", "reconstructed", "incomplete"];
const REVIEW_TYPES = ["checkpoint", "final", "restatement", "reconsideration"];

const fail = (msg) => { console.error("✗ " + msg); process.exit(1); };
const warn = (msg) => console.warn("⚠ " + msg);

function validateEntry(e) {
  for (const f of ["id", "executed_at", "effective_date", "entity", "lever", "from", "to",
    "executed_by", "registration_type", "snapshot_quality", "hypothesis", "snapshot",
    "review_gates", "decision_rule"]) {
    if (e[f] === undefined || e[f] === null || e[f] === "") fail(`missing field: ${f}`);
  }
  if (!/^[a-z0-9][a-z0-9-]+$/.test(e.id)) fail("id must be a kebab-case slug");
  if (!LEVERS.includes(e.lever)) fail(`lever must be one of: ${LEVERS.join(", ")}`);
  if (!REG_TYPES.includes(e.registration_type)) fail(`registration_type: ${REG_TYPES.join(" | ")}`);
  if (!SNAP_QUALITY.includes(e.snapshot_quality)) fail(`snapshot_quality: ${SNAP_QUALITY.join(" | ")}`);
  if (Number.isNaN(Date.parse(e.executed_at))) fail("executed_at is not a parseable timestamp");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.effective_date)) fail("effective_date must be YYYY-MM-DD");
  // effective_date should be a serving day (Mon–Fri) and strictly after the executed_at PT day.
  const eff = new Date(e.effective_date + "T12:00:00-07:00");
  const dow = eff.getUTCDay();
  if (dow === 0 || dow === 6) warn("effective_date falls on a weekend — serving is dark; is that intended?");
  const execDayPT = new Date(e.executed_at).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  if (e.effective_date <= execDayPT)
    warn(`effective_date (${e.effective_date}) does not skip the execution day (${execDayPT}) — the partial day will contaminate the post period.`);
  // snapshot must carry numerators/denominators, not just ratios
  const s = e.snapshot;
  for (const f of ["window", "data_source"]) if (!s[f]) fail(`snapshot.${f} missing`);
  const hasComponents = ["spend_usd", "conversions", "clicks", "serving_days"].filter((k) => s[k] !== undefined);
  if (hasComponents.length < 2)
    warn("snapshot has fewer than 2 of spend_usd/conversions/clicks/serving_days — store components, not just ratios.");
  if (s.settlement_status === undefined) warn("snapshot.settlement_status missing — note restatement state at decision time.");
  if (s.conversion_action_set === undefined) warn("snapshot.conversion_action_set missing — which actions count?");
  // gates
  const g = e.review_gates;
  if (!g.earliest_review_date) fail("review_gates.earliest_review_date required");
  if (g.minimum_serving_days === undefined && g.minimum_post_change_spend_usd === undefined)
    warn("review_gates has no exposure gate (serving days / spend) — calendar-only review repeats the 8/13 audit failure.");
  // decision rule must be structured, not just prose
  const r = e.decision_rule;
  if (!r.prose) fail("decision_rule.prose required (human explanation)");
  if (!r.primary_metric) fail("decision_rule.primary_metric required");
  if (!r.continue_if && !r.revert_if) fail("decision_rule needs machine-readable continue_if and/or revert_if");
  if (e.registration_type === "retrospective" && !e.evidence_source)
    fail("retrospective entries must cite evidence_source (what the reconstruction is based on)");
  if (e.max_exposure_usd === undefined) warn("max_exposure_usd missing — every intervention should bound its downside.");
}

async function conflictCheck(entry) {
  const snap = await db.collection("interventions").where("status", "==", "open").get();
  const [kind] = entry.entity.split(":");
  const hits = [];
  for (const d of snap.docs) {
    const o = d.data();
    if (d.id === entry.id) continue;
    const same = o.entity === entry.entity;
    const sameKind = (o.entity ?? "").startsWith(kind + ":");
    if (same || sameKind) hits.push(`${d.id} (${o.entity} · ${o.lever} · effective ${o.effective_date})`);
  }
  if (hits.length) {
    warn("OPEN interventions overlap this entity/scope — evaluation windows may be confounded:");
    for (const h of hits) console.warn("   · " + h);
    warn("Add them to this entry's confounders[] if they share the window (they were NOT auto-added).");
  }
}

const args = process.argv.slice(2);

if (args[0] === "--list") {
  const snap = await db.collection("interventions").orderBy("executed_at", "asc").get();
  for (const d of snap.docs) {
    const o = d.data();
    console.log(`${o.status === "open" ? "○" : "●"} ${d.id}  ${o.entity} ${o.lever} ${o.from}→${o.to}  eff ${o.effective_date}  [${o.registration_type}]`);
  }
  const inc = await db.collection("measurement_incidents").get();
  console.log(`\n${snap.size} interventions · ${inc.size} measurement incidents`);
  process.exit(0);
}

if (args[0] === "--incident") {
  const e = JSON.parse(readFileSync(args[1], "utf8"));
  for (const f of ["id", "started_at", "kind", "affected", "description"]) if (!e[f]) fail(`incident missing: ${f}`);
  const ref = db.collection("measurement_incidents").doc(e.id);
  if ((await ref.get()).exists) fail(`incident ${e.id} already exists (append corrections as new docs, don't overwrite)`);
  await ref.set({ ...e, logged_at: Timestamp.now() });
  console.log(`✓ incident ${e.id} logged`);
  process.exit(0);
}

if (args[0] === "--review") {
  const [, id, file] = args;
  if (!id || !file) fail("usage: --review <intervention-id> <review.json>");
  const parent = db.collection("interventions").doc(id);
  const pdoc = await parent.get();
  if (!pdoc.exists) fail(`no intervention ${id}`);
  const r = JSON.parse(readFileSync(file, "utf8"));
  if (!REVIEW_TYPES.includes(r.review_type)) fail(`review_type: ${REVIEW_TYPES.join(" | ")}`);
  for (const f of ["data_cutoff", "findings"]) if (!r[f]) fail(`review missing: ${f}`);
  if (r.review_type === "final") {
    const g = pdoc.data().review_gates ?? {};
    if (!r.gates_satisfied) warn("final review without gates_satisfied — record how each gate was met.");
    if (g.earliest_review_date && r.data_cutoff < g.earliest_review_date)
      warn(`data_cutoff ${r.data_cutoff} is before earliest_review_date ${g.earliest_review_date} — this verdict violates the pre-registered gate.`);
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  await parent.collection("reviews").doc(ts).set({ ...r, logged_at: Timestamp.now() });
  if (r.review_type === "final" && r.verdict && r.verdict !== "extend")
    await parent.update({ status: "closed", closed_verdict: r.verdict, closed_at: Timestamp.now() });
  console.log(`✓ ${r.review_type} review appended to ${id}${r.review_type === "final" ? ` (status → ${r.verdict === "extend" ? "open" : "closed"})` : ""}`);
  process.exit(0);
}

// default: create
const entry = JSON.parse(readFileSync(args[0], "utf8"));
validateEntry(entry);
const ref = db.collection("interventions").doc(entry.id);
if ((await ref.get()).exists) fail(`${entry.id} already exists — registrations are append-only; use --review, or a new id for a new decision.`);
await conflictCheck(entry);
await ref.set({ ...entry, status: "open", logged_at: Timestamp.now() });
console.log(`✓ intervention ${entry.id} registered (${entry.registration_type}, ${entry.snapshot_quality} snapshot)`);
process.exit(0);
