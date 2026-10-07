/**
 * Quote/lead reference numbers (the "AL-…" ID customers, agents and carriers
 * read out loud).
 *
 * 2026-10-07: switched from AL-YYMMDD-XXXXXX (16 chars, mixed letters) to a
 * short sequential number, AL-10482. Ben asked for it after a carrier texted
 * "Load IDAL-260930-95XHYD": long mixed IDs are slow to search in ProABD and
 * easy to mishear on the phone (0 vs O, 1 vs I). Digits only, one counter,
 * every number unique.
 *
 * Old AL-YYMMDD-XXXXXX refs stay valid. Nothing parses the format; lookups
 * match the exact string, and ProABD joins on ABD_Id, not on this ref.
 *
 * Counter lives at system/leadRefCounter { next: number }. The first number
 * issued is FIRST_LEAD_NUMBER. If the transaction fails (Firestore blip),
 * we fall back to the legacy random format so a lead is never lost over an ID.
 */

import "server-only";
import { FieldValue, type Firestore } from "firebase-admin/firestore";

const COUNTER_DOC_PATH = "system/leadRefCounter";
export const FIRST_LEAD_NUMBER = 10001;

/** Legacy format, kept as the fallback: AL-YYMMDD-XXXXXX. */
export function legacyLeadRef(now: Date = new Date()): string {
  const ymd =
    String(now.getUTCFullYear()).slice(2) +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
  return "AL-" + ymd + "-" + rand;
}

export function formatLeadRef(n: number): string {
  return "AL-" + String(n);
}

/**
 * Issue the next short ref (AL-10001, AL-10002, …). Pass null for db in
 * local dev without Firestore; that returns a legacy ref.
 */
export async function nextLeadRef(db: Firestore | null): Promise<string> {
  if (!db) return legacyLeadRef();
  const counterRef = db.doc(COUNTER_DOC_PATH);
  try {
    const n = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const stored = snap.exists ? Number(snap.get("next")) : NaN;
      const current =
        Number.isInteger(stored) && stored >= FIRST_LEAD_NUMBER ? stored : FIRST_LEAD_NUMBER;
      tx.set(
        counterRef,
        { next: current + 1, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      return current;
    });
    return formatLeadRef(n);
  } catch (err) {
    console.error("[leadRef] counter transaction failed, using legacy ref", err);
    return legacyLeadRef();
  }
}
