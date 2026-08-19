/**
 * Live revenue-by-campaign for the dashboard — I/O wrapper around the shared
 * pure module (src/lib/admin/revenueByCampaign.mjs). The CLI twin is
 * scripts/revenue-by-campaign.mjs; both callers, one computation.
 *
 * Failure posture mirrors activeDecisions.ts: any error nulls that block and
 * the UI renders an explicit note — degraded is shown as degraded, never as
 * zero (the 8/7 false-zero lesson).
 */
import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
// @ts-ignore — plain-JS shared module, no declarations by design (importable
// from plain node); ts-ignore not ts-expect-error (2026-08-18 build lesson).
import {
  REVENUE_COHORT_START,
  MATURITY_DAYS,
  reduceWebhookState,
  bucketLead,
  computeRevenue,
} from "@/lib/admin/revenueByCampaign.mjs";

export interface RevenueRow {
  key: string;
  matureLeads: number; matureLinked: number; matureBooked: number; matureCanceled: number;
  matureFeeGross: number; matureFeeNet: number;
  greenLeads: number; greenBooked: number; greenFeeGross: number;
}
export interface RevenueLive {
  rows: RevenueRow[];
  totalsPaid: Omit<RevenueRow, "key" | "matureLinked">;
  spendByCampaign: Map<string, number> | null;
  campaignNames: Map<string, string>;
  totalPaidSpend: number | null;
  since: Date;
  matureCutoff: Date;
  adsNote: string;
}

const isTest = (email: unknown) => /test|zaldivar|example\.com/i.test(String(email ?? ""));

export async function computeRevenueLive(): Promise<RevenueLive | null> {
  const now = new Date();
  const since = new Date(`${REVENUE_COHORT_START}T00:00:00-07:00`);
  const matureCutoff = new Date(now.getTime() - MATURITY_DAYS * 864e5);
  const db = getAdminDb();

  try {
    /* ---- leads cohort ---- */
    const leadSnap = await db.collection("leads")
      .where("createdAt", ">=", since).orderBy("createdAt", "asc").limit(5000).get();
    const leads: { at: Date; bucket: string; campaignId: string | null; abdId: string | null; leadRef: string | null }[] = [];
    for (const doc of leadSnap.docs) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const d: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const at = d.createdAt?.toDate?.();
      if (!at || isTest(d.contact?.email)) continue;
      const { bucket, campaignId } = bucketLead(d.attribution ?? {});
      leads.push({
        at, bucket, campaignId,
        abdId: d.proabdAbdId ? String(d.proabdAbdId) : null,
        leadRef: d.leadRef ? String(d.leadRef) : null,
      });
    }

    /* ---- webhook latest state ---- */
    const evSnap = await db.collection("proabd_webhook_events")
      .where("received_at", ">=", since).orderBy("received_at", "asc")
      .select("entity_id", "raw_item.ABD_Id", "raw_item.Custom_Id", "raw_item.Status_Id",
              "raw_item.Item_Type", "raw_item.Booked_Date", "raw_item.Transport.Deposit")
      .get();
    const items = [];
    for (const doc of evSnap.docs) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const d: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const item = d.raw_item ?? {};
      items.push({
        abdId: item.ABD_Id ?? d.entity_id,
        customId: item.Custom_Id,
        statusId: item.Status_Id,
        itemType: item.Item_Type,
        bookedDate: item.Booked_Date,
        deposit: item.Transport?.Deposit,
      });
    }
    const { state, byCustomId } = reduceWebhookState(items);

    const { rows, totalsPaid } = computeRevenue({ leads, state, byCustomId, matureCutoff });

    /* ---- campaign names + spend over the mature create-date window ---- */
    let spendByCampaign: Map<string, number> | null = null;
    const campaignNames = new Map<string, string>();
    let totalPaidSpend: number | null = null;
    let adsNote = "";
    try {
      const missing = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN"]
        .filter((k) => !process.env[k]);
      if (missing.length) throw new Error(`unconfigured: ${missing.join(", ")}`);
      const tokRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_ADS_CLIENT_ID as string,
          client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET as string,
          refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN as string,
          grant_type: "refresh_token",
        }),
      });
      const tok = await tokRes.json();
      if (!tok.access_token) throw new Error(String(tok.error_description ?? tok.error ?? "oauth failed"));
      const ptDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
      const API_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? "v23";
      const CUSTOMER_ID = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "8519808841").replace(/-/g, "");
      const LOGIN_CUSTOMER_ID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "6871495331").replace(/-/g, "");
      const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}/googleAds:search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tok.access_token}`,
          "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN as string,
          "login-customer-id": LOGIN_CUSTOMER_ID,
        },
        body: JSON.stringify({
          query: `SELECT campaign.id, campaign.name, metrics.cost_micros FROM campaign
                  WHERE segments.date BETWEEN '${ptDay(since)}' AND '${ptDay(matureCutoff)}'`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(String(data?.error?.message ?? `HTTP ${res.status}`));
      spendByCampaign = new Map();
      for (const r of data.results ?? []) {
        const id = String(r.campaign.id);
        campaignNames.set(id, r.campaign.name);
        spendByCampaign.set(id, (spendByCampaign.get(id) ?? 0) + Number(r.metrics.costMicros ?? 0) / 1e6);
      }
      totalPaidSpend = 0;
      for (const row of rows) {
        if (row.key.startsWith("ads:")) totalPaidSpend += spendByCampaign.get(row.key.slice(4)) ?? 0;
      }
    } catch (err) {
      adsNote = `Spend unavailable (${err instanceof Error ? err.message : String(err)}) — fee columns still valid`;
    }

    return { rows, totalsPaid, spendByCampaign, campaignNames, totalPaidSpend, since, matureCutoff, adsNote };
  } catch (err) {
    console.error("[revenueLive] computation failed", err);
    return null;
  }
}
