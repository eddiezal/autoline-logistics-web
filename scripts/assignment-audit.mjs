/**
 * Audit: does the agent we EMAILED match the agent ProABD ASSIGNED?
 *
 * Context: our /api/lead round-robin picks an agent and emails them.
 * Since 2026-07-14 the createLead automation also pushes every website
 * lead into ProABD — with NO assignee — and ProABD applies its own
 * rules-based routing. Two independent assignment brains → drift →
 * agents report "I got the email but ProABD assigned it to someone else."
 *
 * This script joins our Firestore `leads` (assignedAgent = who we emailed)
 * to `proabd_webhook_events` (raw_item = ProABD's full lead record) via
 * ABD_Id, auto-detects which raw_item field carries ProABD's assignee
 * (any field whose value contains a known agent name), and reports the
 * mismatch rate + every mismatched lead.
 *
 * Usage:
 *   cd autoline-logistics-web
 *   node scripts/assignment-audit.mjs           # last 30 days of events
 *   node scripts/assignment-audit.mjs 90        # last 90 days
 *
 * Requires FIREBASE_PROJECT_ID in .env.local + gcloud ADC (same as
 * proabd-routes.mjs / backfill-attribution.mjs).
 */

import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });

const AGENT_NAMES = ["nelson", "renee", "ginger"]; // keep in sync with src/lib/leads/agents.ts

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error("Missing FIREBASE_PROJECT_ID in .env.local");
  process.exit(1);
}
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  } else {
    initializeApp({ credential: applicationDefault(), projectId });
  }
}
const db = getFirestore();

const days = Number(process.argv[2]) || 30;
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// ---- 1. Pull webhook events, discover the assignee field ----------------
const evSnap = await db
  .collection("proabd_webhook_events")
  .where("received_at", ">=", since)
  .get();

const fieldNames = new Set();
const agentFieldVotes = new Map(); // field -> count of values containing an agent name
// ABD_Id -> { assigneeRaw, field, lastAt } (updates overwrite inserts = latest wins)
const proabdByAbdId = new Map();

const norm = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const agentIn = (v) => AGENT_NAMES.find((a) => norm(v).includes(a)) ?? null;

for (const doc of evSnap.docs) {
  const raw = doc.data().raw_item ?? {};
  const receivedAt = doc.data().received_at?.toDate?.() ?? null;
  for (const [k, v] of Object.entries(raw)) {
    fieldNames.add(k);
    if (typeof v === "string" && agentIn(v)) {
      agentFieldVotes.set(k, (agentFieldVotes.get(k) ?? 0) + 1);
    }
  }
  const abdId = String(raw.ABD_Id ?? "");
  if (!abdId) continue;
  // record every event; resolve assignee after we know the winning field
  const prev = proabdByAbdId.get(abdId);
  if (!prev || (receivedAt && prev.lastAt && receivedAt > prev.lastAt) || !prev.lastAt) {
    proabdByAbdId.set(abdId, { raw, lastAt: receivedAt });
  }
}

console.log("");
console.log(`Webhook events scanned: ${evSnap.size} (last ${days} days), distinct ABD_Ids: ${proabdByAbdId.size}`);
console.log("");
console.log("raw_item fields seen:");
console.log("  " + [...fieldNames].sort().join(", "));
console.log("");

const rankedAgentFields = [...agentFieldVotes.entries()].sort((a, b) => b[1] - a[1]);
if (!rankedAgentFields.length) {
  console.log("NO field contained a known agent name (nelson/renee/ginger).");
  console.log("=> ProABD's webhook may not carry the assignee, or it uses IDs, or");
  console.log("   assignees use different display names. Ask Brian which field holds");
  console.log("   the assigned user, then hardcode it below.");
  process.exit(0);
}
console.log("Candidate assignee fields (contain agent names), by frequency:");
for (const [f, c] of rankedAgentFields) console.log(`  ${f}: ${c} events`);
const ASSIGNEE_FIELD = rankedAgentFields[0][0];
console.log(`\nUsing "${ASSIGNEE_FIELD}" as ProABD assignee field.\n`);

// ---- 2. Pull our leads, join, compare -----------------------------------
const leadSnap = await db.collection("leads").get();
let joined = 0, match = 0;
const mismatches = [];
let noProabdRecord = 0, noAssigneeParsed = 0;

for (const doc of leadSnap.docs) {
  const d = doc.data();
  const ourAgent = norm(d.assignedAgent?.firstName);
  const abdId = String(d.proabdAbdId ?? "");
  if (!ourAgent || !abdId) continue;
  const ev = proabdByAbdId.get(abdId);
  if (!ev) { noProabdRecord++; continue; }
  const proabdAgent = agentIn(String(ev.raw[ASSIGNEE_FIELD] ?? ""));
  if (!proabdAgent) { noAssigneeParsed++; continue; }
  joined++;
  if (proabdAgent === ourAgent) match++;
  else {
    mismatches.push({
      leadRef: d.leadRef ?? doc.id,
      submittedAt: d.submittedAt ?? "?",
      emailed: d.assignedAgent?.firstName,
      proabd: ev.raw[ASSIGNEE_FIELD],
      abdId,
    });
  }
}

console.log(`Leads joined to a ProABD record w/ parseable assignee: ${joined}`);
console.log(`  MATCH (email == ProABD):    ${match}`);
console.log(`  MISMATCH:                   ${mismatches.length}  (${joined ? ((mismatches.length / joined) * 100).toFixed(1) : 0}%)`);
console.log(`  (leads w/ no webhook record in window: ${noProabdRecord}; assignee unparseable: ${noAssigneeParsed})`);
console.log("");
if (mismatches.length) {
  console.log("Mismatched leads (emailed vs ProABD):");
  for (const m of mismatches.sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)))) {
    console.log(`  ${String(m.leadRef).padEnd(20)} ${String(m.submittedAt).slice(0, 19)}  emailed=${m.emailed}  proabd=${m.proabd}  ABD_Id=${m.abdId}`);
  }
}
process.exit(0);
