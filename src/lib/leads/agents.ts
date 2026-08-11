/**
 * Agent roster + lead-notification recipients.
 *
 * RETIRED 2026-07-20: the round-robin assignment (pickNextAgent) is no
 * longer called from /api/lead. ProABD's rules-based routing is the only
 * assignment brain — it ran in parallel with ours since the 2026-07-14
 * createLead automation and the two disagreed on 8 of 11 leads (see
 * scripts/assignment-audit.mjs). pickNextAgent is kept for reference /
 * potential rollback; delete once the cutover has soaked.
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

/**
 * ASSIGNED-AGENT PRICE EMAIL (2026-08-11, supersedes the 8/10 broadcast
 * stop-gap): ProABD doesn't show agents the website's quoted price, so the
 * full lead email (which carries the estimate) goes to the ONE agent ProABD
 * assigns. The send happens in the ProABD webhook at assignment-stamp time
 * (/api/webhooks/proabd), NOT at intake time — the assignee is unknown when
 * /api/lead runs. The broadcast-to-all version lasted exactly one day:
 * every agent receiving every lead trains the inbox to be ignored and
 * re-creates the pre-7/20 "whose lead is this" confusion in reverse
 * (Eddie, 8/11 morning, after the first broadcast lead).
 *
 * Maps ProABD's display name ("Nelson Zaldivar", "Renee Aragon",
 * "Ginger Marie" — confirmed live via scripts/assignment-audit.mjs) to the
 * roster email by first-name token, case-insensitive. Unknown names (e.g.
 * an admin working a record) return null and no email is sent — the
 * webhook logs a warning so new agent names surface fast. Update AGENTS
 * above when the roster changes. Kill switch: SEND_AGENT_LEAD_EMAILS=false
 * (read in the webhook route).
 */
export function agentEmailForUserName(userName: string): Agent | null {
  const first = userName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!first) return null;
  return AGENTS.find((a) => a.firstName.toLowerCase() === first) ?? null;
}

/** Where Eddie wants every lead BCC'd for QA + visibility. */
export const QA_BCC_EMAIL = "eddie@zaldivarlabs.com";

/** Ben — receives the owner-visibility copy of every lead notification
 *  (cutover 2026-07-20: agents are assigned + notified inside ProABD).
 *  Same inbox as the Friday weekly digest (weekly-digest/route.ts). */
export const OWNER_EMAIL = "info@autolineexpress.com";
