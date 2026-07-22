/**
 * Google Ads API (REST / GAQL) — read-only reporting client.
 *
 * Powers the /admin dashboard's spend + conversion columns (the "cost
 * join"). No SDK: two fetches — an OAuth refresh-token exchange and a
 * googleAds:search call — keep the dependency surface at zero.
 *
 * Auth model (set in Vercel env; see scripts/mint-ads-refresh-token.mjs
 * for the one-time refresh-token mint):
 *   GOOGLE_ADS_DEVELOPER_TOKEN   — MCC API Center token (Basic Access,
 *                                  approved; Tools → API Center in MCC
 *                                  687-149-5331 → "View token").
 *   GOOGLE_ADS_CLIENT_ID         — OAuth desktop client (Cloud console,
 *   GOOGLE_ADS_CLIENT_SECRET       project auto-line-logistics).
 *   GOOGLE_ADS_REFRESH_TOKEN     — minted once for eddie@zaldivarlabs.com
 *                                  with the adwords scope.
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID — optional, defaults to the MCC
 *                                  (6871495331): the account the OAuth
 *                                  user logs in through.
 *   GOOGLE_ADS_CUSTOMER_ID       — optional, defaults to Auto Line
 *                                  (8519808841): the account queried.
 *   GOOGLE_ADS_API_VERSION       — optional, defaults to v23 (current as
 *                                  of Jul 2026; majors sunset ~yearly).
 *
 * Caching: module-level, 10-minute TTL. Ads metrics lag ~3h anyway;
 * this keeps dashboard refreshes from burning API quota.
 */

import "server-only";

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? "v23";
const LOGIN_CUSTOMER_ID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "6871495331").replace(/-/g, "");
const CUSTOMER_ID = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "8519808841").replace(/-/g, "");
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface CampaignStat {
  id: string;
  name: string;
  costDollars: number;
  clicks: number;
  impressions: number;
  /** Conversions counted per the account's "Conversions" column (primary actions). */
  conversions: number;
  conversionsValue: number;
}

export interface ConversionActionStat {
  /** e.g. "Submit Lead Form", "Phone Calls from Ads (90s+)". */
  actionName: string;
  /** All conversions for this action across the account, window total. */
  allConversions: number;
}

export interface AdsStats {
  campaigns: CampaignStat[];
  conversionActions: ConversionActionStat[];
  /** Window queried, inclusive, account timezone (America/Los_Angeles). */
  since: string;
  until: string;
  fetchedAt: Date;
}

export type AdsResult =
  | { state: "ok"; stats: AdsStats }
  | { state: "unconfigured"; missing: string[] }
  | { state: "error"; message: string };

/** Which env vars are absent (empty array = fully configured). */
export function adsMissingEnv(): string[] {
  return [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
  ].filter((k) => !process.env[k]);
}

async function accessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth refresh failed: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim());
  }
  return data.access_token;
}

interface GaqlRow {
  campaign?: { id?: string | number; name?: string };
  segments?: { conversionActionName?: string };
  metrics?: {
    costMicros?: string | number;
    clicks?: string | number;
    impressions?: string | number;
    conversions?: number;
    conversionsValue?: number;
    allConversions?: number;
  };
}

async function gaqlSearch(token: string, query: string): Promise<GaqlRow[]> {
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        "login-customer-id": LOGIN_CUSTOMER_ID,
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
    },
  );
  const data: unknown = await res.json();
  if (!res.ok) {
    // Error shape: { error: { message, details: [{ errors: [{ message }] }] } }
    const err = data as { error?: { message?: string; details?: Array<{ errors?: Array<{ message?: string }> }> } };
    const detail = err.error?.details?.[0]?.errors?.[0]?.message;
    throw new Error(`Ads API ${res.status}: ${detail ?? err.error?.message ?? "unknown error"}`);
  }
  return ((data as { results?: GaqlRow[] }).results ?? []);
}

const num = (v: string | number | undefined): number => (v == null ? 0 : Number(v)) || 0;

/** YYYY-MM-DD in the Ads account timezone (Pacific). */
function ptDateString(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

let cache: { at: number; result: AdsResult } | null = null;

/**
 * Campaign spend/clicks/conversions + per-action conversion totals from
 * `since` (Date) through today. Never throws — errors come back as a
 * typed state so the dashboard can render its readiness row honestly.
 */
export async function fetchAdsStats(since: Date): Promise<AdsResult> {
  const missing = adsMissingEnv();
  if (missing.length > 0) return { state: "unconfigured", missing };

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.result;

  let result: AdsResult;
  try {
    const token = await accessToken();
    const sinceStr = ptDateString(since);
    const untilStr = ptDateString(new Date());
    const window = `segments.date BETWEEN '${sinceStr}' AND '${untilStr}'`;

    const [campaignRows, actionRows] = await Promise.all([
      gaqlSearch(
        token,
        `SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.clicks,
                metrics.impressions, metrics.conversions, metrics.conversions_value
         FROM campaign
         WHERE ${window} AND metrics.impressions > 0`,
      ),
      gaqlSearch(
        token,
        `SELECT segments.conversion_action_name, metrics.all_conversions
         FROM campaign
         WHERE ${window} AND metrics.all_conversions > 0`,
      ),
    ]);

    // Campaign rows arrive per-day-unsegmented (no date in SELECT), but the
    // API may still split rows; aggregate by id defensively.
    const byId = new Map<string, CampaignStat>();
    for (const r of campaignRows) {
      const id = String(r.campaign?.id ?? "");
      if (!id) continue;
      const c = byId.get(id) ?? {
        id,
        name: r.campaign?.name ?? id,
        costDollars: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        conversionsValue: 0,
      };
      c.costDollars += num(r.metrics?.costMicros) / 1_000_000;
      c.clicks += num(r.metrics?.clicks);
      c.impressions += num(r.metrics?.impressions);
      c.conversions += num(r.metrics?.conversions);
      c.conversionsValue += num(r.metrics?.conversionsValue);
      byId.set(id, c);
    }

    const byAction = new Map<string, number>();
    for (const r of actionRows) {
      const name = r.segments?.conversionActionName ?? "(unnamed)";
      byAction.set(name, (byAction.get(name) ?? 0) + num(r.metrics?.allConversions));
    }

    result = {
      state: "ok",
      stats: {
        campaigns: [...byId.values()].sort((a, b) => b.costDollars - a.costDollars),
        conversionActions: [...byAction.entries()]
          .map(([actionName, allConversions]) => ({ actionName, allConversions }))
          .sort((a, b) => b.allConversions - a.allConversions),
        since: sinceStr,
        until: untilStr,
        fetchedAt: new Date(),
      },
    };
  } catch (err) {
    result = { state: "error", message: err instanceof Error ? err.message : String(err) };
  }

  cache = { at: Date.now(), result };
  return result;
}
