/**
 * /admin — Lead & Booking Performance
 * (renames to "Revenue & Lead Performance" only when §24 criteria are met)
 *
 * Implementation of the Now-Tier Dashboard Specification (July 2026).
 * Five views (?view=): overview · acquisition · sales · lanes · opportunities,
 * plus a collapsed data-coverage/readiness panel. Server-rendered from
 * Firestore; HTTP Basic auth in src/proxy.ts (ADMIN_DASH_PASSWORD).
 *
 * SPEC PRINCIPLES ENFORCED HERE
 *  - One eligible population per comparison; every view labels its window.
 *  - Form-only denominators for pricing coverage (calls excluded by design).
 *  - "Quoted value" explicitly ≠ revenue/profit; no provisional booking
 *    number receives headline treatment (booked classification stays
 *    heuristic until the canonical ProABD status map arrives).
 *  - Attribution regimes separated: pre-fix/backfilled vs post-fix
 *    (exact tracking-fix timestamp below).
 *  - Data coverage rendered as independent indicators, never as a funnel.
 *  - Unavailable metrics (revenue, carrier pay, gross profit, response
 *    time, contact/close rates) are OMITTED, not dashed out.
 *
 * METRIC DEFINITIONS (§17) — source of truth for this file:
 *  valid lead        non-test lead passing serviceability validation
 *                    (blocked international/invalid routes excluded and
 *                    reported separately)
 *  valid form        valid lead from the quote form (leadRef "AL-…")
 *  tracked call      CallRail lead (leadRef "CALL-…"); route/vehicle/
 *                    estimate absent BY DESIGN
 *  priced form       valid form with numeric estimate.price > 0
 *  pricing coverage  priced forms / valid forms   (never includes calls)
 *  quoted value      Σ estimate.price over priced forms — NOT revenue
 *  sync coverage     eligible forms with proabdAbdId+proabdSyncedAt /
 *                    eligible forms (15-min processing grace)
 *  attribution completeness (post-fix)
 *                    post-fix paid leads with a mapped campaign /
 *                    post-fix paid leads
 *
 * The previous dashboard is preserved at src/app/admin/_legacy/ per §1.
 */
import { getAdminDb } from "@/lib/firebase/admin";
import { fetchAdsStats, type AdsResult } from "@/lib/googleAds/client";
import { classifyRecord, type RecordOutcome } from "@/lib/proabd/statuses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ── Eligibility constants (§7) ──────────────────────────────── */

/** ProABD createLead integration went live (cohort start). */
const PROABD_START = new Date("2026-07-14T07:00:00Z"); // Jul 14 00:00 PT
/** Exact UTM tracking-fix deploy (commit e3e92ae verified live ~3:00 PM PT). */
const TRACKING_FIX_TS = new Date("2026-07-20T22:00:00Z");
/** Webhook event history begins (assignment/status coverage floor). */
const WEBHOOK_START_LABEL = "Jul 8";
/** Grace period before a missing ProABD sync counts as a failure. */
const SYNC_GRACE_MS = 15 * 60 * 1000;

const TEST_MARKERS = [/eddiezal28@gmail\.com/i, /zaldivarlabs\.com/i, /\btest(ing)?\b/i];

/** Keep in sync with src/lib/leads/emailTemplate.ts. */
const ADS_CAMPAIGN_NAMES: Record<string, string> = {
  "24034601745": "S1 Cost & Quotes",
  "24034601748": "S2 Near Me LA",
  "24034601751": "S3 State + Corridors",
  "24034601754": "S4 Segments",
  "24034601757": "Brand Defense",
  "24034984545": "S5 Español",
};

const PT = "America/Los_Angeles";

/* ── Types ───────────────────────────────────────────────────── */

type SourceKey = "ads" | "organic" | "referral" | "direct";

const CHANNEL_LABELS: Record<SourceKey, string> = {
  ads: "Google Ads",
  organic: "Organic search",
  referral: "Referral",
  direct: "Direct / unknown",
};
const CHANNEL_ORDER: SourceKey[] = ["ads", "organic", "referral", "direct"];

interface LeadRow {
  t: Date;
  ref: string;
  isCall: boolean;
  blocked: boolean;
  originState: string;
  destState: string;
  price: number | null;
  sourceKey: SourceKey;
  sourceLabel: string;
  campaignId: string | null;
  campaignName: string | null; // mapped name, null if unmapped/unknown
  adGroupId: string | null;
  paidProof: boolean; // utm cpc OR gclid present
  postFix: boolean; // created after TRACKING_FIX_TS
  abdId: string;
  synced: boolean; // proabdSyncedAt present
  proabdUser: string | null; // stamped assignee (webhook stamp-back)
  submitPath: string | null; // page the form was submitted on (capture began Jul 22)
  landingPath: string | null; // first-touch page, 30-day cookie (capture began Jul 22)
  locale: "es" | "en" | null; // visitor language (capture began Jul 22)
}

interface AbdState {
  lastAt: Date | null;
  firstUser: string | null;
  lastUser: string | null;
  userChanges: number;
  eventCount: number;
  /** Any event reached Order stage (entity_type "order" or Booked_Date set). */
  reachedOrder: boolean;
  /** Status_Id on the most recent event carrying one. */
  lastStatusId: string | null;
  /** Canonical outcome per the Superflo status map (2026-07-22). */
  outcome: RecordOutcome;
}

/* ── Row shaping ─────────────────────────────────────────────── */
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

function deriveSource(a: any): {
  key: SourceKey;
  label: string;
  campaignId: string | null;
  campaignName: string | null;
  paidProof: boolean;
} {
  const src = typeof a?.utmSource === "string" ? a.utmSource.trim().toLowerCase() : "";
  const med = typeof a?.utmMedium === "string" ? a.utmMedium.trim().toLowerCase() : "";
  const gclid = typeof a?.gclid === "string" && a.gclid.trim() ? true : false;
  if (src === "google" && (med === "cpc" || med === "ppc" || med === "paid")) {
    const id = a?.utmCampaign ? String(a.utmCampaign).trim() : "";
    const name = id ? (ADS_CAMPAIGN_NAMES[id] ?? null) : null;
    return {
      key: "ads",
      label: "Google Ads" + (name ? " — " + name : ""),
      campaignId: id || null,
      campaignName: name,
      paidProof: true,
    };
  }
  if (gclid) {
    return { key: "ads", label: "Google Ads — attribution incomplete", campaignId: null, campaignName: null, paidProof: true };
  }
  if (src) {
    return { key: "referral", label: src.charAt(0).toUpperCase() + src.slice(1), campaignId: null, campaignName: null, paidProof: false };
  }
  const ref = typeof a?.referrer === "string" ? a.referrer.trim().toLowerCase() : "";
  if (ref) {
    let host = "";
    try {
      host = new URL(ref).hostname.replace(/^www\./, "");
    } catch {
      host = ref;
    }
    if (!host.includes(".")) return { key: "direct", label: "Direct / unknown", campaignId: null, campaignName: null, paidProof: false };
    if (host.includes("google.")) return { key: "organic", label: "Google (organic)", campaignId: null, campaignName: null, paidProof: false };
    if (host.includes("bing.")) return { key: "organic", label: "Bing (organic)", campaignId: null, campaignName: null, paidProof: false };
    if (host.includes("duckduckgo.")) return { key: "organic", label: "DuckDuckGo (organic)", campaignId: null, campaignName: null, paidProof: false };
    if (host.includes("yahoo.")) return { key: "organic", label: "Yahoo (organic)", campaignId: null, campaignName: null, paidProof: false };
    if (host.includes("autolinelogistics.com")) return { key: "direct", label: "Direct (internal)", campaignId: null, campaignName: null, paidProof: false };
    return { key: "referral", label: "Referral — " + host, campaignId: null, campaignName: null, paidProof: false };
  }
  return { key: "direct", label: "Direct / unknown", campaignId: null, campaignName: null, paidProof: false };
}

function toRow(d: any): LeadRow | null {
  const t: Date | null = d.createdAt?.toDate?.() ?? (d.submittedAt ? new Date(d.submittedAt) : null);
  if (!t || Number.isNaN(t.getTime())) return null;
  const src = deriveSource(d.attribution ?? {});
  const ref = String(d.leadRef ?? "");
  const isCall = ref.startsWith("CALL");
  const originState = d.origin?.state || "?";
  const destState = d.destination?.state || "?";
  const price = typeof d.estimate?.price === "number" && d.estimate.price > 0 ? d.estimate.price : null;
  return {
    t,
    ref,
    isCall,
    blocked: !isCall && (originState === "?" || destState === "?"),
    originState,
    destState,
    price,
    sourceKey: src.key,
    sourceLabel: src.label,
    campaignId: src.campaignId,
    campaignName: src.campaignName,
    adGroupId: typeof d.attribution?.utmContent === "string" && d.attribution.utmContent.trim() ? d.attribution.utmContent.trim() : null,
    paidProof: src.paidProof,
    postFix: t >= TRACKING_FIX_TS,
    abdId: d.proabdAbdId != null ? String(d.proabdAbdId) : "",
    synced: Boolean(d.proabdSyncedAt),
    submitPath:
      typeof d.attribution?.submitPath === "string" && d.attribution.submitPath
        ? d.attribution.submitPath
        : null,
    landingPath:
      typeof d.attribution?.landingPath === "string" && d.attribution.landingPath
        ? d.attribution.landingPath
        : null,
    locale:
      d.attribution?.locale === "es" ? "es" : d.attribution?.locale === "en" ? "en" : null,
    proabdUser:
      typeof d.proabdAssignedAgent?.userName === "string" && d.proabdAssignedAgent.userName.trim()
        ? d.proabdAssignedAgent.userName.trim()
        : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ── Formatting ──────────────────────────────────────────────── */

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
/** Unit-economics money (CPC, cost/conv, CPL): always 2 decimals. */
const money2 = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) + "%" : "—");
const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { timeZone: PT, month: "short", day: "numeric" });

/* ── Shared styles ───────────────────────────────────────────── */

const GREEN = "#128A3A";
const INK = "var(--color-brand-ink)";
const MUTED = "var(--color-text-muted)";
const CARD: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-gray-200)",
  borderRadius: 12,
  padding: "18px 20px",
};
const H2: React.CSSProperties = { margin: "0 0 4px", fontSize: 14, color: INK };
const SUBTLE: React.CSSProperties = { fontSize: 12, color: MUTED };
const TH: React.CSSProperties = { padding: "6px 10px 6px 0", fontWeight: 600, textAlign: "left", color: MUTED, whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "7px 10px 7px 0", color: "#1a1a1a", verticalAlign: "top" };
const TDR: React.CSSProperties = { ...TD, textAlign: "right" };
const ALERT: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  fontSize: 12.5,
  color: "#92400e",
  marginBottom: 12,
};

/* ── Page ────────────────────────────────────────────────────── */

const VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "acquisition", label: "Acquisition" },
  { id: "sales", label: "Sales workload" },
  { id: "lanes", label: "Lane activity" },
  { id: "opportunities", label: "Opportunities" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

export default async function AdminReportPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const view: ViewId = (VIEWS.find((v) => v.id === sp.view)?.id ?? "overview") as ViewId;

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86_400_000);

  /* ── Load ── */
  let all: LeadRow[] = [];
  let loadError: string | null = null;
  const abdStates = new Map<string, AbdState>();
  try {
    const db = getAdminDb();
    const snap = await db
      .collection("leads")
      .where("createdAt", ">=", d30)
      .orderBy("createdAt", "desc")
      .get();
    all = snap.docs
      .map((doc) => (isTest(doc.data()) ? null : toRow(doc.data())))
      .filter((r): r is LeadRow => r !== null);

    // Ownership/event coverage from ProABD Export events (since Jul 8).
    try {
      const evSnap = await db
        .collection("proabd_webhook_events")
        .where("received_at", ">=", d30)
        .select(
          "entity_id",
          "entity_type",
          "raw_item.ABD_Id",
          "raw_item.UserName",
          "raw_item.Status_Id",
          "raw_item.Booked_Date",
          "received_at",
        )
        .get();
      const evs: {
        abd: string;
        user: string | null;
        at: Date | null;
        isOrder: boolean;
        statusId: string | null;
      }[] = [];
      for (const doc of evSnap.docs) {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const ev: any = doc.data();
        /* eslint-enable @typescript-eslint/no-explicit-any */
        const raw = ev.raw_item ?? {};
        // Join key: entity_id (our indexed copy, stamped by the webhook on
        // every event) with raw_item.ABD_Id as fallback. Keying on the raw
        // payload alone silently drops events whose ABD_Id arrives in an
        // unexpected shape.
        const abd =
          ev.entity_id != null && String(ev.entity_id).trim()
            ? String(ev.entity_id).trim()
            : raw.ABD_Id != null
              ? String(raw.ABD_Id)
              : "";
        if (!abd) continue;
        evs.push({
          abd,
          user: typeof raw.UserName === "string" && raw.UserName.trim() ? raw.UserName.trim() : null,
          at: ev.received_at?.toDate?.() ?? null,
          // Order stage = the canonical booked signal (status map 2026-07-22).
          isOrder:
            ev.entity_type === "order" ||
            (typeof raw.Booked_Date === "string" && raw.Booked_Date.trim() !== ""),
          statusId: raw.Status_Id != null && String(raw.Status_Id).trim() ? String(raw.Status_Id) : null,
        });
      }
      evs.sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
      for (const e of evs) {
        const st = abdStates.get(e.abd) ?? {
          lastAt: null,
          firstUser: null,
          lastUser: null,
          userChanges: 0,
          eventCount: 0,
          reachedOrder: false,
          lastStatusId: null,
          outcome: "active" as RecordOutcome,
        };
        st.eventCount++;
        st.lastAt = e.at;
        if (e.user) {
          if (!st.firstUser) st.firstUser = e.user;
          if (st.lastUser && st.lastUser !== e.user) st.userChanges++;
          st.lastUser = e.user;
        }
        if (e.isOrder) st.reachedOrder = true;
        if (e.statusId) st.lastStatusId = e.statusId;
        abdStates.set(e.abd, st);
      }
      for (const st of abdStates.values()) {
        st.outcome = classifyRecord(st.reachedOrder, st.lastStatusId);
      }
    } catch {
      /* readiness panel notes coverage; page renders without event data */
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  // Google Ads spend/conversions (cost join). Typed states — the page
  // renders fully without credentials; the readiness row tells the truth.
  const ads: AdsResult = await fetchAdsStats(PROABD_START);

  /* ── Cohorts (§7) ── */
  // Lead cohort: created since ProABD integration (Jul 14), valid only.
  const cohortAll = all.filter((r) => r.t >= PROABD_START);
  const cohort = cohortAll.filter((r) => !r.blocked); // valid leads
  const cohortBlocked = cohortAll.filter((r) => r.blocked);
  const forms = cohort.filter((r) => !r.isCall);
  const calls = cohort.filter((r) => r.isCall);
  const pricedForms = forms.filter((r) => r.price !== null);
  const quotedValue = pricedForms.reduce((s, r) => s + (r.price ?? 0), 0);
  const cohortLabel = `Lead cohort · ${fmtDay(PROABD_START)}–${fmtDay(now)}`;

  // Attribution regimes (§7): post-fix paid vs historical/backfilled paid.
  const paidPost = cohort.filter((r) => r.paidProof && r.postFix);
  const paidPostMapped = paidPost.filter((r) => r.campaignName !== null);
  const paidPre = cohort.filter((r) => r.paidProof && !r.postFix);
  const paidPreMapped = paidPre.filter((r) => r.campaignName !== null);

  // ProABD sync coverage (forms only; calls don't flow through createLead).
  const syncEligible = forms.filter((r) => now.getTime() - r.t.getTime() > SYNC_GRACE_MS);
  const syncOk = syncEligible.filter((r) => r.abdId && r.synced);
  const syncFailed = syncEligible.filter((r) => !(r.abdId && r.synced));
  // Status/event match coverage among synced forms.
  const statusMatched = syncOk.filter((r) => abdStates.has(r.abdId));

  /* Needs-attention rules (§11) — each: issue, count, why, owner. */
  const formsNoEstimate = forms.filter((r) => r.price === null);
  // Calls excluded: CALL- docs never flow through createLead, so they have
  // no ProABD link to confirm ownership against (CallRail→ProABD mapping TBD).
  const unassigned = cohort.filter(
    (r) => !r.isCall && !r.proabdUser && !(r.abdId && abdStates.get(r.abdId)?.lastUser),
  );
  const postFixAttrMissing = paidPost.filter((r) => r.campaignName === null);
  const attention: { issue: string; count: number; why: string; owner: string }[] = [
    {
      issue: "Valid form leads without an estimate",
      count: formsNoEstimate.length,
      why: "Customer saw no price — pricing API failure or unusual route; agent must quote manually.",
      owner: "Agents / Eddie (pricing API)",
    },
    {
      issue: "Records without a confirmed ProABD assignee",
      count: unassigned.length,
      why: "Nobody confirmed as owner in the assignment of record; risk of an uncontacted lead.",
      owner: "Ben / agents (assign in ProABD)",
    },
    {
      issue: "Post-fix paid leads missing campaign attribution",
      count: postFixAttrMissing.length,
      why: "Paid click proven but campaign unmapped after the Jul 20 fix — should trend to zero; investigate if it grows.",
      owner: "Eddie (tracking)",
    },
    {
      issue: "Eligible forms that failed ProABD sync",
      count: syncFailed.length,
      why: "Lead never reached the CRM — no agent will see it there; needs manual entry.",
      owner: "Eddie (alert email fires) / agents",
    },
    {
      issue: "Blocked international/invalid submissions",
      count: cohortBlocked.length,
      why: "Unserviceable demand, now rejected at the form. Volume here is a possible referral-partner opportunity.",
      owner: "Ben (partnership decision)",
    },
  ];

  const updatedAt = now.toLocaleString("en-US", {
    timeZone: PT,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  /* ── View renderers ── */

  function Overview() {
    return (
      <>
        <div style={{ ...SUBTLE, marginBottom: 12 }}>
          <strong style={{ color: "#1a1a1a" }}>{cohortLabel}</strong> — website forms and tracked
          calls created since the ProABD integration went live; test and blocked-invalid
          submissions excluded (blocked demand reported separately below).
        </div>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={CARD}>
            <div style={SUBTLE}>Valid leads</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: INK, margin: "2px 0" }}>{cohort.length}</div>
            <div style={SUBTLE}>
              {forms.length} forms · {calls.length} tracked calls
            </div>
          </div>
          <div style={CARD}>
            <div style={SUBTLE}>Form pricing coverage</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: INK, margin: "2px 0" }}>
              {pricedForms.length} of {forms.length}
            </div>
            <div style={SUBTLE}>valid forms with an instant estimate · calls excluded by design</div>
          </div>
          <div style={CARD}>
            <div style={SUBTLE}>Quoted value</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: INK, margin: "2px 0" }}>{money(quotedValue)}</div>
            <div style={SUBTLE}>
              across {pricedForms.length} priced form leads · <strong>not revenue or profit</strong>
            </div>
          </div>
        </section>

        <section style={{ ...CARD, marginBottom: 12 }}>
          <h2 style={H2}>Verified data coverage</h2>
          <div style={{ ...SUBTLE, marginBottom: 8 }}>
            Independent indicators — each has its own denominator. This is coverage, not a
            customer conversion funnel.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <tbody>
              <tr style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                <td style={TD}>Form estimate captured</td>
                <td style={TDR}>
                  <strong>{pricedForms.length}/{forms.length}</strong> ({pct(pricedForms.length, forms.length)})
                </td>
                <td style={{ ...TD, color: MUTED }}>of valid forms</td>
              </tr>
              <tr style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                <td style={TD}>ProABD sync</td>
                <td style={TDR}>
                  <strong>{syncOk.length}/{syncEligible.length}</strong> ({pct(syncOk.length, syncEligible.length)})
                </td>
                <td style={{ ...TD, color: MUTED }}>of eligible forms (15-min grace)</td>
              </tr>
              <tr style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                <td style={TD}>ProABD status/event match</td>
                <td style={TDR}>
                  <strong>{statusMatched.length}/{syncOk.length}</strong> ({pct(statusMatched.length, syncOk.length)})
                </td>
                <td style={{ ...TD, color: MUTED }}>of synced forms with webhook events (since {WEBHOOK_START_LABEL})</td>
              </tr>
              <tr style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                <td style={TD}>Campaign attribution — post-fix paid</td>
                <td style={TDR}>
                  <strong>{paidPostMapped.length}/{paidPost.length}</strong> ({pct(paidPostMapped.length, paidPost.length)})
                </td>
                <td style={{ ...TD, color: MUTED }}>paid leads after the Jul 20 fix ({TRACKING_FIX_TS.toLocaleString("en-US", { timeZone: PT, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} PT)</td>
              </tr>
              <tr style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                <td style={TD}>Campaign attribution — pre-fix / backfilled paid</td>
                <td style={TDR}>
                  <strong>{paidPreMapped.length}/{paidPre.length}</strong> ({pct(paidPreMapped.length, paidPre.length)})
                </td>
                <td style={{ ...TD, color: MUTED }}>historical; paid proven by click ID, campaign mostly unrecoverable</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section style={CARD}>
          <h2 style={H2}>Needs attention</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={TH}>Issue</th>
                <th style={{ ...TH, textAlign: "right" }}>Count</th>
                <th style={TH}>Why it matters</th>
                <th style={TH}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {attention.map((a) => (
                <tr key={a.issue} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={TD}>{a.issue}</td>
                  <td style={{ ...TDR, fontWeight: 800, color: a.count > 0 ? "#92400e" : INK }}>{a.count}</td>
                  <td style={{ ...TD, color: MUTED }}>{a.why}</td>
                  <td style={{ ...TD, whiteSpace: "nowrap" }}>{a.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </>
    );
  }

  function Acquisition() {
    const chan = CHANNEL_ORDER.map((k) => {
      const rows = cohort.filter((r) => r.sourceKey === k);
      const f = rows.filter((r) => !r.isCall);
      const c = rows.filter((r) => r.isCall);
      const p = f.filter((r) => r.price !== null);
      const fSync = f.filter((r) => r.abdId && r.synced);
      return { k, rows, f, c, p, quoted: p.reduce((s, r) => s + (r.price ?? 0), 0), fSync };
    }).filter((c) => c.rows.length > 0);

    const campMap = new Map<string, { post: number; pre: number }>();
    for (const r of cohort.filter((x) => x.paidProof)) {
      const name = r.campaignName ?? (r.postFix ? "Unattributed (post-fix — investigate)" : "Historical — campaign unrecoverable");
      const e = campMap.get(name) ?? { post: 0, pre: 0 };
      if (r.postFix) e.post++;
      else e.pre++;
      campMap.set(name, e);
    }
    const adGroups = new Map<string, number>();
    for (const r of paidPost) {
      if (r.adGroupId) adGroups.set(r.adGroupId, (adGroups.get(r.adGroupId) ?? 0) + 1);
    }

    return (
      <>
        <div style={{ ...SUBTLE, marginBottom: 12 }}>
          <strong style={{ color: "#1a1a1a" }}>{cohortLabel}</strong> — same eligible cohort as
          Overview. Spend, CPL, CAC, close rate, and profit appear only when their sources are
          connected (see data coverage panel).
        </div>
        <section style={{ ...CARD, marginBottom: 12, overflowX: "auto" }}>
          <h2 style={H2}>Channels</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
            <thead>
              <tr>
                <th style={TH}>Channel</th>
                <th style={{ ...TH, textAlign: "right" }}>Valid leads</th>
                <th style={{ ...TH, textAlign: "right" }}>Forms</th>
                <th style={{ ...TH, textAlign: "right" }}>Calls</th>
                <th style={{ ...TH, textAlign: "right" }}>Priced forms</th>
                <th style={{ ...TH, textAlign: "right" }}>Pricing coverage</th>
                <th style={{ ...TH, textAlign: "right" }}>Quoted value</th>
                <th style={{ ...TH, textAlign: "right" }}>ProABD sync</th>
              </tr>
            </thead>
            <tbody>
              {chan.map((c) => (
                <tr key={c.k} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>{CHANNEL_LABELS[c.k]}</td>
                  <td style={{ ...TDR, fontWeight: 800, color: INK }}>{c.rows.length}</td>
                  <td style={TDR}>{c.f.length}</td>
                  <td style={TDR}>{c.c.length}</td>
                  <td style={TDR}>{c.p.length}</td>
                  <td style={TDR}>{pct(c.p.length, c.f.length)}</td>
                  <td style={TDR}>{c.quoted > 0 ? money(c.quoted) : "—"}</td>
                  <td style={TDR}>{c.f.length > 0 ? pct(c.fSync.length, c.f.length) : "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...SUBTLE, marginTop: 8 }}>
            Quoted value is the sum of instant estimates on priced forms — not revenue. Calls
            carry no form estimate by design.
          </div>
        </section>

        <section style={{ ...CARD, marginBottom: 12 }}>
          <h2 style={H2}>Google Ads drill-down</h2>
          <div style={{ ...SUBTLE, marginBottom: 8 }}>
            Post-fix leads carry exact campaign attribution; historical paid leads are proven by
            click ID but their campaign is generally unrecoverable.
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={TH}>Campaign</th>
                <th style={{ ...TH, textAlign: "right" }}>Post-fix leads</th>
                <th style={{ ...TH, textAlign: "right" }}>Historical leads</th>
              </tr>
            </thead>
            <tbody>
              {[...campMap.entries()]
                .sort((a, b) => b[1].post + b[1].pre - (a[1].post + a[1].pre))
                .map(([name, e]) => (
                  <tr key={name} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                    <td style={TD}>{name}</td>
                    <td style={{ ...TDR, fontWeight: 700 }}>{e.post || "—"}</td>
                    <td style={{ ...TDR, color: MUTED }}>{e.pre || "—"}</td>
                  </tr>
                ))}
              {campMap.size === 0 && (
                <tr>
                  <td colSpan={3} style={{ ...TD, color: MUTED }}>
                    No paid leads in cohort yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {adGroups.size > 0 && (
            <div style={{ ...SUBTLE, marginTop: 8 }}>
              Ad-group IDs observed on post-fix leads:{" "}
              {[...adGroups.entries()].map(([id, n]) => `${id} (${n})`).join(" · ")} — name mapping
              pending.
            </div>
          )}
        </section>

        <AdsSpendCard />

        <PagesCard />
      </>
    );
  }

  function AdsSpendCard() {
    if (ads.state === "unconfigured") {
      return (
        <section style={{ ...CARD, marginBottom: 12 }}>
          <h2 style={H2}>Google Ads spend &amp; conversions</h2>
          <div style={SUBTLE}>
            Awaiting API credentials ({ads.missing.join(", ")}). Developer token is approved
            (Basic Access) — see scripts/mint-ads-refresh-token.mjs for the one-time setup.
          </div>
        </section>
      );
    }
    if (ads.state === "error") {
      return (
        <section style={{ ...CARD, marginBottom: 12 }}>
          <h2 style={H2}>Google Ads spend &amp; conversions</h2>
          <div style={{ ...SUBTLE, color: "#b45309" }}>API call failed: {ads.message}</div>
        </section>
      );
    }
    const { stats } = ads;
    // CPL join: post-fix web form leads carry the campaign ID (utmCampaign).
    const leadsByCampaign = new Map<string, number>();
    for (const r of paidPost) {
      const cid =
        r.campaignId ??
        // fall back through the mapped name in case the row only has a name
        null;
      if (cid) leadsByCampaign.set(cid, (leadsByCampaign.get(cid) ?? 0) + 1);
    }
    const totalCost = stats.campaigns.reduce((s, c) => s + c.costDollars, 0);
    const totalLeads = paidPost.length;

    return (
      <section style={{ ...CARD, marginBottom: 12, overflowX: "auto" }}>
        <h2 style={H2}>Google Ads spend &amp; conversions</h2>
        <div style={{ ...SUBTLE, marginBottom: 8 }}>
          Live from the Ads API ({stats.since} → {stats.until}, account timezone). “Web leads”
          are post-fix form leads in our own database joined by campaign ID — the honest CPL.
          Ads-reported conversions include calls and are attributed by Google&rsquo;s rules;
          expect the two columns to differ.
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
          <thead>
            <tr>
              <th style={TH}>Campaign</th>
              <th style={{ ...TH, textAlign: "right" }}>Spend</th>
              <th style={{ ...TH, textAlign: "right" }}>Clicks</th>
              <th style={{ ...TH, textAlign: "right" }}>Avg CPC</th>
              <th style={{ ...TH, textAlign: "right" }}>Ads conv.</th>
              <th style={{ ...TH, textAlign: "right" }}>Cost / conv.</th>
              <th style={{ ...TH, textAlign: "right" }}>Web leads</th>
              <th style={{ ...TH, textAlign: "right" }}>CPL (web)</th>
            </tr>
          </thead>
          <tbody>
            {stats.campaigns.map((c) => {
              const webLeads = leadsByCampaign.get(c.id) ?? 0;
              return (
                <tr key={c.id} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={{ ...TD, fontWeight: 600 }}>{c.name}</td>
                  <td style={{ ...TDR, fontWeight: 700 }}>{money(c.costDollars)}</td>
                  <td style={TDR}>{c.clicks}</td>
                  <td style={TDR}>{c.clicks > 0 ? money2(c.costDollars / c.clicks) : "—"}</td>
                  <td style={TDR}>{c.conversions > 0 ? c.conversions.toFixed(1) : "—"}</td>
                  <td style={TDR}>{c.conversions > 0 ? money2(c.costDollars / c.conversions) : "—"}</td>
                  <td style={{ ...TDR, fontWeight: 700, color: INK }}>{webLeads || "—"}</td>
                  <td style={TDR}>{webLeads > 0 ? money2(c.costDollars / webLeads) : "—"}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: "2px solid var(--color-gray-200)" }}>
              <td style={{ ...TD, fontWeight: 800 }}>Total</td>
              <td style={{ ...TDR, fontWeight: 800 }}>{money(totalCost)}</td>
              <td style={TDR}>{stats.campaigns.reduce((s, c) => s + c.clicks, 0)}</td>
              <td style={TDR}>—</td>
              <td style={TDR}>{stats.campaigns.reduce((s, c) => s + c.conversions, 0).toFixed(1)}</td>
              <td style={TDR}>—</td>
              <td style={{ ...TDR, fontWeight: 800, color: INK }}>{totalLeads || "—"}</td>
              <td style={{ ...TDR, fontWeight: 700 }}>
                {totalLeads > 0 ? money2(totalCost / totalLeads) : "—"}
              </td>
            </tr>
          </tbody>
        </table>
        {stats.conversionActions.length > 0 && (
          <>
            <h2 style={{ ...H2, marginTop: 16 }}>Conversion actions observed</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, maxWidth: 480 }}>
              <thead>
                <tr>
                  <th style={TH}>Action</th>
                  <th style={{ ...TH, textAlign: "right" }}>All conversions</th>
                </tr>
              </thead>
              <tbody>
                {stats.conversionActions.map((a) => (
                  <tr key={a.actionName} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                    <td style={TD}>{a.actionName}</td>
                    <td style={TDR}>{a.allConversions.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ ...SUBTLE, marginTop: 8 }}>
              “All conversions” includes secondary (observation-only) actions — this table shows
              everything being tracked, not what bidding optimizes toward.
            </div>
          </>
        )}
      </section>
    );
  }

  function PagesCard() {
    // Page attribution capture began Jul 22 — earlier leads have no path.
    const formsWithPage = forms.filter((r) => r.submitPath !== null);
    const uncaptured = forms.length - formsWithPage.length;
    const pageAgg = new Map<
      string,
      { n: number; quoted: number; es: number; landedHere: number }
    >();
    for (const r of formsWithPage) {
      const key = r.submitPath as string;
      const a = pageAgg.get(key) ?? { n: 0, quoted: 0, es: 0, landedHere: 0 };
      a.n++;
      if (r.price !== null) a.quoted += r.price;
      if (r.locale === "es") a.es++;
      if (r.landingPath === r.submitPath) a.landedHere++;
      pageAgg.set(key, a);
    }
    const pageList = [...pageAgg.entries()].sort((a, b) => b[1].n - a[1].n);

    return (
      <section style={{ ...CARD, marginBottom: 12, overflowX: "auto" }}>
        <h2 style={H2}>Lead-producing pages</h2>
        <div style={{ ...SUBTLE, marginBottom: 8 }}>
          Which page carried the form at submit, and whether the visit also started there
          (first-touch, 30-day cookie). Capture began Jul 22 — this table fills as new leads
          arrive.
          {uncaptured > 0 && ` ${uncaptured} earlier cohort form${uncaptured === 1 ? "" : "s"} predate capture.`}
        </div>
        {pageList.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 520 }}>
            <thead>
              <tr>
                <th style={TH}>Page</th>
                <th style={{ ...TH, textAlign: "right" }}>Form leads</th>
                <th style={{ ...TH, textAlign: "right" }}>Spanish</th>
                <th style={{ ...TH, textAlign: "right" }}>Also the landing page</th>
                <th style={{ ...TH, textAlign: "right" }}>Quoted value</th>
              </tr>
            </thead>
            <tbody>
              {pageList.map(([path, a]) => (
                <tr key={path} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={{ ...TD, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{path}</td>
                  <td style={{ ...TDR, fontWeight: 800, color: INK }}>{a.n}</td>
                  <td style={TDR}>{a.es || "—"}</td>
                  <td style={TDR}>{a.landedHere || "—"}</td>
                  <td style={TDR}>{a.quoted > 0 ? money(a.quoted) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ ...SUBTLE }}>
            No leads with page attribution yet — the first post-deploy lead starts this table.
          </div>
        )}
      </section>
    );
  }

  function Sales() {
    // 30-day observed ownership activity (valid, non-blocked records).
    const rows30 = all.filter((r) => !r.blocked);
    const unowned: LeadRow[] = [];
    const owners = new Map<
      string,
      {
        n: number;
        quoted: number;
        matched: number;
        withAbd: number;
        reassignedIn: number;
        booked: number;
        lost: number;
        active: number;
      }
    >();
    // Whole-cohort outcome tallies (canonical status map, live 2026-07-22).
    const outcomes = { booked: 0, canceled: 0, lost: 0, active: 0 };
    for (const r of rows30) {
      const st = r.abdId ? abdStates.get(r.abdId) : undefined;
      if (st) outcomes[st.outcome]++;
      const owner = st?.lastUser ?? r.proabdUser;
      if (!owner) {
        unowned.push(r);
        continue;
      }
      const o = owners.get(owner) ?? {
        n: 0,
        quoted: 0,
        matched: 0,
        withAbd: 0,
        reassignedIn: 0,
        booked: 0,
        lost: 0,
        active: 0,
      };
      o.n++;
      if (r.price !== null) o.quoted += r.price;
      if (r.abdId) {
        o.withAbd++;
        if (st) {
          o.matched++;
          if (st.outcome === "booked") o.booked++;
          else if (st.outcome === "lost" || st.outcome === "canceled") o.lost++;
          else o.active++;
        }
        if (st?.firstUser && st.lastUser && st.firstUser !== st.lastUser) o.reassignedIn++;
      }
      owners.set(owner, o);
    }
    const list = [...owners.entries()].sort((a, b) => b[1].n - a[1].n);
    const decided = outcomes.booked + outcomes.lost + outcomes.canceled;

    // Actionable vs structural: records created before the ProABD
    // integration (createLead automation, Jul 14) have no linked ProABD
    // record and can never show an owner from this data — that's a
    // historical-import gap, not an assignment failure. Only
    // integration-era records belong in the alert.
    const unownedActionable = unowned.filter((r) => r.t >= PROABD_START && !r.isCall);
    const unownedLegacy = unowned.length - unownedActionable.length;

    return (
      <>
        <div style={{ ...SUBTLE, marginBottom: 12 }}>
          <strong style={{ color: "#1a1a1a" }}>Last 30 days of observed ownership activity</strong>{" "}
          — ownership and volume, not an agent performance ranking. Response time, contact rate,
          and close rate appear only when their underlying events are captured.
        </div>
        {unownedActionable.length > 0 && (
          <div style={ALERT}>
            <strong>
              {unownedActionable.length} record{unownedActionable.length === 1 ? "" : "s"} without a
              confirmed owner
            </strong>{" "}
            — created since the ProABD integration (Jul 14) but no assignee stamped or observed.
            These need assignment in ProABD. New leads legitimately sit here for a few minutes
            until ProABD&rsquo;s routing runs and the next event batch arrives.
          </div>
        )}
        {unownedLegacy > 0 && (
          <div style={{ ...SUBTLE, marginBottom: 12 }}>
            {unownedLegacy} older record{unownedLegacy === 1 ? "" : "s"} in the 30-day window
            predate the ProABD integration (Jul 14) and carry no linked ProABD record — ownership
            is unknowable from here. The historical ProABD export (Ben) resolves these; they are
            excluded from the alert above.
          </div>
        )}
        <section style={{ ...CARD, marginBottom: 12 }}>
          <h2 style={H2}>Outcomes (canonical ProABD statuses — live since Jul 22)</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: INK }}>{outcomes.booked}</div>
              <div style={SUBTLE}>Booked (reached Order)</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{outcomes.active}</div>
              <div style={SUBTLE}>In pipeline</div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{outcomes.lost + outcomes.canceled}</div>
              <div style={SUBTLE}>
                Lost{outcomes.canceled > 0 ? ` (incl. ${outcomes.canceled} canceled)` : ""}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {decided > 0 ? pct(outcomes.booked, decided) : "—"}
              </div>
              <div style={SUBTLE}>Close rate (of decided)</div>
            </div>
          </div>
          <div style={{ ...SUBTLE, marginTop: 10 }}>
            Booked = record reached Order stage (or carries Booked_Date). Lost = terminal
            statuses: Bad/Closed Lead, Not Interested, Invalid, Archive, Do Not Contact.
            Everything else is working pipeline — not a verdict. Small cohort: read
            direction, not decimals.
          </div>
        </section>
        <section style={{ ...CARD, overflowX: "auto" }}>
          <h2 style={H2}>Ownership &amp; workload</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
            <thead>
              <tr>
                <th style={TH}>Current owner</th>
                <th style={{ ...TH, textAlign: "right" }}>Records owned</th>
                <th style={{ ...TH, textAlign: "right" }}>Quoted value owned</th>
                <th style={{ ...TH, textAlign: "right" }}>Booked</th>
                <th style={{ ...TH, textAlign: "right" }}>In pipeline</th>
                <th style={{ ...TH, textAlign: "right" }}>Lost</th>
                <th style={{ ...TH, textAlign: "right" }}>Reassigned in</th>
              </tr>
            </thead>
            <tbody>
              {list.map(([name, o]) => (
                <tr key={name} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>{name}</td>
                  <td style={{ ...TDR, fontWeight: 800, color: INK }}>{o.n}</td>
                  <td style={TDR}>{o.quoted > 0 ? money(o.quoted) : "—"}</td>
                  <td style={{ ...TDR, fontWeight: 700 }}>{o.booked || "—"}</td>
                  <td style={TDR}>{o.active || "—"}</td>
                  <td style={TDR}>{o.lost || "—"}</td>
                  <td style={TDR}>{o.reassignedIn || "—"}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...TD, color: MUTED }}>
                    No owned records observed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ ...SUBTLE, marginTop: 8 }}>
            Owner = latest ProABD assignee observed via the event feed (history begins{" "}
            {WEBHOOK_START_LABEL}). “Reassigned in” counts records whose first observed assignee
            differs from the current owner; imported/older records may only reveal their current
            owner.
          </div>
        </section>
      </>
    );
  }

  function Lanes() {
    const laneAgg = new Map<string, { n: number; priced: number; sum: number }>();
    for (const r of all) {
      if (r.isCall || r.blocked) continue;
      const lane = r.originState + " → " + r.destState;
      const a = laneAgg.get(lane) ?? { n: 0, priced: 0, sum: 0 };
      a.n++;
      if (r.price !== null) {
        a.priced++;
        a.sum += r.price;
      }
      laneAgg.set(lane, a);
    }
    const lanes = [...laneAgg.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 12);
    const evidence = (n: number) => (n >= 10 ? "Emerging pattern" : n >= 3 ? "Small sample" : "Very small sample");

    return (
      <>
        <div style={{ ...SUBTLE, marginBottom: 12 }}>
          <strong style={{ color: "#1a1a1a" }}>Emerging lane activity · last 30 days of leads</strong>{" "}
          — descriptive demand only; no scaling decisions yet. Carrier pay, booking, dispatch
          time, cancellation, and margin are not yet included; average quote is customer-facing
          price, not economics.
        </div>
        <section style={{ ...CARD, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 520 }}>
            <thead>
              <tr>
                <th style={TH}>Directional lane</th>
                <th style={{ ...TH, textAlign: "right" }}>Leads</th>
                <th style={{ ...TH, textAlign: "right" }}>Priced forms</th>
                <th style={{ ...TH, textAlign: "right" }}>Avg quote</th>
                <th style={TH}>Evidence</th>
                <th style={TH}>Current use</th>
              </tr>
            </thead>
            <tbody>
              {lanes.map(([lane, a]) => (
                <tr key={lane} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>{lane}</td>
                  <td style={{ ...TDR, fontWeight: 800, color: INK }}>{a.n}</td>
                  <td style={TDR}>{a.priced}</td>
                  <td style={TDR}>{a.priced ? money(a.sum / a.priced) : "—"}</td>
                  <td style={{ ...TD, color: a.n >= 10 ? INK : MUTED }}>{evidence(a.n)} (n={a.n})</td>
                  <td style={{ ...TD, color: MUTED }}>Monitor demand</td>
                </tr>
              ))}
              {lanes.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...TD, color: MUTED }}>
                    No routed leads yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </>
    );
  }

  function Opportunities() {
    const opps: { name: string; count: number; rule: string; owner: string; decision: string }[] = [
      {
        name: "Valid forms lacking estimates",
        count: formsNoEstimate.length,
        rule: "Valid form in cohort with missing/non-numeric estimate.price (calls excluded).",
        owner: "Agents",
        decision: "Quote manually today; Eddie reviews pricing-API failures if recurring.",
      },
      {
        name: "Records without a confirmed owner",
        count: unassigned.length,
        rule: "No ProABD assignee stamped or observed in event feed.",
        owner: "Ben / agents",
        decision: "Assign in ProABD now.",
      },
      {
        name: "Eligible forms failing ProABD sync",
        count: syncFailed.length,
        rule: `Form ≥15 min old since ${fmtDay(PROABD_START)} missing proabdAbdId or proabdSyncedAt.`,
        owner: "Eddie",
        decision: "Enter manually in ProABD; investigate createLead failure.",
      },
      {
        name: "Post-fix attribution gaps",
        count: postFixAttrMissing.length,
        rule: "Paid proof (UTM/GCLID) after the Jul 20 fix but no mapped campaign.",
        owner: "Eddie",
        decision: "Investigate tracking if count grows; expect ~0.",
      },
      {
        name: "Blocked international demand",
        count: cohortBlocked.length,
        rule: "Submissions rejected/flagged as non-domestic or invalid route in cohort window.",
        owner: "Ben",
        decision: "Consider a referral partner for international requests (possible referral revenue).",
      },
    ];
    return (
      <>
        <div style={{ ...SUBTLE, marginBottom: 12 }}>
          Observed problems converted into assigned decisions. Every rule states its definition;
          evaluation window is the {cohortLabel.toLowerCase()} unless the rule says otherwise.
          Activity-based rules (uncontacted leads, follow-ups, aging quotes) arrive when contact
          events exist.
        </div>
        <section style={{ ...CARD, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
            <thead>
              <tr>
                <th style={TH}>Opportunity</th>
                <th style={{ ...TH, textAlign: "right" }}>Count</th>
                <th style={TH}>Qualifying rule</th>
                <th style={TH}>Owner</th>
                <th style={TH}>Next decision</th>
              </tr>
            </thead>
            <tbody>
              {opps.map((o) => (
                <tr key={o.name} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>{o.name}</td>
                  <td style={{ ...TDR, fontWeight: 800, color: o.count > 0 ? "#92400e" : INK }}>{o.count}</td>
                  <td style={{ ...TD, color: MUTED }}>{o.rule}</td>
                  <td style={TD}>{o.owner}</td>
                  <td style={{ ...TD, color: MUTED }}>{o.decision}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </>
    );
  }

  const readiness: { group: string; unlocks: string; state: string; dependency: string }[] = [
    { group: "Post-fix campaign attribution", unlocks: "Exact campaign/ad-group reporting", state: "Observed (since Jul 20 fix)", dependency: "—" },
    { group: "Canonical ProABD status map", unlocks: "Authoritative booked/lost + close rates", state: "LIVE (Brian, Jul 22)", dependency: "—" },
    { group: "Transport & Shipper financial fields", unlocks: "Customer price, carrier pay, gross profit", state: "Unavailable (unmapped)", dependency: "Sample dump + mapping" },
    { group: "CallRail detail shape", unlocks: "Call duration/answered quality metrics", state: "Unavailable (unmapped)", dependency: "Sample dump" },
    { group: "Historical ProABD import", unlocks: "Seasonality, mature lane/agent baselines", state: "Unavailable", dependency: "Ben (export)" },
    {
      group: "Google Ads cost join",
      unlocks: "CPL, CAC, GP-ROAS",
      state:
        ads.state === "ok"
          ? `Live (${ads.stats.since} → ${ads.stats.until})`
          : ads.state === "unconfigured"
            ? `Awaiting credentials: ${ads.missing.join(", ")}`
            : `Error: ${ads.message}`,
      dependency: ads.state === "ok" ? "—" : "Eddie (OAuth env vars)",
    },
    { group: "First-contact / follow-up events", unlocks: "Response time, contact rate, follow-up compliance", state: "Unavailable", dependency: "Brian (Export API scope)" },
    { group: "Webhook authentication", unlocks: "Verified event provenance", state: "ENFORCED (Jul 22) — unauthenticated posts rejected", dependency: "—" },
  ];

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 64px" }}>
      <header style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: GREEN }}>
          Auto Line Logistics
        </div>
        <h1 style={{ margin: "4px 0 2px", fontSize: 24, letterSpacing: "-0.02em", color: INK }}>
          Lead &amp; Booking Performance
        </h1>
        <div style={SUBTLE}>
          Updated {updatedAt} PT ·{" "}
          <span
            style={{
              border: "1px solid var(--color-gray-200)",
              borderRadius: 999,
              padding: "1px 8px",
              fontSize: 11,
            }}
          >
            Current observed data
          </span>
        </div>
      </header>

      <nav style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {VIEWS.map((v) => (
          <a
            key={v.id}
            href={v.id === "overview" ? "/admin" : `/admin?view=${v.id}`}
            style={{
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: 999,
              color: view === v.id ? "#fff" : INK,
              background: view === v.id ? GREEN : "var(--color-gray-100)",
            }}
            aria-current={view === v.id ? "page" : undefined}
          >
            {v.label}
          </a>
        ))}
      </nav>

      {loadError ? (
        <div style={{ ...CARD, borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>
          Could not load lead data: {loadError}
        </div>
      ) : (
        <>
          {view === "overview" && <Overview />}
          {view === "acquisition" && <Acquisition />}
          {view === "sales" && <Sales />}
          {view === "lanes" && <Lanes />}
          {view === "opportunities" && <Opportunities />}

          <details style={{ ...CARD, marginTop: 16 }}>
            <summary style={{ fontSize: 13, fontWeight: 700, color: INK, cursor: "pointer" }}>
              Data coverage &amp; metric readiness
            </summary>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 10, minWidth: 560 }}>
                <thead>
                  <tr>
                    <th style={TH}>Integration / field group</th>
                    <th style={TH}>Unlocks</th>
                    <th style={TH}>State</th>
                    <th style={TH}>Dependency</th>
                  </tr>
                </thead>
                <tbody>
                  {readiness.map((r) => (
                    <tr key={r.group} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                      <td style={{ ...TD, fontWeight: 600 }}>{r.group}</td>
                      <td style={{ ...TD, color: MUTED }}>{r.unlocks}</td>
                      <td style={TD}>{r.state}</td>
                      <td style={{ ...TD, color: MUTED }}>{r.dependency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ ...SUBTLE, marginTop: 10 }}>
                Paid attribution exact from the Jul 20 tracking fix; earlier paid leads identified
                by click ID. Booking outcomes remain heuristic until the canonical status map is
                confirmed. Financial values (revenue, carrier pay, gross profit) are not displayed
                anywhere until mapped and approved.
              </div>
            </div>
          </details>
        </>
      )}
    </main>
  );
}
