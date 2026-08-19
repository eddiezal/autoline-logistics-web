/**
 * Unlogged calls — a work queue on Sales workload, not a chart (2026-08-19).
 *
 * Objective rule only (callQueue.mjs): ≥60s, non-spam, no record before the
 * call and none within 72h after. Each row is either a prospect nobody
 * logged or a dismissible non-prospect; the goal is an empty list, and if
 * the logging conversation lands this trends to zero and proves it.
 *
 * v1 is a pure list. Logged-it / Not-a-prospect actions come with a
 * dismissals store (v2). The chase / per-agent service views wait for the
 * threshold freeze (~Sep 2) — do not add them here early.
 */
import type { CallsLive } from "@/lib/admin/callsLive";

const INK = "#1a1a1a";
const MUTED = "var(--color-text-muted)";
const RED = "#C0392B";
const AMBER = "#b45309";
const GREEN = "#128A3A";

const fmtPT = (d: Date) =>
  d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtDur = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;

export function UnloggedCallsQueue({ data }: { data: CallsLive | null }) {
  const card: React.CSSProperties = {
    border: "1px solid var(--color-gray-200)", borderRadius: 12,
    background: "var(--color-surface)", padding: "16px 18px", marginBottom: 12,
  };
  if (!data) {
    return (
      <section style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>Unlogged calls</h2>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: MUTED }}>
          Computation unavailable this render — run scripts/call-crosscheck.mjs for the same list locally.
        </p>
      </section>
    );
  }
  const paidN = data.unlogged.filter((u) => u.campaign).length;
  return (
    <section style={card}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>
        {data.unlogged.length} minute-plus call{data.unlogged.length === 1 ? "" : "s"} with no CRM trace
      </h2>
      <p style={{ margin: "3px 0 10px", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
        Of {data.totalRealCalls} real calls since {data.coverageStart}. Each is a prospect nobody logged or a dismissible
        non-prospect — the goal is an empty list. Sorted longest-first: a nine-minute conversation is never a wrong number.
        {paidN > 0 && <> <strong style={{ color: "#3f3f3f" }}>{paidN} paid-attributed</strong> — this queue is also ad spend leaking.</>}
      </p>
      <div>
        {data.unlogged.map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--color-gray-100)", fontSize: 12.5, color: "#3f3f3f", flexWrap: "wrap" }}>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: INK }}>{fmtPT(u.at)}</span>
            <span style={{ fontWeight: 700, minWidth: 56, color: u.durationSec >= 480 ? RED : INK }}>{fmtDur(u.durationSec)}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, border: `1px solid ${u.campaign ? AMBER : "var(--color-gray-200)"}`, color: u.campaign ? AMBER : MUTED, borderRadius: 999, padding: "1px 8px" }}>
              {u.campaign ?? u.source ?? "untracked"}
            </span>
            {u.timelineUrl ? (
              <a href={u.timelineUrl} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", color: GREEN, fontWeight: 700, fontSize: 12, textDecoration: "none" }}>
                Listen ↗
              </a>
            ) : (
              <span style={{ marginLeft: "auto", color: MUTED, fontSize: 11 }}>{u.id.slice(0, 12)}</span>
            )}
          </div>
        ))}
        {data.unlogged.length === 0 && (
          <p style={{ margin: 0, fontSize: 13, color: GREEN, fontWeight: 600 }}>Empty — every real call is accounted for. That is the goal state.</p>
        )}
      </div>
      <p style={{ margin: "9px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.55, borderTop: "1px solid var(--color-gray-100)", paddingTop: 8 }}>
        Objective rule: ≥60s, non-spam, caller&apos;s number matches no record before the call and none within 72h after.
        Upper bound — customers dormant since before {data.mirrorStart} read as unlogged. Listen links open CallRail; no
        recordings stored here. Chase/service metrics arrive after their definitions freeze (~Sep 2).
      </p>
    </section>
  );
}
