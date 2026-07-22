/**
 * /admin — weekly lead report (Ben's view). Server-rendered from Firestore.
 *
 * Shows the last 7 days vs the prior 7: lead volume, pipeline value,
 * paid/organic split (post-attribution-fix data), daily trend, source
 * breakdown, top lanes (30d), and the most recent leads with the
 * ProABD-assigned agent.
 *
 * Design notes:
 *   - Test submissions (Eddie's) are excluded via TEST_MARKERS — same
 *     rules as scripts/leads-today.mjs.
 *   - All day bucketing is Pacific Time (account + business timezone).
 *   - Cost / cost-per-lead deliberately absent in v1 — needs the Ads API
 *     join (Basic Access approved; phase 2).
 *   - Charts are dependency-free inline SVG per the dataviz method:
 *     single brand hue (validated), thin bars, rounded data-ends on a
 *     square baseline, recessive grid, selective direct labels, native
 *     <title> hover.
 *
 * Added 2026-07-21. Auth in src/proxy.ts (Basic, ADMIN_DASH_PASSWORD).
 */
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ── Config shared with the rest of the codebase ─────────────── */

const TEST_MARKERS = [/eddiezal28@gmail\.com/i, /zaldivarlabs\.com/i, /\btest(ing)?\b/i];

/** Keep in sync with src/lib/leads/emailTemplate.ts (ADS_CAMPAIGN_NAMES). */
const ADS_CAMPAIGN_NAMES: Record<string, string> = {
  "24034601745": "S1 Cost & Quotes",
  "24034601748": "S2 Near Me LA",
  "24034601751": "S3 State + Corridors",
  "24034601754": "S4 Segments",
  "24034601757": "Brand Defense",
  "24034984545": "S5 Español",
};

const PT = "America/Los_Angeles";

/* ── Row shaping ─────────────────────────────────────────────── */

type SourceKey = "ads" | "organic" | "referral" | "direct";

interface LeadRow {
  t: Date;
  ref: string;
  originState: string;
  destState: string;
  price: number | null;
  sourceLabel: string;
  sourceKey: SourceKey;
  agent: string;
  isCall: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function isTest(d: any): boolean {
  const hay = [
    d.contact?.email,
    (d.contact?.firstName ?? "") + " " + (d.contact?.lastName ?? ""),
    d.contact?.notes,
  ]
    .filter(Boolean)
    .join(" | ");
  return TEST_MARKERS.some((re) => re.test(hay));
}

function deriveSource(a: any): { label: string; key: SourceKey } {
  const src = typeof a?.utmSource === "string" ? a.utmSource.trim().toLowerCase() : "";
  const med = typeof a?.utmMedium === "string" ? a.utmMedium.trim().toLowerCase() : "";
  if (src === "google" && (med === "cpc" || med === "ppc" || med === "paid")) {
    const name = a?.utmCampaign ? ADS_CAMPAIGN_NAMES[String(a.utmCampaign).trim()] : undefined;
    return { label: "Google Ads — " + (name ?? "campaign"), key: "ads" };
  }
  if (typeof a?.gclid === "string" && a.gclid.trim()) {
    // gclid only exists on a paid Google click, even when utm tags are absent.
    return { label: "Google Ads", key: "ads" };
  }
  if (src) {
    return { label: src.charAt(0).toUpperCase() + src.slice(1), key: "referral" };
  }
  const ref = typeof a?.referrer === "string" ? a.referrer.trim().toLowerCase() : "";
  if (ref) {
    let host = "";
    try {
      host = new URL(ref).hostname.replace(/^www\./, "");
    } catch {
      host = ref;
    }
    if (host.includes("google.")) return { label: "Google (organic)", key: "organic" };
    if (host.includes("bing.")) return { label: "Bing (organic)", key: "organic" };
    if (host.includes("duckduckgo.")) return { label: "DuckDuckGo (organic)", key: "organic" };
    if (host.includes("yahoo.")) return { label: "Yahoo (organic)", key: "organic" };
    if (host.includes("autolinelogistics.com")) return { label: "Direct (internal)", key: "direct" };
    return { label: "Referral — " + host, key: "referral" };
  }
  return { label: "Direct / unknown", key: "direct" };
}

function toRow(d: any): LeadRow | null {
  const t: Date | null = d.createdAt?.toDate?.() ?? (d.submittedAt ? new Date(d.submittedAt) : null);
  if (!t || Number.isNaN(t.getTime())) return null;
  const src = deriveSource(d.attribution ?? {});
  const price = typeof d.estimate?.price === "number" ? d.estimate.price : null;
  const agent =
    (typeof d.proabdAssignedAgent?.userName === "string"
      ? d.proabdAssignedAgent.userName.split(" ")[0]
      : undefined) ??
    d.assignedAgent?.firstName ??
    "—";
  const ref = String(d.leadRef ?? "");
  return {
    t,
    ref,
    originState: d.origin?.state || "?",
    destState: d.destination?.state || "?",
    price,
    sourceLabel: src.label,
    sourceKey: src.key,
    agent,
    isCall: ref.startsWith("CALL"),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ── Formatting helpers ──────────────────────────────────────── */

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: PT });
const dayShort = (d: Date) =>
  d.toLocaleDateString("en-US", { timeZone: PT, weekday: "short", day: "numeric" });
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

/** Bar with a rounded top and a square baseline (dataviz mark spec). */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return (
    `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} ` +
    `L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`
  );
}

/* ── Page ────────────────────────────────────────────────────── */

const GREEN = "var(--color-brand-primary)";
const INK = "var(--color-brand-ink)";
const MUTED = "var(--color-text-muted)";
const CARD: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-gray-200)",
  borderRadius: 12,
  padding: "18px 20px",
};

export default async function AdminReportPage() {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86_400_000);
  const d14 = new Date(now.getTime() - 14 * 86_400_000);
  const d30 = new Date(now.getTime() - 30 * 86_400_000);

  let rows: LeadRow[] = [];
  let loadError: string | null = null;
  try {
    const snap = await getAdminDb()
      .collection("leads")
      .where("createdAt", ">=", d30)
      .orderBy("createdAt", "desc")
      .get();
    rows = snap.docs
      .map((doc) => (isTest(doc.data()) ? null : toRow(doc.data())))
      .filter((r): r is LeadRow => r !== null);
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const week = rows.filter((r) => r.t >= d7);
  const prev = rows.filter((r) => r.t >= d14 && r.t < d7);
  const pipeline = week.reduce((s, r) => s + (r.price ?? 0), 0);
  const paid = week.filter((r) => r.sourceKey === "ads");
  const calls = week.filter((r) => r.isCall);
  const delta = week.length - prev.length;

  // Daily buckets, last 14 PT days.
  const days: { key: string; label: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    days.push({ key: dayKey(d), label: dayShort(d), count: 0 });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const r of rows) {
    const b = byKey.get(dayKey(r.t));
    if (b) b.count++;
  }

  // Source breakdown (7d).
  const sourceCounts = new Map<string, number>();
  for (const r of week) {
    sourceCounts.set(r.sourceLabel, (sourceCounts.get(r.sourceLabel) ?? 0) + 1);
  }
  const sources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
  const maxSource = sources[0]?.[1] ?? 1;

  // Top lanes (30d), quote-form leads only (calls have no route).
  const laneAgg = new Map<string, { n: number; sum: number; priced: number }>();
  for (const r of rows) {
    if (r.isCall || r.originState === "?" || r.destState === "?") continue;
    const lane = r.originState + " → " + r.destState;
    const a = laneAgg.get(lane) ?? { n: 0, sum: 0, priced: 0 };
    a.n++;
    if (r.price !== null) {
      a.sum += r.price;
      a.priced++;
    }
    laneAgg.set(lane, a);
  }
  const lanes = [...laneAgg.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8);

  const recent = rows.slice(0, 10);

  // Chart geometry.
  const CW = 660;
  const CH = 180;
  const PADL = 30;
  const PADB = 22;
  const PADT = 14;
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const band = (CW - PADL) / days.length;
  const barW = Math.min(28, band * 0.62);
  const yFor = (c: number) => PADT + (CH - PADT - PADB) * (1 - c / maxDay);
  const maxIdx = days.reduce((mi, d, i) => (d.count > days[mi]!.count ? i : mi), 0);

  const generatedAt = now.toLocaleString("en-US", {
    timeZone: PT,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 64px" }}>
      <header style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: GREEN,
          }}
        >
          Auto Line Logistics
        </div>
        <h1 style={{ margin: "4px 0 2px", fontSize: 26, letterSpacing: "-0.02em", color: INK }}>
          Website Lead Report
        </h1>
        <div style={{ fontSize: 13, color: MUTED }}>
          Last 7 days vs the 7 before · generated {generatedAt} PT · test submissions excluded
        </div>
      </header>

      {loadError ? (
        <div style={{ ...CARD, borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>
          Could not load lead data: {loadError}
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
              marginBottom: 12,
            }}
          >
            {[
              {
                label: "Leads (7 days)",
                value: String(week.length),
                sub: delta === 0 ? "even with prior week" : `${delta > 0 ? "+" : ""}${delta} vs prior 7 days`,
              },
              {
                label: "Pipeline value",
                value: money(pipeline),
                sub: "sum of quotes shown",
              },
              {
                label: "From Google Ads",
                value: String(paid.length),
                sub: week.length ? `${Math.round((paid.length / week.length) * 100)}% of leads` : "—",
              },
              {
                label: "Phone-call leads",
                value: String(calls.length),
                sub: "tracked ad calls",
              },
            ].map((s) => (
              <div key={s.label} style={CARD}>
                <div style={{ fontSize: 12, color: MUTED }}>{s.label}</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: INK, margin: "2px 0" }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, color: MUTED }}>{s.sub}</div>
              </div>
            ))}
          </section>

          {/* Daily trend */}
          <section style={{ ...CARD, marginBottom: 12 }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 14, color: INK }}>
              Leads per day <span style={{ color: MUTED, fontWeight: 400 }}>· last 14 days</span>
            </h2>
            <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="Daily lead counts, last 14 days" style={{ width: "100%", height: "auto" }}>
              {[0.5, 1].map((f) => (
                <g key={f}>
                  <line
                    x1={PADL}
                    x2={CW}
                    y1={yFor(maxDay * f)}
                    y2={yFor(maxDay * f)}
                    stroke="var(--color-gray-200)"
                    strokeWidth={1}
                  />
                  <text x={PADL - 6} y={yFor(maxDay * f) + 4} textAnchor="end" fontSize={10} fill="var(--color-gray-500)">
                    {Math.round(maxDay * f)}
                  </text>
                </g>
              ))}
              <line x1={PADL} x2={CW} y1={CH - PADB} y2={CH - PADB} stroke="var(--color-gray-300)" strokeWidth={1} />
              {days.map((d, i) => {
                const x = PADL + i * band + (band - barW) / 2;
                const y = yFor(d.count);
                const h = CH - PADB - y;
                const showLabel = d.count > 0 && (i === maxIdx || i === days.length - 1);
                return (
                  <g key={d.key}>
                    {d.count > 0 && <path d={barPath(x, y, barW, h, 4)} fill="#128A3A" />}
                    <title>{`${d.label}: ${d.count} lead${d.count === 1 ? "" : "s"}`}</title>
                    {showLabel && (
                      <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1a1a1a">
                        {d.count}
                      </text>
                    )}
                    {i % 2 === 1 && (
                      <text x={x + barW / 2} y={CH - 7} textAnchor="middle" fontSize={9.5} fill="var(--color-gray-500)">
                        {d.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </section>

          {/* Sources */}
          <section style={{ ...CARD, marginBottom: 12 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 14, color: INK }}>
              Where leads came from <span style={{ color: MUTED, fontWeight: 400 }}>· last 7 days</span>
            </h2>
            {sources.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No leads yet this week.</div>}
            {sources.map(([label, count]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, margin: "7px 0" }}>
                <div style={{ width: 190, fontSize: 12.5, color: "#1a1a1a", flexShrink: 0 }}>{label}</div>
                <div style={{ flex: 1, background: "var(--color-gray-100)", borderRadius: 4, height: 14 }}>
                  <div
                    style={{
                      width: `${(count / maxSource) * 100}%`,
                      minWidth: 4,
                      height: 14,
                      borderRadius: 4,
                      background: "#128A3A",
                    }}
                    title={`${label}: ${count}`}
                  />
                </div>
                <div style={{ width: 26, fontSize: 12.5, fontWeight: 700, color: INK, textAlign: "right" }}>{count}</div>
              </div>
            ))}
          </section>

          {/* Lanes + recent, two-up on wide screens */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 12,
            }}
          >
            <div style={CARD}>
              <h2 style={{ margin: "0 0 10px", fontSize: 14, color: INK }}>
                Top routes <span style={{ color: MUTED, fontWeight: 400 }}>· last 30 days</span>
              </h2>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ color: MUTED, textAlign: "left" }}>
                    <th style={{ padding: "4px 0", fontWeight: 600 }}>Route</th>
                    <th style={{ padding: "4px 0", fontWeight: 600, textAlign: "right" }}>Leads</th>
                    <th style={{ padding: "4px 0", fontWeight: 600, textAlign: "right" }}>Avg quote</th>
                  </tr>
                </thead>
                <tbody>
                  {lanes.map(([lane, a]) => (
                    <tr key={lane} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                      <td style={{ padding: "6px 0", color: "#1a1a1a" }}>{lane}</td>
                      <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 700, color: INK }}>{a.n}</td>
                      <td style={{ padding: "6px 0", textAlign: "right", color: "#1a1a1a" }}>
                        {a.priced ? money(a.sum / a.priced) : "—"}
                      </td>
                    </tr>
                  ))}
                  {lanes.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: "6px 0", color: MUTED }}>
                        No routed leads yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={CARD}>
              <h2 style={{ margin: "0 0 10px", fontSize: 14, color: INK }}>Most recent leads</h2>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: MUTED, textAlign: "left" }}>
                    <th style={{ padding: "4px 0", fontWeight: 600 }}>When (PT)</th>
                    <th style={{ padding: "4px 0", fontWeight: 600 }}>Route</th>
                    <th style={{ padding: "4px 0", fontWeight: 600, textAlign: "right" }}>Quote</th>
                    <th style={{ padding: "4px 0", fontWeight: 600 }}>Source</th>
                    <th style={{ padding: "4px 0", fontWeight: 600 }}>Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.ref + r.t.getTime()} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                      <td style={{ padding: "6px 4px 6px 0", whiteSpace: "nowrap", color: "#1a1a1a" }}>
                        {r.t.toLocaleString("en-US", { timeZone: PT, month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "6px 4px 6px 0", whiteSpace: "nowrap", color: "#1a1a1a" }}>
                        {r.isCall ? "📞 call" : `${r.originState} → ${r.destState}`}
                      </td>
                      <td style={{ padding: "6px 4px 6px 0", textAlign: "right", color: "#1a1a1a" }}>
                        {r.price !== null ? money(r.price) : "—"}
                      </td>
                      <td style={{ padding: "6px 4px 6px 0", color: "#1a1a1a" }}>{r.sourceLabel}</td>
                      <td style={{ padding: "6px 0", color: "#1a1a1a" }}>{r.agent}</td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: "6px 0", color: MUTED }}>
                        No leads in the last 30 days.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer style={{ marginTop: 20, fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
            Paid attribution is exact from Jul 20 onward (tracking fix); earlier Google Ads leads are
            identified by click ID. Cost per lead joins in the next version via the Google Ads API.
          </footer>
        </>
      )}
    </main>
  );
}
