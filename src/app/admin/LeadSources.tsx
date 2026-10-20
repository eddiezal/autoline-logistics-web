/**
 * Lead Sources — the /admin Overview (2026-10-20).
 *
 * One question: where does the next dollar of lead spend go? Every source on
 * the same row; Google Ads campaigns as the drill-down. Two readers:
 *   · operator (default): dense, month toggle, open-month ranges.
 *   · owner (?who=owner): this month first in words, then the trend by month.
 * Spec: claude/lead-sources-page-spec-2026-10-20.md. Honesty rules live in
 * leadSources.mjs (settled at 95% reported; no rates or colors on an open
 * month; bookings projected, fees never).
 */
// @ts-ignore — plain-JS shared module.
import { SOURCES as SOURCES_JS, SETTLED_AT } from "@/lib/admin/leadSources.mjs";
interface SourceDef { key: string; label: string; paid: boolean; cost: number | null; curve: string; avail?: string; unverified?: boolean; history?: boolean; note?: string }
const SOURCES: Record<string, SourceDef> = SOURCES_JS;
import type { LeadSourcesLive, MonthBlock, SourceRow } from "@/lib/admin/leadSourcesLive";

const GREEN = "#128A3A";
const INK = "#1a1a1a";
const MUTED = "var(--color-text-muted)";
const RED = "#C0392B";
const AMBER = "#B7791F";
const COLORS: Record<string, string> = { irelo: "#9ca3af", livetr: "#B7791F", google: "#D9822B", free: "#2F6FB3", taylorP: "#6b5b95", taylorS: "#b8a9d1" };

const money = (v: number | null | undefined, d = 0) => (v == null ? "—" : (v < 0 ? "−" : "") + "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }));
const money2 = (v: number | null | undefined) => money(v, 2);
const pct = (v: number | null | undefined) => (v == null ? "—" : Math.round(v * 100) + "%");
const signed = (v: number | null | undefined) => (v == null ? "—" : (v >= 0 ? "+" : "−") + "$" + Math.abs(Math.round(v)).toLocaleString());
const monthLabel = (m: string, long = false) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: long ? "long" : "short", year: long ? "numeric" : undefined });
const dayLabel = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
const fmtTime = (d: Date) => d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " PT";

const box: React.CSSProperties = { border: "1px solid var(--color-gray-200)", borderRadius: 12, background: "var(--color-surface)", padding: "16px 18px", marginBottom: 12 };
const th: React.CSSProperties = { textAlign: "right", fontWeight: 700, color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, padding: "6px 6px", borderBottom: "2px solid var(--color-gray-200)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "7px 6px", borderBottom: "1px solid var(--color-gray-100)", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#3f3f3f", fontSize: 12.5, whiteSpace: "nowrap" };
const tdl: React.CSSProperties = { ...td, textAlign: "left", fontWeight: 600, color: INK, whiteSpace: "normal" };
const tot: React.CSSProperties = { ...td, fontWeight: 700, color: INK, borderTop: "2px solid var(--color-gray-200)", borderBottom: "none" };
const sub: React.CSSProperties = { ...td, color: MUTED, fontSize: 12 };
const nl: React.CSSProperties = { fontSize: 11, color: MUTED, fontWeight: 500 };
const tag = (text: string, tone?: "amber" | "ok") => (
  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, borderRadius: 999, padding: "1px 6px", marginLeft: 6, verticalAlign: "middle", background: tone === "amber" ? AMBER : tone === "ok" ? "#E6F4EA" : "var(--color-gray-100)", color: tone === "amber" ? "#fff" : tone === "ok" ? GREEN : MUTED }}>{text}</span>
);

function Tile({ title, value, sub, tone }: { title: string; value: React.ReactNode; sub: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div style={{ flex: "1 1 200px", minWidth: 0, border: "1px solid var(--color-gray-200)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: MUTED }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: tone === "good" ? GREEN : tone === "bad" ? RED : INK, fontVariantNumeric: "tabular-nums", margin: "2px 0" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.45 }}>{sub}</div>
    </div>
  );
}

const TwoColCss = () => <style>{`@media (max-width: 860px) { .ls-two { grid-template-columns: 1fr !important; } }`}</style>;

function Unavailable() {
  return (
    <section style={box}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: INK }}>Lead sources</h2>
      <p style={{ margin: "6px 0 0", fontSize: 12.5, color: MUTED }}>Computation unavailable this render (CRM mirror read failed). The legacy Overview is at <a href={"/admin?view=legacy"}>?view=legacy</a>.</p>
    </section>
  );
}

/** "booked so far · likely A to B" + reported tag, or the settled number. */
function Booked({ r }: { r: SourceRow }) {
  if (r.tooEarly) return <><b>{r.booked}</b> <span style={nl}>too early</span></>;
  if (r.settled || !r.range) return <b>{r.booked}</b>;
  return <><b>{r.booked}</b>{tag(`${Math.round(r.reported * 100)}% reported`)}</>;
}

function WeeklyChart({ data }: { data: LeadSourcesLive }) {
  const keys = ["irelo", "livetr", "google", "free", "taylorP", "taylorS"];
  const W = 560, H = 150, x0 = 30, bw = 40, gap = 24;
  const max = Math.max(6, ...data.weekly.map((w) => Object.values(w.by).reduce((a, b) => a + b, 0)));
  const y = (v: number) => 128 - (v / max) * 120;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true">
        <g fontSize="10" fill="#6b7280" fontFamily="system-ui"><text x="0" y="12">{max}</text><text x="0" y="72">{Math.round(max / 2)}</text><text x="0" y="132">0</text></g>
        <line x1={x0} y1={8} x2={W} y2={8} stroke="#f3f4f6" /><line x1={x0} y1={68} x2={W} y2={68} stroke="#f3f4f6" /><line x1={x0} y1={128} x2={W} y2={128} stroke="#e5e7eb" />
        {data.weekly.map((w, i) => {
          let acc = 0; const x = x0 + 18 + i * (bw + gap);
          return (
            <g key={w.week} opacity={w.partial ? 0.55 : 1}>
              {keys.map((k) => { const v = w.by[k] ?? 0; if (!v) return null; const top = y(acc + v), bot = y(acc); acc += v; return <rect key={k} x={x} y={top} width={bw} height={bot - top} fill={COLORS[k]} />; })}
              <text x={x + bw / 2} y={144} fontSize="10" fill="#6b7280" fontFamily="system-ui" textAnchor="middle">{w.partial ? "this wk" : dayLabel(w.week)}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: MUTED, flexWrap: "wrap" }}>
        {[["irelo", "iRelocation"], ["livetr", "LiveTransport"], ["google", "Google Ads"], ["free", "Free"]].map(([k, l]) => (
          <span key={k}><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: COLORS[k], marginRight: 4, verticalAlign: -1 }} />{l}</span>
        ))}
        <span>· by lead week · last column in progress</span>
      </div>
    </>
  );
}

/* ================================================================ OPERATOR */

export function OperatorView({ data, month }: { data: LeadSourcesLive | null; month?: string }) {
  if (!data) return <Unavailable />;
  const m: MonthBlock = data.byMonth[month && data.byMonth[month] ? month : data.thisMonth];
  const rows = m.rows;
  const paid = Object.keys(SOURCES).filter((k) => SOURCES[k].paid && rows[k] && (!SOURCES[k].history || rows[k]!.leads > 0));
  const free = Object.keys(SOURCES).filter((k) => !SOURCES[k].paid && rows[k] && rows[k]!.leads > 0);
  const g = rows.google;
  const ap = m.allPaid;
  const openNote = m.open && !ap.settled;
  const colorOn = !openNote;
  const fmsStyle = (v: number | null) => ({ ...td, fontWeight: 700, color: colorOn && v != null ? (v >= 0 ? GREEN : RED) : INK });

  return (
    <>
      <TwoColCss />
      <section style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: INK }}>Lead sources · {monthLabel(m.month, true)}{m.open ? <span style={{ fontWeight: 500, fontSize: 13, color: MUTED }}> to date</span> : null}</h2>
          <div style={{ fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", border: "1px solid var(--color-gray-200)", borderRadius: 999, overflow: "hidden", fontSize: 11.5 }}>
              {[...data.months].reverse().map((mk) => (
                <a key={mk} href={`/admin?view=overview&month=${mk}`} style={{ padding: "3px 10px", textDecoration: "none", color: mk === m.month ? "#fff" : MUTED, background: mk === m.month ? INK : "transparent", fontWeight: mk === m.month ? 700 : 500 }}>
                  {mk === data.thisMonth ? `${monthLabel(mk)} to date` : monthLabel(mk)}
                </a>
              ))}
            </span>
            <span>read {fmtTime(data.fetchedAt)}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <Tile title="Leads · lead spend" value={<>{(ap.leads + m.free.leads).toLocaleString()} <span style={{ fontSize: 14, color: MUTED }}>· {money(ap.cost)}</span></>}
            sub={m.open ? <>{monthLabel(m.month)} 1 – {m.daysIn} · {ap.leads.toLocaleString()} paid, {m.free.leads} free</> : <>{ap.leads.toLocaleString()} paid, {m.free.leads} free</>} />
          <Tile title={m.open ? "Bookings from leads already in" : "Bookings"} value={<>{ap.booked + m.free.booked}{openNote && !rows.google?.tooEarly ? <span style={{ fontSize: 15, color: MUTED, fontWeight: 600 }}> · likely {ap.lo + m.free.booked} to {ap.hi + m.free.booked}</span> : null}</>}
            sub={<>{openNote ? `${Math.round(ap.reported * 100)}% reported by each source's own curve · ` : ""}{ap.canceled} canceled excluded from fees</>} />
          <Tile title={`Fees minus lead spend${m.open ? " · so far" : ""}`} value={signed(ap.feeMinusSpend)} tone={colorOn ? (ap.feeMinusSpend >= 0 ? "good" : "bad") : undefined}
            sub={<>{money(ap.feeNet)} uncanceled fees − {money(ap.cost)} lead spend · {money2(ap.recoveredPerDollar)} recovered per $1{openNote ? " · bookings still landing" : ""}</>} />
          <Tile title="Google Ads · cap" value={<>{money(data.google.spentToDate)} <span style={{ fontSize: 14, color: MUTED }}>of {money(data.google.cap)}</span></>}
            sub={<>{data.google.weekdaysLeft} ad weekday{data.google.weekdaysLeft === 1 ? "" : "s"} left · pace → ~{money(data.google.projected)}{data.google.holdDaily != null ? ` · hold daily ≤ ${money(data.google.holdDaily)}` : ""}</>} />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...th, textAlign: "left" }}>paid source</th><th style={th}>leads</th><th style={th}>cost / lead</th><th style={th}>spent</th>
              <th style={th}>booked</th>{openNote ? <th style={th}>likely eventual</th> : <th style={th}>close</th>}
              <th style={th}>fees (uncanceled)</th><th style={th}>fees − spend</th><th style={th}>recovered per $1</th>
            </tr></thead>
            <tbody>
              {paid.map((k) => {
                const r = rows[k]!; const s = SOURCES[k];
                return (
                  <SourceRows key={k} k={k} r={r} s={s} m={m} openNote={openNote} fmsStyle={fmsStyle} campaignRows={k === "google" ? m.campaigns : null} />
                );
              })}
              <tr>
                <td style={{ ...tot, textAlign: "left" }}>ALL PAID</td>
                <td style={tot}>{ap.leads.toLocaleString()}</td><td style={tot}>{money2(ap.leads ? ap.cost / ap.leads : null)}</td><td style={tot}>{money(ap.cost)}</td>
                <td style={tot}>{ap.booked}</td>
                <td style={tot}>{openNote ? <span style={{ color: MUTED, fontWeight: 600 }}>{ap.lo} to {ap.hi}</span> : pct(ap.leads ? ap.booked / ap.leads : null)}</td>
                <td style={tot}>{money(ap.feeNet)}{ap.canceled ? <span style={nl}> {ap.canceled} cxl</span> : null}</td>
                <td style={{ ...tot, color: colorOn ? (ap.feeMinusSpend >= 0 ? GREEN : RED) : INK }}>{signed(ap.feeMinusSpend)}</td>
                <td style={tot}>{money2(ap.recoveredPerDollar)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ ...nl, margin: "6px 0 0" }}>
          {openNote ? <>Open month: rates and colors are withheld until ≥{Math.round(SETTLED_AT * 100)}% of expected bookings are reported; &quot;likely eventual&quot; is an 80% range on bookings only, never on fees. </> : <>Settled month: every row is ≥{Math.round(SETTLED_AT * 100)}% reported. </>}
          Google Ads leads = website forms with Google attribution + tracked calls ({g?.calls ?? 0} calls this month).
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }} className="ls-two">
          <div style={{ border: "1px solid var(--color-gray-200)", borderRadius: 10, padding: "10px 12px" }}>
            <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: "0 0 6px", color: INK }}>Free sources · {monthLabel(m.month)}{m.open ? " to date" : ""}</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ ...th, textAlign: "left" }}>source</th><th style={th}>leads</th><th style={th}>booked</th><th style={th}>fees</th><th style={th}>books 1 in</th></tr></thead>
              <tbody>
                {free.map((k) => { const r = rows[k]!; return (
                  <tr key={k}><td style={tdl}>{SOURCES[k].label} {SOURCES[k].note ? <span style={nl}>{SOURCES[k].note}</span> : null}</td><td style={td}>{r.leads}</td><td style={td}>{r.booked}</td><td style={td}>{money(r.feeNet)}</td>
                    <td style={{ ...td, color: MUTED }}>{r.settled && r.booked >= 5 ? Math.round(r.leads / r.booked) : "too few"}</td></tr>
                ); })}
                {!free.length && <tr><td style={{ ...td, textAlign: "left", color: MUTED }} colSpan={5}>No free leads this month yet.</td></tr>}
              </tbody>
            </table>
            <p style={{ ...nl, margin: "8px 0 0" }}>No cost, so no return ratio: it isn&apos;t infinite, it&apos;s undefined. Phone check Oct 20: no Google-call bookings found in hand-keyed.</p>
          </div>
          <div style={{ border: "1px solid var(--color-gray-200)", borderRadius: 10, padding: "10px 12px" }}>
            <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: "0 0 6px", color: INK }}>How fast bookings get reported · measured {dayLabel(data.curve.measuredAt)}</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ ...th, textAlign: "left" }}>curve</th><th style={th}>same day</th><th style={th}>day 7</th><th style={th}>day 14</th><th style={th}>day 21</th><th style={th}>day 35</th><th style={th}>n</th></tr></thead>
              <tbody>
                {Object.entries(data.curve.sources).map(([name, c]) => { const at = (dd: number) => c.cum[data.curve.buckets.indexOf(dd)]; return (
                  <tr key={name}><td style={tdl}>{name} <span style={nl}>{name === "Website" ? "Google Ads, organic" : name === "iRelocation" ? "+ LiveTransport, Taylor" : ""}</span></td>
                    <td style={td}>{pct(at(0))}</td><td style={td}>{pct(at(7))}</td><td style={td}>{pct(at(14))}</td><td style={td}>{pct(at(21))}</td><td style={td}>{pct(at(35))}</td><td style={td}>{c.booked}</td></tr>
                ); })}
              </tbody>
            </table>
            <p style={{ ...nl, margin: "8px 0 0" }}>Share of a source&apos;s eventual bookings reported N days after the lead ({data.curve.seasonDays}-day seasoning). Re-measured monthly with scripts/booking-delay-curve.mjs.</p>
          </div>
        </div>

        <div style={{ border: "1px solid var(--color-gray-200)", borderRadius: 10, padding: "10px 12px", marginTop: 14 }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: "0 0 6px", color: INK }}>Bookings by source · last 8 weeks</h3>
          <WeeklyChart data={data} />
        </div>

        <p style={{ margin: "12px 0 0", fontSize: 11.5, color: MUTED, lineHeight: 1.55, borderTop: "1px solid var(--color-gray-100)", paddingTop: 8 }}>
          Lead-created cohorts: a booking counts in the month its lead arrived. Fees are booking deposits; &quot;uncanceled&quot; excludes records currently canceled, and cancellations can arrive after the booking does.
          Google Ads bookings are undercounted when a phone booking has no click match, so its cost per lead and close rate can be off in either direction (phone-matched check Oct 20: none found outside the form path; calls never logged in the CRM remain uncounted).
          LiveTransport cost is a $4 stand-in, not verified, rate pending from Kacy. Agent time per lead is not measured. Recovered per $1: $1.00 covers lead cost only, not agent pay, card fees or refunds.
          {data.notes.map((n) => <span key={n}><br />⚠ {n}</span>)}
        </p>
      </section>
    </>
  );
}

function SourceRows({ k, r, s, m, openNote, fmsStyle, campaignRows }: { k: string; r: SourceRow; s: { label: string; avail?: string; unverified?: boolean }; m: MonthBlock; openNote: boolean; fmsStyle: (v: number | null) => React.CSSProperties; campaignRows: MonthBlock["campaigns"] | null }) {
  const star = s.unverified ? "*" : "";
  return (
    <>
      <tr>
        <td style={tdl}>
          {s.label}{s.unverified ? tag("$4 stand-in", "amber") : null}
          {s.avail ? <span style={{ ...nl, display: "block" }}>{s.avail}</span> : null}
        </td>
        <td style={td}>{r.leads.toLocaleString()}{r.calls ? <span style={nl}> {r.calls} calls</span> : null}</td>
        <td style={td}>{money2(r.costPerLead)}{star}</td>
        <td style={td}>{money(r.cost)}{star}</td>
        <td style={td}><Booked r={r} /></td>
        <td style={td}>{openNote ? (r.range ? <span style={{ color: MUTED }}>{r.range.lo === r.range.hi ? r.range.lo : `${r.range.lo} to ${r.range.hi}`}</span> : r.tooEarly ? <span style={nl}>too early</span> : <span style={{ color: MUTED }}>{r.booked}</span>) : pct(r.closeRate)}</td>
        <td style={td}>{money(r.feeNet)}{r.canceled ? <span style={nl}> {r.canceled} cxl</span> : null}</td>
        <td style={s.unverified ? { ...td, color: MUTED } : fmsStyle(r.feeMinusSpend)}>{s.unverified ? "—" : signed(r.feeMinusSpend)}</td>
        <td style={td}>{s.unverified ? <span style={{ color: MUTED }}>even at {money2(r.breakEvenCpl)}/lead</span> : money2(r.recoveredPerDollar)}</td>
      </tr>
      {campaignRows?.map((c) => (
        <tr key={c.campaignId}>
          <td style={{ ...sub, textAlign: "left", paddingLeft: 22, whiteSpace: "normal" }}>
            {c.name}
            {c.leads && c.pricedShare != null ? <span style={nl}> · {pct(c.pricedShare)} priced · {money2(c.costPerPriced)}/priced{c.campaignId === "24034984545" ? " vs $36 target" : ""}</span> : null}
          </td>
          <td style={sub}>{c.leads}</td><td style={sub}>{money2(c.costPerLead)}</td><td style={sub}>{money(c.cost)}</td>
          <td style={sub}>{c.booked}</td><td style={sub}>{openNote ? "" : pct(c.leads ? c.booked / c.leads : null)}</td>
          <td style={sub}>{money(c.feeNet)}</td><td style={sub}>{signed(c.feeMinusSpend)}</td><td style={sub}>{money2(c.recoveredPerDollar)}</td>
        </tr>
      ))}
      {k === "google" && m.open ? null : null}
    </>
  );
}

/* ================================================================ OWNER */

export function OwnerView({ data }: { data: LeadSourcesLive | null }) {
  if (!data) return <Unavailable />;
  const cur = data.byMonth[data.thisMonth];
  const ap = cur.allPaid;
  // Trend months: every complete month. A cell shows its value once that row is
  // ≥95% reported, "~value" between 85 and 95% (nearly final), and "not yet" below.
  const settledMonths = data.months.filter((mk) => mk !== data.thisMonth);
  const cell = (r: SourceRow | undefined, f: (r: SourceRow) => React.ReactNode): React.ReactNode => {
    if (!r || !r.leads) return "—";
    if (r.reported >= SETTLED_AT) return f(r);
    if (r.reported >= 0.85) return <span style={{ color: MUTED }} title={`${Math.round(r.reported * 100)}% reported`}>~{f(r)}</span>;
    return <span style={nl}>not yet</span>;
  };
  const g = cur.rows.google;
  const prevMonth = data.months[data.months.indexOf(data.thisMonth) - 1];
  const gPrev = prevMonth ? data.byMonth[prevMonth].rows.google : undefined;
  const rowsNow = ["irelo", "google", "livetr", "taylorP", "taylorS"].filter((k) => cur.rows[k] && cur.rows[k]!.leads > 0);
  const last7 = data.weekly.slice(-2).reduce((acc, w) => { for (const [k, v] of Object.entries(w.by)) acc[k] = (acc[k] ?? 0) + v; return acc; }, {} as Record<string, number>);

  // Trend: fees per $1 by source by settled month, and the Google strip.
  const trendKeys = ["irelo", "google", "taylorP", "livetr"].filter((k) => settledMonths.some((mk) => data.byMonth[mk].rows[k]));
  const vendorsNow = (() => { const ms = settledMonths.filter((mk) => data.byMonth[mk].rows.irelo && data.byMonth[mk].rows.irelo!.reported >= SETTLED_AT); if (!ms.length) return null; const lastM = data.byMonth[ms[ms.length - 1]]; const ks = ["irelo", "taylorP", "taylorS"].filter((k) => lastM.rows[k]?.cost); const c = ks.reduce((s, k) => s + lastM.rows[k]!.cost, 0); const f = ks.reduce((s, k) => s + lastM.rows[k]!.feeNet, 0); return c ? f / c : null; })();
  const gSettled = settledMonths.map((mk) => data.byMonth[mk].rows.google).filter((r): r is SourceRow => !!r && r.leads > 0 && r.reported >= SETTLED_AT);
  const gFirst = gSettled[0]?.recoveredPerDollar ?? null;
  const gLast = gSettled.length ? gSettled[gSettled.length - 1].recoveredPerDollar : null;

  const sentence = (() => {
    if (gLast == null) return null;
    const dir = gFirst != null && gLast > gFirst ? `has gone from ${money2(gFirst)} to ${money2(gLast)} in fees per $1 since the July relaunch` : `returned ${money2(gLast)} in fees per $1 last month`;
    const cond = gLast < 1 ? "Still below $1: the next step is matching the phone bookings we can't see, then this month's read." : "Above $1: Google Ads now covers its lead cost before agent pay.";
    return <>Google Ads {dir}. <b style={{ background: "#FFF4D6", padding: "0 4px", borderRadius: 3 }}>{cond}</b>{vendorsNow != null ? <> Lead vendors hold near <b>{money2(vendorsNow)}</b>.</> : null}</>;
  })();

  const big: React.CSSProperties = { ...td, fontSize: 13.5, padding: "10px 10px" };
  const bigl: React.CSSProperties = { ...tdl, fontSize: 13.5, padding: "10px 10px" };
  const bigh: React.CSSProperties = { ...th, padding: "8px 10px" };

  return (
    <section style={box}>
      <TwoColCss />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: INK }}>Where the bookings come from</h2>
        <span style={{ fontSize: 12, color: MUTED }}>Updated {fmtTime(data.fetchedAt)}</span>
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 700, margin: "14px 0 6px", color: INK }}>{monthLabel(data.thisMonth, true)} so far</h3>
      <div style={{ borderLeft: `3px solid ${INK}`, padding: "6px 12px", margin: "0 0 12px", fontSize: 14, lineHeight: 1.5 }}>
        Through {dayLabel(data.todayKey)}: <b>{(ap.leads + cur.free.leads).toLocaleString()} leads</b>, <b>{ap.booked + cur.free.booked} bookings</b>, <b>{money(ap.feeNet + cur.free.feeNet)}</b> in fees, against <b>{money(ap.cost)}</b> spent on leads.
        {!ap.settled ? <> Leads from the last few weeks are still booking, mostly iRelocation ones, so bookings and fees will rise.</> : null}
        {" "}Google Ads is at <b>{money(data.google.spentToDate)} of the {money(data.google.cap)}</b> cap with {data.google.weekdaysLeft} ad weekday{data.google.weekdaysLeft === 1 ? "" : "s"} left, on pace to finish near {money(data.google.projected)}.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...bigh, textAlign: "left" }}>Source</th><th style={bigh}>Leads</th><th style={bigh}>Spent on leads</th><th style={bigh}>Booked so far</th><th style={bigh}>Fees so far</th><th style={bigh}>Last 2 weeks</th></tr></thead>
          <tbody>
            {rowsNow.map((k) => { const r = cur.rows[k]!; const s = SOURCES[k]; return (
              <tr key={k}>
                <td style={bigl}>{s.label}{k === "google" ? <span style={nl}> phone bookings undercounted</span> : null}{s.unverified ? tag("rate not confirmed", "amber") : null}</td>
                <td style={big}>{r.leads.toLocaleString()}</td>
                <td style={s.unverified ? { ...big, color: MUTED } : big}>{s.unverified ? "$4 each?" : money(r.cost)}</td>
                <td style={big}>{r.booked}</td><td style={big}>{money(r.feeNet)}</td>
                <td style={{ ...big, color: MUTED }}>{last7[k] ?? 0} booking{(last7[k] ?? 0) === 1 ? "" : "s"}</td>
              </tr>
            ); })}
            <tr>
              <td style={bigl}>Free <span style={nl}>referrals, Google search, repeat</span></td>
              <td style={big}>{cur.free.leads}</td><td style={big}>$0</td><td style={big}>{cur.free.booked}</td><td style={big}>{money(cur.free.feeNet)}</td>
              <td style={{ ...big, color: MUTED }}>{last7.free ?? 0} booking{(last7.free ?? 0) === 1 ? "" : "s"}</td>
            </tr>
            <tr>
              <td style={{ ...tot, textAlign: "left", fontSize: 13.5, padding: "10px 10px" }}>All sources</td>
              <td style={{ ...tot, fontSize: 13.5, padding: "10px 10px" }}>{(ap.leads + cur.free.leads).toLocaleString()}</td>
              <td style={{ ...tot, fontSize: 13.5, padding: "10px 10px" }}>{money(ap.cost)}</td>
              <td style={{ ...tot, fontSize: 13.5, padding: "10px 10px" }}>{ap.booked + cur.free.booked}</td>
              <td style={{ ...tot, fontSize: 13.5, padding: "10px 10px" }}>{money(ap.feeNet + cur.free.feeNet)}</td>
              <td style={{ ...tot, fontSize: 13.5, padding: "10px 10px" }}>{Object.values(last7).reduce((a, b) => a + b, 0)} bookings</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ ...nl, margin: "6px 0 0" }}>No rates or rankings on an open month; a booking can land up to three weeks after its lead.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }} className="ls-two">
        <div style={{ border: "1px solid var(--color-gray-200)", borderRadius: 10, padding: "10px 12px" }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: "0 0 6px", color: INK }}>Bookings by week · last 8 weeks</h3>
          <WeeklyChart data={data} />
        </div>
        <div style={{ border: "1px solid var(--color-gray-200)", borderRadius: 10, padding: "10px 12px" }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 700, margin: "0 0 6px", color: INK }}>Google Ads budget · {monthLabel(data.thisMonth, true)}</h3>
          <div style={{ fontSize: 22, fontWeight: 800, margin: "4px 0" }}>{money(data.google.spentToDate)} <span style={{ color: MUTED, fontSize: 14, fontWeight: 500 }}>of {money(data.google.cap)}</span></div>
          <div style={{ height: 10, background: "var(--color-gray-100)", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${Math.min(100, Math.round((data.google.spentToDate / data.google.cap) * 100))}%`, height: "100%", background: INK }} /></div>
          <p style={{ ...nl, margin: "8px 0 0" }}>{data.google.weekdaysLeft} ad weekday{data.google.weekdaysLeft === 1 ? "" : "s"} left. At the current daily pace the month ends near {money(data.google.projected)}, {data.google.projected <= data.google.cap ? "under" : "over"} the cap.</p>
          {g ? <p style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.5 }}>Leads this month: <b>{g.leads}</b> at <b>{money(g.costPerLead)}</b> each.{gPrev ? <> Last month: {gPrev.leads} at {money(gPrev.costPerLead)}.</> : null}</p> : null}
        </div>
      </div>

      {settledMonths.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: "20px 0 6px", color: INK }}>How each source is trending · complete months <span style={nl}>(~ = nearly final, still reporting)</span></h3>
          {sentence ? <div style={{ borderLeft: `3px solid ${INK}`, padding: "6px 12px", margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.5 }}>{sentence}</div> : null}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ ...bigh, textAlign: "left" }}>Fees earned per $1 spent</th>{settledMonths.map((mk) => <th key={mk} style={bigh}>{monthLabel(mk)}{mk === "2026-07" ? <span style={nl}> relaunch Jul 20</span> : null}</th>)}</tr></thead>
              <tbody>
                {trendKeys.map((k) => (
                  <tr key={k}>
                    <td style={bigl}>{SOURCES[k].label}{k === "google" ? <span style={nl}> phone bookings undercounted</span> : null}{SOURCES[k].unverified ? tag("rate not confirmed", "amber") : null}</td>
                    {settledMonths.map((mk) => { const r = data.byMonth[mk].rows[k]; return (
                      <td key={mk} style={{ ...big, color: INK, fontWeight: 700 }}>
                        {cell(r, (rr) => SOURCES[k].unverified ? <span style={{ color: MUTED, fontWeight: 500 }}>pays below {money2(rr.breakEvenCpl)}/lead</span> : money2(rr.recoveredPerDollar))}
                      </td>
                    ); })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ ...bigh, textAlign: "left" }}>Google Ads, month by month</th>{settledMonths.map((mk) => <th key={mk} style={bigh}>{monthLabel(mk)}</th>)}<th style={bigh}>{monthLabel(data.thisMonth)} so far</th></tr></thead>
              <tbody>
                {([
                  ["Spent", (r: SourceRow) => money(r.cost)],
                  ["Leads · cost per lead", (r: SourceRow) => `${r.leads} · ${money(r.costPerLead)}`],
                  ["Books 1 in", (r: SourceRow, open: boolean) => (open ? "open" : r.booked ? String(Math.round(r.leads / r.booked)) : "—")],
                  ["Cost per booking", (r: SourceRow, open: boolean) => (open ? "open" : money(r.costPerBooking))],
                  ["Fees earned", (r: SourceRow, open: boolean) => money(r.feeNet) + (open ? " so far" : "")],
                ] as Array<[string, (r: SourceRow, open: boolean) => string]>).map(([label, f]) => (
                  <tr key={label}>
                    <td style={bigl}>{label}</td>
                    {settledMonths.map((mk) => { const r = data.byMonth[mk].rows.google; return <td key={mk} style={big}>{label === "Spent" || label === "Leads · cost per lead" ? (r ? f(r, false) : "—") : cell(r, (rr) => f(rr, false))}</td>; })}
                    <td style={{ ...big, color: MUTED }}>{g ? f(g, true) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ ...nl, margin: "6px 0 0" }}>July was setup: the account relaunched Jul 20, the Spanish campaign started in August, and bidding moved to lead quality in mid-September. Free leads over the same months: {settledMonths.reduce((s, mk) => s + data.byMonth[mk].free.leads, 0)} leads, {settledMonths.reduce((s, mk) => s + data.byMonth[mk].free.booked, 0)} bookings, {money(settledMonths.reduce((s, mk) => s + data.byMonth[mk].free.feeNet, 0))} in fees.</p>
        </>
      )}

      <div style={{ background: "#FFFBEB", border: "1px solid #F3E2A3", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, marginTop: 12, lineHeight: 1.5 }}>
        Fees are the deposit collected at booking, minus bookings later canceled. Google Ads bookings by phone can&apos;t always be matched to the ad, so its fees are undercounted. Agent pay is not included for any source. LiveTransport&apos;s rate is pending from Kacy.
      </div>
    </section>
  );
}
