/**
 * ProABD canonical status map — provided by Brian (Superflo), 2026-07-22.
 *
 * "status_type" 1 = Lead, 2 = Quote, 3 = Order. Child statuses are
 * user-defined refinements of these primaries; classification below keys
 * on PRIMARY status IDs only, which Brian confirmed are fixed.
 *
 * Lifecycle: website leads enter as Leads (createLead), convert to Quotes
 * when priced, and to Orders when booked. Becoming an ORDER is the booked
 * signal (corroborated by Booked_Date on the export payload).
 *
 * This map replaces the regex heuristics that were parked in
 * src/app/admin/_legacy/v2-dashboard.tsx — the dashboard's booked/lost
 * numbers are now Authoritative per the spec's reliability ladder.
 */

export const PROABD_STATUS: Record<string, { text: string; type: 1 | 2 | 3 }> = {
  "1": { text: "Not quoted", type: 1 },
  "2": { text: "Contacted", type: 1 },
  "3": { text: "Needs Follow Up", type: 1 },
  "4": { text: "Customer Will Call Back", type: 1 },
  "5": { text: "Bad Lead", type: 1 },
  "6": { text: "Closed Lead", type: 1 },
  "7": { text: "New Quote", type: 2 },
  "8": { text: "Contacted", type: 2 },
  "9": { text: "Needs Follow Up", type: 2 },
  "10": { text: "Customer Will Call Back", type: 2 },
  "11": { text: "On Hold for Customer", type: 2 },
  "12": { text: "Customer Not Interested", type: 2 },
  "13": { text: "Invalid Information", type: 2 },
  "14": { text: "New", type: 3 },
  "15": { text: "In Processing", type: 3 },
  "16": { text: "Posted to Load Boards", type: 3 },
  "17": { text: "On Hold For Carrier", type: 3 },
  "18": { text: "Dispatched", type: 3 },
  "19": { text: "In Transit", type: 3 },
  "20": { text: "Delivered", type: 3 },
  "21": { text: "Accounting", type: 3 },
  "22": { text: "Order Complete", type: 3 },
  "23": { text: "Canceled", type: 3 },
  "24": { text: "On Hold for Customer", type: 3 },
  "25": { text: "Archive", type: 2 },
  "26": { text: "Not Emailed", type: 2 },
  "2581": { text: "DO NOT CONTACT", type: 2 },
};

/** Terminal-negative statuses: the record is dead, no booking coming. */
export const LOST_STATUS_IDS: ReadonlySet<string> = new Set([
  "5", // Bad Lead
  "6", // Closed Lead
  "12", // Customer Not Interested
  "13", // Invalid Information
  "25", // Archive (quote)
  "2581", // DO NOT CONTACT
]);

/** Order status that undoes a booking. */
export const CANCELED_ORDER_STATUS_ID = "23";

export type RecordOutcome = "booked" | "canceled" | "lost" | "active";

/**
 * Classify a ProABD record from its observed event history.
 *
 * @param reachedOrder  any event arrived with entity_type "order" (or a
 *                      type-3 status), or Booked_Date was populated
 * @param lastStatusId  Status_Id on the most recent event
 */
export function classifyRecord(
  reachedOrder: boolean,
  lastStatusId: string | null,
): RecordOutcome {
  if (reachedOrder) {
    return lastStatusId === CANCELED_ORDER_STATUS_ID ? "canceled" : "booked";
  }
  if (lastStatusId && LOST_STATUS_IDS.has(lastStatusId)) return "lost";
  return "active";
}
