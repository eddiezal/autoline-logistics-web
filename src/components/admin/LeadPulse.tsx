/**
 * Lead Pulse — the at-a-glance strip + weekly trend at the top of /admin.
 * Spec: claude/lead-pulse-dashboard-spec.md (v2, 2026-08-13). Mockup-faithful.
 *
 * Rendering rules that carry meaning (do not restyle casually):
 *  - DASHING has exactly one meaning: the in-progress current week.
 *    Series identity is weight/fill/color — never dash.
 *  - Blended CPL is the primary series (heavy ink, filled markers);
 *    Google Ads CPL (confirmed) is secondary (light orange, hollow).
 *  - Each CPL series suppresses independently when its own lead
 *    denominator is < 5 that week (no marker, line gap).
 *  - Paid counts are click-proof FLOORS — copy says "at least".
 *  - Failure isolation: lead panels never depend on the Ads API; a spend
 *    failure renders "spend unavailable" instead of the CPL panel.
 */

import type { CSSProperties } from "react";
import {
  computeLeadPulse,
  spendByWeek,
  type LeadPulseData,
  type WeekBucket,
} from "@/lib/admin/leadPulse";
import { fetchAdsCostByDay } from "@/lib/googleAds/client";

const INK = "#0b0b0b";
const MUTED = "#6b7280";
const FAINT = "#9ca3af";
const GRID = "#e7e6e2";
const PAID = "#eb6834"; // Google Ads (validated categorical slot)
const OTHER = "#2a78d6"; // other sources (validated categorical slot)
const UP = "#008300";
const DOWN = "#b45309";

const card: CSSProperties = {
  background: "#fff",
  border: `1px solid ${GRID}`,
  borderRadius: 14,
  padding: "14px 16px 12px",
};
const kicker: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: FAINT,
};

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

interface WeekRow extends WeekBucket {
  spend: number | null;
  blendedCpl: number | null; // null = suppressed or spend unavailable
  paidCpl: number | null;
}

export async function LeadPulse() {
  let data: LeadPulseData;
  try {
    data = await computeLeadPulse();
  } catch (err) {
    // Never break /admin over the pulse. Say so and get out of the way.
    return (
      <div style={{ ...card, color: MUTED, fontSize: 13, marginBottom: 18 }}>
        Lead Pulse unavailable ({err instanceof Error ? err.message : "load error"}).
      </div>
    );
  }

  const cost = await fetchAdsCostByDay(new Date(Date.now() - 63 * 86_400_000));
  const weeklySpend = cost.state === "ok" ? spendByWeek(cost.byDay, data.weeks) : null;
  const spendNote =
    cost.state === "ok"
      ? null
      : cost.state === "unconfigured"
        ? "spend unavailable (Ads API not configured)"
        : "spend unavailable (Ads API error)";

  const weeks: WeekRow[] = data.weeks.map((w) => {
    const spend = weeklySpend?.get(w.mondayKey) ?? null;
    const hasSpend = spend !== null && spend > 0;
    return {
      ...w,
      spend,
      blendedCpl: hasSpend && w.blended >= 5 ? spend / w.blended : null,
      paidCpl: hasSpend && w.paid >= 5 ? spend / w.paid : null,
    };
  });

  /* ── geometry (shared week axis) ── */
  const W = 840;
  const plotL = 56;
  const plotR = 828;
  const n = weeks.length;
  const cx = (i: number) => plotL + ((plotR - plotL) * (i + 0.5)) / n;

  // Leads panel: baseline 160, top of scale at y=34.
  const maxBlended = Math.max(10, ...weeks.map((w) => w.blended));
  const leadCeil = Math.ceil(maxBlended / 10) * 10;
  const yLead = (v: number) => 160 - (126 * v) / leadCeil;

  // CPL panel: shared $ axis across both series.
  const cplVals = weeks.flatMap((w) =>
    [w.blendedCpl, w.paidCpl].filter((v): v is number => v !== null),
  );
  const cplLo = cplVals.length ? Math.max(0, Math.floor((Math.min(...cplVals) * 0.9) / 25) * 25) : 0;
  const cplHi = cplVals.length ? Math.max(cplLo + 50, Math.ceil((Math.max(...cplVals) * 1.05) / 25) * 25) : 100;
  const yCpl = (v: number) => 172 - (150 * (v - cplLo)) / (cplHi - cplLo);
  const cplMid = Math.round((cplLo + cplHi) / 2 / 5) * 5;

  /** Consecutive non-null points → line segments; dash iff right end is the
   *  current (in-progress) week. */
  const segments = (pick: (w: WeekRow) => number | null) => {
    const segs: { x1: number; y1: number; x2: number; y2: number; dashed: boolean }[] = [];
    let prev: { i: number; v: number } | null = null;
    weeks.forEach((w, i) => {
      const v = pick(w);
      if (v === null) {
        prev = null; // suppression = a visible gap, by design
        return;
      }
      if (prev) {
        segs.push({
          x1: cx(prev.i),
          y1: yCpl(prev.v),
          x2: cx(i),
          y2: yCpl(v),
          dashed: w.isCurrent,
        });
      }
      prev = { i, v };
    });
    return segs;
  };
  const blendedSegs = segments((w) => w.blendedCpl);
  const paidSegs = segments((w) => w.paidCpl);
  const lastCompleteBlended = [...weeks].reverse().find((w) => !w.isCurrent && w.blendedCpl !== null);
  const currentWeek = weeks[weeks.length - 1]?.isCurrent ? weeks[weeks.length - 1] : null;

  const weekTitle = (w: WeekRow) =>
    [
      `Week of ${w.label}${w.isCurrent ? " — to date" : ""}`,
      `${w.web} web · ${w.calls} calls · ${w.blended} blended`,
      `Google Ads: at least ${w.paid}`,
      w.spend !== null ? `Spend ${money(w.spend)}` : "Spend unavailable",
      w.blendedCpl !== null ? `Blended CPL ${money(w.blendedCpl)}` : "Blended CPL: n too small",
      w.paidCpl !== null
        ? `Google Ads CPL ${money(w.paidCpl)} (confirmed attribution only)`
        : "Google Ads CPL: n too small",
    ].join("\n");

  const maxDay = Math.max(1, ...data.last7Days.map((d) => d.blended));
  const deltaPct7 =
    data.prior7.blended >= 3
      ? Math.round(((data.last7.blended - data.prior7.blended) / data.prior7.blended) * 100)
      : null;

  return (
    <section style={{ marginBottom: 22 }} aria-label="Lead pulse">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={kicker}>Lead pulse</span>
        <span style={{ fontSize: 11.5, color: FAINT }}>
          as of {data.asOfPt} PT · source: first-party leads + Google Ads API
        </span>
      </div>

      {/* ── Pulse strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* TODAY */}
        <div style={card}>
          <div style={kicker}>Today (PT)</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>
              {data.today.blended}
              <span style={{ fontSize: 14, fontWeight: 600, color: MUTED }}> leads</span>
            </span>
            {data.pacePct !== null &&
              (data.paceNeutral ? (
                <span style={{ fontSize: 12.5, fontWeight: 700, color: MUTED }}>on pace</span>
              ) : (
                <span style={{ fontSize: 12.5, fontWeight: 700, color: data.pacePct > 0 ? UP : DOWN }}>
                  {data.pacePct > 0 ? "↑" : "↓"} {data.pacePct > 0 ? "+" : ""}
                  {data.pacePct}% pace
                </span>
              ))}
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 5 }}>
            {data.today.web} web + {data.today.calls} calls ·{" "}
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: PAID, marginRight: 4 }} />
            <b style={{ color: INK }}>{data.today.paid}</b> from Google Ads{" "}
            <span style={{ color: FAINT }}>(click-proof, at least)</span>
          </div>
          <div style={{ fontSize: 12, color: FAINT, marginTop: 7, borderTop: `1px solid ${GRID}`, paddingTop: 7 }}>
            typical {data.todayWeekday} by {data.asOfPt}: ~{data.paceBaseline} · full {data.todayWeekday}: ~
            {data.fullDayBaseline} <span style={{ opacity: 0.85 }}>(last 4 {data.todayWeekday}s)</span>
          </div>
        </div>

        {/* LAST 7 DAYS */}
        <div style={card}>
          <div style={kicker}>Last 7 days</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>
              {data.last7.blended}
              <span style={{ fontSize: 14, fontWeight: 600, color: MUTED }}> leads</span>
            </span>
            {deltaPct7 !== null && Math.abs(deltaPct7) > 15 && (
              <span style={{ fontSize: 12.5, fontWeight: 700, color: deltaPct7 > 0 ? UP : DOWN }}>
                {deltaPct7 > 0 ? "↑ +" : "↓ "}
                {deltaPct7}%
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 5 }}>
            {data.last7.web} web + {data.last7.calls} calls ·{" "}
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: PAID, marginRight: 4 }} />
            <b style={{ color: INK }}>{data.last7.paid}</b> from Google Ads{" "}
            <span style={{ color: FAINT }}>(prior: {data.prior7.paid})</span>
          </div>
          <div aria-hidden="true" style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 22, marginTop: 6 }}>
            {data.last7Days.map((d) => (
              <span
                key={d.dayKey}
                title={`${d.dayKey}: ${d.blended} leads (${d.paid} paid)`}
                style={{
                  width: 13,
                  height: Math.max(2, Math.round((22 * d.blended) / maxDay)),
                  borderRadius: "3px 3px 0 0",
                  background: d.paid * 2 >= d.blended && d.blended > 0 ? PAID : OTHER,
                  opacity: d.paid * 2 >= d.blended && d.blended > 0 ? 1 : 0.55,
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 12, color: FAINT, marginTop: 6, borderTop: `1px solid ${GRID}`, paddingTop: 7 }}>
            prior 7 days: {data.prior7.blended} · mini-bars oldest → today
          </div>
        </div>
      </div>

      {/* ── Weekly trend ── */}
      <div style={{ ...card, paddingBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: MUTED }}>
            Weekly trend — leads &amp; CPL
          </span>
          <span style={{ fontSize: 11.5, color: FAINT }}>
            weeks are Mon–Sun PT · since ads relaunch (Jul 20) ·{" "}
            <a href="/admin?view=acquisition" style={{ color: MUTED, fontWeight: 700 }}>
              source detail →
            </a>
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: MUTED, margin: "6px 0 2px" }}>
          <span>
            <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: PAID, marginRight: 5 }} />
            Google Ads (at least)
          </span>
          <span>
            <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: OTHER, marginRight: 5 }} />
            Other sources
          </span>
        </div>

        {/* Panel 1 — leads/week */}
        <svg viewBox={`0 0 ${W} 190`} width="100%" role="img" aria-label="Leads per week, Google Ads vs other sources">
          <defs>
            <pattern id="lp-wip-paid" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#ffffff" />
              <rect width="3" height="6" fill={PAID} opacity="0.55" />
            </pattern>
            <pattern id="lp-wip-other" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#ffffff" />
              <rect width="3" height="6" fill={OTHER} opacity="0.45" />
            </pattern>
          </defs>
          {[0, leadCeil / 2, leadCeil].map((v) => (
            <g key={v}>
              <line x1={plotL} y1={yLead(v)} x2={plotR} y2={yLead(v)} stroke={GRID} strokeWidth={1} />
              <text x={plotL - 8} y={yLead(v) + 4} textAnchor="end" fontSize={11} fill={FAINT}>
                {v}
              </text>
            </g>
          ))}
          {weeks.map((w, i) => {
            const x = cx(i) - 12;
            const paidH = Math.max(0, 160 - yLead(w.paid));
            const otherH = Math.max(0, 160 - yLead(w.blended - w.paid));
            const gap = w.paid > 0 && w.blended - w.paid > 0 ? 2 : 0;
            return (
              <g key={w.mondayKey}>
                <title>{weekTitle(w)}</title>
                {w.paid > 0 && (
                  <rect
                    x={x}
                    y={160 - paidH}
                    width={24}
                    height={paidH}
                    fill={w.isCurrent ? "url(#lp-wip-paid)" : PAID}
                    stroke={w.isCurrent ? PAID : "none"}
                    strokeWidth={w.isCurrent ? 1 : 0}
                  />
                )}
                {w.blended - w.paid > 0 && (
                  <rect
                    x={x}
                    y={160 - paidH - gap - otherH}
                    width={24}
                    height={otherH}
                    rx={4}
                    fill={w.isCurrent ? "url(#lp-wip-other)" : OTHER}
                    stroke={w.isCurrent ? OTHER : "none"}
                    strokeWidth={w.isCurrent ? 1 : 0}
                  />
                )}
                {w.blended > 0 && (
                  <text
                    x={cx(i)}
                    y={160 - paidH - gap - otherH - 6}
                    textAnchor="middle"
                    fontSize={11.5}
                    fontWeight={700}
                    fill={INK}
                  >
                    {w.blended}
                  </text>
                )}
                {w.isCurrent && (
                  <text x={cx(i)} y={22} textAnchor="middle" fontSize={11} fill={MUTED}>
                    to date
                  </text>
                )}
                {/* full-height hover target */}
                <rect x={x - 8} y={14} width={40} height={150} fill="transparent" />
              </g>
            );
          })}
        </svg>

        {/* Panel 2 — CPL/week (blended primary, confirmed Google Ads secondary) */}
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: MUTED, margin: "4px 0 0" }}>
          <span>
            <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: INK, marginRight: 5 }} />
            <b style={{ color: INK }}>Blended CPL</b> ($/lead)
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                border: `2px solid ${PAID}`,
                background: "transparent",
                marginRight: 5,
              }}
            />
            Google Ads CPL (confirmed)
          </span>
          {spendNote && <span style={{ color: DOWN, fontWeight: 600 }}>{spendNote}</span>}
        </div>
        {!spendNote && (
          <svg
            viewBox={`0 0 ${W} 200`}
            width="100%"
            role="img"
            aria-label="Weekly cost per lead: blended (primary) and confirmed Google Ads (secondary), shared dollar axis"
          >
            {[cplLo, cplMid, cplHi].map((v) => (
              <g key={v}>
                <line x1={plotL} y1={yCpl(v)} x2={plotR} y2={yCpl(v)} stroke={GRID} strokeWidth={1} />
                <text x={plotL - 8} y={yCpl(v) + 4} textAnchor="end" fontSize={11} fill={FAINT}>
                  ${v}
                </text>
              </g>
            ))}
            {/* secondary first so the primary draws on top */}
            {paidSegs.map((s, i) => (
              <line
                key={`p${i}`}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke={PAID}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray={s.dashed ? "4 5" : undefined}
              />
            ))}
            {weeks.map(
              (w, i) =>
                w.paidCpl !== null && (
                  <circle key={`pm${w.mondayKey}`} cx={cx(i)} cy={yCpl(w.paidCpl)} r={4} fill="#fff" stroke={PAID} strokeWidth={2}>
                    <title>{weekTitle(w)}</title>
                  </circle>
                ),
            )}
            {blendedSegs.map((s, i) => (
              <line
                key={`b${i}`}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke={INK}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={s.dashed ? "4 5" : undefined}
              />
            ))}
            {weeks.map(
              (w, i) =>
                w.blendedCpl !== null && (
                  <circle key={`bm${w.mondayKey}`} cx={cx(i)} cy={yCpl(w.blendedCpl)} r={5} fill={INK} stroke="#fff" strokeWidth={2}>
                    <title>{weekTitle(w)}</title>
                  </circle>
                ),
            )}
            {/* selective direct labels: latest complete + to-date (blended); to-date (paid) */}
            {lastCompleteBlended && lastCompleteBlended.blendedCpl !== null && (
              <text
                x={cx(weeks.indexOf(lastCompleteBlended))}
                y={yCpl(lastCompleteBlended.blendedCpl) - 12}
                textAnchor="middle"
                fontSize={11.5}
                fontWeight={700}
                fill={INK}
              >
                {money(lastCompleteBlended.blendedCpl)}
              </text>
            )}
            {currentWeek && currentWeek.blendedCpl !== null && (
              <text
                x={cx(weeks.length - 1)}
                y={yCpl(currentWeek.blendedCpl) + 20}
                textAnchor="middle"
                fontSize={11.5}
                fontWeight={700}
                fill={INK}
              >
                {money(currentWeek.blendedCpl)} to date
              </text>
            )}
            {currentWeek && currentWeek.paidCpl !== null && (
              <text
                x={cx(weeks.length - 1)}
                y={yCpl(currentWeek.paidCpl) - 10}
                textAnchor="middle"
                fontSize={11}
                fill={MUTED}
              >
                {money(currentWeek.paidCpl)} to date
              </text>
            )}
          </svg>
        )}

        {/* shared week axis */}
        <svg viewBox={`0 0 ${W} 20`} width="100%" aria-hidden="true">
          {weeks.map((w, i) => (
            <text key={w.mondayKey} x={cx(i)} y={13} textAnchor="middle" fontSize={11} fill={FAINT}>
              {w.label}
              {w.isCurrent ? " · wtd" : ""}
            </text>
          ))}
        </svg>

        {/* table view (accessibility + relief rule) */}
        <details style={{ margin: "4px 0 6px" }}>
          <summary style={{ fontSize: 12, color: MUTED, cursor: "pointer" }}>View as table</summary>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5, marginTop: 6, width: "100%" }}>
            <thead>
              <tr style={{ color: MUTED, textAlign: "right" }}>
                <th style={{ textAlign: "left", padding: "3px 8px 3px 0" }}>Week</th>
                <th style={{ padding: "3px 8px" }}>Web</th>
                <th style={{ padding: "3px 8px" }}>Calls</th>
                <th style={{ padding: "3px 8px" }}>Blended</th>
                <th style={{ padding: "3px 8px" }}>Google Ads</th>
                <th style={{ padding: "3px 8px" }}>Spend</th>
                <th style={{ padding: "3px 8px" }}>Blended CPL</th>
                <th style={{ padding: "3px 8px" }}>Ads CPL (confirmed)</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.mondayKey} style={{ borderTop: `1px solid ${GRID}`, textAlign: "right", color: INK }}>
                  <td style={{ textAlign: "left", padding: "3px 8px 3px 0" }}>
                    {w.label}
                    {w.isCurrent ? " (to date)" : ""}
                  </td>
                  <td style={{ padding: "3px 8px" }}>{w.web}</td>
                  <td style={{ padding: "3px 8px" }}>{w.calls}</td>
                  <td style={{ padding: "3px 8px", fontWeight: 700 }}>{w.blended}</td>
                  <td style={{ padding: "3px 8px" }}>≥ {w.paid}</td>
                  <td style={{ padding: "3px 8px" }}>{w.spend !== null ? money(w.spend) : "—"}</td>
                  <td style={{ padding: "3px 8px", fontWeight: 700 }}>
                    {w.blendedCpl !== null ? money(w.blendedCpl) : "n too small"}
                  </td>
                  <td style={{ padding: "3px 8px", color: MUTED }}>
                    {w.paidCpl !== null ? money(w.paidCpl) : "n too small"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>

        <p style={{ fontSize: 11.5, color: FAINT, margin: "2px 0 4px", lineHeight: 1.5 }}>
          Blended = unique leads (web + tracked calls, deduped, tests excluded). Google Ads = click-proof floor
          (some paid leads miss click IDs). CPL = weekly Ads spend ÷ that series&apos; leads; hidden under 5 leads.
          Confirmed Ads CPL is a conservative high estimate. Dashed/striped = current week in progress.
        </p>
      </div>
    </section>
  );
}
