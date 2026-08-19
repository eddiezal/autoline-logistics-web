"use client";
/**
 * Inline chip picker for human call labels (unmatched queue, v2.1).
 *
 * One-tap flow: clicking any primary chip submits immediately with whatever
 * adornments (ES flag, linked record) are currently set. "Other" is the sole
 * two-step label — it requires a note by taxonomy rule. Corrections are just
 * another tap: events are append-only server-side, latest wins, so "Relabel"
 * reuses this exact component.
 *
 * This component may import ONLY the plain taxonomy module and the server
 * action — never callsLive/callLabels server modules.
 */
import { useState, useTransition } from "react";
import { CALL_LABELS } from "@/lib/admin/callLabelTaxonomy";
import { applyCallLabel } from "./labelActions";

const MUTED = "var(--color-text-muted)";
const LINE = "var(--color-gray-200)";
const GREEN = "#128A3A";
const RED = "#C0392B";

export function LabelControls({ callId, relabel }: { callId: string; relabel?: boolean }) {
  const [open, setOpen] = useState(false);
  const [otherPicked, setOtherPicked] = useState(false);
  const [spanish, setSpanish] = useState(false);
  const [rec, setRec] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (label: string) => {
    setErr(null);
    startTransition(async () => {
      const r = await applyCallLabel({
        callId,
        label,
        note: note.trim() || null,
        spanishNotServed: spanish,
        relatedRecordId: rec.trim() || null,
      });
      if (!r.ok) setErr(r.error ?? "failed");
      else {
        setOpen(false);
        setOtherPicked(false);
        setNote("");
      }
    });
  };

  const chipStyle = (active?: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700, border: `1px solid ${active ? GREEN : LINE}`,
    color: active ? GREEN : "#3f3f3f", background: "transparent",
    borderRadius: 999, padding: "2px 10px", cursor: "pointer",
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ fontSize: 11, fontWeight: 700, border: `1px solid ${LINE}`, borderRadius: 6, padding: "2px 9px", color: MUTED, background: "transparent", cursor: "pointer" }}
      >
        {relabel ? "Relabel" : "Label"}
      </button>
    );
  }

  return (
    <div style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: 7, padding: "7px 0 3px", opacity: isPending ? 0.5 : 1 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {CALL_LABELS.map((l) =>
          l.key === "other" ? (
            <button key={l.key} disabled={isPending} title={l.hint} onClick={() => setOtherPicked(true)} style={chipStyle(otherPicked)}>
              {l.short}
            </button>
          ) : (
            <button key={l.key} disabled={isPending} title={l.hint} onClick={() => submit(l.key)} style={chipStyle()}>
              {l.short}
            </button>
          ),
        )}
        <button disabled={isPending} onClick={() => { setOpen(false); setOtherPicked(false); setErr(null); }} style={{ fontSize: 11, border: "none", background: "transparent", color: MUTED, cursor: "pointer" }}>
          cancel
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 11.5, color: MUTED }}>
        <label style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={spanish} disabled={isPending} onChange={(e) => setSpanish(e.target.checked)} />
          Spanish — couldn&apos;t serve
        </label>
        <input
          value={rec} disabled={isPending} onChange={(e) => setRec(e.target.value.replace(/\D/g, ""))}
          placeholder="Link ProABD # (optional)" inputMode="numeric"
          style={{ fontSize: 11.5, border: `1px solid ${LINE}`, borderRadius: 6, padding: "2px 8px", width: 160 }}
        />
      </div>
      {otherPicked && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={note} disabled={isPending} onChange={(e) => setNote(e.target.value)}
            placeholder="Why 'Other'? Required — no names or numbers." maxLength={280}
            style={{ fontSize: 11.5, border: `1px solid ${LINE}`, borderRadius: 6, padding: "3px 8px", flexGrow: 1, minWidth: 220 }}
          />
          <button disabled={isPending || !note.trim()} onClick={() => submit("other")} style={{ ...chipStyle(true), opacity: note.trim() ? 1 : 0.5 }}>
            Apply
          </button>
        </div>
      )}
      {err && <span style={{ fontSize: 11.5, color: RED, fontWeight: 600 }}>{err}</span>}
    </div>
  );
}
