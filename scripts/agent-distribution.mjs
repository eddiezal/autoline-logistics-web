/**
 * Agent assignment distribution — is ProABD's routing actually rotating?
 *
 * Lists website leads in submission order with the ProABD-assigned agent
 * (leads.proabdAssignedAgent, stamped by the webhook since the 7/20
 * cutover) and tallies per-agent counts.
 *
 * READING THE OUTPUT: ProABD's rotation covers ALL its lead sources
 * (phone, Taylor 503/18, iRelocation, website), so the website-only
 * sequence is a SAMPLE of the rotation, not the rotation itself — perfect
 * N→R→G order is not expected even if routing is fair. Judge fairness by
 * the COUNTS converging toward equal over time, and by the "longest same-
 * agent run" staying small. A heavily skewed count or long runs = ask Ben
 * whether ProABD's routing rules weight someone intentionally.
 *
 * Usage: node scripts/agent-distribution.mjs [--days 30]
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

const DAYS = (() => {
  const i = process.argv.indexOf("--days");
  return i > -1 ? Number(process.argv[i + 1]) || 30 : 30;
})();
const since = new Date(Date.now() - DAYS * 86_400_000);

const TEST_RE = /\btest(ing)?\b|\bfake\b/i;
const isTest = (d) => {
  const c = d.contact ?? {};
  return TEST_RE.test([c.firstName, c.lastName, c.email, c.notes].filter(Boolean).join(" "));
};

const fmtPT = (date) =>
  date.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });

const snap = await db
  .collection("leads")
  .where("createdAt", ">=", since)
  .orderBy("createdAt", "asc")
  .get();

const rows = [];
let unassigned = 0, tests = 0;
for (const doc of snap.docs) {
  const d = doc.data();
  if (isTest(d)) { tests++; continue; }
  const name = d.proabdAssignedAgent?.userName ?? null;
  if (!name) { unassigned++; continue; }
  rows.push({
    ref: d.leadRef ?? doc.id,
    at: d.createdAt?.toDate?.(),
    agent: name,
    // Since 8/11: who the price email actually went to (assigned-agent send).
    emailedTo: d.agentEmail?.sentTo ?? null,
  });
}

console.log(`Website leads with a ProABD assignment, last ${DAYS} days (PT):\n`);
const counts = new Map();
let prev = null, run = 0, longestRun = 0, longestRunAgent = "";
for (const r of rows) {
  counts.set(r.agent, (counts.get(r.agent) ?? 0) + 1);
  if (r.agent === prev) run++;
  else { prev = r.agent; run = 1; }
  if (run > longestRun) { longestRun = run; longestRunAgent = r.agent; }
  console.log(
    `${(r.at ? fmtPT(r.at) : "?").padEnd(14)}${r.ref.padEnd(20)}${r.agent.padEnd(18)}` +
    (r.emailedTo ? `→ emailed ${r.emailedTo}` : ""),
  );
}

console.log("\n===== distribution =====");
const total = rows.length;
for (const [agent, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${agent.padEnd(20)}${String(n).padStart(3)}  (${((n / total) * 100).toFixed(0)}%)`);
}
console.log(`total assigned: ${total} · unassigned/pending: ${unassigned} · tests excluded: ${tests}`);
console.log(`longest same-agent run: ${longestRun}${longestRun > 1 ? " (" + longestRunAgent + ")" : ""}`);
console.log(
  "\nFairness = counts roughly equal over time. Website leads sample ProABD's",
);
console.log(
  "GLOBAL rotation (phone/Taylor leads rotate too), so short runs are normal.",
);
process.exit(0);
