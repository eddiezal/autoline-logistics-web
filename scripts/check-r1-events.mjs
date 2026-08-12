/**
 * Release 1 smoke-test verifier (2026-08-12).
 *
 * Run AFTER submitting one untagged test lead on the live /quote page.
 * Confirms the three things Release 1 changed:
 *   1. Field-level funnel events landed in site_events with the
 *      fv="quote-r1-20260812" release stamp (form_started, form_field,
 *      submit_attempted, lead_persisted — and any form_friction).
 *   2. The newest lead doc has NO last name and still reached ProABD
 *      (proabd stamp present) and stored the agent email payload.
 *   3. Prints the event timeline for the test visitor so drop-off
 *      instrumentation is visibly working.
 *
 * Usage: node scripts/check-r1-events.mjs [--hours 2]
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

const hoursArg = process.argv.indexOf("--hours");
const HOURS = hoursArg > -1 ? Number(process.argv[hoursArg + 1]) || 2 : 2;
const since = new Date(Date.now() - HOURS * 3600_000);

const fmtPT = (d) =>
  d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour12: false,
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

// ---- 1. Release-stamped form events ----
const evSnap = await db.collection("site_events")
  .where("ts", ">=", since).orderBy("ts", "asc").limit(2000).get();

const formTypes = new Set(["form_started", "form_field", "form_friction", "submit_attempted", "lead_persisted"]);
const formEvents = [];
for (const doc of evSnap.docs) {
  const d = doc.data();
  if (formTypes.has(d.type)) formEvents.push(d);
}

console.log(`\n===== [1] Form events, last ${HOURS}h (${formEvents.length} found) =====`);
if (!formEvents.length) {
  console.log("  NONE — either no one touched the form yet, or events aren't flowing. Submit the test lead first.");
}
const byVid = new Map();
for (const e of formEvents) {
  const key = e.vid ?? "?";
  if (!byVid.has(key)) byVid.set(key, []);
  byVid.get(key).push(e);
}
for (const [vid, events] of byVid) {
  console.log(`\n  visitor ${vid.slice(0, 8)}… (${events.length} events)`);
  for (const e of events) {
    const ts = e.ts?.toDate?.() ? fmtPT(e.ts.toDate()) : "?";
    const m = e.meta ?? {};
    const bits = [m.field, m.action, m.kind, m.reason, m.status].filter(Boolean).join(" ");
    const stamp = m.fv === "quote-r1-20260812" ? "✓fv" : (m.fv ? `fv=${m.fv}` : "NO-STAMP");
    console.log(`    ${ts} PT  ${e.type.padEnd(17)} ${bits.padEnd(28)} ${stamp}  [${e.locale}]`);
  }
}

// ---- 2. Newest lead: no last name, ProABD reached ----
const leadSnap = await db.collection("leads").orderBy("createdAt", "desc").limit(3).get();
console.log("\n===== [2] Newest 3 leads =====");
for (const doc of leadSnap.docs) {
  const d = doc.data();
  const created = d.createdAt?.toDate?.();
  const c = d.contact ?? {};
  console.log(`\n  ${d.leadRef ?? doc.id}  ${created ? fmtPT(created) + " PT" : "?"}`);
  console.log(`    name: ${JSON.stringify(c.firstName)} / lastName: ${JSON.stringify(c.lastName)} ${c.lastName === "" ? "← empty as designed" : ""}`);
  console.log(`    tier: ${JSON.stringify(d.tier)}  (server default is "priority" when the form sends none)`);
  console.log(`    proabd: ${d.proabd?.abdId ? "✓ ABD_Id " + d.proabd.abdId : (d.proabd ? JSON.stringify(d.proabd).slice(0, 80) : "✗ MISSING")}`);
  console.log(`    agentEmail stored: ${d.agentEmail ? "✓ (sentTo: " + JSON.stringify(d.agentEmail.sentTo) + ")" : "—"}`);
  console.log(`    attribution: gclid=${d.attribution?.gclid ? "PRESENT (should be ABSENT on an untagged test!)" : "none ✓"}`);
}

console.log("\nExpected for a clean test: form_started → form_field focus/complete per field →");
console.log("submit_attempted → lead_persisted, all ✓fv; lead with lastName \"\" and proabd ABD_Id; no gclid.");
process.exit(0);
