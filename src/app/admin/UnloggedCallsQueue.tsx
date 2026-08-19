/**
 * Unmatched calls — a work queue on Sales workload, not a chart (2026-08-19,
 * v2.1 adds human labeling; see claude/call-labels-spec.md).
 *
 * Naming: "unmatched" / "no automated CRM match" — NOT "no CRM trace". Review
 * can discover the caller was an existing customer on another number; in that
 * case the automated match failed, not the CRM relationship. The row name
 * must stay true either way.
 *
 * Objective rule only (callQueue.mjs): ≥60s, non-spam, no record before the
 * call and none within 72h after. Human labels (LabelControls → labelActions)
 * ANNOTATE rows — nothing ever leaves the denominator; reviewed rows collapse
 * out of the active list but stay counted, with the split disclosed. System
 * facts and human judgments render distinctly (System: UNMATCHED vs
 * Human: LABEL · EZ · date) — never confusable.
 *
 * The chase / per-agent service views wait for the threshold freeze (~Sep 2)
 * and will use a SEPARATE label taxonomy — do not add them here early.
 */
import type { CallsLive, UnloggedCall } from "@/lib/admin/callsLive";
import { labelShort } from "@/lib/admin/callLabelTaxonomy";
import { LabelControls } from "./LabelControls";

const INK = "#1a1a1a";
const MUTED = "var(--color-text-muted)";
const RED = "#C0392B";
const AMBER = "#b45309";
const GREEN = "#128A3A";

const fmtPT = (d: Date) =>
  d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtDur = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" });
};

const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
  borderBottom: "1px solid var(--color-gray-100)", fontSize: 12.5, color: "#3f3f3f", flexWrap: "wrap",
};

function RowFacts({ u }: { u: UnloggedCall }) {
  return (
    <>
      <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: INK }}>{fmtPT(u.at)}</span>
      <span style={{ fontWeight: 700, minWidth: 56, color: u.durationSec >= 480 ? RED : INK }}>{fmtDur(u.durationSec)}</span>
      <span style={{ fontSize: 10.5, fontWeight: 700, border: `1px solid ${u.campaign ? AMBER : "var(--color-gray-200)"}`, color: u.campaign ? AMBER : MUTED, borderRadius: 999, padding: "1px 8px" }}>
        {u.campaign ?? u.source ?? "untracked"}
      </span>
      {u.timelineUrl && (
        <a href={u.timelineUrl} target="_blank" rel="noreferrer" style={{ color: GREEN, fontWeight: 700, fontSize: 12, textDecoration: "none" }}>
          Listen ↗
        </a>
      )}
    </>
  );
}

export function UnloggedCallsQueue({ data }: { data: CallsLive | null }) {
  const card: React.CSSProperties = {
    border: "1px solid var(--color-gray-200)", borderRadius: 12,
    background: "var(--color-surface)", padding: "16px 18px", marginBottom: 12,
  };
  if (!data) {
    return (
      <section style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>Unmatched calls</h2>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: MUTED }}>
          Computation unavailable this render — run scripts/call-crosscheck.mjs for the same list locally.
        </p>
      </section>
    );
  }

  const unreviewed = data.unlogged.filter((u) => !u.latestLabel);
  const reviewed = data.unlogged.filter((u) => u.latestLabel);
  const paidN = unreviewed.filter((u) => u.campaign).length;

  // Reviewed-outcomes counts (counts only — no rates, no colors; the split is
  // what turns the "upper bound" caveat into a measured one).
  const outcome = new Map<string, number>();
  let esN = 0, linkedN = 0;
  for (const r of reviewed) {
    const l = r.latestLabel!;
    outcome.set(l.key, (outcome.get(l.key) ?? 0) + 1);
    if (l.spanishNotServed) esN += 1;
    if (l.relatedRecordId) linkedN += 1;
  }
  const outcomeText = [...outcome.entries()].map(([k, n]) => `${labelShort(k)} ${n}`).join(" · ");

  return (
    <section style={card}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>
        {data.unlogged.length} unmatched minute-plus call{data.unlogged.length === 1 ? "" : "s"} — no automated CRM match
      </h2>
      <p style={{ margin: "3px 0 10px", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
        Of {data.totalRealCalls} real calls since {data.coverageStart} · {unreviewed.length} unreviewed · {reviewed.length} reviewed.
        Sorted longest-first: a nine-minute conversation is never a wrong number. Listen, then label.
        {paidN > 0 && <> <strong style={{ color: "#3f3f3f" }}>{paidN} unreviewed paid-attributed</strong> — this queue is also ad spend leaking.</>}
        {data.labelsUnavailable && <> <strong style={{ color: RED }}>Label store unreachable this render</strong> — rows shown unlabeled; nothing was lost.</>}
      </p>

      {reviewed.length > 0 && (
        <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "#3f3f3f", background: "var(--color-gray-100)", borderRadius: 8, padding: "6px 10px", lineHeight: 1.5 }}>
          <strong>Reviewed outcomes ({reviewed.length}):</strong> {outcomeText}
          {esN > 0 && <> · Spanish—couldn&apos;t serve {esN}</>}
          {linkedN > 0 && <> · linked to a record {linkedN}</>}
          <span style={{ color: MUTED }}> — human-reviewed labels (EZ), counts only.</span>
        </p>
      )}

      <div>
        {unreviewed.map((u) => (
          <div key={u.id} style={rowStyle}>
            <RowFacts u={u} />
            <span style={{ marginLeft: "auto" }}><LabelControls callId={u.id} /></span>
          </div>
        ))}
        {data.unlogged.length === 0 && (
          <p style={{ margin: 0, fontSize: 13, color: GREEN, fontWeight: 600 }}>Empty — every real call is accounted for. That is the goal state.</p>
        )}
        {data.unlogged.length > 0 && unreviewed.length === 0 && (
          <p style={{ margin: 0, fontSize: 12.5, color: GREEN, fontWeight: 600 }}>Nothing unreviewed — every unmatched call has a human label.</p>
        )}
      </div>

      {reviewed.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 12, fontWeight: 700, color: MUTED, cursor: "pointer" }}>Reviewed ({reviewed.length})</summary>
          {reviewed.map((u) => {
            const l = u.latestLabel!;
            return (
              <div key={u.id} style={{ ...rowStyle, opacity: 0.85 }}>
                <RowFacts u={u} />
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.4, color: MUTED, background: "var(--color-gray-100)", borderRadius: 999, padding: "1px 7px" }}>
                  SYSTEM: UNMATCHED
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#52525b", borderRadius: 999, padding: "1px 8px" }}>
                  {labelShort(l.key)} · {l.labeledBy}{l.labeledAtISO && ` · ${fmtDay(l.labeledAtISO)}`}
                </span>
                {l.spanishNotServed && <span style={{ fontSize: 10, fontWeight: 700, color: AMBER }}>ES — couldn&apos;t serve</span>}
                {l.relatedRecordId && <span style={{ fontSize: 10.5, color: MUTED }}>↳ record {l.relatedRecordId}</span>}
                {l.note && <span style={{ fontSize: 11, color: MUTED, fontStyle: "italic" }}>“{l.note}”</span>}
                <span style={{ marginLeft: "auto" }}><LabelControls callId={u.id} relabel /></span>
              </div>
            );
          })}
        </details>
      )}

      <p style={{ margin: "9px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.55, borderTop: "1px solid var(--color-gray-100)", paddingTop: 8 }}>
        Objective rule: ≥60s, non-spam, caller&apos;s number matches no record before the call and none within 72h after.
        Upper bound — customers dormant since before {data.mirrorStart} read as unmatched; human review measures exactly that.
        Labels annotate: nothing leaves the denominator, corrections append (audit trail), and a label is a judgment from
        listening — the system can&apos;t verify playback and doesn&apos;t claim to. Listen links open CallRail; no recordings
        stored here. Chase/service metrics arrive after their definitions freeze (~Sep 2), on a separate taxonomy.
      </p>
    </section>
  );
}
