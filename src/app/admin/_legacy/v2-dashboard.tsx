// PRESERVED v2 dashboard (pre-spec). Not routed (underscore folder). Restore by
// copying back to src/app/admin/page.tsx.
/**
 * /admin — weekly lead report (Ben's view). Server-rendered from Firestore.
 *
 * v2a (2026-07-21): channel rollup (Paid/Organic/Referral/Direct) with
 * campaign drill-down, agent volume + pipeline card, forms-vs-calls split,
 * blocked-lead tagging (pre-ZIP-gate international submissions), launch
 * annotation on the week delta, "campaign unknown" labeling for
 * gclid-backfilled leads, and non-URL referrer artifact fix.
 *
 * Design notes:
 *   - Test submissions (Eddie's) excluded via TEST_MARKERS — same rules
 *     as scripts/leads-today.mjs.
 *   - Day bucketing in Pacific Time (business timezone).
 *   - Cost / cost-per-lead deliberately absent — Ads API join is phase 2.
 *   - Close rates / time-to-book arrive with the webhook status parser
 *     (proabd_webhook_events.raw_item.Status / Booked_Date) — phase 2b.
 *   - Charts are dependency-free inline SVG per the dataviz method:
 *     single validated brand hue, thin bars, rounded data-ends on a square
 *     baseline, recessive grid, selective direct labels, native <title>.
 *
 * Auth in src/proxy.ts (HTTP Basic, ADMIN_DASH_PASSWORD).
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
/** Paid search went live this date — annotates week-over-week deltas. */
const PAID_LAUNCH_LABEL = "paid launched Jul 20";

/* ── Row shaping ─────────────────────────────────────────────── */

type SourceKey = "ads" | "organic" | "referral" | "direct";

const CHANNEL_LABELS: Record<SourceKey, string> = {
  ads: "Google Ads (paid)",
  organic: "Search (organic)",
  referral: "Referral",
  direct: "Direct / unknown",
};
const CHANNEL_ORDER: SourceKey[] = ["ads", "organic", "referral", "direct"];

type Outcome = "booked" | "lost" | "open" | "untracked";

interface LeadRow {
  t: Date;
  ref: string;
  originState: string;
  destState: string;
  price: number | null;
  sourceLabel: string;
  sourceKey: SourceKey;
  campaignName: string | null;
  agent: string;
  isCall: boolean;
  blocked: boolean;
  abdId: string;
  outcome: Outcome;
  bookedAt: Date | null;
  statusRaw: string;
}

/** ProABD status heuristics. Booked_Date is the strongest signal; the
 *  regexes cover status names until Brian supplies the canonical map. */
const BOOKED_RE = /book|dispatch|pick(ed)?\s*up|deliver|order|complete/i;
const LOST_RE = /cancel|lost|dead|archiv|duplicate|spam|bad\s*lead|no\s*answer/i;

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

function deriveSource(a: any): { label: string; key: SourceKey; campaign: string | null } {
  const src = typeof a?.utmSource === "string" ? a.utmSource.trim().toLowerCase() : "";
  const med = typeof a?.utmMedium === "string" ? a.utmMedium.trim().toLowerCase() : "";
  if (src === "google" && (med === "cpc" || med === "ppc" || med === "paid")) {
    const id = a?.utmCampaign ? String(a.utmCampaign).trim() : "";
    const campaign = id ? (ADS_CAMPAIGN_NAMES[id] ?? "Campaign " + id) : "Campaign unknown";
    return { label: "Google Ads — " + campaign, key: "ads", campaign };
  }
  if (typeof a?.gclid === "string" && a.gclid.trim()) {
    // gclid only exists on a paid Google click, even without utm tags
    // (pre-fix leads corrected by scripts/backfill-attribution.mjs).
    return { label: "Google Ads — campaign unknown", key: "ads", campaign: "Campaign unknown" };
  }
  if (src) {
    return { label: src.charAt(0).toUpperCase() + src.slice(1), key: "referral", campaign: null };
  }
  const ref = typeof a?.referrer === "string" ? a.referrer.trim().toLowerCase() : "";
  if (ref) {
    let host = "";
    try {
      host = new URL(ref).hostname.replace(/^www\./, "");
    } catch {
      host = ref;
    }
    // Non-URL junk referrers ("direct", app identifiers without a dot)
    // are direct traffic, not a "Referral — direct" artifact.
    if (!host.includes(".")) return { label: "Direct / unknown", key: "direct", campaign: null };
    if (host.includes("google.")) return { label: "Google (organic)", key: "organic", campaign: null };
    if (host.includes("bing.")) return { label: "Bing (organic)", key: "organic", campaign: null };
    if (host.includes("duckduckgo.")) return { label: "DuckDuckGo (organic)", key: "organic", campaign: null };
    if (host.includes("yahoo.")) return { label: "Yahoo (organic)", key: "organic", campaign: null };
    if (host.includes("autolinelogistics.com")) return { label: "Direct (internal)", key: "direct", campaign: null };
    return { label: "Referral — " + host, key: "referral", campaign: null };
  }
  return { label: "Direct / unknown", key: "direct", campaign: null };
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
    "Unassigned";
  const ref = String(d.leadRef ?? "");
  const isCall = ref.startsWith("CALL");
  const originState = d.origin?.state || "?";
  const destState = d.destination?.state || "?";
  return {
    t,
    ref,
    originState,
    destState,
    price,
    sourceLabel: src.label,
    sourceKey: src.key,
    campaignName: src.campaign,
    agent,
    isCall,
    // Pre-ZIP-gate submissions with unresolvable route (e.g. "Honduras"
    // typed as a ZIP). The form + API now reject these outright (Jul 20).
    blocked: !isCall && (originState === "?" || destState === "?"),
    abdId: d.proabdAbdId != null ? String(d.proabdAbdId) : "",
    outcome: "untracked",
    bookedAt: null,
    statusRaw: "",
  };
}

interface AbdState {
  lastAt: Date | null;
  status: string;
  outcome: "booked" | "lost" | "open";
  bookedAt: Date | null;
}

/** Collapse webhook events to latest-status per ABD_Id + earliest booked time. */
function classifyEvent(status: string, bookedDate: string | null): "booked" | "lost" | "open" {
  if (bookedDate || BOOKED_RE.test(status)) return "booked";
  if (LOST_RE.test(status)) return "lost";
  return "open";
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

const GREEN = "#128A3A";
const INK = "var(--color-brand-ink)";
const MUTED = "var(--color-text-muted)";
const CARD: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-gray-200)",
  borderRadius: 12,
  padding: "18px 20px",
};
const H2: React.CSSProperties = { margin: "0 0 12px", fontSize: 14, color: INK };
const SUB: React.CSSProperties = { color: MUTED, fontWeight: 400 };

function HBar({ frac, title }: { frac: number; title: string }) {
  return (
    <div style={{ flex: 1, background: "var(--color-gray-100)", borderRadius: 4, height: 14 }}>
      <div
        title={title}
        style={{
          width: `${Math.max(2, frac * 100)}%`,
          height: 14,
          borderRadius: 4,
          background: GREEN,
        }}
      />
    </div>
  );
}

export default async function AdminReportPage() {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86_400_000);
  const d14 = new Date(now.getTime() - 14 * 86_400_000);
  const d30 = new Date(now.getTime() - 30 * 86_400_000);

  let rows: LeadRow[] = [];
  let loadError: string | null = null;
  const abdStates = new Map<string, AbdState>();
  let statusFeedError = false;
  try {
    const db = getAdminDb();
    const snap = await db
      .collection("leads")
      .where("createdAt", ">=", d30)
      .orderBy("createdAt", "desc")
      .get();
    rows = snap.docs
      .map((doc) => (isTest(doc.data()) ? null : toRow(doc.data())))
      .filter((r): r is LeadRow => r !== null);

    // ProABD outcome feed: collapse webhook events (Export API) to the
    // latest status per ABD_Id. Non-fatal — the report renders without
    // outcomes if this query fails.
    try {
      const evSnap = await db
        .collection("proabd_webhook_events")
        .where("received_at", ">=", d30)
        .select("raw_item.ABD_Id", "raw_item.Status", "raw_item.Child_Status", "raw_item.Booked_Date", "received_at")
        .get();
      for (const doc of evSnap.docs) {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const ev: any = doc.data();
        /* eslint-enable @typescript-eslint/no-explicit-any */
        const raw = ev.raw_item ?? {};
        const abd = raw.ABD_Id != null ? String(raw.ABD_Id) : "";
        if (!abd) continue;
        const recAt: Date | null = ev.received_at?.toDate?.() ?? null;
        const status = [raw.Status, raw.Child_Status]
          .filter((s: unknown) => typeof s === "string" && (s as string).trim())
          .join(" · ");
        const bookedDateStr =
          typeof raw.Booked_Date === "string" && raw.Booked_Date.trim() ? raw.Booked_Date.trim() : null;
        const outcome = classifyEvent(status, bookedDateStr);

        const prev = abdStates.get(abd);
        // Earliest booked timestamp: parsed Booked_Date if valid, else event arrival.
        let bookedAt: Date | null = prev?.bookedAt ?? null;
        if (outcome === "booked" && !bookedAt) {
          const parsed = bookedDateStr ? new Date(bookedDateStr) : null;
          bookedAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : recAt;
        }
        // Latest event wins for current status/outcome.
        if (!prev || !prev.lastAt || (recAt && recAt > prev.lastAt)) {
          abdStates.set(abd, { lastAt: recAt, status, outcome, bookedAt });
        } else {
          prev.bookedAt = bookedAt;
        }
      }
      // Decorate lead rows with outcomes.
      for (const r of rows) {
        if (!r.abdId) continue;
        const st = abdStates.get(r.abdId);
        if (!st) continue;
        r.outcome = st.outcome;
        r.bookedAt = st.bookedAt;
        r.statusRaw = st.status;
      }
    } catch {
      statusFeedError = true;
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  const week = rows.filter((r) => r.t >= d7);
  const prev = rows.filter((r) => r.t >= d14 && r.t < d7);
  const pipeline = week.reduce((s, r) => s + (r.price ?? 0), 0);
  const paid = week.filter((r) => r.sourceKey === "ads");
  const forms = week.filter((r) => !r.isCall);
  const calls = week.filter((r) => r.isCall);
  const blockedWeek = week.filter((r) => r.blocked);
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

  // Channel rollup (7d): count, pipeline, priced-count per channel.
  const channelAgg = new Map<SourceKey, { n: number; sum: number; priced: number }>();
  for (const k of CHANNEL_ORDER) channelAgg.set(k, { n: 0, sum: 0, priced: 0 });
  for (const r of week) {
    const a = channelAgg.get(r.sourceKey)!;
    a.n++;
    if (r.price !== null) {
      a.sum += r.price;
      a.priced++;
    }
  }
  const maxChannel = Math.max(1, ...[...channelAgg.values()].map((a) => a.n));

  // Paid campaign drill-down (7d).
  const campAgg = new Map<string, number>();
  for (const r of paid) {
    const name = r.campaignName ?? "Campaign unknown";
    campAgg.set(name, (campAgg.get(name) ?? 0) + 1);
  }
  const campaigns = [...campAgg.entries()].sort((a, b) => b[1] - a[1]);

  // Non-paid source detail (7d) for the rollup's secondary lines.
  const detailAgg = new Map<string, number>();
  for (const r of week) {
    if (r.sourceKey === "ads") continue;
    detailAgg.set(r.sourceLabel, (detailAgg.get(r.sourceLabel) ?? 0) + 1);
  }

  // Booking funnel (30d, serviceable form leads — tracked ad calls don't
  // create ProABD records from the website flow yet).
  const funnelBase = rows.filter((r) => !r.isCall && !r.blocked);
  const inProabd = funnelBase.filter((r) => r.abdId);
  const tracked = inProabd.filter((r) => r.outcome !== "untracked");
  const bookedRows = tracked.filter((r) => r.outcome === "booked");
  const lostRows = tracked.filter((r) => r.outcome === "lost");
  const openRows = tracked.filter((r) => r.outcome === "open");
  const closeRate = tracked.length ? bookedRows.length / tracked.length : 0;
  const bookedValue = bookedRows.reduce((s, r) => s + (r.price ?? 0), 0);
  const daysToBook = bookedRows
    .filter((r) => r.bookedAt)
    .map((r) => (r.bookedAt!.getTime() - r.t.getTime()) / 86_400_000)
    .filter((d) => d >= 0 && d < 60);
  const avgDaysToBook = daysToBook.length
    ? daysToBook.reduce((s, d) => s + d, 0) / daysToBook.length
    : null;

  // Close rate by channel (30d, tracked leads only).
  const chanBook = new Map<SourceKey, { tracked: number; booked: number }>();
  for (const k of CHANNEL_ORDER) chanBook.set(k, { tracked: 0, booked: 0 });
  for (const r of tracked) {
    const c = chanBook.get(r.sourceKey)!;
    c.tracked++;
    if (r.outcome === "booked") c.booked++;
  }

  // Status taxonomy observed (tracked leads' latest status) — refine the
  // BOOKED/LOST regexes against this list as ProABD vocabulary emerges.
  const statusCounts = new Map<string, number>();
  for (const r of tracked) {
    if (r.statusRaw) statusCounts.set(r.statusRaw, (statusCounts.get(r.statusRaw) ?? 0) + 1);
  }
  const topStatuses = [...statusCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const recentBookings = [...bookedRows]
    .sort((a, b) => (b.bookedAt?.getTime() ?? 0) - (a.bookedAt?.getTime() ?? 0))
    .slice(0, 6);

  // Agent performance (30d): volume, pipeline, bookings, close rate.
  // ProABD is the assignment of record post-cutover; older leads carry
  // the legacy email routing.
  const agentAgg = new Map<string, { n: number; sum: number; tracked: number; booked: number }>();
  for (const r of rows) {
    if (r.blocked) continue;
    const a = agentAgg.get(r.agent) ?? { n: 0, sum: 0, tracked: 0, booked: 0 };
    a.n++;
    if (r.price !== null) a.sum += r.price;
    if (!r.isCall && r.abdId && r.outcome !== "untracked") {
      a.tracked++;
      if (r.outcome === "booked") a.booked++;
    }
    agentAgg.set(r.agent, a);
  }
  const agents = [...agentAgg.entries()].sort((a, b) => b[1].n - a[1].n);
  const maxAgent = Math.max(1, ...agents.map(([, a]) => a.n));

  // Top lanes (30d), quote-form leads with valid routes only.
  const laneAgg = new Map<string, { n: number; sum: number; priced: number }>();
  for (const r of rows) {
    if (r.isCall || r.blocked) continue;
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
                sub:
                  (delta === 0
                    ? "even with prior week"
                    : `${delta > 0 ? "+" : ""}${delta} vs prior 7 days`) +
                  " · " +
                  PAID_LAUNCH_LABEL,
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
                label: "Forms · Calls",
                value: `${forms.length} · ${calls.length}`,
                sub: "quote forms vs tracked ad calls",
              },
            ].map((s) => (
              <div key={s.label} style={CARD}>
                <div style={{ fontSize: 12, color: MUTED }}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: INK, margin: "2px 0" }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 11.5, color: MUTED }}>{s.sub}</div>
              </div>
            ))}
          </section>

          {/* Daily trend */}
          <section style={{ ...CARD, marginBottom: 12 }}>
            <h2 style={H2}>
              Leads per day <span style={SUB}>· last 14 days</span>
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
                    {d.count > 0 && <path d={barPath(x, y, barW, h, 4)} fill={GREEN} />}
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

          {/* Channel rollup */}
          <section style={{ ...CARD, marginBottom: 12 }}>
            <h2 style={H2}>
              Channels <span style={SUB}>· last 7 days · count, pipeline, avg quote</span>
            </h2>
            {CHANNEL_ORDER.map((k) => {
              const a = channelAgg.get(k)!;
              return (
                <div key={k}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 2px" }}>
                    <div style={{ width: 150, fontSize: 13, fontWeight: 700, color: "#1a1a1a", flexShrink: 0 }}>
                      {CHANNEL_LABELS[k]}
                    </div>
                    <HBar frac={a.n / maxChannel} title={`${CHANNEL_LABELS[k]}: ${a.n}`} />
                    <div style={{ width: 24, fontSize: 13, fontWeight: 800, color: INK, textAlign: "right" }}>{a.n}</div>
                    <div style={{ width: 130, fontSize: 12, color: MUTED, textAlign: "right" }}>
                      {a.sum > 0 ? `${money(a.sum)} · avg ${money(a.sum / Math.max(1, a.priced))}` : "—"}
                    </div>
                  </div>
                  {/* drill-down lines */}
                  {k === "ads" &&
                    campaigns.map(([name, n]) => (
                      <div key={name} style={{ display: "flex", gap: 10, margin: "0 0 2px", paddingLeft: 24 }}>
                        <div style={{ width: 220, fontSize: 12, color: MUTED }}>{name}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>{n}</div>
                      </div>
                    ))}
                  {k !== "ads" &&
                    [...detailAgg.entries()]
                      .filter(([label]) => {
                        if (k === "organic") return label.includes("(organic)");
                        if (k === "referral") return label.startsWith("Referral") || (!label.includes("(organic)") && !label.startsWith("Direct") && !label.startsWith("Google Ads"));
                        return label.startsWith("Direct");
                      })
                      .map(([label, n]) => (
                        <div key={label} style={{ display: "flex", gap: 10, margin: "0 0 2px", paddingLeft: 24 }}>
                          <div style={{ width: 220, fontSize: 12, color: MUTED }}>{label}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>{n}</div>
                        </div>
                      ))}
                </div>
              );
            })}
            {blockedWeek.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: MUTED }}>
                {blockedWeek.length} additional submission{blockedWeek.length === 1 ? "" : "s"} had
                invalid/international routes — this traffic is now rejected at the form (ZIP
                validation, live Jul 20).
              </div>
            )}
          </section>

          {/* Booking funnel from ProABD status feed */}
          <section style={{ ...CARD, marginBottom: 12 }}>
            <h2 style={H2}>
              Bookings <span style={SUB}>· last 30 days · from ProABD status feed</span>
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "baseline", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 28, fontWeight: 800, color: INK }}>{bookedRows.length}</span>
                <span style={{ fontSize: 12.5, color: MUTED }}> booked{bookedValue > 0 ? ` · ${money(bookedValue)} quoted value` : ""}</span>
              </div>
              <div style={{ fontSize: 13, color: "#1a1a1a" }}>
                <strong style={{ color: INK }}>{Math.round(closeRate * 100)}%</strong>{" "}
                <span style={{ color: MUTED }}>close rate</span>
              </div>
              {avgDaysToBook !== null && (
                <div style={{ fontSize: 13, color: "#1a1a1a" }}>
                  <strong style={{ color: INK }}>{avgDaysToBook.toFixed(1)}</strong>{" "}
                  <span style={{ color: MUTED }}>days to book (avg)</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 10 }}>
              {funnelBase.length} serviceable web leads → {inProabd.length} reached ProABD →{" "}
              {tracked.length} status-tracked → <strong style={{ color: "#1a1a1a" }}>{bookedRows.length} booked</strong> ·{" "}
              {openRows.length} open · {lostRows.length} lost
            </div>
            {[...chanBook.entries()].filter(([, c]) => c.tracked > 0).length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {CHANNEL_ORDER.filter((k) => chanBook.get(k)!.tracked > 0).map((k) => {
                  const c = chanBook.get(k)!;
                  return (
                    <div key={k} style={{ display: "flex", gap: 10, fontSize: 12, margin: "2px 0" }}>
                      <div style={{ width: 150, color: MUTED }}>{CHANNEL_LABELS[k]}</div>
                      <div style={{ color: "#1a1a1a", fontWeight: 700 }}>
                        {c.booked}/{c.tracked} booked{c.tracked >= 3 ? ` (${Math.round((c.booked / c.tracked) * 100)}%)` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {recentBookings.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 8 }}>
                <thead>
                  <tr style={{ color: MUTED, textAlign: "left" }}>
                    <th style={{ padding: "4px 0", fontWeight: 600 }}>Booked (PT)</th>
                    <th style={{ padding: "4px 0", fontWeight: 600 }}>Route</th>
                    <th style={{ padding: "4px 0", fontWeight: 600, textAlign: "right" }}>Quote</th>
                    <th style={{ padding: "4px 0", fontWeight: 600 }}>Agent</th>
                    <th style={{ padding: "4px 0", fontWeight: 600, textAlign: "right" }}>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((r) => (
                    <tr key={r.ref} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                      <td style={{ padding: "6px 4px 6px 0", whiteSpace: "nowrap", color: "#1a1a1a" }}>
                        {r.bookedAt
                          ? r.bookedAt.toLocaleString("en-US", { timeZone: PT, month: "numeric", day: "numeric" })
                          : "—"}
                      </td>
                      <td style={{ padding: "6px 4px 6px 0", color: "#1a1a1a" }}>{`${r.originState} → ${r.destState}`}</td>
                      <td style={{ padding: "6px 4px 6px 0", textAlign: "right", color: "#1a1a1a" }}>
                        {r.price !== null ? money(r.price) : "—"}
                      </td>
                      <td style={{ padding: "6px 4px 6px 0", color: "#1a1a1a" }}>{r.agent}</td>
                      <td style={{ padding: "6px 0", textAlign: "right", color: "#1a1a1a" }}>
                        {r.bookedAt ? Math.max(0, (r.bookedAt.getTime() - r.t.getTime()) / 86_400_000).toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
              {statusFeedError
                ? "Status feed unavailable right now — outcome data will return on the next load."
                : topStatuses.length > 0
                  ? "ProABD statuses observed: " + topStatuses.map(([s, n]) => `${s} (${n})`).join(" · ")
                  : "No ProABD statuses observed yet — outcomes appear as the Export API feed flows."}{" "}
              Booked/lost detection is heuristic until the canonical status map is confirmed with
              Superflo. Web leads since the Jul 14 integration only; phone-call bookings not yet
              tracked here.
            </div>
          </section>

          {/* Agents + Top routes, two-up */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div style={CARD}>
              <h2 style={H2}>
                Agent performance <span style={SUB}>· last 30 days</span>
              </h2>
              {agents.map(([name, a]) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0" }}>
                  <div style={{ width: 84, fontSize: 12.5, fontWeight: 700, color: "#1a1a1a", flexShrink: 0 }}>{name}</div>
                  <HBar frac={a.n / maxAgent} title={`${name}: ${a.n} leads`} />
                  <div style={{ width: 20, fontSize: 12.5, fontWeight: 800, color: INK, textAlign: "right" }}>{a.n}</div>
                  <div style={{ width: 148, fontSize: 11.5, color: MUTED, textAlign: "right" }}>
                    {a.tracked > 0 ? `${a.booked} booked (${Math.round((a.booked / a.tracked) * 100)}%) · ` : ""}
                    {a.sum > 0 ? money(a.sum) : "—"}
                  </div>
                </div>
              ))}
              {agents.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>No leads yet.</div>}
              <div style={{ marginTop: 10, fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
                Assignment of record is ProABD. Close % uses status-tracked web leads only — call
                leads and pre-integration history excluded.
              </div>
            </div>

            <div style={CARD}>
              <h2 style={H2}>
                Top routes <span style={SUB}>· last 30 days</span>
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
          </section>

          {/* Recent leads */}
          <section style={CARD}>
            <h2 style={H2}>Most recent leads</h2>
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
                    <td style={{ padding: "6px 4px 6px 0", whiteSpace: "nowrap" }}>
                      {r.isCall ? (
                        <span style={{ color: "#1a1a1a" }}>📞 call</span>
                      ) : r.blocked ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#92400e",
                            background: "#fffbeb",
                            border: "1px solid #fde68a",
                            borderRadius: 6,
                            padding: "1px 6px",
                          }}
                          title="Invalid or international route — now rejected at the form (ZIP validation, live Jul 20)"
                        >
                          {r.originState} → blocked (intl/invalid)
                        </span>
                      ) : (
                        <span style={{ color: "#1a1a1a" }}>{`${r.originState} → ${r.destState}`}</span>
                      )}
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
          </section>

          <footer style={{ marginTop: 20, fontSize: 11.5, color: MUTED, lineHeight: 1.6 }}>
            Paid attribution is exact from Jul 20 onward (tracking fix); earlier Google Ads leads
            are identified by click ID and shown as “campaign unknown.” Booking outcomes come from
            the ProABD status feed (web leads since Jul 14). Cost per lead joins in the next
            version via the Google Ads API.
          </footer>
        </>
      )}
    </main>
  );
}
