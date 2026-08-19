/**
 * "What the leads actually banked" — Acquisition-view section (2026-08-19).
 *
 * Renders the shared revenue-by-campaign computation (revenueLive.ts →
 * revenueByCampaign.mjs; CLI twin scripts/revenue-by-campaign.mjs).
 *
 * Honesty mechanics, enforced in render:
 *  · Mature cohort only carries rates; green cohort renders counts+dollars.
 *  · net/$100 bar shows POSITION always; COLOR unlocks at ≥5 bookings
 *    (COLOR_UNLOCK_BOOKINGS) — same grammar as the Decision strip meters.
 *  · Every paid figure labeled a floor (phone bookings not click-attributable).
 *  · Spend failure renders an explicit note, never $0.
 */
// @ts-ignore — plain-JS shared module (see revenueLive.ts note).
import { COLOR_UNLOCK_BOOKINGS, rowLabel } from "@/lib/admin/revenueByCampaign.mjs";
import type { RevenueLive } from "@/lib/admin/revenueLive";

const GREEN = "#128A3A";
const INK = "#1a1a1a";
const MUTED = "var(--color-text-muted)";
const RED = "#C0392B";
const GRAY_BAR = "#9ca3af";

const money = (v: number) => "$" + Math.round(v).toLocaleString();
const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" });

export function RevenueSection({ data }: { data: RevenueLive | null }) {
  if (!data) {
    return (
      <section style={{ border: "1px solid var(--color-gray-200)", borderRadius: 12, background: "var(--color-surface)", padding: "14px 18px", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>What the leads actually banked</h2>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: MUTED }}>
          Computation unavailable this render — run scripts/revenue-by-campaign.mjs for the same numbers locally.
        </p>
      </section>
    );
  }

  const paidRows = data.rows.filter((r) => r.key.startsWith("ads"));
  const otherRows = data.rows.filter((r) => !r.key.startsWith("ads"));
  const otherAgg = otherRows.reduce(
    (t, r) => ({ leads: t.leads + r.matureLeads, booked: t.booked + r.matureBooked, fee: t.fee + r.matureFeeNet }),
    { leads: 0, booked: 0, fee: 0 },
  );
  // Bar scale: pin to the largest per-$100 value on the table (min 100 to keep tiny values visible as slivers).
  const per100 = (r: RevenueRowLike, spend: number | null) => (spend && spend > 0 ? (r.matureFeeNet / spend) * 100 : null);
  interface RevenueRowLike { matureFeeNet: number }
  const rowSpend = (key: string) => (data.spendByCampaign ? data.spendByCampaign.get(key.slice(4)) ?? null : null);
  const scaleMax = Math.max(
    100,
    ...paidRows.map((r) => per100(r, rowSpend(r.key)) ?? 0),
    data.totalPaidSpend ? (data.totalsPaid.matureFeeNet / data.totalPaidSpend) * 100 : 0,
  );

  const th: React.CSSProperties = { textAlign: "right", fontWeight: 700, color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, padding: "6px 8px", borderBottom: "2px solid var(--color-gray-200)" };
  const td: React.CSSProperties = { padding: "7px 8px", borderBottom: "1px solid var(--color-gray-100)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#3f3f3f", fontSize: 12.5 };

  const barCell = (r: { matureFeeNet: number; matureBooked: number }, spend: number | null, isTotal = false) => {
    const v = spend && spend > 0 ? (r.matureFeeNet / spend) * 100 : null;
    if (v === null) return <span style={{ color: MUTED }}>—</span>;
    const unlocked = r.matureBooked >= COLOR_UNLOCK_BOOKINGS;
    const w = Math.max(2, Math.round((v / scaleMax) * 110));
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
        <span style={{ height: 10, width: w, borderRadius: "0 2px 2px 0", background: unlocked ? GREEN : GRAY_BAR, display: "inline-block" }} />
        <span style={{ minWidth: 40, fontWeight: unlocked || isTotal ? 700 : 600, color: unlocked || isTotal ? INK : MUTED }}>{money(v)}</span>
        {!unlocked && (
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: MUTED, background: "var(--color-gray-100)", borderRadius: 999, padding: "1px 6px" }}>
            n&lt;{COLOR_UNLOCK_BOOKINGS}
          </span>
        )}
      </span>
    );
  };

  const greens = data.rows.filter((r) => r.greenBooked > 0);

  return (
    <section style={{ border: "1px solid var(--color-gray-200)", borderRadius: 12, background: "var(--color-surface)", padding: "16px 18px", marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>What the leads actually banked</h2>
      <p style={{ margin: "3px 0 12px", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
        Booked broker fees (deposits) joined click → lead → CRM record · mature cohort{" "}
        <strong style={{ color: "#3f3f3f" }}>{fmtDay(data.since)} – {fmtDay(data.matureCutoff)}</strong>{" "}
        (every lead ≥14 days old — younger cohorts are still booking, so their rates would lie) · advances one day per day
        {data.adsNote ? <> · ⚠ {data.adsNote}</> : null}
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>source</th>
              <th style={th}>leads</th><th style={th}>booked</th><th style={th}>cxl</th>
              <th style={th}>fees net</th><th style={th}>spend</th><th style={th}>net / $100</th>
            </tr>
          </thead>
          <tbody>
            {paidRows.map((r) => {
              const spend = rowSpend(r.key);
              return (
                <tr key={r.key}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 600, color: INK }}>{rowLabel(r.key, data.campaignNames)}</td>
                  <td style={td}>{r.matureLeads}</td>
                  <td style={td}>{r.matureBooked}</td>
                  <td style={{ ...td, color: r.matureCanceled ? RED : td.color, fontWeight: r.matureCanceled ? 700 : 400 }}>{r.matureCanceled}</td>
                  <td style={td}>
                    {money(r.matureFeeNet)}
                    {r.matureFeeGross > r.matureFeeNet ? <span style={{ color: MUTED }}> ({money(r.matureFeeGross)} gross)</span> : null}
                  </td>
                  <td style={td}>{spend != null ? money(spend) : "—"}</td>
                  <td style={td}>{barCell(r, spend)}</td>
                </tr>
              );
            })}
            {otherAgg.leads > 0 && (
              <tr>
                <td style={{ ...td, textAlign: "left", fontWeight: 600, color: INK }}>Organic / Direct / Referral</td>
                <td style={td}>{otherAgg.leads}</td>
                <td style={td}>{otherAgg.booked}</td>
                <td style={td}>—</td>
                <td style={td}>{money(otherAgg.fee)}</td>
                <td style={td}>—</td>
                <td style={td}><span style={{ color: MUTED }}>—</span></td>
              </tr>
            )}
            <tr>
              <td style={{ ...td, textAlign: "left", fontWeight: 700, color: INK, borderTop: "2px solid var(--color-gray-200)", borderBottom: "none" }}>TOTAL PAID</td>
              <td style={{ ...td, fontWeight: 700, color: INK, borderTop: "2px solid var(--color-gray-200)", borderBottom: "none" }}>{data.totalsPaid.matureLeads}</td>
              <td style={{ ...td, fontWeight: 700, color: INK, borderTop: "2px solid var(--color-gray-200)", borderBottom: "none" }}>{data.totalsPaid.matureBooked}</td>
              <td style={{ ...td, fontWeight: 700, color: data.totalsPaid.matureCanceled ? RED : INK, borderTop: "2px solid var(--color-gray-200)", borderBottom: "none" }}>{data.totalsPaid.matureCanceled}</td>
              <td style={{ ...td, fontWeight: 700, color: INK, borderTop: "2px solid var(--color-gray-200)", borderBottom: "none" }}>{money(data.totalsPaid.matureFeeNet)}</td>
              <td style={{ ...td, fontWeight: 700, color: INK, borderTop: "2px solid var(--color-gray-200)", borderBottom: "none" }}>{data.totalPaidSpend != null ? money(data.totalPaidSpend) : "—"}</td>
              <td style={{ ...td, borderTop: "2px solid var(--color-gray-200)", borderBottom: "none" }}>{barCell(data.totalsPaid, data.totalPaidSpend, true)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {greens.length > 0 && (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
          <strong style={{ color: "#3f3f3f" }}>Still maturing</strong> (created after {fmtDay(data.matureCutoff)} — counts only, no rates):{" "}
          {greens.map((r, i) => (
            <span key={r.key}>{i > 0 && " · "}{rowLabel(r.key, data.campaignNames)} <strong style={{ color: "#3f3f3f" }}>{r.greenBooked} booked · {money(r.greenFeeGross)}</strong></span>
          ))}
          {" · "}{data.rows.reduce((s, r) => s + r.greenLeads, 0)} leads accruing. Rows join the table as their cohort matures.
        </p>
      )}
      <p style={{ margin: "9px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.55, borderTop: "1px solid var(--color-gray-100)", paddingTop: 8 }}>
        Fees are booking deposits, before card fees/refunds; net excludes currently-canceled records (official treatment = the P8 disposition rule).
        Phone bookings aren&apos;t click-attributable yet, so every paid figure is a <strong>floor</strong>. net/$100 color unlocks at {COLOR_UNLOCK_BOOKINGS} bookings.
      </p>
    </section>
  );
}
