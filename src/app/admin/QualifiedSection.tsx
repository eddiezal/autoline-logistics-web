/**
 * "Qualified leads: what S5 bids on" — Acquisition-view section (2026-10-20).
 *
 * Since Oct 19, S5 bids on "Qualified lead (priced)" = an AGENT price on a
 * website record, uploaded nightly. The older "priced form" numbers on this
 * page are the website's instant estimate. This panel is the agent-priced
 * number, from the same Firestore census the upload script reads
 * (qualifiedLive.ts → qualifiedCensus.mjs).
 *
 * Honesty mechanics:
 *  · Today is partial (agents still pricing, upload runs at 7 PM PT): shown,
 *    excluded from every total.
 *  · Spend/Google failure renders blank with a note, never $0.
 *  · Blended = all ad spend ÷ ALL qualified website leads (organic included),
 *    per the reporting rule; S5 = S5 spend ÷ S5-attributed qualified leads.
 */
// @ts-ignore — plain-JS shared module (see revenueLive.ts note).
import { S5_TARGET_CPA, ASSUMED_QUALIFIED_RATE, SWITCH_DAY, GUARDRAIL_MIN_PRICED_PER_DAY, GUARDRAIL_RUN_DAYS, MATURITY_DAYS } from "@/lib/admin/qualifiedCensus.mjs";
import type { QualifiedLive, QualifiedTotals, QualifiedWeekRow } from "@/lib/admin/qualifiedLive";

const GREEN = "#128A3A";
const INK = "#1a1a1a";
const MUTED = "var(--color-text-muted)";
const RED = "#C0392B";
const AMBER = "#B7791F";

const money = (v: number | null | undefined) => (v == null ? "—" : "$" + Math.round(v).toLocaleString());
const money2 = (v: number | null | undefined) => (v == null ? "—" : "$" + v.toFixed(2));
const pct = (v: number | null | undefined) => (v == null ? "—" : Math.round(v * 100) + "%");
const addDays = (k: string, n: number) => new Date(new Date(`${k}T12:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);
const fmtDayKey = (k: string) =>
  new Date(`${k}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const fmtTime = (d: Date) =>
  d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " PT";

function label(key: string, names: Map<string, string>): string {
  if (key === "unlinked") return "No lead doc (handoff gap)";
  if (key === "organic") return "Organic search";
  if (key === "direct") return "Direct";
  if (key === "referral") return "Referral";
  if (key === "ads-incomplete") return "Ads (attribution incomplete)";
  if (key.startsWith("ads:")) {
    const id = key.slice(4);
    return id === "?" ? "Ads (no campaign id)" : names.get(id) ?? id;
  }
  return key;
}

function Tile({ title, value, sub, tone }: { title: string; value: string; sub: React.ReactNode; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "good" ? GREEN : tone === "bad" ? RED : tone === "warn" ? AMBER : INK;
  return (
    <div style={{ flex: "1 1 180px", minWidth: 0, border: "1px solid var(--color-gray-200)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: MUTED }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: "tabular-nums", margin: "2px 0" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.45 }}>{sub}</div>
    </div>
  );
}

/** Inline rate bar: width = rate, color by distance from the assumed rate. */
function RateBar({ rate, n }: { rate: number | null; n: number }) {
  if (rate == null) return <span style={{ color: MUTED }}>—</span>;
  const tone = rate >= ASSUMED_QUALIFIED_RATE - 0.03 ? GREEN : rate >= ASSUMED_QUALIFIED_RATE - 0.1 ? AMBER : RED;
  const thin = n < 10;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
      <span style={{ position: "relative", height: 9, width: 72, background: "var(--color-gray-100)", borderRadius: 2, display: "inline-block", overflow: "hidden" }}>
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round(rate * 100)}%`, background: thin ? "#9ca3af" : tone }} />
        <span style={{ position: "absolute", left: `${Math.round(ASSUMED_QUALIFIED_RATE * 100)}%`, top: 0, bottom: 0, width: 1, background: INK, opacity: 0.5 }} />
      </span>
      <span style={{ minWidth: 34, fontWeight: 700, color: thin ? MUTED : INK }}>{pct(rate)}</span>
    </span>
  );
}

export function QualifiedSection({ data }: { data: QualifiedLive | null }) {
  const box: React.CSSProperties = { border: "1px solid var(--color-gray-200)", borderRadius: 12, background: "var(--color-surface)", padding: "16px 18px", marginBottom: 12 };
  if (!data) {
    return (
      <section style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>Qualified leads: what S5 bids on</h2>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: MUTED }}>
          Census unavailable this render. Run <code>node scripts/upload-qualified-shadow.mjs --days 7</code> (dry run) for the same rows locally.
        </p>
      </section>
    );
  }

  const sw: QualifiedTotals | null = data.sinceSwitch;
  const w = data.window;
  const s5Tone = sw?.s5Cpq == null ? undefined : sw.s5Cpq <= S5_TARGET_CPA ? "good" : sw.s5Cpq <= S5_TARGET_CPA * 1.15 ? "warn" : "bad";
  const rate = w.rate;
  const rateTone = rate == null ? undefined : rate >= ASSUMED_QUALIFIED_RATE - 0.03 ? "good" : rate >= ASSUMED_QUALIFIED_RATE - 0.1 ? "warn" : "bad";

  const lastRun = data.runs?.[0] ?? null;
  const lastOk = data.runs?.find((r) => r.conclusion === "success") ?? null;
  const staleHours = lastOk ? (data.fetchedAt.getTime() - lastOk.startedAt.getTime()) / 36e5 : null;
  const runTone = !data.runs ? undefined : lastRun?.conclusion === "success" && staleHours != null && staleHours < 30 ? "good" : lastRun?.status !== "completed" ? "warn" : "bad";
  const uc = data.uploadCheck;
  const gap = uc.counted == null ? null : uc.expected - uc.counted;

  const th: React.CSSProperties = { textAlign: "right", fontWeight: 700, color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, padding: "6px 8px", borderBottom: "2px solid var(--color-gray-200)", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid var(--color-gray-100)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#3f3f3f", fontSize: 12.5, whiteSpace: "nowrap" };
  const tot: React.CSSProperties = { ...td, fontWeight: 700, color: INK, borderTop: "2px solid var(--color-gray-200)", borderBottom: "none" };

  const rowsDesc = [...data.rows].reverse();
  const weeksDesc = [...data.weeks].reverse();

  return (
    <section style={box}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>Qualified leads: what S5 bids on</h2>
      <p style={{ margin: "3px 0 12px", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
        Qualified = an <strong style={{ color: "#3f3f3f" }}>agent price</strong> on a website record (first priced CRM event), not the instant estimate.
        S5 bids on this since {fmtDayKey(SWITCH_DAY)} at a <strong style={{ color: "#3f3f3f" }}>${S5_TARGET_CPA}</strong> target.
        Headline numbers are the last {w.days} complete days; today is partial and left out of totals.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <Tile
          title={`S5 cost per priced lead · since ${fmtDayKey(SWITCH_DAY).replace(/^\w+, /, "")}`}
          value={money2(sw?.s5Cpq)}
          tone={s5Tone}
          sub={sw ? <>{sw.s5} priced · {money(sw.s5Spend)} spend · {sw.servingDays} serving day{sw.servingDays === 1 ? "" : "s"} · Google counted {sw.googleS5 ?? "—"} ({money2(sw.s5GoogleCpa)})</> : <>First full day after the switch not complete yet.</>}
        />
        <Tile
          title={`Blended cost per qualified · ${w.days}d`}
          value={money2(w.blendedCpq)}
          sub={<>{money(w.spend)} all ad spend ÷ {w.qualified} qualified (all sources) · S5 {money2(w.s5Cpq)}</>}
        />
        <Tile
          title={`Qualified rate (priced ÷ forms) · ${w.days}d`}
          value={pct(rate)}
          tone={rateTone}
          sub={<>{w.formsPriced}/{w.forms} forms priced · S5 {pct(w.s5Rate)} ({w.s5FormsPriced}/{w.s5Forms}) · target math assumes {pct(ASSUMED_QUALIFIED_RATE)}</>}
        />
        <Tile
          title="Nightly upload"
          value={!data.runs ? "—" : lastRun?.conclusion === "success" ? "OK" : lastRun?.status !== "completed" ? "Running" : "Failed"}
          tone={runTone}
          sub={
            <>
              {lastRun ? <>Last run {fmtTime(lastRun.startedAt)}{lastRun.durationSec != null ? ` · ${lastRun.durationSec}s` : ""}</> : "No run history"}
              {staleHours != null && staleHours >= 30 ? <> · <strong style={{ color: RED }}>no success in {Math.round(staleHours)}h</strong></> : null}
              <br />
              {uc.days.length ? <>{fmtDayKey(uc.days[0]).replace(/^\w+, /, "")}–{fmtDayKey(uc.days[uc.days.length - 1]).replace(/^\w+, /, "")}: {uc.expected} sent (with gclid) · Google counted {uc.counted ?? "—"}</> : null}
              {gap != null && gap > 0 ? <> · <strong style={{ color: gap > 2 ? RED : AMBER }}>{gap} short</strong></> : null}
            </>
          }
        />
      </div>

      {(data.guardrail.tripped || (data.action && !data.action.primary)) && (
        <div style={{ background: "#FDF2F2", border: `1px solid ${RED}`, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: INK, marginBottom: 12, lineHeight: 1.5 }}>
          {data.guardrail.tripped && (
            <div>
              <strong style={{ color: RED }}>Guardrail tripped:</strong> S5 priced leads below {GUARDRAIL_MIN_PRICED_PER_DAY}/day for {data.guardrail.lowRun} serving days running
              (rule: {GUARDRAIL_RUN_DAYS} → raise target to $40). Check the Google-counted column first: a short upload looks like a volume drop.
            </div>
          )}
          {data.action && !data.action.primary && (
            <div><strong style={{ color: RED }}>&quot;Qualified lead (priced)&quot; is SECONDARY</strong> in Google Ads: S5 is not bidding on it.</div>
          )}
        </div>
      )}

      <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: "4px 0 4px", color: INK }}>Form fills → priced, by week · Mon–Sun, PT</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>week of</th>
              <th style={th}>forms</th>
              <th style={th}>priced</th>
              <th style={th} title="Priced ÷ forms for forms created that week (cohort). Line = the 92% the target math assumes">rate</th>
              <th style={th}>S5 forms</th>
              <th style={th}>S5 priced</th>
              <th style={th}>S5 rate</th>
              <th style={th}>S5 spend</th>
              <th style={th} title="S5 spend ÷ S5 priced leads (by priced day)">S5 $/priced</th>
              <th style={th}>blended $/priced</th>
            </tr>
          </thead>
          <tbody>
            {weeksDesc.map((wk: QualifiedWeekRow) => {
              const muted = wk.partial;
              const cell: React.CSSProperties = muted ? { ...td, color: MUTED } : td;
              const isSwitch = wk.week <= SWITCH_DAY && SWITCH_DAY < addDays(wk.week, 7);
              return (
                <tr key={wk.week} style={isSwitch ? { boxShadow: `inset 3px 0 0 ${GREEN}` } : undefined}>
                  <td style={{ ...cell, textAlign: "left", fontWeight: 600, color: muted ? MUTED : INK }}>
                    {fmtDayKey(wk.week).replace(/^\w+, /, "")}{wk.partial ? ` · ${wk.days} of 7 days` : ""}{isSwitch ? " · switch" : ""}
                  </td>
                  <td style={cell}>{wk.forms}</td>
                  <td style={{ ...cell, fontWeight: 700 }}>{wk.formsPriced}</td>
                  <td style={cell}><RateBar rate={wk.rate} n={wk.forms} /></td>
                  <td style={cell}>{wk.s5Forms}</td>
                  <td style={{ ...cell, fontWeight: 700 }}>{wk.s5FormsPriced}</td>
                  <td style={cell}><RateBar rate={wk.s5Rate} n={wk.s5Forms} /></td>
                  <td style={cell}>{money(wk.s5Spend)}</td>
                  <td style={{ ...cell, fontWeight: 700, color: wk.s5Cpq != null && !muted ? (wk.s5Cpq <= S5_TARGET_CPA ? GREEN : wk.s5Cpq > S5_TARGET_CPA * 1.15 ? RED : cell.color) : cell.color }}>{money2(wk.s5Cpq)}</td>
                  <td style={cell}>{money2(wk.blendedCpq)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: "16px 0 2px", color: INK }}>Revenue per lead, by source</h3>
      <p style={{ margin: "0 0 6px", fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
        Website leads created {fmtDayKey(data.weeks[0]?.week ?? data.matureCutoffDay).replace(/^\w+, /, "")} – {fmtDayKey(data.matureCutoffDay).replace(/^\w+, /, "")}: every lead is ≥{MATURITY_DAYS} days old, so booking has had time to happen.
        Fees are booking deposits (our broker fee), net of currently-canceled records.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>source</th>
              <th style={th}>leads</th>
              <th style={th}>priced</th>
              <th style={th}>rate</th>
              <th style={th}>booked</th>
              <th style={th}>fees net</th>
              <th style={th} title="Fees net ÷ leads: what an average form fill from this source is worth">fee / lead</th>
              <th style={th} title="Fees net ÷ priced leads: what an average priced lead is worth. Compare to S5's $36 target">fee / priced</th>
              <th style={th}>spend</th>
              <th style={th}>$ / priced</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((r) => {
              const thin = r.booked < 5;
              const perPriced = r.qualified > 0 ? r.feeNet / r.qualified : null;
              const cpq = r.spend != null && r.qualified > 0 ? r.spend / r.qualified : null;
              const margin = perPriced != null && cpq != null ? perPriced - cpq : null;
              return (
                <tr key={r.key}>
                  <td style={{ ...td, textAlign: "left", fontWeight: 600, color: INK }}>{label(r.key, data.campaignNames)}</td>
                  <td style={td}>{r.leads}</td>
                  <td style={td}>{r.qualified}</td>
                  <td style={td}>{r.leads ? pct(r.qualified / r.leads) : "—"}</td>
                  <td style={td}>{r.booked}{r.canceled ? <span style={{ color: RED }}> ({r.canceled} cxl)</span> : null}</td>
                  <td style={td}>{money(r.feeNet)}{r.feeGross > r.feeNet ? <span style={{ color: MUTED }}> ({money(r.feeGross)} gross)</span> : null}</td>
                  <td style={{ ...td, fontWeight: 700, color: thin ? MUTED : INK }}>{r.leads ? money2(r.feeNet / r.leads) : "—"}</td>
                  <td style={{ ...td, fontWeight: 700, color: thin ? MUTED : INK }}>
                    {money2(perPriced)}
                    {thin && r.leads > 0 ? <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: MUTED, background: "var(--color-gray-100)", borderRadius: 999, padding: "1px 6px", marginLeft: 6 }}>n&lt;5</span> : null}
                  </td>
                  <td style={td}>{money(r.spend)}</td>
                  <td style={{ ...td, color: margin != null && !thin ? (margin >= 0 ? GREEN : RED) : td.color, fontWeight: margin != null ? 700 : 400 }}>{money2(cpq)}</td>
                </tr>
              );
            })}
            {(() => {
              const paid = data.sources.filter((r) => r.key.startsWith("ads"));
              const t = paid.reduce((a, r) => ({ leads: a.leads + r.leads, qualified: a.qualified + r.qualified, booked: a.booked + r.booked, canceled: a.canceled + r.canceled, feeNet: a.feeNet + r.feeNet, spend: a.spend == null && r.spend == null ? null : (a.spend ?? 0) + (r.spend ?? 0) }), { leads: 0, qualified: 0, booked: 0, canceled: 0, feeNet: 0, spend: null as number | null });
              if (!t.leads) return null;
              return (
                <tr>
                  <td style={{ ...tot, textAlign: "left" }}>ALL PAID</td>
                  <td style={tot}>{t.leads}</td>
                  <td style={tot}>{t.qualified}</td>
                  <td style={tot}>{pct(t.qualified / t.leads)}</td>
                  <td style={tot}>{t.booked}</td>
                  <td style={tot}>{money(t.feeNet)}</td>
                  <td style={tot}>{money2(t.feeNet / t.leads)}</td>
                  <td style={tot}>{t.qualified ? money2(t.feeNet / t.qualified) : "—"}</td>
                  <td style={tot}>{money(t.spend)}</td>
                  <td style={tot}>{t.spend != null && t.qualified ? money2(t.spend / t.qualified) : "—"}</td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: INK, listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: MUTED }}>▶</span> Day by day · last {data.rows.length} days
        </summary>
        <div style={{ marginTop: 6 }}>
      <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>day</th>
                  <th style={th}>forms</th>
                  <th style={th}>qualified</th>
                  <th style={th}>rate</th>
                  <th style={th}>S5 qual.</th>
                  <th style={th} title="Qualified lead (priced) conversions Google has recorded for S5, by conversion date">S5 in Google</th>
                  <th style={th}>spend</th>
                  <th style={th}>S5 spend</th>
                  <th style={th}>blended $/qual.</th>
                  <th style={th}>S5 $/qual.</th>
                </tr>
              </thead>
              <tbody>
                {rowsDesc.map((r) => {
                  const muted = r.weekend || r.partial;
                  const cell: React.CSSProperties = muted ? { ...td, color: MUTED } : td;
                  const s5c = !r.partial && r.s5Spend != null && r.s5 > 0 ? r.s5Spend / r.s5 : null;
                  const short = r.googleS5 != null && !r.partial && r.googleS5 < r.s5;
                  return (
                    <tr key={r.day} style={r.day === SWITCH_DAY ? { boxShadow: `inset 3px 0 0 ${GREEN}` } : undefined}>
                      <td style={{ ...cell, textAlign: "left", fontWeight: 600, color: muted ? MUTED : INK }}>
                        {fmtDayKey(r.day)}{r.partial ? " · partial" : r.weekend ? " · off" : ""}
                      </td>
                      <td style={cell}>{r.forms}</td>
                      <td style={{ ...cell, fontWeight: 700 }}>{r.qualified}</td>
                      <td style={cell}>{r.forms ? pct(r.formsPriced / r.forms) : "—"}</td>
                      <td style={{ ...cell, fontWeight: 700, color: !muted && r.s5 < GUARDRAIL_MIN_PRICED_PER_DAY && r.day >= SWITCH_DAY ? AMBER : cell.color }}>{r.s5}</td>
                      <td style={{ ...cell, color: short ? AMBER : cell.color }}>{r.googleS5 ?? "—"}</td>
                      <td style={cell}>{money(r.spend)}</td>
                      <td style={cell}>{money(r.s5Spend)}</td>
                      <td style={cell}>{!r.partial && r.spend != null && r.spend > 0 && r.qualified > 0 ? money2(r.spend / r.qualified) : "—"}</td>
                      <td style={{ ...cell, color: s5c != null && !muted ? (s5c <= S5_TARGET_CPA ? GREEN : cell.color) : cell.color }}>{money2(s5c)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td style={{ ...tot, textAlign: "left" }}>{w.days} complete days</td>
                  <td style={tot}>{w.forms}</td>
                  <td style={tot}>{w.qualified}</td>
                  <td style={tot}>{pct(w.rate)}</td>
                  <td style={tot}>{w.s5}</td>
                  <td style={tot}>{w.googleS5 ?? "—"}</td>
                  <td style={tot}>{money(w.spend)}</td>
                  <td style={tot}>{money(w.s5Spend)}</td>
                  <td style={tot}>{money2(w.blendedCpq)}</td>
                  <td style={tot}>{money2(w.s5Cpq)}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </details>

      {data.runs && data.runs.length > 0 && (
        <p style={{ margin: "12px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
          <strong style={{ color: "#3f3f3f" }}>Upload runs:</strong>{" "}
          {data.runs.map((r, i) => (
            <span key={r.url || i}>
              {i > 0 && " · "}
              <a href={r.url} target="_blank" rel="noreferrer" style={{ color: r.conclusion === "success" ? GREEN : r.conclusion ? RED : AMBER, textDecoration: "none", fontWeight: 600 }}>
                {r.conclusion === "success" ? "✓" : r.conclusion ? "✗" : "…"} {fmtTime(r.startedAt).replace(/ PT$/, "")}
              </a>
              {r.event !== "schedule" ? ` (${r.event === "workflow_dispatch" ? "manual" : r.event})` : ""}
            </span>
          ))}
        </p>
      )}

      <p style={{ margin: "9px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.55, borderTop: "1px solid var(--color-gray-100)", paddingTop: 8 }}>
        Rate is by form-created day (cohort); qualified counts are by priced day, so the two columns don&apos;t divide.
        &quot;In Google&quot; is by conversion date; uploads land the night of the pricing day, so the latest day fills in after the 7 PM PT run.
        Sent vs counted compares the last {uc.days.length} complete serving days: a gap that persists after 48h is an upload problem, not a volume drop.
        {data.notes.map((n) => <span key={n}><br />⚠ {n}</span>)}
      </p>
    </section>
  );
}
