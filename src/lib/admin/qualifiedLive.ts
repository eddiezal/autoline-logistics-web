/**
 * Live loader for the /admin qualified-lead panel — I/O wrapper around the
 * shared pure module (src/lib/admin/qualifiedCensus.mjs).
 *
 * Three sources, each failing independently (degraded is shown as degraded,
 * never as zero — the 8/7 false-zero lesson):
 *   1. Firestore: proabd_webhook_events (first priced event per record) and
 *      leads (gclid + campaign join, form denominator). The same census the
 *      nightly upload script reads.
 *   2. Google Ads: spend by day x campaign, and "Qualified lead (priced)"
 *      conversions by CONVERSION date x campaign (what the bidder has
 *      actually received), plus the action's primary/secondary state.
 *   3. GitHub Actions (public repo, no token needed; GITHUB_TOKEN raises the
 *      rate limit if set): the nightly qualified-lead-upload runs.
 *
 * Cached 10 minutes at module level, like the Ads client.
 */
import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { runGaql } from "@/lib/googleAds/client";
// @ts-ignore — plain-JS shared module, no declarations by design (see revenueLive.ts).
import {
  QUALIFIED_ACTION_NAME,
  FIRST_PRICED_LOOKBACK_DAYS,
  PRICE_PATHS,
  DEPOSIT_PATHS,
  TREND_WEEKS,
  reducePricedRecords,
  toLeadLite,
  buildQualifiedPanel,
  ptDay,
  weekStart,
} from "@/lib/admin/qualifiedCensus.mjs";
// @ts-ignore — plain-JS shared module.
import { reduceWebhookState } from "@/lib/admin/revenueByCampaign.mjs";

const DAY = 864e5;
const CACHE_TTL_MS = 10 * 60 * 1000;
const UPLOAD_REPO = "eddiezal/autoline-logistics-web";
const UPLOAD_WORKFLOW = "qualified-lead-upload.yml";

export interface QualifiedDayRow {
  day: string; weekend: boolean; partial: boolean;
  qualified: number; s5: number; paid: number; organic: number; unlinked: number;
  uploadable: number; value: number;
  spend: number | null; s5Spend: number | null;
  googleAll: number | null; googleS5: number | null;
  forms: number; formsPriced: number; s5Forms: number; s5FormsPriced: number;
}
export interface QualifiedTotals {
  days: number; servingDays: number;
  qualified: number; s5: number; uploadable: number;
  spend: number | null; s5Spend: number | null;
  googleAll: number | null; googleS5: number | null;
  forms: number; formsPriced: number; s5Forms: number; s5FormsPriced: number;
  blendedCpq: number | null; s5Cpq: number | null; s5GoogleCpa: number | null;
  rate: number | null; s5Rate: number | null;
}
export interface QualifiedWeekRow extends QualifiedTotals {
  week: string; partial: boolean; daysIn: number;
}
export interface QualifiedSourceRow {
  key: string; leads: number; qualified: number; booked: number; canceled: number;
  feeGross: number; feeNet: number; spend: number | null;
}
export interface QualifiedCampaignRow {
  key: string; qualified: number; uploadable: number; spend: number | null; google: number | null;
}
export interface UploadRun {
  startedAt: Date; status: string; conclusion: string | null; event: string;
  durationSec: number | null; url: string;
}
export interface QualifiedLive {
  rows: QualifiedDayRow[];
  weeks: QualifiedWeekRow[];
  sources: QualifiedSourceRow[];
  matureCutoffDay: string;
  window: QualifiedTotals;
  sinceSwitch: QualifiedTotals | null;
  campaigns: QualifiedCampaignRow[];
  campaignNames: Map<string, string>;
  guardrail: { lowRun: number; tripped: boolean; servingDaysRead: number };
  uploadCheck: { days: string[]; expected: number; counted: number | null };
  runs: UploadRun[] | null;
  action: { primary: boolean; status: string } | null;
  notes: string[];
  fetchedAt: Date;
}

let cache: { at: number; value: QualifiedLive | null } | null = null;

export async function computeQualifiedLive(): Promise<QualifiedLive | null> {
  if (cache && Date.now() - cache.at < (cache.value ? CACHE_TTL_MS : 60_000)) return cache.value;
  const value = await compute().catch((err) => {
    console.error("[qualifiedLive] computation failed", err);
    return null;
  });
  cache = { at: Date.now(), value };
  return value;
}

async function compute(): Promise<QualifiedLive> {
  const now = new Date();
  const todayKey: string = ptDay(now);
  // Window: TREND_WEEKS Mon-Sun weeks ending this (partial) week.
  const fromDay: string = new Date(new Date(`${weekStart(todayKey)}T12:00:00Z`).getTime() - (TREND_WEEKS - 1) * 7 * DAY).toISOString().slice(0, 10);
  const readFrom = new Date(new Date(`${fromDay}T00:00:00-07:00`).getTime() - FIRST_PRICED_LOOKBACK_DAYS * DAY);
  const notes: string[] = [];
  const db = getAdminDb();

  /* ── Firestore census (required: without it there is no panel) ── */
  const fields = [
    "entity_id", "received_at", "raw_item.ABD_Id", "raw_item.Referrer_Id",
    "raw_item.Custom_Id", "raw_item.Status_Id", "raw_item.Item_Type", "raw_item.Booked_Date",
    ...[...PRICE_PATHS, ...DEPOSIT_PATHS].map((p: string) => `raw_item.${p}`),
  ];
  const [evSnap, leadSnap] = await Promise.all([
    db.collection("proabd_webhook_events").where("received_at", ">=", readFrom).select(...fields).get(),
    db.collection("leads").where("createdAt", ">=", readFrom).limit(10_000).get(),
  ]);
  const records = reducePricedRecords(
    evSnap.docs.map((doc) => {
      const d = doc.data();
      return { receivedAt: d.received_at?.toDate?.() ?? null, entityId: d.entity_id, raw: d.raw_item ?? {} };
    }),
  );
  const leads = leadSnap.docs.map((doc) => toLeadLite(doc.data())).filter(Boolean);
  // Latest booking state per record (ascending received order) for the fee join.
  const { state } = reduceWebhookState(
    evSnap.docs
      .map((doc) => doc.data())
      .sort((a, b) => (a.received_at?.toMillis?.() ?? 0) - (b.received_at?.toMillis?.() ?? 0))
      .map((d) => {
        const item = d.raw_item ?? {};
        return {
          abdId: item.ABD_Id ?? d.entity_id, customId: item.Custom_Id, statusId: item.Status_Id,
          itemType: item.Item_Type, bookedDate: item.Booked_Date, deposit: item.Transport?.Deposit,
        };
      }),
  );

  /* ── Google Ads (optional) ── */
  let spend: { byDay: Map<string, number>; byDayCampaign: Map<string, number> } | null = null;
  let google: Map<string, number> | null = null;
  let action: QualifiedLive["action"] = null;
  const campaignNames = new Map<string, string>();
  try {
    const window = `segments.date BETWEEN '${fromDay}' AND '${todayKey}'`;
    const [costRows, convRows, actionRows] = await Promise.all([
      runGaql(`SELECT segments.date, campaign.id, campaign.name, metrics.cost_micros
               FROM campaign WHERE ${window} AND metrics.cost_micros > 0`),
      runGaql(`SELECT segments.date, segments.conversion_action_name, campaign.id, campaign.name,
                      metrics.all_conversions_by_conversion_date
               FROM campaign
               WHERE ${window} AND segments.conversion_action_name = '${QUALIFIED_ACTION_NAME}'`),
      runGaql(`SELECT conversion_action.name, conversion_action.primary_for_goal, conversion_action.status
               FROM conversion_action WHERE conversion_action.status != 'REMOVED'`),
    ]);
    spend = { byDay: new Map(), byDayCampaign: new Map() };
    for (const r of costRows) {
      const day = r.segments?.date as string; const id = String(r.campaign?.id ?? "");
      const v = Number(r.metrics?.costMicros ?? 0) / 1e6;
      if (!day || !id) continue;
      campaignNames.set(id, r.campaign?.name ?? id);
      spend.byDay.set(day, (spend.byDay.get(day) ?? 0) + v);
      spend.byDayCampaign.set(`${day}|${id}`, (spend.byDayCampaign.get(`${day}|${id}`) ?? 0) + v);
    }
    google = new Map();
    for (const r of convRows) {
      const day = r.segments?.date as string; const id = String(r.campaign?.id ?? "");
      const v = Number(r.metrics?.allConversionsByConversionDate ?? 0);
      if (!day || !id || !v) continue;
      campaignNames.set(id, r.campaign?.name ?? id);
      google.set(`${day}|${id}`, (google.get(`${day}|${id}`) ?? 0) + v);
    }
    const a = actionRows.find((r) => r.conversionAction?.name === QUALIFIED_ACTION_NAME)?.conversionAction;
    if (a) action = { primary: a.primaryForGoal !== false, status: String(a.status ?? "") };
    else notes.push(`Conversion action "${QUALIFIED_ACTION_NAME}" not found in the account.`);
  } catch (err) {
    notes.push(`Google Ads unavailable (${err instanceof Error ? err.message : String(err)}): spend, cost per lead and Google-counted columns are blank, not zero.`);
  }

  /* ── GitHub Actions runs (optional) ── */
  let runs: UploadRun[] | null = null;
  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "autoline-admin" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(
      `https://api.github.com/repos/${UPLOAD_REPO}/actions/workflows/${UPLOAD_WORKFLOW}/runs?per_page=7`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const data = (await res.json()) as { workflow_runs?: Array<Record<string, string | null>> };
    runs = (data.workflow_runs ?? []).map((r) => {
      const start = new Date(String(r.run_started_at ?? r.created_at));
      const end = r.status === "completed" && r.updated_at ? new Date(r.updated_at) : null;
      return {
        startedAt: start,
        status: String(r.status ?? ""),
        conclusion: r.conclusion ?? null,
        event: String(r.event ?? ""),
        durationSec: end ? Math.round((end.getTime() - start.getTime()) / 1000) : null,
        url: String(r.html_url ?? ""),
      };
    });
  } catch (err) {
    notes.push(`Upload run history unavailable (${err instanceof Error ? err.message : String(err)}).`);
  }

  // JS module: its inferred row type is loose (Map.get → possibly undefined); the shape is pinned by qualifiedCensus.test.mjs.
  const panel = buildQualifiedPanel({ records, leads, spend, google, state, fromDay, toDay: todayKey, todayKey }) as unknown as Pick<
    QualifiedLive, "rows" | "weeks" | "sources" | "matureCutoffDay" | "window" | "sinceSwitch" | "campaigns" | "guardrail" | "uploadCheck"
  >;
  return { ...panel, campaignNames, runs, action, notes, fetchedAt: now };
}
