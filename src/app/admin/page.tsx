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
import { roadMilesBetweenZips } from "@/lib/geo/zip3";
import { dedupeLeads, normalizePhoneKey, normalizeEmailKey } from "@/lib/leads/identity";
import { LeadPulse } from "@/components/admin/LeadPulse";
import {
  ACCOUNT_PHASE,
  PHASES,
  GATE_ACTIONS_30D,
  CPL_CEILING,
  PHASE2_PILOT_NOTE,
  PHASE_NARRATIVE,
} from "@/lib/admin/targets";
import {
  tabRows,
  snowbirdOrderCount,
  type BizOrder,
  type BusinessTab,
} from "@/lib/admin/business";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ── Eligibility constants (§7) ──────────────────────────────── */

/** ProABD createLead integration went live (cohort start). */
const PROABD_START = new Date("2026-07-14T07:00:00Z"); // Jul 14 00:00 PT
/** Exact UTM tracking-fix deploy (commit e3e92ae verified live ~3:00 PM PT). */
const TRACKING_FIX_TS = new Date("2026-07-20T22:00:00Z");
/** First-party behavior capture went live (site_events). */
const BEHAVIOR_START = new Date("2026-07-22T19:00:00Z");
/** Route-price-checker success logging fixed (before this, only failures logged). */
const RPC_LOG_START = new Date("2026-07-28T00:00:00Z"); // Jul 27 ~5 PM PT
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

/**
 * Campaign metadata — single source of truth for what each campaign IS,
 * in words a human who doesn't live in the Ads account can read
 * (2026-07-28: "we do not know what S1 or S3 are"). Roles are HYPOTHESES
 * until booking data validates them; a campaign is judged against its own
 * role's success metric, never one shared CPL yardstick. Budgets are
 * deliberately NOT stored here — they drift, and a stale number on a
 * dashboard is worse than a click into Ads.
 */
interface CampaignMeta {
  role: string;
  metric: string;
  /** One plain-English sentence: who this campaign catches. */
  plain: string;
  /** Two-three example searches, verbatim style. */
  examples: string;
  /** Where the ads land. */
  lands: string;
}
/**
 * Dated decisions of record. Unlike budgets, a decision with a date is a
 * FACT, not a number that drifts — so these belong on the dashboard.
 * Drives verdict flags below + suppresses now-obsolete "wait for data"
 * recommendations for campaigns whose question has been answered.
 *
 * 2026-08-10 (evening PT): S1 PAUSED. The research-feeder hypothesis was MEASURED, not
 * abandoned: retroactive session join (scripts/s1-assist.mjs) found 0 of 42
 * joinable leads with a cross-campaign prior touch, 88% of leads convert in
 * their FIRST session, and S1 came to $574.85 per influenced lead with every
 * measurable assist counted. Re-enable only if accruing first-touch data
 * (capture live since 8/10) shows journey-starting value after 2–3 weeks.
 */
const CAMPAIGN_VERDICTS: Record<string, { date: string; verdict: string; detail: string }> = {
  "24034601745": {
    date: "2026-08-10",
    verdict: "Paused 8/10 — assist value measured ≈ 0",
    detail:
      "Session join: 0 cross-campaign assists in 42 joinable leads; 88% same-session market; $574.85/influenced lead. Judged on primary CPL and paused. Re-enable only if first-touch data (live 8/10) shows divergence.",
  },
};

const CAMPAIGN_META: Record<string, CampaignMeta> = {
  "24034601745": {
    role: "research feeder (paused 8/10)",
    metric: "was: signal→lead rate — measured 8/10: assists ≈ 0",
    plain: "People googling what shipping a car costs. Hypothesis tested and closed: researchers here don't come back and convert elsewhere — 88% of all leads convert in their first session.",
    examples: "“car shipping cost” · “car shipping calculator” · “car shipping quotes”",
    lands: "price checker + quote page",
  },
  "24034601748": {
    role: "local presence",
    metric: "present at sane CPC",
    plain: "Los Angeles-area “near me” searches. Local intent, home turf.",
    examples: "“car shipping near me” · “auto transport los angeles”",
    lands: "home page",
  },
  "24034601751": {
    role: "route intent",
    metric: "$ / primary action · rank recovery",
    plain: "People who already know their route — the closest thing search has to a hand raised.",
    examples: "“ship car from california to texas” · “car transport to florida”",
    lands: "matching corridor pages",
  },
  "24034601754": {
    role: "niche direct response",
    metric: "$ / primary action",
    plain: "Specialty needs: enclosed/classic, door-to-door, military moves (more unpause Aug 1).",
    examples: "“enclosed car transport” · “military car shipping”",
    lands: "matching service pages",
  },
  "24034601757": {
    role: "moat",
    metric: "overall impr. share ≥ 90%",
    plain: "People searching our name. Cheap clicks that keep competitors off it.",
    examples: "“auto line logistics”",
    lands: "home page",
  },
  "24034984545": {
    role: "direct response · ES",
    metric: "$ / primary action → $ / booking",
    plain: "Spanish-language searches, Spanish ads, Spanish site — an audience most competitors ignore.",
    examples: "“transportar carro a otro estado” · “envío de autos”",
    lands: "Spanish quote page",
  },
};

/**
 * Layman definitions for the jargon on this page — drives BOTH the hover
 * tooltips (CSS-only, .tip class in the style block) and the glossary in
 * the methodology drawer, so the two can never drift apart. Definitions
 * are deliberately opinionated: a neutral definition doesn't help a
 * decision.
 */
const DEFS = {
  avgCpc: {
    term: "Avg CPC",
    def: "What one click costs us on average (cost ÷ clicks).",
  },
  imprShare: {
    term: "Impression share",
    def: "Of the searches where our ad was eligible to show, the % of times it actually did.",
  },
  topLostRank: {
    term: "Top lost (rank)",
    def: "Top-of-page ad slots we missed because Google ranked our ad too low (ad quality × bid). NOT a budget problem — money won't fix it; better ads and landing pages will.",
  },
  budgetLimited: {
    term: "Budget-limited",
    def: "Impressions missed because the daily budget ran out. This one IS fixable with money.",
  },
  secondaryEvents: {
    term: "Secondary events (2°)",
    def: "Things people did on the site after clicking an ad: used the price checker, engaged the quote page. Interest signals we track but don't bid on. Events, not people — one visitor can fire several.",
  },
  primaryActions: {
    term: "Primary actions (1°)",
    def: "What we count as a lead and tell Google to optimize toward: a submitted quote form, or a phone call from an ad lasting 90+ seconds.",
  },
  signalLeadRate: {
    term: "Signal→lead rate",
    def: "Of the tool-users an ad paid for, how many later became a lead. Started measuring at the Jul 28 deploy; this number decides the research feeder's budget.",
  },
  quotedValue: {
    term: "Quoted value",
    def: "Sum of the instant estimates we showed. What was quoted — never revenue.",
  },
  paidLeadRecords: {
    term: "Paid lead records",
    def: "Leads in OUR database carrying proof of an ad click (click ID or campaign tag). Not yet deduplicated across forms and calls.",
  },
  proabdJoined: {
    term: "ProABD joined",
    def: "The lead made it into the CRM and got an ID back, so we can follow what actually happens to it — assigned, quoted, booked, or lost.",
  },
  affordabilityCeiling: {
    term: "affordability ceiling",
    def: "The most we could pay per qualified lead and still break even: our median booked fee times an assumed close rate. A ceiling to stay under, not a goal to spend up to.",
  },
  learningPhase: {
    term: "learning phase",
    def: "We're deliberately optimizing for clicks to collect data. Efficiency grades start once a campaign has enough conversions for automated bidding to work (30 in 30 days).",
  },
} as const;
type DefKey = keyof typeof DEFS;

/**
 * Dotted-underline term with a CSS-only hover definition (plus native
 * title as the touch/clipped-container fallback). Style rules live in the
 * ADMIN_TIP_CSS block rendered once per page.
 */
function Term({ k, children }: { k: DefKey; children?: React.ReactNode }) {
  return (
    <span className="tip" data-tip={DEFS[k].def} title={DEFS[k].def}>
      {children ?? DEFS[k].term}
    </span>
  );
}

/** Hover card text for a campaign name. */
function campaignTip(id: string): string | undefined {
  const m = CAMPAIGN_META[id];
  if (!m) return undefined;
  return `${m.plain} Typical searches: ${m.examples}. Lands on: ${m.lands}.`;
}

const ADMIN_TIP_CSS = `
.tip{border-bottom:1px dotted #9ca3af;cursor:help;position:relative}
.tip:hover::after{content:attr(data-tip);position:absolute;left:0;bottom:calc(100% + 7px);z-index:60;
  width:250px;background:#0A1E14;color:#fff;font-size:11px;font-weight:400;letter-spacing:0;
  text-transform:none;line-height:1.55;padding:8px 11px;border-radius:8px;white-space:normal;text-align:left}
.tip:hover::before{content:"";position:absolute;left:12px;bottom:calc(100% + 2px);z-index:60;
  border:5px solid transparent;border-top-color:#0A1E14}
.navcap{transition:color .12s}
.navcap:hover{color:#0A1E14 !important}
`;

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
  visitorId: string | null; // behavior join key (capture began Jul 22 PM)
  firstTouchAt: Date | null; // first-touch cookie timestamp (Jul 22 PM)
  /** P4 identity keys (metric-contract §3) — read-time dedup, never stored. */
  phoneKey: string | null;
  emailKey: string | null;
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
    visitorId:
      typeof d.attribution?.visitorId === "string" && d.attribution.visitorId
        ? d.attribution.visitorId
        : null,
    firstTouchAt: d.attribution?.firstTouchAt?.toDate?.() ?? null,
    proabdUser:
      typeof d.proabdAssignedAgent?.userName === "string" && d.proabdAssignedAgent.userName.trim()
        ? d.proabdAssignedAgent.userName.trim()
        : null,
    phoneKey: normalizePhoneKey(d.contact?.phone),
    emailKey: normalizeEmailKey(d.contact?.email),
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

// Journey-ordered, grouped nav (2026-07-28): Overview, then Growth →
// Operations → Economics. Opportunities retired — its rules live on in the
// Overview decision queue (parity confirmed at removal).
const VIEWS = [
  { id: "overview", label: "Overview", group: "" },
  { id: "acquisition", label: "Acquisition", group: "Growth" },
  { id: "behavior", label: "Behavior", group: "Growth" },
  { id: "sales", label: "Sales workload", group: "Operations" },
  { id: "lanes", label: "Lane activity", group: "Economics" },
  { id: "business", label: "Business", group: "Economics" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

/**
 * Nav clusters (2026-07-28 v2): consecutive VIEWS sharing a group render as
 * one flex unit — a tiny uppercase caption ABOVE its pill row, pills
 * bottom-aligned across the bar. Labels-above never read as buttons (the
 * inline captions did), each cluster wraps as a unit on narrow windows, and
 * the caption itself is a link to the group's first tab.
 */
const NAV_GROUPS = VIEWS.reduce<{ group: string; views: (typeof VIEWS)[number][] }[]>(
  (acc, v) => {
    const last = acc[acc.length - 1];
    if (last && last.group === v.group && v.group !== "") last.views.push(v);
    else acc.push({ group: v.group, views: [v] });
    return acc;
  },
  [],
);

const viewHref = (id: ViewId) => (id === "overview" ? "/admin" : `/admin?view=${id}`);

const BIZ_TABS: { id: BusinessTab; label: string }[] = [
  { id: "repeats", label: "Repeats" },
  { id: "snowbirds", label: "Snowbirds" },
  { id: "b2b", label: "B2B" },
];

export default async function AdminReportPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const view: ViewId = (VIEWS.find((v) => v.id === sp.view)?.id ?? "overview") as ViewId;
  const bizTab: BusinessTab = (BIZ_TABS.find((t) => t.id === sp.tab)?.id ?? "repeats") as BusinessTab;

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  // Clock B (metric-contract §2): mature cohort = leads created 44→14 days
  // ago. The fetch extends to 44d; `all` stays the 30d slice legacy views
  // were built on so nothing else shifts meaning.
  const d44 = new Date(now.getTime() - 44 * 86_400_000);
  const d14 = new Date(now.getTime() - 14 * 86_400_000);
  const d7 = new Date(now.getTime() - 7 * 86_400_000);

  /* ── Load ── */
  let allFetched: LeadRow[] = []; // 44-day fetch (Clock B needs the tail)
  let all: LeadRow[] = []; // 30-day slice — legacy views keep their meaning
  let loadError: string | null = null;
  const abdStates = new Map<string, AbdState>();
  /** First time each record was OBSERVED at order stage — Clock-A "bookings
   *  recorded" counts these transitions inside the operating window. */
  const abdFirstOrderAt = new Map<string, Date>();
  try {
    const db = getAdminDb();
    const snap = await db
      .collection("leads")
      .where("createdAt", ">=", d44)
      .orderBy("createdAt", "desc")
      .get();
    allFetched = snap.docs
      .map((doc) => (isTest(doc.data()) ? null : toRow(doc.data())))
      .filter((r): r is LeadRow => r !== null);
    all = allFetched.filter((r) => r.t >= d30);

    // Ownership/event coverage from ProABD Export events (since Jul 8).
    try {
      const evSnap = await db
        .collection("proabd_webhook_events")
        .where("received_at", ">=", d44)
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
        if (e.isOrder) {
          st.reachedOrder = true;
          if (e.at && !abdFirstOrderAt.has(e.abd)) abdFirstOrderAt.set(e.abd, e.at);
        }
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
  // Window starts at the tracking fix, not PROABD_START: "paid attribution
  // eligible since Jul 20" is the honest cohort for every paid number shown.
  const ads: AdsResult = await fetchAdsStats(TRACKING_FIX_TS);
  // Clock-A paid totals for Overview (cache is keyed per window, so this
  // second call cannot poison the Acquisition window).
  const ads7: AdsResult = await fetchAdsStats(d7);

  // ProABD order history (Business Baseline card + Business view + lane
  // economics). Populated by scripts/import-orders.mjs (monthly re-run until
  // the webhook parser writes orders automatically). Full docs, not select():
  // the Business view needs contact + city/zip fields and the collection is
  // a few hundred docs.
  let orders: BizOrder[] = [];
  let ordersImportedAtMs = 0; // freshness for the health chip (const Date derived below)
  try {
    const oSnap = await getAdminDb().collection("orders").get();
    orders = oSnap.docs.map((doc) => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const d: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const impMs: number = d.importedAt?.toDate?.()?.getTime?.() ?? 0;
      if (impMs > ordersImportedAtMs) ordersImportedAtMs = impMs;
      return {
        orderId: String(d.orderId ?? doc.id),
        firstName: String(d.firstName ?? ""),
        lastName: String(d.lastName ?? ""),
        email: String(d.email ?? ""),
        phone: String(d.phone ?? ""),
        originCity: String(d.originCity ?? ""),
        originState: String(d.originState ?? ""),
        originZip: String(d.originZip ?? ""),
        destCity: String(d.destCity ?? ""),
        destState: String(d.destState ?? ""),
        destZip: String(d.destZip ?? ""),
        orderCreatedAt: d.orderCreatedAt?.toDate?.() ?? null,
        availableAt: d.availableAt?.toDate?.() ?? null,
        price: Number(d.price) || 0,
        deposit: Number(d.deposit) || 0,
      };
    });
  } catch {
    /* orders collection absent → card simply doesn't render */
  }
  const ordersImportedAt: Date | null = ordersImportedAtMs > 0 ? new Date(ordersImportedAtMs) : null;

  // Webhook-linked shipments — the booked-broker-fee source (metric-contract
  // §6.1, coverage measured 93.1% on 2026-07-28). Test fixtures excluded.
  interface ShipRow {
    abdId: string;
    stage: string;
    depositCents: number | null;
  }
  let ships: ShipRow[] = [];
  try {
    const shSnap = await getAdminDb()
      .collection("shipments")
      .select("proabdAbdId", "stage", "status", "proabdDepositCents", "ownerEmail")
      .get();
    ships = shSnap.docs
      .filter(
        (doc) =>
          !doc.id.startsWith("ALL-TEST") &&
          !/eddiezal28@gmail\.com/i.test(String(doc.get("ownerEmail") ?? "")),
      )
      .map((doc) => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const d: any = doc.data();
        /* eslint-enable @typescript-eslint/no-explicit-any */
        const dep = Number(d.proabdDepositCents);
        return {
          abdId: d.proabdAbdId != null ? String(d.proabdAbdId) : "",
          stage: String(d.stage ?? d.status ?? "unknown"),
          depositCents: Number.isFinite(dep) && dep > 0 ? dep : null,
        };
      });
  } catch {
    /* fee tile renders its unavailable state */
  }
  const BOOKED_STAGES = new Set(["booked", "prep", "inTransit", "delivered", "completed"]);
  const shipsBooked = ships.filter((x) => BOOKED_STAGES.has(x.stage));
  const shipsBookedWithFee = shipsBooked.filter((x) => x.depositCents !== null);
  const feeCoveragePct =
    shipsBooked.length > 0 ? (shipsBookedWithFee.length / shipsBooked.length) * 100 : null;
  const shipFeeByAbd = new Map(
    shipsBookedWithFee.filter((x) => x.abdId).map((x) => [x.abdId, x.depositCents as number]),
  );

  // Route-price-checker demand since success logging was fixed (Jul 27 PM).
  // Small volume by construction; counted in memory to avoid a composite
  // index on (status, createdAt).
  let rpcOk = 0;
  let rpcUnsupported = 0;
  let rpcError = 0;
  try {
    const rpcSnap = await getAdminDb()
      .collection("route_price_checker_queries")
      .where("createdAt", ">=", RPC_LOG_START)
      .select("status")
      .get();
    for (const doc of rpcSnap.docs) {
      const s = String(doc.get("status") ?? "");
      if (s === "ok") rpcOk++;
      else if (s === "unsupported_route") rpcUnsupported++;
      else if (s === "sd_error") rpcError++;
    }
  } catch {
    /* diagnostics line simply omits price-checker counts */
  }

  // First-party behavior events (last 14 days). Capture began Jul 22 PM —
  // the Behavior view labels itself accordingly while history accrues.
  interface SiteEvent {
    vid: string;
    sid: string | null;
    type: string;
    path: string;
    locale: "es" | "en";
    at: Date | null;
    price: number | null;
    /** Session click attribution (capture live Jul 28) — the P1 lens. */
    campaignId: string | null;
  }
  let siteEvents: SiteEvent[] = [];
  try {
    const d14 = new Date(now.getTime() - 14 * 86_400_000);
    const sevSnap = await getAdminDb()
      .collection("site_events")
      .where("ts", ">=", d14)
      .select("vid", "sid", "type", "path", "locale", "ts", "meta.price", "attr.campaignId")
      .get();
    siteEvents = sevSnap.docs.map((doc) => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const e: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
      return {
        vid: String(e.vid ?? ""),
        sid: e.sid ? String(e.sid) : null,
        type: String(e.type ?? ""),
        path: String(e.path ?? ""),
        locale: e.locale === "es" ? ("es" as const) : ("en" as const),
        at: e.ts?.toDate?.() ?? null,
        price: typeof e.meta?.price === "number" ? e.meta.price : null,
        campaignId:
          typeof e.attr?.campaignId === "string" && e.attr.campaignId ? e.attr.campaignId : null,
      };
    });
    siteEvents.sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
  } catch {
    /* Behavior view renders its empty state */
  }

  /* ── Estimate email captures (spec 2026-07-29) — same 14d window as
   * site_events so the capture rate shares its denominator. Language
   * discipline: "captured estimates", never leads. ── */
  interface CaptureRow {
    campaignId: string | null;
    at: Date | null;
  }
  let captures: CaptureRow[] = [];
  try {
    const d14 = new Date(now.getTime() - 14 * 86_400_000);
    const capSnap = await getAdminDb()
      .collection("estimate_captures")
      .where("createdAt", ">=", d14)
      .select("attr.campaignId", "createdAt", "emailStatus")
      .get();
    captures = capSnap.docs
      .filter((doc) => doc.get("emailStatus") !== "failed")
      .map((doc) => ({
        campaignId:
          typeof doc.get("attr.campaignId") === "string" && doc.get("attr.campaignId")
            ? String(doc.get("attr.campaignId"))
            : null,
        at: doc.get("createdAt")?.toDate?.() ?? null,
      }));
  } catch {
    /* tile renders zero state */
  }

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

  /* ── Operational conditions (feed the decision queue) ── */
  const formsNoEstimate = forms.filter((r) => r.price === null);
  // Calls excluded: CALL- docs never flow through createLead, so they have
  // no ProABD link to confirm ownership against (CallRail→ProABD mapping TBD).
  const unassigned = cohort.filter(
    (r) => !r.isCall && !r.proabdUser && !(r.abdId && abdStates.get(r.abdId)?.lastUser),
  );
  const postFixAttrMissing = paidPost.filter((r) => r.campaignName === null);

  /* ── Clock A (7d) operating totals ── */
  const leads7 = all.filter((r) => r.t >= d7); // valid leads, forms + calls
  const unique7 = dedupeLeads(leads7);
  const branch7 = new Map<SourceKey, number>();
  for (const e of unique7) branch7.set(e.origin.sourceKey, (branch7.get(e.origin.sourceKey) ?? 0) + 1);
  const bookingsRecorded7 = [...abdFirstOrderAt.values()].filter((at) => at >= d7).length;
  const feeRecorded7Cents = [...abdFirstOrderAt.entries()]
    .filter(([, at]) => at >= d7)
    .reduce((sum, [abd]) => sum + (shipFeeByAbd.get(abd) ?? 0), 0);

  /* ── Clock B mature cohort (created 44→14 days ago) — the only rates ── */
  const matureRows = allFetched.filter((r) => r.t >= d44 && r.t < d14);
  const matureEntities = dedupeLeads(matureRows);
  // P5 serviceable v1 (contract §7.2): blocked already excluded upstream;
  // junk-contact filter = at least one identity key. Lower bound by design.
  const matureServiceable = matureEntities.filter(
    (e) => e.origin.phoneKey !== null || e.origin.emailKey !== null,
  );
  const matureQuoted = matureServiceable.filter((e) => e.touches.some((t) => t.price !== null));
  const matureJoined = matureServiceable.filter((e) => e.touches.some((t) => t.abdId && t.synced));
  const matureBooked = matureJoined.filter((e) =>
    e.touches.some((t) => t.abdId && abdStates.get(t.abdId)?.outcome === "booked"),
  );
  const matureFeeCents = matureBooked.reduce((sum, e) => {
    const abd = e.touches.find((t) => t.abdId && abdStates.get(t.abdId)?.outcome === "booked")?.abdId;
    return sum + (abd ? (shipFeeByAbd.get(abd) ?? 0) : 0);
  }, 0);
  // Honesty label: does this cohort predate the ProABD integration?
  const maturePreIntegration = d44 < PROABD_START;
  const firstCleanCohortMatures = new Date(PROABD_START.getTime() + 44 * 86_400_000);

  /* ── Unified decision queue (contract §7.5 — stateless, rule-derived).
   *    Severity = hand-tuned impact × urgency × confidence score; every old
   *    Opportunities/Needs-attention rule is present (queue parity), so the
   *    Opportunities tab retires. Top 4 render on Overview; the rest live
   *    in the all-actions drawer. ── */
  interface QueueItem {
    title: string;
    body: string;
    impact: string;
    confidence: "high" | "med" | "low";
    owner: string;
    tab: string; // ?view= target ("" = overview/data-health)
    score: number; // ranking only
    warn: boolean;
  }
  const queue: QueueItem[] = [];
  if (syncFailed.length > 0)
    queue.push({
      title: `${syncFailed.length} form lead${syncFailed.length === 1 ? "" : "s"} never reached ProABD`,
      body: "No agent will see these in the CRM — enter manually today, then investigate the createLead failure.",
      impact: `${syncFailed.length} uncontacted lead${syncFailed.length === 1 ? "" : "s"}`,
      confidence: "high",
      owner: "Eddie / agents",
      tab: "sales",
      score: 100 + syncFailed.length * 10,
      warn: true,
    });
  if (syncOk.length > 0 && statusMatched.length / syncOk.length < 0.9)
    queue.push({
      title: "Webhook coverage gap — records missing event stamp-backs",
      body: `Only ${pct(statusMatched.length, syncOk.length)} of synced forms have webhook events — outcome tracking is blind on the rest. Self-resolves as events arrive; if it persists a day, check the receiver and ask Superflo about failed deliveries (Jul 22–27 lesson: their sender doesn't follow redirects or retry).`,
      impact: "outcome + fee blind spots on unstamped records",
      confidence: "high",
      owner: "Eddie → Brian",
      tab: "",
      score: 90,
      warn: true,
    });
  if (unassigned.length > 0)
    queue.push({
      title: `${unassigned.length} record${unassigned.length === 1 ? "" : "s"} without a confirmed owner`,
      body: "Nobody is stamped as owner in ProABD — risk of an uncontacted lead. Assign now.",
      impact: `${unassigned.length} lead${unassigned.length === 1 ? "" : "s"} at risk`,
      confidence: "med",
      owner: "Ben / agents",
      tab: "sales",
      score: 60 + unassigned.length * 5,
      warn: true,
    });
  // Ads-derived rules (mirror Acquisition's thresholds on the D-window stats).
  if (ads.state === "ok") {
    const acctClicks = ads.stats.campaigns.reduce((n, c) => n + c.clicks, 0);
    const acctCost = ads.stats.campaigns.reduce((n, c) => n + c.costDollars, 0);
    const acctCpc = acctClicks > 0 ? acctCost / acctClicks : null;
    for (const c of ads.stats.campaigns) {
      const cpc = c.clicks > 0 ? c.costDollars / c.clicks : null;
      const short = c.name.replace(/^ALL - /, "").split(" ")[0];
      if (acctCpc !== null && cpc !== null && c.clicks < 10 && cpc > 2 * acctCpc && c.costDollars > 0)
        queue.push({
          title: `${short}: rebuild relevance, then retest`,
          body: `${c.clicks} click${c.clicks === 1 ? "" : "s"} at ${money2(cpc)} (${(cpc / acctCpc).toFixed(1)}× account avg). Money can't fix a rank problem.`,
          impact: "parked daily budget",
          confidence: "high",
          owner: "Eddie",
          tab: "acquisition",
          score: 55,
          warn: true,
        });
      const secondary = Math.max(0, c.allConversions - c.conversions);
      const verdict = CAMPAIGN_VERDICTS[c.id];
      // Secondary-heavy rule, doctrine updated 8/10: the old advice ("hold
      // budget; signal→lead rate decides") assumed downstream value was
      // unmeasurable. It was measured on 8/10 (session join): assists ≈ 0
      // account-wide and 88% of leads convert same-session — so a campaign
      // rich in signals but poor in primaries is a CUT CANDIDATE judged on
      // primary CPL, not a hold. Campaigns with a recorded verdict (e.g. S1
      // paused) get the verdict card instead of a stale recommendation.
      if (secondary >= 10 && secondary >= 10 * Math.max(1, c.conversions)) {
        if (verdict)
          queue.push({
            title: `${short}: ${verdict.verdict}`,
            body: verdict.detail,
            impact: `decision of record ${verdict.date}`,
            confidence: "high",
            owner: "Eddie",
            tab: "acquisition",
            score: 20, // resolved — informational, sorts low
            warn: false,
          });
        else
          queue.push({
            title: `${short}: secondary-heavy — judge on primary CPL`,
            body: `${secondary} secondary events vs ${c.conversions || 0} primary action${c.conversions === 1 ? "" : "s"}. Assist value measured ≈ 0 account-wide (8/10 session join; 88% same-session market) — signals no longer defend spend. If primaries don't materialize, cut per the S1 precedent.`,
            impact: `$${Math.round(c.costDollars)} window spend riding on primaries`,
            confidence: "med",
            owner: "Eddie",
            tab: "acquisition",
            score: 50,
            warn: true,
          });
      }
      if (/brand/i.test(c.name) && c.searchImpressionShare !== null && c.searchImpressionShare < 0.9) {
        // Diagnosis order fixed 8/10: the 8/10 read showed Brand's lost IS
        // was BUDGET (50–75% top-IS lost to budget), not Quality Score —
        // budget went $14→$20/day that day. Blame budget first when the
        // data says budget; only send Eddie on a QS hunt when it doesn't.
        const brandBudgetLost = c.searchBudgetLostAbsTopShare ?? 0;
        queue.push({
          title:
            brandBudgetLost > 0.3
              ? "Brand moat leaky — budget-capped on our own name"
              : "Brand moat leaky — QS check on brand terms",
          body:
            `${Math.round(c.searchImpressionShare * 100)}% overall impression share on our own name — ~${Math.round((1 - c.searchImpressionShare) * 100)}% of brand searches unserved.` +
            (brandBudgetLost > 0.3
              ? ` ${Math.round(brandBudgetLost * 100)}% of top impressions lost to BUDGET — raise the daily cap (raised to $20 on 8/10; verify IS recovery before touching QS).`
              : " Budget-lost is low, so this one IS a relevance/QS question."),
          impact: "brand traffic leaking to competitors",
          confidence: "med",
          owner: "Eddie",
          tab: "acquisition",
          score: 45,
          warn: true,
        });
      }
    }
  }
  if (postFixAttrMissing.length > 0)
    queue.push({
      title: `${postFixAttrMissing.length} post-fix paid lead${postFixAttrMissing.length === 1 ? "" : "s"} missing campaign attribution`,
      body: "Paid click proven, campaign unmapped — should trend to zero; investigate tracking if it grows.",
      impact: "attribution completeness",
      confidence: "med",
      owner: "Eddie",
      tab: "acquisition",
      score: 30,
      warn: false,
    });
  if (formsNoEstimate.length > 0)
    queue.push({
      title: `${formsNoEstimate.length} valid form${formsNoEstimate.length === 1 ? "" : "s"} saw no price`,
      body: "Pricing API failure or unusual route — agent must quote manually; review if recurring.",
      impact: `${formsNoEstimate.length} manual quote${formsNoEstimate.length === 1 ? "" : "s"}`,
      confidence: "high",
      owner: "Agents / Eddie",
      tab: "sales",
      score: 25,
      warn: false,
    });
  if (cohortBlocked.length > 0)
    queue.push({
      title: `${cohortBlocked.length} blocked international/invalid submission${cohortBlocked.length === 1 ? "" : "s"}`,
      body: "Unserviceable demand rejected at the form — referral-partner opportunity (PR/HI receipts also in the price checker).",
      impact: "possible referral revenue",
      confidence: "low",
      owner: "Ben",
      tab: "lanes",
      score: 15,
      warn: false,
    });
  queue.sort((a, b) => b.score - a.score);

  /* ── Data health chip ── */
  const healthIssues: string[] = [];
  if (syncOk.length > 0 && statusMatched.length / syncOk.length < 0.9)
    healthIssues.push(
      `Webhook stamp-backs at ${pct(statusMatched.length, syncOk.length)} of synced forms`,
    );
  if (ordersImportedAt && now.getTime() - ordersImportedAt.getTime() > 3 * 86_400_000)
    healthIssues.push(
      `Orders import ${Math.round((now.getTime() - ordersImportedAt.getTime()) / 86_400_000)} days old (book numbers to ${fmtDay(ordersImportedAt)})`,
    );
  if (feeCoveragePct !== null && feeCoveragePct < 80)
    healthIssues.push(`Fee coverage ${feeCoveragePct.toFixed(0)}% — below the 80% contract threshold`);
  if (ads.state !== "ok") healthIssues.push("Ads API join unavailable");

  const updatedAt = now.toLocaleString("en-US", {
    timeZone: PT,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  /* ── View renderers ── */

  function BusinessBaselineCard() {
    if (orders.length === 0) return null;

    const monthKey = (d: Date) =>
      d.toLocaleDateString("en-CA", { timeZone: PT, year: "numeric", month: "2-digit" });
    const monthLabel = (d: Date) => d.toLocaleDateString("en-US", { timeZone: PT, month: "short" });

    const monthly = new Map<string, { label: string; orders: number; fees: number }>();
    let firstOrder: Date | null = null;
    for (const o of orders) {
      if (!o.orderCreatedAt) continue;
      if (!firstOrder || o.orderCreatedAt < firstOrder) firstOrder = o.orderCreatedAt;
      const k = monthKey(o.orderCreatedAt);
      const m = monthly.get(k) ?? { label: monthLabel(o.orderCreatedAt), orders: 0, fees: 0 };
      m.orders++;
      m.fees += o.deposit;
      monthly.set(k, m);
    }
    const keys = [...monthly.keys()].sort();
    const currentKey = monthKey(now);
    const months = keys.map((k) => ({ key: k, ...monthly.get(k)! }));
    const maxFees = Math.max(...months.map((m) => m.fees), 1);
    const peak = months.reduce((a, b) => (b.fees > a.fees ? b : a), months[0]);

    const totalFees = orders.reduce((s, o) => s + o.deposit, 0);
    const avgFee = Math.round(totalFees / orders.length);

    const byEmail = new Map<string, number>();
    for (const o of orders) if (o.email) byEmail.set(o.email, (byEmail.get(o.email) ?? 0) + 1);
    const repeatCustomers = [...byEmail.values()].filter((n) => n > 1).length;
    const repeatOrders = [...byEmail.values()].filter((n) => n > 1).reduce((s, n) => s + n, 0);
    const repeatPct = Math.round((repeatOrders / orders.length) * 100);

    const SOUTH = new Set(["FL", "AZ"]);
    const snowbirds = orders.filter((o) => SOUTH.has(o.originState) && !SOUTH.has(o.destState)).length;

    const fastPickup = orders.filter(
      (o) =>
        o.availableAt && o.orderCreatedAt && o.availableAt.getTime() - o.orderCreatedAt.getTime() <= 86_400_000,
    ).length;
    const fastPct = Math.round((fastPickup / orders.length) * 100);

    // "$0 → $peak/month in ~N days" — first order to end of peak month.
    const [py, pm] = peak.key.split("-").map(Number);
    const peakMonthEnd = new Date(py, pm, 0);
    const days = firstOrder ? Math.round((peakMonthEnd.getTime() - firstOrder.getTime()) / 86_400_000 / 10) * 10 : 90;

    const money = (n: number) =>
      n >= 10_000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toLocaleString("en-US")}`;

    const chip: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "baseline",
      gap: 5,
      border: "1px solid var(--color-gray-200)",
      borderRadius: 999,
      padding: "4px 12px",
      fontSize: 12,
      background: "#f9fafb",
    };
    const chipNum: React.CSSProperties = { color: GREEN, fontWeight: 800, fontSize: 14 };
    const STRIPE = `repeating-linear-gradient(135deg, ${GREEN} 0 4px, #6FCB8A 4px 8px)`;

    return (
      <div style={{ ...CARD, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ ...SUBTLE, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              The B2C book · started {firstOrder?.toLocaleDateString("en-US", { timeZone: PT, month: "long", year: "numeric" })}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: INK, lineHeight: 1.15, margin: "2px 0" }}>
              $0 → {money(peak.fees)}/month in {days} days
            </div>
            <div style={SUBTLE}>
              ${totalFees.toLocaleString("en-US")} in fees · {orders.length} bookings · avg ${avgFee} per order ·{" "}
              {repeatPct}% repeat volume
            </div>
          </div>
          <div style={{ ...SUBTLE, textAlign: "right", whiteSpace: "nowrap" }}>
            Source: ProABD orders
            <br />
            Updated {updatedAt}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
          {months.map((m) => {
            const isPartial = m.key === currentKey;
            const showVal = m.key === peak.key || isPartial;
            return (
              <div
                key={m.key}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", flex: 1, minWidth: 0 }}
                title={`${m.label} — ${m.orders} orders · $${m.fees.toLocaleString("en-US")} fees${isPartial ? " (in progress)" : ""}`}
              >
                {showVal && (
                  <div style={{ fontSize: 10.5, color: INK, fontWeight: 700, marginBottom: 3, whiteSpace: "nowrap" }}>
                    ${m.fees.toLocaleString("en-US")}
                  </div>
                )}
                <div
                  style={{
                    width: "100%",
                    maxWidth: 40,
                    // Pixel heights: percentage heights collapse inside an
                    // auto-height flex column (bug caught on first deploy).
                    height: Math.max(3, Math.round((m.fees / maxFees) * 72)),
                    background: isPartial ? STRIPE : GREEN,
                    borderRadius: "4px 4px 0 0",
                  }}
                />
                <div style={{ fontSize: 10.5, color: MUTED, marginTop: 5, textAlign: "center", lineHeight: 1.35 }}>
                  {m.label}
                  {isPartial ? "*" : ""}
                  <br />
                  <span style={{ color: INK, fontWeight: 600 }}>{m.orders}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            borderTop: "1px solid var(--color-gray-200)",
            marginTop: 14,
            paddingTop: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span style={{ ...SUBTLE, marginRight: 4 }}>Banked:</span>
          <span style={chip}>
            <span style={chipNum}>{snowbirds}</span> snowbird targets · Oct
          </span>
          <span style={chip}>
            <span style={chipNum}>{repeatCustomers}</span> repeat customers
          </span>
          <span style={chip}>
            <span style={chipNum}>{fastPct}%</span> book pickup ≤1 day
          </span>
        </div>
        <div style={{ fontSize: 10.5, color: MUTED, marginTop: 10 }}>
          Bars = monthly fees (booking deposits, Auto Line revenue — not customer gross). *Current month in
          progress. First fall/winter on record — this year sets the baseline.
        </div>
      </div>
    );
  }

  function Overview() {
    /* ── Overview — the whole machine (rebuilt 2026-07-28, two clocks) ──
     * metric-contract.md: operating totals (Clock A) are independent
     * numbers, never a funnel; rates live ONLY in the mature cohort
     * (Clock B); every block links into its zoom tab; decision queue is
     * stateless and rule-derived with parity over the old Opportunities
     * tab (which this build retires).
     */
    const stats7 = ads7.state === "ok" ? ads7.stats : null;
    const spend7 = stats7 ? stats7.campaigns.reduce((s, c) => s + c.costDollars, 0) : null;
    const actions7 = stats7 ? stats7.campaigns.reduce((s, c) => s + c.conversions, 0) : null;

    const pill: React.CSSProperties = {
      display: "inline-block",
      fontSize: 11,
      border: "1px solid var(--color-gray-200)",
      background: "var(--color-surface)",
      borderRadius: 999,
      padding: "4px 11px",
      color: MUTED,
      marginRight: 6,
      marginBottom: 6,
    };
    const pillB: React.CSSProperties = { color: "#1a1a1a", fontWeight: 700 };
    const tile: React.CSSProperties = {
      border: "1px solid var(--color-gray-200)",
      borderRadius: 10,
      background: "var(--color-surface)",
      padding: "11px 13px",
      flex: "1 1 150px",
      minWidth: 140,
    };
    const tileL: React.CSSProperties = {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: MUTED,
    };
    const tileV: React.CSSProperties = { fontSize: 23, fontWeight: 800, color: INK, margin: "2px 0" };
    const tileS: React.CSSProperties = { fontSize: 10.5, color: MUTED, lineHeight: 1.45 };

    const stageRow = (label: string, n: number, rateLabel: string | null, width: number) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "7px 0" }}>
        <div style={{ width: 140, fontSize: 11.5, fontWeight: 600, color: INK, textAlign: "right" }}>{label}</div>
        <div style={{ flex: 1, background: "var(--color-gray-100)", borderRadius: 5, height: 20, position: "relative" }}>
          <div style={{ width: `${Math.max(width, 0.5)}%`, height: "100%", background: GREEN, borderRadius: 5 }} />
          <span
            style={{
              position: "absolute",
              left: width > 12 ? undefined : `calc(${Math.max(width, 0.5)}% + 7px)`,
              right: width > 12 ? `calc(${100 - width}% + 7px)` : undefined,
              top: 2,
              fontSize: 11,
              fontWeight: 800,
              color: width > 12 ? "#fff" : INK,
            }}
          >
            {n}
          </span>
        </div>
        <div style={{ width: 135, fontSize: 10.5, color: MUTED }}>{rateLabel ?? "—"}</div>
      </div>
    );
    const mw = (n: number) =>
      matureEntities.length > 0 ? (n / matureEntities.length) * 100 : 0;

    const decTile = (d: (typeof queue)[number], i: number) => (
      <div
        key={d.title}
        style={{
          border: "1px solid var(--color-gray-200)",
          borderLeft: `4px solid ${i === 0 && d.warn ? "#dc2626" : d.warn ? "#d97706" : GREEN}`,
          borderRadius: 10,
          background: "var(--color-surface)",
          padding: "11px 13px",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: INK }}>{d.title}</span>
          <span style={{ fontSize: 10.5, color: MUTED }}>
            impact: {d.impact} · confidence: {d.confidence} · owner: {d.owner}
            {d.tab ? (
              <>
                {" "}·{" "}
                <a href={`/admin?view=${d.tab}`} style={{ color: GREEN, fontWeight: 600, textDecoration: "none" }}>
                  {VIEWS.find((v) => v.id === d.tab)?.label ?? d.tab} →
                </a>
              </>
            ) : null}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: "#374151", lineHeight: 1.5, marginTop: 3 }}>{d.body}</div>
      </div>
    );

    return (
      <>
        {/* 1 · clocks + health */}
        <div style={{ marginBottom: 10 }}>
          <span style={pill}>Operating period: <span style={pillB}>last 7 days</span> · latest day partial</span>
          <span style={pill}>Mature cohort: <span style={pillB}>created {fmtDay(d44)}–{fmtDay(d14)}</span> · seasoned ≥14d</span>
          <span style={pill}>Book: <span style={pillB}>Mar 1 → {ordersImportedAt ? fmtDay(ordersImportedAt) : "import date unknown"}</span></span>
          <span
            style={{
              ...pill,
              background: healthIssues.length > 0 ? "#fffbeb" : "#ecfdf5",
              borderColor: healthIssues.length > 0 ? "#fde68a" : "#a7f3d0",
              color: healthIssues.length > 0 ? "#92400e" : "#065f46",
              fontWeight: 700,
            }}
          >
            {healthIssues.length > 0 ? `⚠ ${healthIssues.length} data issue${healthIssues.length === 1 ? "" : "s"}` : "✓ data healthy"}
          </span>
        </div>

        {/* 2 · narrative verdict — paid and all-channel kept apart */}
        <section style={{ ...CARD, marginBottom: 12, borderLeft: `4px solid ${GREEN}` }}>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "#1a1a1a" }}>
            <strong>
              This week: {spend7 !== null ? money(spend7) : "—"} paid spend produced{" "}
              {actions7 !== null ? Math.round(actions7) : "—"} paid{" "}
              <Term k="primaryActions">primary conversion actions</Term>. Across all channels the
              business received {unique7.length} new <Term k="paidLeadRecords">unique leads</Term>
            </strong>{" "}
            ({CHANNEL_ORDER.filter((k) => (branch7.get(k) ?? 0) > 0)
              .map((k) => `${branch7.get(k)} ${CHANNEL_LABELS[k].toLowerCase()}`)
              .join(" · ") || "none yet"}
            ). {bookingsRecorded7} booking{bookingsRecorded7 === 1 ? "" : "s"} recorded (some may belong
            to older cohorts){feeRecorded7Cents > 0 ? <> · {money(feeRecorded7Cents / 100)} booked broker fee recorded</> : null}.
            The book stands at <strong>{money(orders.reduce((s, o) => s + o.deposit, 0))} fees · {orders.length} bookings since March</strong>
            {ordersImportedAt ? ` (as of ${fmtDay(ordersImportedAt)})` : ""}.
          </div>
        </section>

        {/* 2b · phase card — contract §10: the optimization ladder */}
        <section style={{ ...CARD, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <h2 style={H2}>Where we are — the optimization ladder</h2>
            <span style={{ fontSize: 10.5, color: MUTED }}>
              contract §10 · provisional targets set Jul 29 · Ben ratifies Jul 31
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {PHASES.map((p) => {
              const active = p.n === ACCOUNT_PHASE;
              const past = p.n < ACCOUNT_PHASE;
              return (
                <div
                  key={p.n}
                  style={{
                    flex: "1 1 180px",
                    minWidth: 170,
                    border: active ? `2px solid ${GREEN}` : "1px solid var(--color-gray-200)",
                    borderRadius: 10,
                    padding: "9px 12px",
                    background: active ? "#f0fdf4" : "var(--color-surface)",
                    opacity: past ? 0.75 : 1,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: active ? GREEN : MUTED }}>
                    Phase {p.n} · {p.title} {active ? "— NOW" : past ? "— done" : ""}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, margin: "3px 0 1px" }}>
                    Optimize for {p.optimize}
                  </div>
                  <div style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.45 }}>
                    {p.bidding} · judged on {p.judgedOn}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12.5, color: "#1a1a1a", lineHeight: 1.55, marginTop: 9 }}>
            <strong><Term k="learningPhase">Learning phase</Term>:</strong> {PHASE_NARRATIVE[ACCOUNT_PHASE]}
          </div>
          {ads.state === "ok" && (
            <div style={{ marginTop: 9 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: MUTED, marginBottom: 5 }}>
                Gate to Phase 2 — {GATE_ACTIONS_30D} primary actions / 30d per campaign (era began Jul 20)
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {ads.stats.campaigns
                  .filter((c) => ADS_CAMPAIGN_NAMES[c.id])
                  .sort((a, b) => b.conversions - a.conversions)
                  .map((c) => {
                    const n = Math.round(c.conversions);
                    const w = Math.min(100, (n / GATE_ACTIONS_30D) * 100);
                    return (
                      <div key={c.id} style={{ flex: "1 1 130px", minWidth: 120 }}>
                        <div style={{ fontSize: 10.5, color: INK, fontWeight: 600, marginBottom: 2 }}>
                          {(ADS_CAMPAIGN_NAMES[c.id] ?? c.id).replace(" Español", " ES")}{" "}
                          <span style={{ color: MUTED, fontWeight: 400 }}>{n}/{GATE_ACTIONS_30D}</span>
                        </div>
                        <div style={{ height: 5, background: "var(--color-gray-100)", borderRadius: 3 }}>
                          <div style={{ height: 5, width: `${w}%`, background: w >= 100 ? GREEN : "#86efac", borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.5, marginTop: 7 }}>
                {PHASE2_PILOT_NOTE} Gate to Phase 3: fee coverage ≥80% (measured {feeCoveragePct !== null ? `${feeCoveragePct.toFixed(0)}% ✓` : "—"}) ·
                conversion-value import (not built) · first mature instrumented cohort read (Aug 27+).
              </div>
            </div>
          )}
          <div style={{ fontSize: 11, color: "#1a1a1a", marginTop: 8, borderTop: "1px solid var(--color-gray-100)", paddingTop: 7, lineHeight: 1.55 }}>
            Declared <Term k="affordabilityCeiling">affordability ceiling</Term>:{" "}
            <strong>${CPL_CEILING.value} per unique serviceable paid lead</strong> (activates Phase 2) —{" "}
            {CPL_CEILING.basis}. Rate targets (click→lead, lead→book, cost per booking) are
            deliberately unset until our first mature instrumented cohort — Aug 27, not invented from industry benchmarks.
          </div>
        </section>

        {/* 3 · decision queue */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ ...H2, marginBottom: 6 }}>
            Needs a decision{" "}
            <span style={{ ...SUBTLE, fontWeight: 400 }}>
              — ranked · stateless: tiles clear when their rule stops firing
            </span>
          </h2>
        </div>
        {queue.length > 0 ? queue.slice(0, 4).map(decTile) : (
          <div style={{ ...SUBTLE, marginBottom: 8 }}>No rules firing — nothing needs a decision right now.</div>
        )}
        {queue.length > 4 && (
          <details style={{ marginBottom: 6 }}>
            <summary style={{ fontSize: 12.5, fontWeight: 700, color: GREEN, cursor: "pointer" }}>
              View all actions ({queue.length})
            </summary>
            <div style={{ marginTop: 8 }}>{queue.slice(4).map(decTile)}</div>
          </details>
        )}

        {/* 4a · operating totals — NOT a funnel */}
        <section style={{ ...CARD, marginBottom: 12, marginTop: 8 }}>
          <h2 style={H2}>
            This period — independent operating totals{" "}
            <span style={{ ...SUBTLE, fontWeight: 400 }}>· not a funnel; these share a window, not a population</span>
          </h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <div style={tile}>
              <div style={tileL}>Paid spend</div>
              <div style={tileV}>{spend7 !== null ? money(spend7) : "—"}</div>
              <div style={tileS}>
                Ads API · last 7 days →{" "}
                <a href="/admin?view=acquisition" style={{ color: GREEN, fontWeight: 600, textDecoration: "none" }}>Acquisition</a>
              </div>
            </div>
            <div style={tile}>
              <div style={tileL}>Paid primary actions</div>
              <div style={tileV}>{actions7 !== null ? Math.round(actions7) : "—"}</div>
              <div style={tileS}>forms + 90s calls · not deduped into unique leads</div>
              <div style={{ marginTop: 4 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: MUTED, border: "1px solid var(--color-gray-200)", borderRadius: 999, padding: "1px 7px", background: "var(--color-gray-100)" }}>
                  Phase 1 · learning — CPL target activates at gate
                </span>
              </div>
            </div>
            <div style={tile}>
              <div style={tileL}>New unique leads · all channels</div>
              <div style={tileV}>{unique7.length}</div>
              <div style={tileS}>
                P4 dedup (phone/email, 30d) over {leads7.length} valid records
              </div>
            </div>
            <div style={tile}>
              <div style={tileL}>Bookings recorded</div>
              <div style={tileV}>{bookingsRecorded7}</div>
              <div style={tileS}>
                order-stage events this window · may belong to older cohorts →{" "}
                <a href="/admin?view=sales" style={{ color: GREEN, fontWeight: 600, textDecoration: "none" }}>Sales</a>
              </div>
            </div>
            <div
              style={{
                ...tile,
                ...(feeCoveragePct !== null && feeCoveragePct < 80
                  ? { background: "#fffbeb", borderColor: "#fde68a" }
                  : {}),
              }}
            >
              <div style={tileL}>Booked broker fee recorded</div>
              <div style={tileV}>
                {ships.length === 0 ? (
                  <span style={{ fontSize: 14, color: MUTED }}>unavailable</span>
                ) : (
                  money(feeRecorded7Cents / 100)
                )}
              </div>
              <div style={tileS}>
                {feeCoveragePct !== null
                  ? `deposit present on ${feeCoveragePct.toFixed(0)}% of booked shipments · live to within minutes · not revenue`
                  : "webhook shipments unavailable"}
              </div>
            </div>
          </div>
        </section>

        {/* 4b · mature cohort — the only rates */}
        <section style={{ ...CARD, marginBottom: 12 }}>
          <h2 style={H2}>
            Mature cohort — leads created {fmtDay(d44)}–{fmtDay(d14)}{" "}
            <span style={{ ...SUBTLE, fontWeight: 400 }}>· the only place rates live · each stage nests in the last</span>
          </h2>
          {matureEntities.length > 0 ? (
            <div style={{ marginTop: 6 }}>
              {stageRow("Unique leads", matureEntities.length, null, 100)}
              {stageRow(
                "Serviceable",
                matureServiceable.length,
                pct(matureServiceable.length, matureEntities.length) + " of unique",
                mw(matureServiceable.length),
              )}
              {stageRow(
                "Quoted (forms)",
                matureQuoted.length,
                pct(matureQuoted.length, matureServiceable.length) + " of serviceable",
                mw(matureQuoted.length),
              )}
              {stageRow(
                "ProABD joined",
                matureJoined.length,
                pct(matureJoined.length, matureServiceable.length) + " of serviceable",
                mw(matureJoined.length),
              )}
              {stageRow(
                "Booked",
                matureBooked.length,
                pct(matureBooked.length, matureServiceable.length) + " of serviceable",
                mw(matureBooked.length),
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "7px 0" }}>
                <div style={{ width: 140, fontSize: 11.5, fontWeight: 600, color: INK, textAlign: "right" }}>Booked broker fee</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: matureFeeCents > 0 ? INK : MUTED }}>
                  {matureFeeCents > 0 ? money(matureFeeCents / 100) : "n too small / fee join thin"}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ ...SUBTLE, marginTop: 6 }}>No leads in the mature window yet.</div>
          )}
          <div style={{ ...SUBTLE, marginTop: 8 }}>
            {maturePreIntegration ? (
              <>
                Part of this cohort predates the ProABD integration ({fmtDay(PROABD_START)}) and the{" "}
                {fmtDay(TRACKING_FIX_TS)} tracking fix — join and booked rates read LOW and are labeled
                unreliable.{" "}
                <strong style={{ color: INK }}>
                  The first fully-instrumented cohort matures {fmtDay(firstCleanCohortMatures)}
                </strong>{" "}
                — this block improves on a schedule, not by wishing.
              </>
            ) : (
              <>Fully instrumented cohort. Source-branch rate split lands with more volume.</>
            )}{" "}
            Calls are quoted by humans and never counted in &ldquo;Quoted&rdquo;.
          </div>
        </section>

        {/* 4c · the book */}
        <BusinessBaselineCard />

        {/* 5 · data health drawer */}
        <details style={{ ...CARD, marginBottom: 8 }}>
          <summary style={{ fontSize: 13, fontWeight: 700, color: INK, cursor: "pointer" }}>
            Data health — {healthIssues.length > 0 ? `${healthIssues.length} issue${healthIssues.length === 1 ? "" : "s"}` : "healthy"}
          </summary>
          <div style={{ marginTop: 10 }}>
            {healthIssues.length > 0 && (
              <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 12.5, color: "#92400e", lineHeight: 1.7 }}>
                {healthIssues.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <tbody>
                <tr style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={TD}>Form estimate captured</td>
                  <td style={TDR}><strong>{pricedForms.length}/{forms.length}</strong> ({pct(pricedForms.length, forms.length)})</td>
                  <td style={{ ...TD, color: MUTED }}>of valid forms</td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={TD}>ProABD sync</td>
                  <td style={TDR}><strong>{syncOk.length}/{syncEligible.length}</strong> ({pct(syncOk.length, syncEligible.length)})</td>
                  <td style={{ ...TD, color: MUTED }}>of eligible forms (15-min grace)</td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={TD}>ProABD status/event match</td>
                  <td style={TDR}><strong>{statusMatched.length}/{syncOk.length}</strong> ({pct(statusMatched.length, syncOk.length)})</td>
                  <td style={{ ...TD, color: MUTED }}>of synced forms with webhook events (since {WEBHOOK_START_LABEL})</td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={TD}>Campaign attribution — post-fix paid</td>
                  <td style={TDR}><strong>{paidPostMapped.length}/{paidPost.length}</strong> ({pct(paidPostMapped.length, paidPost.length)})</td>
                  <td style={{ ...TD, color: MUTED }}>paid leads after the Jul 20 fix</td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={TD}>Campaign attribution — pre-fix paid</td>
                  <td style={TDR}><strong>{paidPreMapped.length}/{paidPre.length}</strong> ({pct(paidPreMapped.length, paidPre.length)})</td>
                  <td style={{ ...TD, color: MUTED }}>historical; campaign mostly unrecoverable</td>
                </tr>
              </tbody>
            </table>
            <div style={{ ...SUBTLE, marginTop: 8 }}>
              Independent indicators, each with its own denominator — coverage, never a funnel. The
              integration-readiness table at the page bottom carries the longer-horizon gaps.
            </div>
          </div>
        </details>

        {/* 6 · methodology */}
        <details style={{ ...CARD }}>
          <summary style={{ fontSize: 13, fontWeight: 700, color: INK, cursor: "pointer" }}>Methodology</summary>
          <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#1a1a1a", marginTop: 10 }}>
            Two clocks, never mixed: operating totals cover the last 7 days and are independent
            numbers; rates appear only on the mature cohort (created {fmtDay(d44)}–{fmtDay(d14)},
            ≥14 days seasoned — 82% of orders historically resolve within 7 days).{" "}
            <strong>Unique leads</strong> = records collapsed by normalized phone/email within 30
            days (read-time, nothing merged in the database). <strong>Booked broker fee</strong> is
            the booking deposit — not collected revenue, not profit. Full definitions:
            metric-contract.md; glossary on hover throughout.
          </div>
        </details>
      </>
    );
  }

  function Acquisition() {
    /* ── Paid Acquisition — Early Funnel (redesigned 2026-07-28) ──
     * Measurement rules enforced here (per the v2 mockup critique):
     *  - Only genuinely nested stages appear on the spine; research/
     *    engagement activity is a PARALLEL diagnostic, never a stage.
     *  - Secondary conversions are events, not people; primary actions are
     *    not deduplicated into unique leads. Labels say so.
     *  - Roles are hypotheses until booking data validates them; every
     *    conclusion is threshold-gated to the sample size behind it.
     *  - Coverage/eligibility dates render BEFORE any conclusion.
     */
    const stats = ads.state === "ok" ? ads.stats : null;

    interface CampRow {
      id: string;
      name: string;
      role: string;
      metric: string;
      cost: number;
      clicks: number;
      cpc: number | null;
      primary: number;
      secondary: number;
      cpAction: number | null;
      cpSignal: number | null;
      is: number | null;
      rankLost: number | null;
      budgetLost: number | null;
      flags: { text: string; tone: "good" | "gap" | "info" }[];
    }

    const camps: CampRow[] = (stats?.campaigns ?? [])
      .filter((c) => c.clicks > 0 || c.costDollars > 0)
      .map((c) => {
        const meta: Pick<CampaignMeta, "role" | "metric"> =
          CAMPAIGN_META[c.id] ?? { role: "unassigned", metric: "$ / primary action" };
        const primary = c.conversions;
        const secondary = Math.max(0, c.allConversions - c.conversions);
        return {
          id: c.id,
          name: c.name.replace(/^ALL - /, ""),
          role: meta.role,
          metric: meta.metric,
          cost: c.costDollars,
          clicks: c.clicks,
          cpc: c.clicks > 0 ? c.costDollars / c.clicks : null,
          primary,
          secondary,
          cpAction: primary > 0 ? c.costDollars / primary : null,
          cpSignal: secondary > 0 ? c.costDollars / secondary : null,
          is: c.searchImpressionShare,
          rankLost: c.searchRankLostTopShare,
          budgetLost: c.searchBudgetLostAbsTopShare,
          flags: [],
        };
      })
      .sort((a, b) => b.cost - a.cost);

    const tot = {
      cost: camps.reduce((s, c) => s + c.cost, 0),
      clicks: camps.reduce((s, c) => s + c.clicks, 0),
      primary: camps.reduce((s, c) => s + c.primary, 0),
      secondary: camps.reduce((s, c) => s + c.secondary, 0),
    };
    const acctCpc = tot.clicks > 0 ? tot.cost / tot.clicks : null;

    /* ── Threshold-gated flags (evidence-proportional by construction) ── */
    const actionLeaders = camps.filter((c) => c.primary >= 3).sort((a, b) => (a.cpAction ?? 1e9) - (b.cpAction ?? 1e9));
    for (const c of camps) {
      // Dated verdicts render first — a decision of record beats any live heuristic.
      const verdict = CAMPAIGN_VERDICTS[c.id];
      if (verdict) c.flags.push({ text: verdict.verdict, tone: "info" });
      if (actionLeaders.length > 0 && c.id === actionLeaders[0].id)
        c.flags.push({ text: "Best $/action — validate serviceability", tone: "good" });
      else if (c.primary >= 3) c.flags.push({ text: "Promising — small n", tone: "good" });
      // Doctrine updated 8/10 (assists measured ≈ 0; 88% same-session):
      // secondary-heavy no longer earns a "hold" — it earns scrutiny.
      if (!verdict && c.secondary >= 10 && c.secondary >= 10 * Math.max(1, c.primary))
        c.flags.push({ text: "Secondary-heavy — judge on primary CPL (assists ≈ 0, 8/10)", tone: "gap" });
      if (acctCpc !== null && c.cpc !== null && c.clicks < 10 && c.cpc > 2 * acctCpc)
        c.flags.push({ text: "Rebuild relevance, then retest", tone: "gap" });
      else if (c.rankLost !== null && c.rankLost > 0.5)
        c.flags.push({ text: "Rank-limited — QS / relevance work", tone: "gap" });
      if (c.budgetLost !== null && c.budgetLost > 0.3)
        c.flags.push({ text: "Budget-limited — headroom exists", tone: "info" });
      if (c.role === "moat" && c.is !== null && c.is < 0.9)
        c.flags.push({
          text:
            `Moat leaky — ~${Math.round((1 - c.is) * 100)}% of brand searches unserved` +
            ((c.budgetLost ?? 0) > 0.3 ? " (cause: budget — raised to $20/day 8/10, watch recovery)" : " (cause: rank/QS)"),
          tone: "gap",
        });
      if (c.flags.length === 0 && c.primary <= 1 && c.clicks < 50)
        c.flags.push({ text: "Too early to judge", tone: "info" });
    }

    /* ── Decision panel (rule-derived; a tile renders only when its rule fires) ── */
    const decisions: { n: string; title: string; body: string; warn: boolean }[] = [];
    if (actionLeaders.length > 0) {
      const names = actionLeaders.slice(0, 2).map((c) => c.name.split(" ")[0]);
      decisions.push({
        n: "PROTECT & VALIDATE",
        title: names.join(" + "),
        body: `Best cost per primary action (${actionLeaders
          .slice(0, 2)
          .map((c) => money(c.cpAction ?? 0))
          .join(" · ")}). Next: verify these actions become serviceable leads and bookings via the ProABD join before calling them winners.`,
        warn: false,
      });
    }
    const holdCamp = camps
      .filter((c) => c.secondary >= 10 && c.secondary >= 10 * Math.max(1, c.primary))
      .sort((a, b) => b.secondary - a.secondary)[0];
    if (holdCamp) {
      decisions.push({
        n: "DO NOT SCALE YET",
        title: holdCamp.name.split(" ")[0],
        body: `Cheap engagement (${holdCamp.cpSignal !== null ? money2(holdCamp.cpSignal) : "—"}/signal) but ${holdCamp.primary || "no"} primary action${holdCamp.primary === 1 ? "" : "s"}. Signal→lead rate is now accruing (UTM capture live) — decide with that evidence, not before.`,
        warn: true,
      });
    }
    const rebuildCamp = camps
      .filter((c) => acctCpc !== null && c.cpc !== null && c.clicks < 10 && c.cpc > 2 * acctCpc)
      .sort((a, b) => (b.cpc ?? 0) - (a.cpc ?? 0))[0];
    if (rebuildCamp) {
      decisions.push({
        n: "REBUILD, THEN RETEST",
        title: rebuildCamp.name.split(" ")[0],
        body: `${rebuildCamp.clicks} click${rebuildCamp.clicks === 1 ? "" : "s"} at ${rebuildCamp.cpc !== null ? money2(rebuildCamp.cpc) : "—"}${rebuildCamp.rankLost !== null && rebuildCamp.rankLost > 0.9 ? "; >90% of top-of-page impressions lost to rank" : ""}. Fix relevance/QS first — adding money to a rank problem buys nothing.`,
        warn: true,
      });
    }

    /* ── Spine stages 3–4: site-side, window-consistent (since the fix) ── */
    const paidLeadRecords = paidPost.length; // valid paid lead records since Jul 20 (forms + calls)
    // P4∩P6: unique paid leads (metric-contract §3, ratified 7/28) — read-time dedup.
    const uniquePaidLeads = dedupeLeads(paidPost).length;
    const paidJoined = paidPost.filter((r) => !r.isCall && r.abdId && r.synced);
    const paidBooked = paidJoined.filter((r) => abdStates.get(r.abdId)?.outcome === "booked");

    /* ── First-party research echo (14-day site_events window) ── */
    const estEvents = siteEvents.filter((e) => e.type === "estimate_shown");
    const estVids = new Set(estEvents.map((e) => e.vid)).size;

    /* ── Display helpers ── */
    const isPct = (v: number | null): string =>
      v === null ? "—" : v <= 0.1 ? "<10%" : v >= 0.9 ? ">90%" : Math.round(v * 100) + "%";
    const per100 = (n: number, d: number): string => (d > 0 ? ((n / d) * 100).toFixed(1) : "—");

    const covChip: React.CSSProperties = {
      fontSize: 11,
      border: "1px solid var(--color-gray-200)",
      background: "var(--color-surface)",
      borderRadius: 999,
      padding: "4px 11px",
      color: MUTED,
      marginRight: 6,
      marginBottom: 6,
      display: "inline-block",
    };
    const covB: React.CSSProperties = { color: "#1a1a1a", fontWeight: 700 };
    const flagChip = (tone: "good" | "gap" | "info"): React.CSSProperties => ({
      display: "inline-block",
      fontSize: 10.5,
      fontWeight: 600,
      borderRadius: 999,
      padding: "2px 9px",
      marginRight: 4,
      marginBottom: 2,
      whiteSpace: "nowrap",
      color: tone === "good" ? "#065f46" : tone === "gap" ? "#92400e" : MUTED,
      background: tone === "good" ? "#ecfdf5" : tone === "gap" ? "#fffbeb" : "var(--color-gray-100)",
      border: `1px solid ${tone === "good" ? "#a7f3d0" : tone === "gap" ? "#fde68a" : "var(--color-gray-200)"}`,
    });
    const stageCard = (pending: boolean): React.CSSProperties => ({
      ...CARD,
      padding: "12px 14px",
      flex: "1 1 140px",
      minWidth: 128,
      ...(pending ? { background: "var(--color-gray-100)", borderStyle: "dashed" as const } : {}),
    });
    const stgName: React.CSSProperties = {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      color: MUTED,
    };
    const stgNote: React.CSSProperties = { fontSize: 10, color: MUTED, marginTop: 5, lineHeight: 1.5 };

    /* ── Channels context (kept from the previous design — unique data) ── */
    const chan = CHANNEL_ORDER.map((k) => {
      const rows = cohort.filter((r) => r.sourceKey === k);
      const f = rows.filter((r) => !r.isCall);
      const c = rows.filter((r) => r.isCall);
      const p = f.filter((r) => r.price !== null);
      return { k, rows, f, c, p, quoted: p.reduce((s, r) => s + (r.price ?? 0), 0) };
    }).filter((c) => c.rows.length > 0);

    if (ads.state === "unconfigured") {
      return (
        <div style={ALERT}>
          Paid acquisition needs the Ads API credentials ({ads.missing.join(", ")}) — see
          scripts/mint-ads-refresh-token.mjs. Channel and lead data still appear on Overview.
        </div>
      );
    }

    return (
      <>
        {/* Coverage strip — BEFORE any conclusion */}
        <div style={{ marginBottom: 10 }}>
          <span style={covChip}>
            <span style={covB}>Paid attribution</span> eligible since {fmtDay(TRACKING_FIX_TS)} (tracking fix)
          </span>
          <span style={covChip}>
            <span style={covB}>First-party behavior</span> since {fmtDay(BEHAVIOR_START)}
          </span>
          <span style={covChip}>
            <span style={covB}>Price-checker log</span> since {fmtDay(RPC_LOG_START)}
          </span>
          <span style={covChip}>
            <span style={covB}>ProABD booking cohort</span> maturing — no booking economics yet
          </span>
          {stats && (
            <span style={covChip}>
              <span style={covB}>Ads window</span> {stats.since} → {stats.until} · latest day partial · weekends dark
            </span>
          )}
        </div>

        {ads.state === "error" && (
          <div style={ALERT}>Ads API error: {ads.message} — showing site-side data only.</div>
        )}

        {/* Narrative — deflated language by construction */}
        {stats && (
          <section style={{ ...CARD, marginBottom: 12, borderLeft: `4px solid ${GREEN}` }}>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "#1a1a1a" }}>
              <strong>
                {money(tot.cost)} generated {tot.clicks} clicks, {tot.secondary}{" "}
                <Term k="secondaryEvents">secondary engagement events</Term>, and {tot.primary}{" "}
                <Term k="primaryActions">primary conversion actions</Term>
              </strong>{" "}
              (forms + 90s+ calls; not deduplicated into unique leads).{" "}
              {actionLeaders.length > 0 && (
                <>
                  <strong>
                    {actionLeaders.slice(0, 2).map((c) => c.name.split(" ")[0]).join(" and ")} lead on cost per
                    primary action
                  </strong>{" "}
                  ({actionLeaders.slice(0, 2).map((c) => money(c.cpAction ?? 0)).join(" · ")}).{" "}
                </>
              )}
              {holdCamp && holdCamp.cpSignal !== null && (
                <>
                  {holdCamp.name.split(" ")[0]} produces the least-expensive secondary engagement (
                  {money2(holdCamp.cpSignal)} per signal) — <strong>its downstream value is not yet proven</strong>.{" "}
                </>
              )}
              Booking economics remain pending while the ProABD cohort matures.
            </div>
          </section>
        )}

        {/* Decision panel */}
        {decisions.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            {decisions.map((d, i) => (
              <div
                key={d.n}
                style={{
                  flex: "1 1 220px",
                  border: "1px solid var(--color-gray-200)",
                  borderLeft: `4px solid ${d.warn ? "#d97706" : GREEN}`,
                  borderRadius: 10,
                  background: "var(--color-surface)",
                  padding: "12px 14px",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: MUTED }}>
                  {i + 1} · {d.n}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: INK, margin: "2px 0 4px" }}>{d.title}</div>
                <div style={{ fontSize: 11.5, color: "#374151", lineHeight: 1.5 }}>{d.body}</div>
              </div>
            ))}
          </div>
        )}

        {/* Measured spine — nested stages only */}
        <h2 style={{ ...H2, marginBottom: 8 }}>
          The measured spine{" "}
          <span style={{ ...SUBTLE, fontWeight: 400 }}>— each stage is a subset of the one before it</span>
        </h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <div style={stageCard(false)}>
            <div style={stgName}>Paid clicks</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: INK }}>{stats ? tot.clicks : "—"}</div>
            <div style={{ fontSize: 11.5, color: GREEN, fontWeight: 700 }}>
              {acctCpc !== null ? <>{money2(acctCpc)} <Term k="avgCpc">avg CPC</Term></> : ""}
            </div>
            <div style={stgNote}>
              {camps
                .slice()
                .sort((a, b) => b.clicks - a.clicks)
                .slice(0, 4)
                .map((c) => `${c.name.split(" ")[0]} ${c.clicks}`)
                .join(" · ")}
            </div>
          </div>
          <div style={stageCard(false)}>
            <div style={stgName}><Term k="primaryActions">Primary conversion actions</Term></div>
            <div style={{ fontSize: 24, fontWeight: 800, color: INK }}>{stats ? tot.primary : "—"}</div>
            <div style={{ fontSize: 11.5, color: GREEN, fontWeight: 700 }}>
              {tot.primary > 0 ? `${money(tot.cost / tot.primary)} / action · ${per100(tot.primary, tot.clicks)} per 100 clicks` : "none this window"}
            </div>
            <div style={stgNote}>
              forms + 90s+ calls; calls are a lead <i>proxy</i>, not yet validated as serviceable
            </div>
          </div>
          <div style={stageCard(false)}>
            <div style={stgName}>Unique paid leads (P4)</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: INK }}>{uniquePaidLeads}</div>
            <div style={{ fontSize: 11.5, color: GREEN, fontWeight: 700 }}>
              {uniquePaidLeads > 0 ? money(tot.cost / uniquePaidLeads) + " / unique lead" : ""}
            </div>
            <div style={stgNote}>
              {paidLeadRecords} <Term k="paidLeadRecords">records</Term> deduped by phone/email
              (30-day window) · paid proof since {fmtDay(TRACKING_FIX_TS)}
            </div>
          </div>
          <div style={stageCard(paidJoined.length === 0)}>
            <div style={stgName}><Term k="proabdJoined">ProABD joined</Term> → booked</div>
            <div style={{ fontSize: paidJoined.length > 0 ? 24 : 17, fontWeight: 800, color: paidJoined.length > 0 ? INK : MUTED }}>
              {paidJoined.length > 0 ? `${paidJoined.length} → ${paidBooked.length}` : "maturing"}
            </div>
            <div style={stgNote}>
              {paidJoined.length > 0
                ? `${paidJoined.length} synced by ABD_Id; ${paidBooked.length} booked so far — cohort young, rates not meaningful yet`
                : "ABD_Id stamp-backs live; cohort too young for booking rates by campaign"}
            </div>
          </div>
          <div style={stageCard(true)}>
            <div style={stgName}>Gross profit</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: MUTED }}>pending</div>
            <div style={stgNote}>needs the fee join (deposit per booked order) — the number this page should end on</div>
          </div>
        </div>

        {/* Engagement diagnostics — parallel evidence, NOT a stage */}
        <section
          style={{ ...CARD, marginBottom: 14, background: "#EDF5F0", borderColor: "#d5e8dc" }}
        >
          <h2 style={H2}>
            Engagement diagnostics{" "}
            <span style={{ ...SUBTLE, fontWeight: 400 }}>— parallel evidence from paid traffic, not a funnel stage</span>
          </h2>
          <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#1a1a1a" }}>
            {stats && (
              <>
                <strong>{tot.secondary} <Term k="secondaryEvents">secondary conversion events</Term></strong> · {per100(tot.secondary, tot.clicks)} per
                100 clicks{tot.secondary > 0 ? ` · ${money2(tot.cost / tot.secondary)} per event` : ""} ·{" "}
                <i>events, not people</i> — one visitor can fire several, and a lead does not have to pass through any
                of them. Mix:{" "}
                {camps
                  .slice()
                  .sort((a, b) => b.secondary - a.secondary)
                  .filter((c) => c.secondary > 0)
                  .slice(0, 4)
                  .map((c) => `${c.name.split(" ")[0]} ${c.secondary}`)
                  .join(" · ") || "none"}
                .{" "}
              </>
            )}
            First-party echo (last 14 days): <strong>{estEvents.length} estimate_shown events from {estVids} unique visitors</strong>.
            {rpcOk + rpcUnsupported + rpcError > 0 && (
              <>
                {" "}Price-checker since {fmtDay(RPC_LOG_START)}: {rpcOk} priced · {rpcUnsupported} unserviceable route
                {rpcUnsupported === 1 ? "" : "s"} (HI/AK/PR demand){rpcError > 0 ? ` · ${rpcError} pricing errors` : ""}.
              </>
            )}
            <br />
            <span style={SUBTLE}>
              <Term k="signalLeadRate">Signal→lead rate</Term> by campaign is now accruing (session UTM capture live as of this deploy) — that answer
              decides the research feeder&rsquo;s budget, nothing else does.
            </span>
          </div>
        </section>

        {/* Campaign roles — hypotheses, compact */}
        <section style={{ ...CARD, marginBottom: 12, overflowX: "auto" }}>
          <h2 style={H2}>
            Campaign roles{" "}
            <span style={{ ...SUBTLE, fontWeight: 400 }}>— hypotheses until booking data validates them</span>
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640, marginTop: 6 }}>
            <thead>
              <tr>
                <th style={TH}>Campaign · role hypothesis</th>
                <th style={TH}>Success metric</th>
                <th style={TH}>Evidence (this window)</th>
                <th style={TH}>Next action</th>
              </tr>
            </thead>
            <tbody>
              {camps.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={{ ...TD, maxWidth: 240 }}>
                    {campaignTip(c.id) ? (
                      <strong className="tip" data-tip={campaignTip(c.id)} title={campaignTip(c.id)}>
                        {c.name}
                      </strong>
                    ) : (
                      <strong>{c.name}</strong>
                    )}
                    <br />
                    <span style={SUBTLE}>
                      {c.role}
                      {CAMPAIGN_META[c.id] ? <> — {CAMPAIGN_META[c.id].plain}</> : null}
                    </span>
                  </td>
                  <td style={{ ...TD, color: MUTED }}>{c.metric}</td>
                  <td style={TD}>
                    {c.primary > 0
                      ? `${c.primary} action${c.primary === 1 ? "" : "s"} @ ${money(c.cpAction ?? 0)}`
                      : `${c.clicks} click${c.clicks === 1 ? "" : "s"}${c.cpc !== null ? ` @ ${money2(c.cpc)}` : ""}`}
                    {c.secondary > 0 && c.role === "research feeder"
                      ? ` · ${c.secondary} signals @ ${money2(c.cpSignal ?? 0)}`
                      : ""}
                    {c.rankLost !== null && c.rankLost > 0.5 ? ` · ${isPct(c.rankLost)} top-IS lost to rank` : ""}
                    {c.role === "moat" && c.is !== null ? ` · ${isPct(c.is)} overall IS` : ""}
                  </td>
                  <td style={TD}>
                    {c.flags.map((f) => (
                      <span key={f.text} style={flagChip(f.tone)}>
                        {f.text}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
              {camps.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...TD, color: MUTED }}>
                    No campaign activity in the window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Analyst matrix — collapsed by default */}
        <details style={{ ...CARD, marginBottom: 12 }}>
          <summary style={{ fontSize: 13, fontWeight: 700, color: INK, cursor: "pointer" }}>
            Analyst view — full numbers by campaign
          </summary>
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={TH}>Campaign</th>
                  <th style={{ ...TH, textAlign: "right" }}>Cost</th>
                  <th style={{ ...TH, textAlign: "right" }}>Clicks</th>
                  <th style={{ ...TH, textAlign: "right" }}>CPC</th>
                  <th style={{ ...TH, textAlign: "right" }} title={DEFS.secondaryEvents.def}>2° events</th>
                  <th style={{ ...TH, textAlign: "right" }}>$ / event</th>
                  <th style={{ ...TH, textAlign: "right" }} title={DEFS.primaryActions.def}>1° actions</th>
                  <th style={{ ...TH, textAlign: "right" }}>$ / action</th>
                  <th style={{ ...TH, textAlign: "right" }} title={DEFS.imprShare.def}>Impr. share</th>
                  <th style={{ ...TH, textAlign: "right" }} title={DEFS.topLostRank.def}>Top lost (rank)</th>
                </tr>
              </thead>
              <tbody>
                {camps.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                    <td style={{ ...TD, fontWeight: 700 }}>{c.name}</td>
                    <td style={TDR}>{money(c.cost)}</td>
                    <td style={TDR}>{c.clicks}</td>
                    <td style={TDR}>{c.cpc !== null ? money2(c.cpc) : "—"}</td>
                    <td style={TDR}>{c.secondary || "—"}</td>
                    <td style={TDR}>{c.cpSignal !== null ? money2(c.cpSignal) : "—"}</td>
                    <td style={{ ...TDR, fontWeight: 700 }}>{c.primary || "—"}</td>
                    <td style={TDR}>{c.cpAction !== null ? money(c.cpAction) : "—"}</td>
                    <td style={TDR}>{isPct(c.is)}</td>
                    <td style={TDR}>{isPct(c.rankLost)}</td>
                  </tr>
                ))}
                {stats && (
                  <tr style={{ borderTop: "2px solid var(--color-gray-200)", color: MUTED }}>
                    <td style={{ ...TD, color: MUTED }}>Account</td>
                    <td style={TDR}>{money(tot.cost)}</td>
                    <td style={TDR}>{tot.clicks}</td>
                    <td style={TDR}>{acctCpc !== null ? money2(acctCpc) : "—"}</td>
                    <td style={TDR}>{tot.secondary}</td>
                    <td style={TDR}>{tot.secondary > 0 ? money2(tot.cost / tot.secondary) : "—"}</td>
                    <td style={TDR}>{tot.primary}</td>
                    <td style={TDR}>{tot.primary > 0 ? money(tot.cost / tot.primary) : "—"}</td>
                    <td style={TDR} colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
            <div style={{ ...SUBTLE, marginTop: 8 }}>
              2° = secondary conversion events (site behavior Google ties to ad clicks). 1° = primary conversion
              actions (forms + 90s+ calls). Small samples throughout — direction, not gospel.
            </div>
          </div>
        </details>

        {/* Methodology drawer */}
        <details style={{ ...CARD, marginBottom: 12 }}>
          <summary style={{ fontSize: 13, fontWeight: 700, color: INK, cursor: "pointer" }}>
            Methodology &amp; definitions
          </summary>
          <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#1a1a1a", marginTop: 10 }}>
            <strong>Secondary events ≠ people.</strong> Google counts events; one visitor can fire several, and a form
            can be submitted without any preceding research event — which is why engagement sits beside the spine, not
            inside it.
            <br />
            <strong>Primary actions ≠ unique leads.</strong> Forms and 90s+ calls are counted separately by Google and
            not deduplicated; a 90-second call is a lead proxy until validated as serviceable. The site-side
            &ldquo;paid lead records&rdquo; stage counts our own DB rows (also not cross-channel deduplicated yet).
            <br />
            <strong>Impression-share denominators differ.</strong> Overall impression share is measured against ALL
            eligible impressions; &ldquo;top lost (rank)&rdquo; against top-of-page eligible impressions only — the two
            can legitimately sum past 100%.
            <br />
            <strong>Windows.</strong> Ads numbers cover {stats ? `${stats.since} → ${stats.until}` : "the post-fix window"}
            {" "}(latest day partial; weekends dark by schedule). First-party behavior since {fmtDay(BEHAVIOR_START)};
            price-checker success logging since {fmtDay(RPC_LOG_START)}; booking joins maturing. Numbers from different
            windows are never summed together.
            {stats && stats.conversionActions.length > 0 && (
              <>
                <br />
                <strong>Conversion actions observed:</strong>{" "}
                {stats.conversionActions.map((a) => `${a.actionName} (${a.allConversions.toFixed(0)})`).join(" · ")}
              </>
            )}

            <div style={{ fontWeight: 800, color: INK, margin: "14px 0 4px" }}>The campaigns, in plain English</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {Object.entries(CAMPAIGN_META).map(([id, m]) => (
                  <tr key={id} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                    <td style={{ ...TD, fontWeight: 700, whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {(ADS_CAMPAIGN_NAMES[id] ?? id).replace(" Español", " Espanol")}
                    </td>
                    <td style={{ ...TD, color: "#374151" }}>
                      {m.plain} <span style={{ color: MUTED }}>Typical searches: {m.examples}. Lands on: {m.lands}.</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ fontWeight: 800, color: INK, margin: "14px 0 4px" }}>Glossary</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {Object.values(DEFS).map((d) => (
                  <tr key={d.term} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                    <td style={{ ...TD, fontWeight: 700, whiteSpace: "nowrap", verticalAlign: "top" }}>{d.term}</td>
                    <td style={{ ...TD, color: "#374151" }}>{d.def}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ ...SUBTLE, marginTop: 8 }}>
              Dotted-underlined terms across the page show these definitions on hover; this drawer is the same list in
              one place (and the version that works on a phone).
            </div>
          </div>
        </details>

        {/* All-channels context */}
        <section style={{ ...CARD, marginBottom: 12, overflowX: "auto" }}>
          <h2 style={H2}>
            All channels{" "}
            <span style={{ ...SUBTLE, fontWeight: 400 }}>— {cohortLabel.toLowerCase()}, paid and unpaid together</span>
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 520, marginTop: 6 }}>
            <thead>
              <tr>
                <th style={TH}>Channel</th>
                <th style={{ ...TH, textAlign: "right" }}>Valid leads</th>
                <th style={{ ...TH, textAlign: "right" }}>Forms</th>
                <th style={{ ...TH, textAlign: "right" }}>Calls</th>
                <th style={{ ...TH, textAlign: "right" }}>Priced forms</th>
                <th style={{ ...TH, textAlign: "right" }}>Quoted value</th>
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
                  <td style={TDR}>{c.quoted > 0 ? money(c.quoted) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...SUBTLE, marginTop: 8 }}>
            Quoted value is the sum of instant estimates on priced forms — not revenue. Calls carry no form estimate by
            design.
          </div>
        </section>

        <PagesCard />
      </>
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
    // ── Lead demand (last 30 days) ──
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

    // ── Booked history (ProABD orders, Mar–now) — the C1 merge ──
    const median = (xs: number[]) => {
      if (xs.length === 0) return null;
      const s = [...xs].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };
    const hist = new Map<string, { booked: number; prices: number[]; ppms: number[] }>();
    for (const o of orders) {
      if (!o.originState || !o.destState) continue;
      const lane = o.originState + " → " + o.destState;
      const h = hist.get(lane) ?? { booked: 0, prices: [], ppms: [] };
      h.booked++;
      if (o.price > 0) {
        h.prices.push(o.price);
        const miles = roadMilesBetweenZips(o.originZip, o.destZip);
        if (miles !== null) h.ppms.push(o.price / miles);
      }
      hist.set(lane, h);
    }

    // Corridor landing pages that exist on the site today (src/app/[locale]/
    // corridors/*). Matched as unordered state pairs — a CA→TX page serves
    // TX→CA demand too.
    const CORRIDOR_PAIRS = new Set(
      ["CA|TX", "CA|FL", "CA|NY", "CA|GA", "CA|IL", "CA|NC", "CA|AK", "CA|HI", "NY|FL", "TX|FL"].flatMap(
        (p) => {
          const [a, b] = p.split("|");
          return [a + "|" + b, b + "|" + a];
        },
      ),
    );

    // Union of demand + history, ranked by current leads then booked depth.
    const laneKeys = new Set<string>([...laneAgg.keys(), ...hist.keys()]);
    interface LaneRow {
      lane: string;
      leads: number;
      quoted: number;
      booked: number;
      medPrice: number | null;
      medPpm: number | null;
      flags: { text: string; tone: "good" | "gap" | "info" }[];
    }
    const rows: LaneRow[] = [...laneKeys].map((lane) => {
      const a = laneAgg.get(lane) ?? { n: 0, priced: 0, sum: 0 };
      const h = hist.get(lane) ?? { booked: 0, prices: [], ppms: [] };
      return {
        lane,
        leads: a.n,
        quoted: a.sum,
        booked: h.booked,
        medPrice: median(h.prices),
        medPpm: median(h.ppms),
        flags: [],
      };
    });
    rows.sort((x, y) => y.leads - x.leads || y.booked - x.booked);
    const top = rows.slice(0, 18);

    // Verdict flags (the C3 "verdict line", folded into C1 as chips).
    const bestPpm = top
      .filter((r) => r.booked >= 3 && r.medPpm !== null)
      .reduce<LaneRow | null>((best, r) => (best === null || (r.medPpm ?? 0) > (best.medPpm ?? 0) ? r : best), null);
    for (const r of top) {
      const [o, d] = r.lane.split(" → ");
      const hasPage = CORRIDOR_PAIRS.has(o + "|" + d);
      if (r.booked >= 8 && (r.medPrice ?? 0) >= 1000) r.flags.push({ text: "Proven earner", tone: "good" });
      if (bestPpm !== null && r.lane === bestPpm.lane) r.flags.push({ text: "Best $/mi", tone: "good" });
      if (hasPage) r.flags.push({ text: "Corridor page ✓", tone: "info" });
      else if (o !== d && (r.booked >= 3 || r.leads >= 3)) r.flags.push({ text: "No corridor page — gap", tone: "gap" });
      if (r.leads >= 3 && r.booked === 0) r.flags.push({ text: "New demand — no booked history", tone: "info" });
      if (r.booked >= 4 && r.leads === 0) r.flags.push({ text: "Books historically — no current leads", tone: "gap" });
    }

    const flagChip = (tone: "good" | "gap" | "info"): React.CSSProperties => ({
      display: "inline-block",
      fontSize: 10.5,
      fontWeight: 600,
      borderRadius: 999,
      padding: "1px 8px",
      marginRight: 4,
      marginBottom: 2,
      whiteSpace: "nowrap",
      color: tone === "good" ? "#065f46" : tone === "gap" ? "#92400e" : MUTED,
      background: tone === "good" ? "#ecfdf5" : tone === "gap" ? "#fffbeb" : "var(--color-gray-100)",
      border: `1px solid ${tone === "good" ? "#a7f3d0" : tone === "gap" ? "#fde68a" : "var(--color-gray-200)"}`,
    });

    const hasHistory = orders.length > 0;

    return (
      <>
        <div style={{ ...SUBTLE, marginBottom: 12 }}>
          <strong style={{ color: "#1a1a1a" }}>Lane activity · leads (last 30 days) merged with booked
          history (ProABD orders since Mar)</strong>{" "}
          — one row = the whole truth of a lane. Quoted is customer-facing quote value, not
          revenue; Median $ and $/mi are booked customer price (ZIP3-centroid road miles,
          ±~2% median). Local moves under ~25 mi are excluded from $/mi.
        </div>
        {!hasHistory && (
          <div style={ALERT}>
            Booked-history columns are empty because the <code>orders</code> collection has no
            data — run <code>scripts/import-orders.mjs</code> with the latest ProABD export.
          </div>
        )}
        <section style={{ ...CARD, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
            <thead>
              <tr>
                <th style={TH}>Lane</th>
                <th style={{ ...TH, textAlign: "right" }}>Leads 30d</th>
                <th style={{ ...TH, textAlign: "right" }}>Quoted</th>
                <th style={{ ...TH, textAlign: "right", color: GREEN }}>Booked</th>
                <th style={{ ...TH, textAlign: "right", color: GREEN }}>Median $</th>
                <th style={{ ...TH, textAlign: "right", color: GREEN }}>$/mi</th>
                <th style={TH}>Signals</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.lane} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>{r.lane}</td>
                  <td style={{ ...TDR, fontWeight: 800, color: r.leads > 0 ? INK : MUTED }}>
                    {r.leads || "—"}
                  </td>
                  <td style={TDR}>{r.quoted > 0 ? money(r.quoted) : "—"}</td>
                  <td style={{ ...TDR, fontWeight: 700, color: r.booked > 0 ? "#065f46" : MUTED }}>
                    {r.booked || "—"}
                  </td>
                  <td style={TDR}>{r.medPrice !== null ? money(r.medPrice) : "—"}</td>
                  <td style={TDR}>
                    {r.medPpm !== null ? "$" + r.medPpm.toFixed(2) : "—"}
                  </td>
                  <td style={{ ...TD, minWidth: 150 }}>
                    {r.flags.length > 0
                      ? r.flags.map((f) => (
                          <span key={f.text} style={flagChip(f.tone)}>
                            {f.text}
                          </span>
                        ))
                      : null}
                  </td>
                </tr>
              ))}
              {top.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...TD, color: MUTED }}>
                    No routed leads or booked history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ ...SUBTLE, marginTop: 10 }}>
            Top {top.length} lanes by current lead volume, then booked depth. Small samples
            everywhere — read medians as direction, not gospel. Corridor-page flags reflect
            pages live on the site today.
          </div>
        </section>
      </>
    );
  }

  function Behavior() {
    /* ── Behavior — what visitors do before raising a hand ──
     * Rebuilt 2026-07-28 to the shared grammar (metric-contract.md):
     * pills → narrative verdict → decision tiles (rule-gated) → nested
     * funnel → research diagnostics (parallel, §7.4) → landing pages →
     * per-campaign lens (P1) → analyst + methodology drawers.
     * Computations preserved from the Jul 22 build; presentation reordered.
     */

    // ── Sessionize (P0) ──
    interface Sess {
      vid: string;
      locale: "es" | "en";
      day: string;
      pages: string[];
      formStarted: boolean;
      estPrices: number[];
      campaignId: string | null; // P1 lens — first attr seen in session
    }
    const norm = (p: string) => {
      const n = p.replace(/^\/es(?=\/|$)/, "");
      return n === "" ? "/" : n;
    };
    const isQuotePath = (p: string) => norm(p).startsWith("/quote");
    const dayOf = (d: Date | null) =>
      d ? d.toLocaleDateString("en-CA", { timeZone: PT }) : "?";
    const sessions = new Map<string, Sess>();
    for (const e of siteEvents) {
      if (!e.vid) continue;
      const key = e.sid ?? e.vid + "|" + dayOf(e.at);
      const sess =
        sessions.get(key) ??
        ({ vid: e.vid, locale: e.locale, day: dayOf(e.at), pages: [], formStarted: false, estPrices: [], campaignId: null } as Sess);
      if (e.type === "page_view") sess.pages.push(e.path);
      else if (e.type === "form_started") sess.formStarted = true;
      else if (e.type === "estimate_shown" && e.price !== null) sess.estPrices.push(e.price);
      if (sess.campaignId === null && e.campaignId !== null) sess.campaignId = e.campaignId;
      sessions.set(key, sess);
    }
    const sessList = [...sessions.values()].filter((x) => x.pages.length > 0 || x.formStarted);
    const convertedVids = new Set(all.filter((r) => r.visitorId).map((r) => r.visitorId as string));

    // ── Funnel (nested session stages — law 3) ──
    const totalSess = sessList.length;
    const quoteSess = sessList.filter((x) => x.pages.some(isQuotePath) || x.formStarted).length;
    const startedSess = sessList.filter((x) => x.formStarted).length;
    // Converted = distinct VISITORS (cross-session join by design) — shown
    // beside the funnel, never as a nested bar: a visitor can start the
    // form in one session and submit in another.
    const convVisitors = new Set(
      sessList.filter((x) => convertedVids.has(x.vid)).map((x) => x.vid),
    ).size;

    // ── Locale split for the ES rule ──
    const esSess = sessList.filter((x) => x.locale === "es");
    const enSess = sessList.filter((x) => x.locale !== "es");
    const convRate = (xs: Sess[]) => {
      const vids = new Set(xs.map((x) => x.vid));
      let conv = 0;
      for (const v of vids) if (convertedVids.has(v)) conv++;
      return vids.size > 0 ? conv / vids.size : null;
    };
    const esRate = convRate(esSess);
    const enRate = convRate(enSess);

    // ── Research diagnostics (parallel evidence — contract §7.4) ──
    const estEvents = siteEvents.filter((e) => e.type === "estimate_shown");
    const estVids = new Set(estEvents.map((e) => e.vid)).size;
    const anchors = estEvents
      .map((e) => e.price)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    const anchorMedian = anchors.length > 0 ? anchors[Math.floor(anchors.length / 2)] : null;
    const BANDS: Array<{ label: string; min: number; max: number }> = [
      { label: "under $750", min: 0, max: 750 },
      { label: "$750–1,099", min: 750, max: 1100 },
      { label: "$1,100–1,499", min: 1100, max: 1500 },
      { label: "$1,500+", min: 1500, max: Infinity },
    ];
    const bandRows = BANDS.map((b) => {
      const withEst = sessList.filter((x) => x.estPrices.some((v) => v >= b.min && v < b.max));
      return {
        label: b.label,
        n: withEst.length,
        proceeded: withEst.filter((x) => x.formStarted || convertedVids.has(x.vid)).length,
      };
    }).filter((r) => r.n > 0);
    const estSessCount = sessList.filter((x) => x.estPrices.length > 0).length;

    // ── Landing pages ──
    const landings = new Map<string, { n: number; quote: number; convVids: Set<string> }>();
    for (const x of sessList) {
      if (x.pages.length === 0) continue;
      const lp = norm(x.pages[0]);
      const l = landings.get(lp) ?? { n: 0, quote: 0, convVids: new Set<string>() };
      l.n++;
      if (x.pages.some(isQuotePath)) l.quote++;
      if (convertedVids.has(x.vid)) l.convVids.add(x.vid);
      landings.set(lp, l);
    }
    const landingList = [...landings.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 15);

    // ── Per-campaign lens (P1 — accruing since the Jul 28 UTM capture) ──
    const byCampaign = new Map<string, { sess: number; est: number; started: number; convVids: Set<string> }>();
    for (const x of sessList) {
      if (x.campaignId === null) continue;
      const c = byCampaign.get(x.campaignId) ?? { sess: 0, est: 0, started: 0, convVids: new Set<string>() };
      c.sess++;
      if (x.estPrices.length > 0) c.est++;
      if (x.formStarted) c.started++;
      if (convertedVids.has(x.vid)) c.convVids.add(x.vid);
      byCampaign.set(x.campaignId, c);
    }
    const campaignRows = [...byCampaign.entries()].sort((a, b) => b[1].sess - a[1].sess);
    const capByCampaign = new Map<string, number>();
    for (const cp of captures) {
      if (cp.campaignId === null) continue;
      capByCampaign.set(cp.campaignId, (capByCampaign.get(cp.campaignId) ?? 0) + 1);
    }

    // ── Analyst-drawer aggregates (kept, demoted) ──
    const byDay = new Map<string, { n: number; es: number }>();
    for (const x of sessList) {
      const d = byDay.get(x.day) ?? { n: 0, es: 0 };
      d.n++;
      if (x.locale === "es") d.es++;
      byDay.set(x.day, d);
    }
    const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 14);
    const before = new Map<string, number>();
    for (const x of sessList) {
      const idx = x.pages.findIndex(isQuotePath);
      if (idx > 0) {
        const prev = norm(x.pages[idx - 1]);
        before.set(prev, (before.get(prev) ?? 0) + 1);
      }
    }
    const beforeList = [...before.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const ttcLeads = all.filter((r) => r.firstTouchAt !== null && !r.isCall);
    const TTC_BUCKETS = [
      { label: "Same visit (<30 min)", maxMs: 30 * 60_000 },
      { label: "Same day", maxMs: 86_400_000 },
      { label: "1–3 days", maxMs: 3 * 86_400_000 },
      { label: "3–7 days", maxMs: 7 * 86_400_000 },
      { label: "Over a week", maxMs: Infinity },
    ];
    const ttcCounts = TTC_BUCKETS.map((bkt, i) => ({
      label: bkt.label,
      n: ttcLeads.filter((r) => {
        const ms = Math.max(0, r.t.getTime() - (r.firstTouchAt as Date).getTime());
        const lo = i === 0 ? 0 : TTC_BUCKETS[i - 1].maxMs;
        return ms >= lo && ms < bkt.maxMs;
      }).length,
    }));

    /* ── Decision rules (threshold-gated; stateless — contract §7.5) ── */
    const decisions: { title: string; meta: string; body: string }[] = [];
    // ES funnel rule: needs a real ES sample before it may speak.
    if (esSess.length >= 30 && esRate !== null && enRate !== null && enRate > 0 && esRate < 0.5 * enRate) {
      decisions.push({
        title: "ES quote funnel converts at under half the EN rate",
        meta: `impact: ~${Math.max(1, Math.round(esSess.length * (enRate - esRate)))} leads/period · confidence: ${esSess.length >= 80 ? "med" : "low"} (n=${esSess.length} ES sessions) · owner: Eddie`,
        body: "Review ES form copy and the S5 landing path before adding S5 budget.",
      });
    }
    // High-band abandonment rule: $1,500+ proceeds at <half the under-$750 rate.
    const bandLow = bandRows.find((b) => b.label === "under $750");
    const bandHigh = bandRows.find((b) => b.label === "$1,500+");
    if (
      bandLow && bandHigh && bandHigh.n >= 8 && bandLow.n >= 8 && bandLow.proceeded > 0 &&
      bandHigh.proceeded / bandHigh.n < 0.5 * (bandLow.proceeded / bandLow.n)
    ) {
      decisions.push({
        title: "High-price estimates lose visitors at twice the low-band rate",
        meta: `impact: ${bandHigh.n - bandHigh.proceeded} abandoned high-value sessions · confidence: low-med · owner: Eddie`,
        body: "Flat-fee v1 lowered heavy-deal quotes on Jul 28 — watch whether this band's proceed rate moves; if not, the price isn't the objection.",
      });
    }

    const pill: React.CSSProperties = {
      display: "inline-block",
      fontSize: 11,
      border: "1px solid var(--color-gray-200)",
      background: "var(--color-surface)",
      borderRadius: 999,
      padding: "4px 11px",
      color: MUTED,
      marginRight: 6,
      marginBottom: 6,
    };
    const pillB: React.CSSProperties = { color: "#1a1a1a", fontWeight: 700 };

    if (siteEvents.length === 0) {
      return (
        <section style={CARD}>
          <h2 style={H2}>On-site behavior</h2>
          <div style={SUBTLE}>
            Collecting — first-party event capture went live Jul 22. This view populates as
            visitors arrive. (No GA involved: events flow from the site to our own database.)
          </div>
        </section>
      );
    }

    const funnelBar = (label: string, n: number, denomLabel: string | null, width: number) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "7px 0" }}>
        <div style={{ width: 130, fontSize: 11.5, fontWeight: 600, color: INK, textAlign: "right" }}>{label}</div>
        <div style={{ flex: 1, background: "var(--color-gray-100)", borderRadius: 5, height: 20, position: "relative" }}>
          <div
            style={{
              width: `${Math.max(width, 0.5)}%`,
              height: "100%",
              background: GREEN,
              borderRadius: 5,
            }}
          />
          <span
            style={{
              position: "absolute",
              left: width > 12 ? undefined : `calc(${Math.max(width, 0.5)}% + 7px)`,
              right: width > 12 ? `calc(${100 - width}% + 7px)` : undefined,
              top: 2,
              fontSize: 11,
              fontWeight: 800,
              color: width > 12 ? "#fff" : INK,
            }}
          >
            {n}
          </span>
        </div>
        <div style={{ width: 130, fontSize: 10.5, color: MUTED }}>{denomLabel ?? "—"}</div>
      </div>
    );

    return (
      <>
        {/* pills */}
        <div style={{ marginBottom: 10 }}>
          <span style={pill}>Window: <span style={pillB}>last 14 days</span> · capture began {fmtDay(BEHAVIOR_START)}</span>
          <span style={pill}>Population: <span style={pillB}>all sessions</span> · bot-filtered · 30-min windows</span>
          <span style={pill}>Per-campaign lens: <span style={pillB}>accruing since {fmtDay(new Date("2026-07-28T20:00:00Z"))}</span></span>
        </div>

        {/* narrative verdict */}
        <section style={{ ...CARD, marginBottom: 12, borderLeft: `4px solid ${GREEN}` }}>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "#1a1a1a" }}>
            <strong>
              {totalSess} sessions · {quoteSess} reached the quote page · {startedSess} started the
              form · {convVisitors} distinct visitors converted
            </strong>{" "}
            ({pct(convVisitors, totalSess)} of sessions — cross-session join, see funnel note). Research
            tools fired <strong>{estEvents.length} <Term k="secondaryEvents">estimate events</Term> from {estVids} unique visitors</strong>
            {anchorMedian !== null ? ` (median price shown ${money(anchorMedian)})` : ""}.{" "}
            {esSess.length >= 30 && esRate !== null && enRate !== null ? (
              <>Spanish sessions convert at {pct(Math.round((esRate ?? 0) * 1000), 1000)} vs {pct(Math.round((enRate ?? 0) * 1000), 1000)} for English.</>
            ) : (
              <>ES sample still too small to compare conversion rates honestly (n={esSess.length} sessions; rule arms at 30).</>
            )}
          </div>
        </section>

        {/* decision tiles */}
        {decisions.map((d) => (
          <div
            key={d.title}
            style={{
              border: "1px solid var(--color-gray-200)",
              borderLeft: "4px solid #d97706",
              borderRadius: 10,
              background: "var(--color-surface)",
              padding: "11px 13px",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: INK }}>{d.title}</span>
              <span style={{ fontSize: 10.5, color: MUTED }}>{d.meta}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#374151", lineHeight: 1.5, marginTop: 3 }}>{d.body}</div>
          </div>
        ))}

        {/* nested funnel */}
        <section style={{ ...CARD, marginBottom: 12 }}>
          <h2 style={H2}>
            The quote funnel{" "}
            <span style={{ ...SUBTLE, fontWeight: 400 }}>— nested: same sessions at every stage</span>
          </h2>
          <div style={{ marginTop: 6 }}>
            {funnelBar("Sessions", totalSess, null, 100)}
            {funnelBar("Reached /quote", quoteSess, pct(quoteSess, totalSess) + " of sessions", totalSess > 0 ? (quoteSess / totalSess) * 100 : 0)}
            {funnelBar("Form started", startedSess, pct(startedSess, quoteSess) + " of quote-reachers", totalSess > 0 ? (startedSess / totalSess) * 100 : 0)}
          </div>
          <div style={{ ...SUBTLE, marginTop: 8 }}>
            <strong style={{ color: INK }}>{convVisitors} distinct visitors converted</strong> — kept
            beside the funnel, not in it: a visitor can start the form in one session and submit in
            another, so conversion is a visitor-level join, not a nested session stage.
          </div>
        </section>

        {/* research diagnostics — parallel */}
        <section style={{ ...CARD, marginBottom: 12, background: "#EDF5F0", borderColor: "#d5e8dc" }}>
          <h2 style={H2}>
            Research diagnostics{" "}
            <span style={{ ...SUBTLE, fontWeight: 400 }}>— parallel evidence, not funnel stages (contract §7.4)</span>
          </h2>
          <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#1a1a1a" }}>
            <strong>{estEvents.length} estimate events · {estVids} unique visitors · {estSessCount} sessions</strong>
            {anchors.length > 0 && (
              <> · prices shown: median {money(anchorMedian ?? 0)} ({money(anchors[0])}–{money(anchors[anchors.length - 1])})</>
            )}
            {rpcOk + rpcUnsupported + rpcError > 0 && (
              <>
                {" "}· route-checker since {fmtDay(RPC_LOG_START)}: {rpcOk} priced · {rpcUnsupported} unserviceable
                route{rpcUnsupported === 1 ? "" : "s"}{rpcError > 0 ? ` · ${rpcError} pricing errors` : ""}
              </>
            )}
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#1a1a1a", marginTop: 4 }}>
            <strong>Captured estimates: {captures.length}</strong>
            {estSessCount > 0 && captures.length > 0 && (
              <> · {pct(captures.length, estSessCount)} of estimate-shown sessions left an email</>
            )}
            {captures.length === 0 && <> — accruing since the Jul 29 capture-row deploy</>}
            <span style={{ color: MUTED }}>
              {" "}· a capture is a contact, not a lead; capture→lead joins via email identity (P4)
            </span>
          </div>
          {bandRows.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, maxWidth: 480, marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={TH}>Price band shown</th>
                  <th style={{ ...TH, textAlign: "right" }}>Sessions</th>
                  <th style={{ ...TH, textAlign: "right" }}>Proceeded</th>
                </tr>
              </thead>
              <tbody>
                {bandRows.map((r) => (
                  <tr key={r.label} style={{ borderTop: "1px solid #d5e8dc" }}>
                    <td style={TD}>{r.label}</td>
                    <td style={TDR}>{r.n}</td>
                    <td style={TDR}>{pct(r.proceeded, r.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ ...SUBTLE, marginTop: 8 }}>
            &ldquo;Proceeded&rdquo; = started or submitted the quote form afterward. These become funnel
            stages only if proven unique + nested + predictive — the signal→lead instrument (live Jul 28)
            decides. Small samples: direction, not decimals.
          </div>
        </section>

        {/* landing pages */}
        <section style={{ ...CARD, marginBottom: 12, overflowX: "auto" }}>
          <h2 style={H2}>Where sessions land</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 520, marginTop: 4 }}>
            <thead>
              <tr>
                <th style={TH}>Landing page</th>
                <th style={{ ...TH, textAlign: "right" }}>Sessions</th>
                <th style={{ ...TH, textAlign: "right" }}>Reached quote</th>
                <th style={{ ...TH, textAlign: "right" }}>Converted</th>
              </tr>
            </thead>
            <tbody>
              {landingList.map(([path, l]) => (
                <tr key={path} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={{ ...TD, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{path}</td>
                  <td style={{ ...TDR, fontWeight: 700 }}>{l.n}</td>
                  <td style={TDR}>{l.quote > 0 ? pct(l.quote, l.n) : "—"}</td>
                  <td style={TDR}>{l.convVids.size > 0 ? pct(l.convVids.size, l.n) : "—"}</td>
                </tr>
              ))}
              {landingList.length === 0 && (
                <tr><td colSpan={4} style={{ ...TD, color: MUTED }}>No sessions with page views yet.</td></tr>
              )}
            </tbody>
          </table>
          <div style={{ ...SUBTLE, marginTop: 8 }}>
            EN and ES versions of a page are grouped. Every visitor, not just converters.
          </div>
        </section>

        {/* per-campaign lens */}
        <section style={{ ...CARD, marginBottom: 12, overflowX: "auto" }}>
          <h2 style={H2}>
            By campaign{" "}
            <span style={{ ...SUBTLE, fontWeight: 400 }}>— the lens session UTM capture unlocks (accruing)</span>
          </h2>
          {campaignRows.length > 0 ? (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 520, marginTop: 4 }}>
                <thead>
                  <tr>
                    <th style={TH}>Campaign</th>
                    <th style={{ ...TH, textAlign: "right" }}>Sessions</th>
                    <th style={{ ...TH, textAlign: "right" }}>Research sessions</th>
                    <th style={{ ...TH, textAlign: "right" }}>Form starts</th>
                    <th style={{ ...TH, textAlign: "right" }} title="Estimate emails captured — contacts, not leads">
                      Captures
                    </th>
                    <th style={{ ...TH, textAlign: "right" }}>Converted visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignRows.map(([id, c]) => (
                    <tr key={id} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                      <td style={{ ...TD, fontWeight: 700 }}>{ADS_CAMPAIGN_NAMES[id] ?? `campaign ${id}`}</td>
                      <td style={{ ...TDR, fontWeight: 700 }}>{c.sess}</td>
                      <td style={TDR}>{c.est || "—"}</td>
                      <td style={TDR}>{c.started || "—"}</td>
                      <td style={TDR}>{capByCampaign.get(id) || "—"}</td>
                      <td style={TDR}>{c.convVids.size || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ ...SUBTLE, marginTop: 8 }}>
                Research-session share per campaign is the signal→lead precursor — the number that
                settles the research feeder&rsquo;s budget once conversion columns fill.
              </div>
            </>
          ) : (
            <div style={{ ...SUBTLE, marginTop: 4 }}>
              No attributed sessions yet — capture deployed {fmtDay(new Date("2026-07-28T20:00:00Z"))}; fills within
              ~a week of paid traffic. Columns waiting: sessions · research sessions · form starts ·
              converted visitors · signal→lead rate per campaign.
            </div>
          )}
        </section>

        {/* analyst drawer */}
        <details style={{ ...CARD, marginBottom: 8 }}>
          <summary style={{ fontSize: 13, fontWeight: 700, color: INK, cursor: "pointer" }}>
            Analyst view — time to convert · path before quote · sessions per day
          </summary>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginTop: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 4 }}>Time to convert</div>
              {ttcLeads.length > 0 ? (
                <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                  <tbody>
                    {ttcCounts.map((r) => (
                      <tr key={r.label} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                        <td style={TD}>{r.label}</td>
                        <td style={{ ...TDR, fontWeight: 700, paddingLeft: 14 }}>{r.n || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={SUBTLE}>Fills as first-touch leads arrive.</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 4 }}>Page before /quote</div>
              {beforeList.length > 0 ? (
                <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                  <tbody>
                    {beforeList.map(([path, n]) => (
                      <tr key={path} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                        <td style={{ ...TD, fontFamily: "ui-monospace, monospace" }}>{path}</td>
                        <td style={{ ...TDR, fontWeight: 700, paddingLeft: 14 }}>{n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={SUBTLE}>No multi-page journeys into /quote yet.</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 4 }}>Sessions / day</div>
              <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  {days.map(([d, v]) => (
                    <tr key={d} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                      <td style={TD}>{d}</td>
                      <td style={{ ...TDR, fontWeight: 700, paddingLeft: 14 }}>{v.n}</td>
                      <td style={{ ...TDR, color: MUTED, paddingLeft: 10 }}>{v.es > 0 ? v.es + " ES" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>

        {/* methodology drawer */}
        <details style={{ ...CARD }}>
          <summary style={{ fontSize: 13, fontWeight: 700, color: INK, cursor: "pointer" }}>
            Methodology
          </summary>
          <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#1a1a1a", marginTop: 10 }}>
            <strong>Sessions</strong> = 30-minute activity windows per anonymous visitor (first-party
            cookie; no GA). <strong>Converted</strong> = a lead submitted by the same visitor ID —
            a cross-session, visitor-level join, deliberately excluded from the nested funnel.
            <strong> Research events ≠ people</strong>: one visitor can fire several; they stay in the
            diagnostics panel per metric-contract §7.4 until proven unique, nested, and predictive.
            <strong> Per-campaign lens</strong> = sessions whose landing URL carried our own UTM/gclid
            capture (live Jul 28) — includes non-converters, which the lead-doc join never could.
            Full definitions: metric-contract.md.
          </div>
        </details>
      </>
    );
  }

  function Business() {
    // B3 layout — "numbers | people": charts in a narrow left rail, one tall
    // working customer table with tabs + export on the right. This view's
    // real job is outreach: when snowbird season hits, this is the screen
    // Ginger works from.
    if (orders.length === 0) {
      return (
        <div style={ALERT}>
          The Business view needs the ProABD orders import — run{" "}
          <code>scripts/import-orders.mjs</code> with the latest export, then reload.
        </div>
      );
    }

    const monthKey = (d: Date) =>
      d.toLocaleDateString("en-CA", { timeZone: PT, year: "numeric", month: "2-digit" });
    const monthLabel = (d: Date) => d.toLocaleDateString("en-US", { timeZone: PT, month: "short" });

    // ── Left rail chart 1: fees / month ──
    const monthly = new Map<string, { label: string; fees: number }>();
    for (const o of orders) {
      if (!o.orderCreatedAt) continue;
      const k = monthKey(o.orderCreatedAt);
      const m = monthly.get(k) ?? { label: monthLabel(o.orderCreatedAt), fees: 0 };
      m.fees += o.deposit;
      monthly.set(k, m);
    }
    const months = [...monthly.keys()].sort().map((k) => ({ key: k, ...monthly.get(k)! }));
    const maxFees = Math.max(...months.map((m) => m.fees), 1);
    const currentKey = monthKey(now);

    // ── Left rail chart 2: $ / mile by distance band (booked price) ──
    const BANDS: { label: string; lo: number; hi: number }[] = [
      { label: "≤250", lo: 25, hi: 250 },
      { label: "250–500", lo: 250, hi: 500 },
      { label: "500–1K", lo: 500, hi: 1000 },
      { label: "1–1.5K", lo: 1000, hi: 1500 },
      { label: "1.5–2K", lo: 1500, hi: 2000 },
      { label: "2–2.5K", lo: 2000, hi: 2500 },
      { label: "2.5K+", lo: 2500, hi: Infinity },
    ];
    const bandPpms: number[][] = BANDS.map(() => []);
    for (const o of orders) {
      if (o.price <= 0) continue;
      const miles = roadMilesBetweenZips(o.originZip, o.destZip);
      if (miles === null) continue;
      const idx = BANDS.findIndex((b) => miles > b.lo && miles <= b.hi);
      if (idx >= 0) bandPpms[idx].push(o.price / miles);
    }
    const medianOf = (xs: number[]) => {
      if (xs.length === 0) return null;
      const s = [...xs].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };
    const bands = BANDS.map((b, i) => ({ ...b, ppm: medianOf(bandPpms[i]), n: bandPpms[i].length }));
    const maxPpm = Math.max(...bands.map((b) => b.ppm ?? 0), 0.01);

    // ── Right: tabbed customer table ──
    const rows = tabRows(orders, bizTab);
    const counts: Record<BusinessTab, number> = {
      repeats: tabRows(orders, "repeats").length,
      snowbirds: tabRows(orders, "snowbirds").length,
      b2b: tabRows(orders, "b2b").length,
    };
    const fmtLast = (d: Date | null) =>
      d ? d.toLocaleDateString("en-US", { timeZone: PT, month: "short", day: "numeric" }) : "—";
    const STRIPE = `repeating-linear-gradient(135deg, ${GREEN} 0 4px, #6FCB8A 4px 8px)`;

    return (
      <>
        <div style={{ ...SUBTLE, marginBottom: 12 }}>
          <strong style={{ color: "#1a1a1a" }}>The book as a business · ProABD orders since Mar</strong>{" "}
          — fees are booking deposits (Auto Line revenue). Repeats = ≥2 orders on one email.
          Snowbird targets left FL/AZ in spring — the October outreach list ({snowbirdOrderCount(orders)}{" "}
          qualifying orders across {counts.snowbirds} customers). B2B = company/org mailbox or
          business name. Contact PII is here on purpose — this screen is an outreach tool.
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* ── Left rail ── */}
          <div style={{ flex: "0 0 218px", display: "flex", flexDirection: "column", gap: 12 }}>
            <section style={CARD}>
              <h2 style={H2}>Fees / mo</h2>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, marginTop: 8 }}>
                {months.map((m) => (
                  <div
                    key={m.key}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}
                    title={`${m.label} — $${m.fees.toLocaleString("en-US")}`}
                  >
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 26,
                        height: Math.max(3, Math.round((m.fees / maxFees) * 56)),
                        background: m.key === currentKey ? STRIPE : GREEN,
                        borderRadius: "3px 3px 0 0",
                      }}
                    />
                    <div style={{ fontSize: 9.5, color: MUTED, marginTop: 3 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={CARD}>
              <h2 style={H2}>$ / mile by distance</h2>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                {bands.map((b) => (
                  <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }} title={`${b.label} mi — n=${b.n}`}>
                    <div style={{ fontSize: 10, color: MUTED, width: 48, textAlign: "right", whiteSpace: "nowrap" }}>{b.label}</div>
                    <div style={{ flex: 1, background: "var(--color-gray-100)", borderRadius: 3, height: 10 }}>
                      {b.ppm !== null && (
                        <div
                          style={{
                            width: `${Math.round((b.ppm / maxPpm) * 100)}%`,
                            height: "100%",
                            background: GREEN,
                            borderRadius: 3,
                          }}
                        />
                      )}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: INK, width: 38 }}>
                      {b.ppm !== null ? "$" + b.ppm.toFixed(2) : "—"}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginTop: 8 }}>
                Median booked price per road mile (ZIP3 estimate). Short moves price steep;
                mid-long routes flatten — the forward-pricing opportunity.
              </div>
            </section>
          </div>

          {/* ── Right: working customer table ── */}
          <section style={{ ...CARD, flex: "1 1 420px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {BIZ_TABS.map((t) => (
                <a
                  key={t.id}
                  href={`/admin?view=business&tab=${t.id}`}
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    textDecoration: "none",
                    padding: "4px 12px",
                    borderRadius: 999,
                    color: bizTab === t.id ? "#fff" : INK,
                    background: bizTab === t.id ? GREEN : "var(--color-gray-100)",
                  }}
                >
                  {counts[t.id]} {t.label}
                </a>
              ))}
              <a
                href={`/admin/export?tab=${bizTab}`}
                style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: GREEN, textDecoration: "none" }}
              >
                Export CSV ↓
              </a>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
                <thead>
                  <tr>
                    <th style={TH}>Customer</th>
                    {bizTab === "b2b" && <th style={TH}>Signal</th>}
                    <th style={TH}>Contact</th>
                    {bizTab === "snowbirds" ? (
                      <>
                        <th style={TH}>Route</th>
                        <th style={{ ...TH, textAlign: "right" }}>Paid</th>
                      </>
                    ) : (
                      <>
                        <th style={{ ...TH, textAlign: "right" }}>Orders</th>
                        <th style={{ ...TH, textAlign: "right" }}>Fees</th>
                      </>
                    )}
                    <th style={TH}>Last</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.email || c.name} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                      <td style={{ ...TD, fontWeight: 700, whiteSpace: "nowrap" }}>{c.name}</td>
                      {bizTab === "b2b" && (
                        <td style={{ ...TD, color: MUTED, whiteSpace: "nowrap" }}>{c.bizSignal}</td>
                      )}
                      <td style={{ ...TD, color: MUTED, fontSize: 11.5 }}>
                        {c.email}
                        {c.phone ? <> · {c.phone}</> : null}
                      </td>
                      {bizTab === "snowbirds" ? (
                        <>
                          <td style={{ ...TD, whiteSpace: "nowrap" }}>{c.route}</td>
                          <td style={{ ...TDR, fontWeight: 700 }}>{money(c.lastPaid)}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...TDR, fontWeight: 800, color: INK }}>{c.orders}</td>
                          <td style={{ ...TDR, fontWeight: 700 }}>{money(c.fees)}</td>
                        </>
                      )}
                      <td style={{ ...TD, color: MUTED, whiteSpace: "nowrap" }}>{fmtLast(c.lastOrderAt)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ ...TD, color: MUTED }}>
                        No customers match this tab yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
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
      <style>{ADMIN_TIP_CSS}</style>
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

      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          columnGap: 14,
          rowGap: 10,
          marginBottom: 16,
          alignItems: "flex-end",
        }}
      >
        {NAV_GROUPS.map((g) => (
          <div
            key={g.group || g.views[0].id}
            style={{ display: "flex", flexDirection: "column", gap: 3 }}
          >
            {g.group !== "" && (
              <a
                className="navcap"
                href={viewHref(g.views[0].id)}
                title={`Jump to ${g.views[0].label}`}
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: MUTED,
                  textDecoration: "none",
                  paddingLeft: 6,
                }}
              >
                {g.group}
              </a>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              {g.views.map((v) => (
                <a
                  key={v.id}
                  href={viewHref(v.id)}
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
            </div>
          </div>
        ))}
        {/* Right-aligned report links — grouped so they wrap TOGETHER, not
            one-per-line, at narrow widths. */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <a
            href="/admin/analysis"
            style={{
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: 999,
              color: GREEN,
              border: `1px solid ${GREEN}`,
              whiteSpace: "nowrap",
            }}
          >
            Analysis →
          </a>
          <a
            href="/admin/changes"
            style={{
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: 999,
              color: GREEN,
              border: `1px solid ${GREEN}`,
              whiteSpace: "nowrap",
            }}
          >
            Work Log →
          </a>
          <a
            href="/admin/report"
            style={{
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: 999,
              color: GREEN,
              border: `1px solid ${GREEN}`,
              whiteSpace: "nowrap",
            }}
          >
            Monthly report →
          </a>
        </div>
      </nav>

      {loadError ? (
        <div style={{ ...CARD, borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>
          Could not load lead data: {loadError}
        </div>
      ) : (
        <>
          {/* Lead Pulse — always-on glance strip (spec: claude/lead-pulse-dashboard-spec.md) */}
          <LeadPulse />
          {view === "overview" && <Overview />}
          {view === "acquisition" && <Acquisition />}
          {view === "sales" && <Sales />}
          {view === "lanes" && <Lanes />}
          {view === "behavior" && <Behavior />}
          {view === "business" && <Business />}

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
