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
const CAMPAIGN_META: Record<string, CampaignMeta> = {
  "24034601745": {
    role: "research feeder",
    metric: "$ / signal · signal→lead rate (accruing)",
    plain: "People googling what shipping a car costs — early researchers, not ready to book.",
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
  { id: "behavior", label: "Behavior" },
  { id: "business", label: "Business" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

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
  // Window starts at the tracking fix, not PROABD_START: "paid attribution
  // eligible since Jul 20" is the honest cohort for every paid number shown.
  const ads: AdsResult = await fetchAdsStats(TRACKING_FIX_TS);

  // ProABD order history (Business Baseline card + Business view + lane
  // economics). Populated by scripts/import-orders.mjs (monthly re-run until
  // the webhook parser writes orders automatically). Full docs, not select():
  // the Business view needs contact + city/zip fields and the collection is
  // a few hundred docs.
  let orders: BizOrder[] = [];
  try {
    const oSnap = await getAdminDb().collection("orders").get();
    orders = oSnap.docs.map((doc) => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const d: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
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
  }
  let siteEvents: SiteEvent[] = [];
  try {
    const d14 = new Date(now.getTime() - 14 * 86_400_000);
    const sevSnap = await getAdminDb()
      .collection("site_events")
      .where("ts", ">=", d14)
      .select("vid", "sid", "type", "path", "locale", "ts", "meta.price")
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
      };
    });
    siteEvents.sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
  } catch {
    /* Behavior view renders its empty state */
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
    return (
      <>
        <div style={{ ...SUBTLE, marginBottom: 12 }}>
          <strong style={{ color: "#1a1a1a" }}>{cohortLabel}</strong> — website forms and tracked
          calls created since the ProABD integration went live; test and blocked-invalid
          submissions excluded (blocked demand reported separately below).
        </div>

        <BusinessBaselineCard />

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
      if (actionLeaders.length > 0 && c.id === actionLeaders[0].id)
        c.flags.push({ text: "Best $/action — validate serviceability", tone: "good" });
      else if (c.primary >= 3) c.flags.push({ text: "Promising — small n", tone: "good" });
      if (c.secondary >= 10 && c.secondary >= 10 * Math.max(1, c.primary))
        c.flags.push({ text: "Hold budget — downstream value unproven", tone: "gap" });
      if (acctCpc !== null && c.cpc !== null && c.clicks < 10 && c.cpc > 2 * acctCpc)
        c.flags.push({ text: "Rebuild relevance, then retest", tone: "gap" });
      else if (c.rankLost !== null && c.rankLost > 0.5)
        c.flags.push({ text: "Rank-limited — QS / relevance work", tone: "gap" });
      if (c.budgetLost !== null && c.budgetLost > 0.3)
        c.flags.push({ text: "Budget-limited — headroom exists", tone: "info" });
      if (c.role === "moat" && c.is !== null && c.is < 0.9)
        c.flags.push({ text: `Moat leaky — ~${Math.round((1 - c.is) * 100)}% of brand searches unserved`, tone: "gap" });
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
            <div style={stgName}><Term k="paidLeadRecords">Paid lead records (site)</Term></div>
            <div style={{ fontSize: 24, fontWeight: 800, color: INK }}>{paidLeadRecords}</div>
            <div style={{ fontSize: 11.5, color: GREEN, fontWeight: 700 }}>
              {paidLeadRecords > 0 ? money(tot.cost / paidLeadRecords) + " / record" : ""}
            </div>
            <div style={stgNote}>
              our own DB, paid proof since {fmtDay(TRACKING_FIX_TS)} · forms + tracked calls; cross-channel dedup pending
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


  function Behavior() {
    // ── Sessionize ──
    interface Sess {
      vid: string;
      locale: "es" | "en";
      day: string;
      pages: string[];
      formStarted: boolean;
      estPrices: number[];
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
        ({ vid: e.vid, locale: e.locale, day: dayOf(e.at), pages: [], formStarted: false, estPrices: [] } as Sess);
      if (e.type === "page_view") sess.pages.push(e.path);
      else if (e.type === "form_started") sess.formStarted = true;
      else if (e.type === "estimate_shown" && e.price !== null) sess.estPrices.push(e.price);
      sessions.set(key, sess);
    }
    const sessList = [...sessions.values()].filter((x) => x.pages.length > 0 || x.formStarted);
    const convertedVids = new Set(all.filter((r) => r.visitorId).map((r) => r.visitorId as string));

    // ── Aggregates ──
    const byDay = new Map<string, { n: number; es: number }>();
    for (const x of sessList) {
      const d = byDay.get(x.day) ?? { n: 0, es: 0 };
      d.n++;
      if (x.locale === "es") d.es++;
      byDay.set(x.day, d);
    }
    const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 14);

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

    const totalSess = sessList.length;
    const quoteSess = sessList.filter((x) => x.pages.some(isQuotePath) || x.formStarted).length;
    const startedSess = sessList.filter((x) => x.formStarted).length;
    // Distinct visitors (2026-07-22 review): counting sessions here inflated
    // conversions — a converted visitor's every return visit counted again.
    const convVisitors = new Set(
      sessList.filter((x) => convertedVids.has(x.vid)).map((x) => x.vid),
    ).size;

    // Price bands from estimate_shown (route checker), with what happened next.
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

    // Page-before-quote.
    const before = new Map<string, number>();
    for (const x of sessList) {
      const idx = x.pages.findIndex(isQuotePath);
      if (idx > 0) {
        const prev = norm(x.pages[idx - 1]);
        before.set(prev, (before.get(prev) ?? 0) + 1);
      }
    }
    const beforeList = [...before.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Time-to-convert from lead docs (firstTouchAt capture began Jul 22 PM).
    const ttcLeads = all.filter((r) => r.firstTouchAt !== null && !r.isCall);
    const TTC_BUCKETS = [
      { label: "Same visit (<30 min)", maxMs: 30 * 60_000 },
      { label: "Same day", maxMs: 86_400_000 },
      { label: "1–3 days", maxMs: 3 * 86_400_000 },
      { label: "3–7 days", maxMs: 7 * 86_400_000 },
      { label: "Over a week", maxMs: Infinity },
    ];
    // Buckets partition [0, ∞): clamp negatives (client clock skew) to 0
    // so every lead lands in exactly one bucket (2026-07-22 review).
    const ttcCounts = TTC_BUCKETS.map((bkt, i) => ({
      label: bkt.label,
      n: ttcLeads.filter((r) => {
        const ms = Math.max(0, r.t.getTime() - (r.firstTouchAt as Date).getTime());
        const lo = i === 0 ? 0 : TTC_BUCKETS[i - 1].maxMs;
        return ms >= lo && ms < bkt.maxMs;
      }).length,
    }));

    if (siteEvents.length === 0) {
      return (
        <section style={CARD}>
          <h2 style={H2}>On-site behavior</h2>
          <div style={SUBTLE}>
            Collecting — first-party event capture went live Jul 22. This view populates as
            visitors arrive; check back in a day or two. (No GA involved: events flow from the
            site to our own database.)
          </div>
        </section>
      );
    }

    return (
      <>
        <div style={{ ...SUBTLE, marginBottom: 12 }}>
          <strong style={{ color: "#1a1a1a" }}>Last 14 days of first-party sessions</strong> —
          capture began Jul 22, so early numbers are partial by construction. Anonymous visitor
          IDs; conversion = a lead submitted by the same visitor.
        </div>

        <section style={{ ...CARD, marginBottom: 12 }}>
          <h2 style={H2}>Quote funnel (sessions)</h2>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 4 }}>
            <div><div style={{ fontSize: 22, fontWeight: 800, color: INK }}>{totalSess}</div><div style={SUBTLE}>Sessions</div></div>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>{quoteSess}</div><div style={SUBTLE}>Reached quote page</div></div>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>{startedSess}</div><div style={SUBTLE}>Started the form</div></div>
            <div><div style={{ fontSize: 22, fontWeight: 800, color: INK }}>{convVisitors}</div><div style={SUBTLE}>Converted (distinct visitors)</div></div>
          </div>
          <div style={{ ...SUBTLE, marginTop: 10 }}>
            Drop-off reads left to right. Sessions = 30-minute activity windows per anonymous
            visitor.
          </div>
        </section>

        <section style={{ ...CARD, marginBottom: 12, overflowX: "auto" }}>
          <h2 style={H2}>Landing pages — all visitors</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 520 }}>
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
            EN and ES versions of a page are grouped (locale split below). This is every visitor,
            not just converters — the denominator the lead-pages table was missing.
          </div>
        </section>

        {bandRows.length > 0 && (
          <section style={{ ...CARD, marginBottom: 12 }}>
            <h2 style={H2}>Price shown vs. what happened next</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, maxWidth: 480 }}>
              <thead>
                <tr>
                  <th style={TH}>Price band (route checker)</th>
                  <th style={{ ...TH, textAlign: "right" }}>Sessions shown</th>
                  <th style={{ ...TH, textAlign: "right" }}>Proceeded</th>
                </tr>
              </thead>
              <tbody>
                {bandRows.map((r) => (
                  <tr key={r.label} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                    <td style={TD}>{r.label}</td>
                    <td style={TDR}>{r.n}</td>
                    <td style={TDR}>{pct(r.proceeded, r.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ ...SUBTLE, marginTop: 8 }}>
              {estSessCount} session{estSessCount === 1 ? "" : "s"} saw a live price pre-submit.
              “Proceeded” = started or submitted the quote form afterward. Small samples: read
              direction, not decimals.
            </div>
          </section>
        )}

        <section style={{ ...CARD, marginBottom: 12 }}>
          <h2 style={H2}>Time to convert (leads with first-touch data)</h2>
          {ttcLeads.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, maxWidth: 420 }}>
              <tbody>
                {ttcCounts.map((r) => (
                  <tr key={r.label} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                    <td style={TD}>{r.label}</td>
                    <td style={{ ...TDR, fontWeight: 700 }}>{r.n || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={SUBTLE}>
              First-touch timestamps began Jul 22 — this fills as new leads arrive.
            </div>
          )}
        </section>

        <section style={{ ...CARD, marginBottom: 12 }}>
          <h2 style={H2}>Page visited right before the quote page</h2>
          {beforeList.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, maxWidth: 480 }}>
              <tbody>
                {beforeList.map(([path, n]) => (
                  <tr key={path} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                    <td style={{ ...TD, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{path}</td>
                    <td style={{ ...TDR, fontWeight: 700 }}>{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={SUBTLE}>No multi-page journeys into the quote page recorded yet.</div>
          )}
        </section>

        <section style={{ ...CARD, marginBottom: 12 }}>
          <h2 style={H2}>Sessions per day</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, maxWidth: 380 }}>
            <tbody>
              {days.map(([d, v]) => (
                <tr key={d} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                  <td style={TD}>{d}</td>
                  <td style={{ ...TDR, fontWeight: 700 }}>{v.n}</td>
                  <td style={{ ...TDR, color: MUTED }}>{v.es > 0 ? v.es + " ES" : "—"}</td>
                </tr>
              ))}
              {days.length === 0 && (
                <tr><td colSpan={3} style={{ ...TD, color: MUTED }}>No sessions recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>
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

      <nav style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16, alignItems: "center" }}>
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
        <a
          href="/admin/report"
          style={{
            marginLeft: "auto",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            padding: "6px 12px",
            borderRadius: 999,
            color: GREEN,
            border: `1px solid ${GREEN}`,
          }}
        >
          Monthly report →
        </a>
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
