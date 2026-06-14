/**
 * Agent round-robin for /quote lead routing.
 *
 * Phase 1: the 3 named agents on Ben's team. Each new lead picks the
 * "next" agent via an atomically-incremented Firestore counter. Manual
 * entry into ProABD by the assigned agent. No ProABD API call here.
 *
 * Phase 2: replace constants with an admin-configurable agent table in
 * Firestore so Ben can add/remove agents without a redeploy.
 */

import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

export interface Agent {
  /** First name, used in email salutations. */
  firstName: string;
  email: string;
}

// Constant for now. Order matters because it affects which agent gets
// the first lead. Mix it up periodically to spread load fairly across
// a cold start.
export const AGENTS: ReadonlyArray<Agent> = [
  { firstName: "Nelson", email: "nelson@autolinelogistics.com" },
  { firstName: "Renee", email: "renee@autolinelogistics.com" },
  { firstName: "Ginger", email: "ginger@autolinelogistics.com" },
];

const COUNTER_DOC_PATH = "system/leadRoutingCounter";

/**
 * Atomically pick the next agent in the round-robin sequence. Uses a
 * Firestore transaction so concurrent lead intakes can't accidentally
 * route to the same agent or skip an agent entirely.
 *
 * Returns the assigned agent + their index. Persist both on the lead
 * doc so we can later analyze per-agent close rates.
 */
export async function pickNextAgent(): Promise<{ agent: Agent; index: number }> {
  const db = getAdminDb();
  const counterRef = db.doc(COUNTER_DOC_PATH);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = (snap.exists ? snap.get("nextIndex") : 0) as number;
    const next = (current + 1) % AGENTS.length;
    tx.set(
      counterRef,
      {
        nextIndex: next,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return current;
  });

  const index = result % AGENTS.length;
  return { agent: AGENTS[index]!, index };
}

/** Where Eddie wants every lead BCC'd for QA + visibility. */
export const QA_BCC_EMAIL = "eddie@zaldivarlabs.com";
