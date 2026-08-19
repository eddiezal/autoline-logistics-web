/**
 * Human call-label taxonomy — unmatched-calls queue, v2.1 (2026-08-19).
 *
 * SHARED between server (write path, callsLive) and client (chip picker), so
 * this module holds constants and types ONLY — no "server-only", no Firebase,
 * no I/O. The doctrine it encodes:
 *
 *   Computed classification ≠ human judgment. The classifier says UNMATCHED
 *   (no automated CRM match); a human, after listening, asserts what the call
 *   actually was. The two must never be visually or structurally confusable —
 *   human labels always carry who + when.
 *
 * Taxonomy rules (see claude/call-labels-spec.md in the project):
 *   - Primary labels are identity/disposition only, mutually exclusive, one
 *     tap. Language is NOT a primary label — a Spanish caller can be a
 *     prospect, an alt-number customer, or a vendor — so "couldn't serve in
 *     Spanish" is an orthogonal flag applied alongside any label.
 *   - "Other" requires a note (recurring patterns in Other notes are the
 *     signal that this taxonomy needs revision — review at the ~Sep 2 freeze).
 *   - taxonomyVersion is stamped on every event so a September label can
 *     never silently mean something different from a November one. The
 *     post-freeze cluster taxonomy (chase / status / new shipment / …) will
 *     use its own namespace, e.g. "cluster-v1" — it is a different question.
 */

export const UNMATCHED_TAXONOMY_VERSION = "unmatched-v1";

export const CALL_LABELS = [
  { key: "prospect_not_logged", short: "Prospect — not logged", hint: "A real prospect nobody entered. The label this queue exists to find." },
  { key: "existing_alt_number", short: "Existing customer — different number", hint: "Known customer calling from a number we don't have. Link the record if identified." },
  { key: "carrier_vendor", short: "Carrier / vendor / partner", hint: "Not a marketing or sales failure — a routing question at most." },
  { key: "wrong_number_robocall", short: "Wrong number / robocall", hint: "Noise. (Kept merged in v2.1; not used for spam-flag calibration.)" },
  { key: "other", short: "Other", hint: "Requires a note — recurring patterns here mean the taxonomy is wrong." },
] as const;

export type CallLabelKey = (typeof CALL_LABELS)[number]["key"];

const SHORT: Record<string, string> = Object.fromEntries(CALL_LABELS.map((l) => [l.key, l.short]));
export const labelShort = (key: string): string => SHORT[key] ?? key;

export const isCallLabelKey = (v: unknown): v is CallLabelKey =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(SHORT, v);

/** Latest human label for a call, serialized for rendering (dates as ISO). */
export interface LatestCallLabel {
  key: CallLabelKey;
  labeledBy: string;
  labeledAtISO: string;
  note: string | null;
  spanishNotServed: boolean;
  relatedRecordId: string | null;
}
