/**
 * Sales-view operations blocks (2026-08-19) — three OBJECTIVE surfaces:
 * disposition hygiene, call-back queue, per-owner* service load.
 *
 * Doctrine carried in the UI: no colors on agents, no rates-as-quality, no
 * chase flags (definitions freeze ~Sep 2). owner* = change-author proxy;
 * "activity" = CRM webhook event, not customer contact. Queues share the
 * unmatched-calls grammar: the goal is a short list, denominators named.
 */
import type { OpsLive } from "@/lib/admin/opsLive";
import { HORIZON_DAYS } from "@/lib/admin/opsLive";

const INK = "#1a1a1a";
const MUTED = "var(--color-text-muted)";

const card: React.CSSProperties = {
  border: "1px solid var(--color-gray-200)", borderRadius: 12,
  background: "var(--color-surface)", padding: "16px 18px", marginBottom: 12,
};
const rowS: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, padding: "7px 0",
  borderBottom: "1px solid var(--color-gray-100)", fontSize: 12.5, color: "#3f3f3f", flexWrap: "wrap",
};
const foot: React.CSSProperties = {
  margin: "9px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.55,
  borderTop: "1px solid var(--color-gray-100)", paddingTop: 8,
};
const fmtPT = (d: Date) =>
  d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

export function OpsBlocks({ data }: { data: OpsLive | null }) {
  if (!data) {
    return (
      <section style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>Operations</h2>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: MUTED }}>
          Computation unavailable this render — scripts/call-crosscheck.mjs covers the same ground locally.
        </p>
      </section>
    );
  }
  const { hygiene, callbacks, load, openTotal } = data;
  return (
    <>
      {/* ── Disposition hygiene ─────────────────────────────────────── */}
      <section style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>
          {hygiene.total} record{hygiene.total === 1 ? "" : "s"} still Active past the booking horizon
        </h2>
        <p style={{ margin: "3px 0 10px", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
          Open records older than {HORIZON_DAYS} days ({openTotal} open in total). No booking in the book&apos;s history has landed
          past day 20.3 — these are closed-in-reality, open-in-CRM, and every one sits in the close-rate
          denominators that govern budget. Close out or justify; the goal is a short list.
        </p>
        {hygiene.byOwner.length > 0 && (
          <p style={{ margin: "0 0 8px", fontSize: 11.5, color: "#3f3f3f", background: "var(--color-gray-100)", borderRadius: 8, padding: "5px 10px" }}>
            {hygiene.byOwner.map((o) => `${o.owner} ${o.count}`).join(" · ")}
          </p>
        )}
        <div>
          {hygiene.rows.map((r) => (
            <div key={r.abd} style={rowS}>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: INK }}>{r.abd}</span>
              <span>{r.owner}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, border: "1px solid var(--color-gray-200)", color: MUTED, borderRadius: 999, padding: "1px 8px" }}>{r.status}</span>
              <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{r.ageDays}d old · {r.staleDays}d since activity</span>
            </div>
          ))}
          {hygiene.total > hygiene.rows.length && (
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: MUTED }}>… {hygiene.total - hygiene.rows.length} more (stalest {hygiene.rows.length} shown).</p>
          )}
          {hygiene.total === 0 && <p style={{ margin: 0, fontSize: 13, color: "#128A3A", fontWeight: 600 }}>Empty — every open record is inside the booking horizon.</p>}
        </div>
        <p style={foot}>
          Objective rule: not booked, not in a lost/canceled status, created &gt;{HORIZON_DAYS}d ago. Clearing these is
          hygiene, not judgment — nobody&apos;s performance is measured here.
        </p>
      </section>

      {/* ── Call-back queue ─────────────────────────────────────────── */}
      <section style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>
          {callbacks.length} open record{callbacks.length === 1 ? "" : "s"} where the customer called and nothing followed
        </h2>
        <p style={{ margin: "3px 0 10px", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
          A real call (≥60s) landed on an open record and no CRM activity has happened since. No threshold,
          no flag — sorted longest-waiting first. Chase metrics arrive after their definitions freeze (~Sep 2).
        </p>
        <div>
          {callbacks.map((r) => (
            <div key={r.abd} style={rowS}>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: INK }}>{r.abd}</span>
              <span>{r.owner}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, border: "1px solid var(--color-gray-200)", color: MUTED, borderRadius: 999, padding: "1px 8px" }}>{r.status}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>called {fmtPT(r.callAt)} · {Math.floor(r.durationSec / 60)}m{String(r.durationSec % 60).padStart(2, "0")}s</span>
              <span style={{ marginLeft: "auto", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{r.waitingDays}d waiting</span>
            </div>
          ))}
          {callbacks.length === 0 && <p style={{ margin: 0, fontSize: 13, color: "#128A3A", fontWeight: 600 }}>Empty — every recent customer call has CRM activity after it.</p>}
        </div>
        <p style={foot}>
          &quot;Activity&quot; = a webhook event on the record (CRM work), NOT necessarily customer contact — an agent may have
          called back without touching the CRM; treat rows as prompts, not verdicts. Calls matched by phone since Aug 10;
          window 14 days; one row per record (latest unanswered call).
        </p>
      </section>

      {/* ── Service load per owner* ─────────────────────────────────── */}
      <section style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>Service load by owner*</h2>
        <p style={{ margin: "3px 0 10px", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
          Workload counts — NOT a quality ranking. Rates and comparisons stay unpublished until the assigned-agent
          field arrives (vendor ask) and the Sep 2 definitions freeze.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr>
                {["owner*", "open records", `past ${HORIZON_DAYS}d`, "calls on their records (7d)", "median days since activity", "2nd call before any activity"].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? "left" : "right", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, color: MUTED, padding: "4px 8px", borderBottom: "2px solid var(--color-gray-200)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {load.map((r) => (
                <tr key={r.owner}>
                  <td style={{ padding: "6px 8px", fontWeight: 600, color: INK, borderBottom: "1px solid var(--color-gray-100)" }}>{r.owner}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid var(--color-gray-100)", fontVariantNumeric: "tabular-nums" }}>{r.openRecords}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid var(--color-gray-100)", fontVariantNumeric: "tabular-nums" }}>{r.pastHorizon}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid var(--color-gray-100)", fontVariantNumeric: "tabular-nums" }}>{r.calls7d}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid var(--color-gray-100)", fontVariantNumeric: "tabular-nums" }}>{r.medianStaleDays == null ? "—" : r.medianStaleDays.toFixed(0)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid var(--color-gray-100)", fontVariantNumeric: "tabular-nums" }}>{r.secondCallBeforeTouch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={foot}>
          owner* = dominant change-author on the record&apos;s event feed — a proxy, not the assignee (that field is a
          pending vendor request). High load can mean trust, volume, or coverage; low can mean specialization. Counts
          inform the staffing conversation; they do not settle it.
        </p>
      </section>
    </>
  );
}
