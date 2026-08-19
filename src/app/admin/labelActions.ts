"use server";
/**
 * Call-label server action — the dashboard's FIRST write path (2026-08-19).
 *
 * Everything else on /admin is read-only; this writes, so the rules are
 * explicit:
 *
 *   Storage: flat collection `call_label_events`, auto-ID docs — label
 *   EVENTS, append-only. A relabel appends a new event; nothing is ever
 *   updated or deleted, so every correction stays auditable and "latest
 *   labeledAt wins" is deterministic. (The spec sketched a per-call
 *   subcollection; flat was chosen at build time because reading "all labels"
 *   is then one auto-indexed query — a collection-group query would need a
 *   manually enabled index — and every other collection in this codebase is
 *   flat. Same event shape either way.)
 *
 *   Auth: the /admin proxy gate (HTTP Basic vs ADMIN_DASH_PASSWORD) already
 *   covers server-action POSTs to /admin, but this action re-verifies the
 *   Authorization header itself so it stays safe even if the proxy matcher
 *   ever changes. Labeling is Eddie-only by design (see spec) — labeledBy is
 *   a constant, not user input.
 *
 *   PII: the note field is free text — the UI says "no names or numbers" and
 *   this action strips digit runs ≥7 as a backstop. relatedRecordId is a
 *   ProABD ABD_Id (internal id, not personal data).
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { isCallLabelKey, UNMATCHED_TAXONOMY_VERSION } from "@/lib/admin/callLabelTaxonomy";

const LABELED_BY = "EZ"; // single-labeler v2.1; becomes real identity if access widens

async function authorized(): Promise<boolean> {
  const expected = process.env.ADMIN_DASH_PASSWORD;
  if (!expected) return false;
  const auth = (await headers()).get("authorization") ?? "";
  if (!auth.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    return decoded.slice(decoded.indexOf(":") + 1) === expected;
  } catch {
    return false;
  }
}

// NOT exported: "use server" files should export only async functions —
// type-only exports are erased but there's no reason to test the edge.
interface ApplyCallLabelInput {
  callId: string;
  label: string;
  note?: string | null;
  spanishNotServed?: boolean;
  relatedRecordId?: string | null;
}

export async function applyCallLabel(
  input: ApplyCallLabelInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await authorized())) return { ok: false, error: "unauthorized" };

  const callId = typeof input.callId === "string" ? input.callId.trim() : "";
  if (!callId || callId.length > 64) return { ok: false, error: "bad callId" };
  if (!isCallLabelKey(input.label)) return { ok: false, error: "unknown label" };

  // Note: required for "other", optional otherwise; capped; digit runs ≥7
  // masked as a PII backstop (phone numbers don't belong in notes).
  let note = typeof input.note === "string" ? input.note.trim().slice(0, 280) : "";
  note = note.replace(/\d{7,}/g, "•••");
  if (input.label === "other" && !note) {
    return { ok: false, error: "Other requires a note" };
  }

  const rec = typeof input.relatedRecordId === "string" ? input.relatedRecordId.trim() : "";
  if (rec && !/^\d{1,12}$/.test(rec)) {
    return { ok: false, error: "record id must be the numeric ProABD id" };
  }

  try {
    await getAdminDb().collection("call_label_events").add({
      callId,
      label: input.label,
      note: note || null,
      spanishNotServed: input.spanishNotServed === true,
      relatedRecordId: rec || null,
      labeledBy: LABELED_BY,
      labeledAt: FieldValue.serverTimestamp(),
      taxonomyVersion: UNMATCHED_TAXONOMY_VERSION,
    });
  } catch (err) {
    console.error("[labelActions] write failed", err);
    return { ok: false, error: "write failed" };
  }

  revalidatePath("/admin");
  return { ok: true };
}
