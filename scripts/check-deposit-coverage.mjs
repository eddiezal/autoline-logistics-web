/**
 * Measure `proabdDepositCents` coverage across webhook-linked shipments —
 * the precondition the metric contract (claude/metric-contract.md §6.1)
 * sets before "booked broker fee" may appear on any dashboard:
 *
 *   "Coverage % is computed, not asserted. If coverage < 80%, the metric
 *    renders with a warning tint."
 *
 * Also cross-checks the live webhook-fed fee sum against the monthly
 * orders import for the overlapping window (contract: divergence >10%
 * freezes the live number pending investigation).
 *
 * Usage: node scripts/check-deposit-coverage.mjs
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

const BOOKED_STAGES = new Set(["booked", "prep", "inTransit", "delivered", "completed"]);

const snap = await db.collection("shipments").get();
let total = 0;
let testDocs = 0;
const byStage = {};
let bookedish = 0;
let bookedishWithDeposit = 0;
let depositSumCents = 0;
const monthly = new Map(); // PT month -> { n, withDep, sumCents }

for (const doc of snap.docs) {
  const d = doc.data();
  // Exclude the ALL-TEST fixtures (owner eddiezal28) from coverage math.
  if (doc.id.startsWith("ALL-TEST") || /eddiezal28@gmail\.com/i.test(String(d.ownerEmail ?? ""))) {
    testDocs++;
    continue;
  }
  total++;
  const stage = String(d.stage ?? d.status ?? "unknown");
  byStage[stage] = (byStage[stage] ?? 0) + 1;

  const dep = Number(d.proabdDepositCents);
  const hasDep = Number.isFinite(dep) && dep > 0;
  if (BOOKED_STAGES.has(stage)) {
    bookedish++;
    if (hasDep) {
      bookedishWithDeposit++;
      depositSumCents += dep;
      const at = d.updatedFromProabdAt?.toDate?.() ?? d.createdAt?.toDate?.() ?? null;
      const mk = at
        ? at.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit" })
        : "unknown";
      const m = monthly.get(mk) ?? { n: 0, sumCents: 0 };
      m.n++;
      m.sumCents += dep;
      monthly.set(mk, m);
    }
  }
}

console.log(`shipments: ${total} real docs (+${testDocs} test fixtures excluded)`);
console.log("by stage:", byStage);
const pctCov = bookedish ? ((bookedishWithDeposit / bookedish) * 100).toFixed(1) : "n/a";
console.log(`\n=== FEE COVERAGE (contract §6.1) ===`);
console.log(`booked-or-later shipments: ${bookedish}`);
console.log(`  with proabdDepositCents > 0: ${bookedishWithDeposit}  →  coverage ${pctCov}%  ${bookedish && bookedishWithDeposit / bookedish < 0.8 ? "⚠️ BELOW 80% — metric must render with warning tint" : "✅ meets threshold"}`);
console.log(`  booked broker fee (webhook-fed): $${(depositSumCents / 100).toLocaleString("en-US")}`);
console.log(`\nby month (PT, from last ProABD update):`);
for (const [k, m] of [...monthly.entries()].sort()) {
  console.log(`  ${k}: ${m.n} orders · $${(m.sumCents / 100).toLocaleString("en-US")}`);
}

// Cross-check vs the monthly orders import (overlap = months both cover).
const oSnap = await db.collection("orders").select("orderCreatedAt", "deposit").get();
const oMonthly = new Map();
for (const doc of oSnap.docs) {
  const d = doc.data();
  const at = d.orderCreatedAt?.toDate?.();
  if (!at) continue;
  const mk = at.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit" });
  const m = oMonthly.get(mk) ?? { n: 0, sum: 0 };
  m.n++;
  m.sum += Number(d.deposit) || 0;
  oMonthly.set(mk, m);
}
console.log(`\n=== CROSS-CHECK vs orders import (as of last import) ===`);
console.log("month | import n/$ | webhook n/$ | webhook share of import $");
for (const [k, m] of [...oMonthly.entries()].sort()) {
  const w = monthly.get(k);
  const share = w && m.sum > 0 ? ((w.sumCents / 100 / m.sum) * 100).toFixed(0) + "%" : "—";
  console.log(`  ${k}: ${m.n} / $${m.sum.toLocaleString("en-US")}  |  ${w ? `${w.n} / $${(w.sumCents / 100).toLocaleString("en-US")}` : "0 / $0"}  |  ${share}`);
}
console.log(
  "\nNote: webhook coverage begins Jul 8 and only records that CHANGED since — early months will read low. The contract's 10%-divergence rule applies only to months where both sources should be complete.",
);
process.exit(0);
