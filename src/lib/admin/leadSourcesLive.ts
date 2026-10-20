/**
 * Live loader for the Lead Sources page (the /admin Overview since
 * 2026-10-20) — I/O wrapper around src/lib/admin/leadSources.mjs.
 *
 * Sources, each failing on its own (degraded shows as degraded, never zero):
 *   1. Firestore proabd_webhook_events (every CRM record from Jul 8: referrer,
 *      created, booked, status, deposit, first price) and leads (website
 *      attribution; Google-attributed tracked calls).
 *   2. Google Ads API: cost by day × campaign only.
 *   3. booking-curve.json (committed; regenerated monthly by
 *      scripts/booking-delay-curve.mjs).
 *
 * Cached 10 minutes at module level. The events read is the big one
 * (~50k docs, select()ed to the fields used); 10 minutes keeps the page
 * usable without a cron.
 */
import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { runGaql } from "@/lib/googleAds/client";
import curveJson from "@/lib/admin/booking-curve.json";
// @ts-ignore — plain-JS shared modules, no declarations by design (see revenueLive.ts).
import { reduceRecords, toLead, buildLeadSources, SOURCES, FIRST_MONTH } from "@/lib/admin/leadSources.mjs";
// @ts-ignore — ProABD naive timestamps are Eastern; one parser for scripts and app.
import { parseProabdDate } from "../../../scripts/lib/proabd-time.mjs";

const CACHE_TTL_MS = 10 * 60 * 1000;

export type SourceKey = keyof typeof SOURCES;
export interface SourceRow {
  key: string; leads: number; calls: number; priced: number; booked: number; canceled: number;
  feeGross: number; feeNet: number; cost: number;
  reported: number; settled: boolean; tooEarly: boolean;
  range: { expected: number; lo: number; hi: number } | null;
  costPerLead: number | null; closeRate: number | null; feeMinusSpend: number | null;
  recoveredPerDollar: number | null; breakEvenCpl: number | null; costPerBooking: number | null;
}
export interface CampaignRow {
  campaignId: string; name: string; leads: number; priced: number; booked: number; canceled: number;
  feeNet: number; cost: number; costPerLead: number | null; pricedShare: number | null;
  costPerPriced: number | null; feeMinusSpend: number; recoveredPerDollar: number | null;
}
export interface MonthBlock {
  month: string; open: boolean; daysIn: number;
  rows: Partial<Record<string, SourceRow>>;
  allPaid: { leads: number; cost: number; booked: number; canceled: number; feeNet: number; reported: number; lo: number; hi: number; feeMinusSpend: number; recoveredPerDollar: number | null; settled: boolean };
  free: { leads: number; booked: number; feeNet: number };
  campaigns: CampaignRow[];
}
export interface LeadSourcesLive {
  todayKey: string; thisMonth: string; months: string[];
  byMonth: Record<string, MonthBlock>;
  weekly: Array<{ week: string; partial: boolean; by: Record<string, number> }>;
  google: { spentToDate: number; cap: number; weekdaysLeft: number; projected: number; holdDaily: number | null };
  curve: { measuredAt: string; seasonDays: number; buckets: number[]; sources: Record<string, { booked: number; leads: number; cum: number[] }> };
  campaignNames: Map<string, string>;
  notes: string[];
  fetchedAt: Date;
}

let cache: { at: number; value: LeadSourcesLive | null } | null = null;

export async function computeLeadSourcesLive(): Promise<LeadSourcesLive | null> {
  if (cache && Date.now() - cache.at < (cache.value ? CACHE_TTL_MS : 60_000)) return cache.value;
  const value = await compute().catch((err) => {
    console.error("[leadSourcesLive] computation failed", err);
    return null;
  });
  cache = { at: Date.now(), value };
  return value;
}

async function compute(): Promise<LeadSourcesLive> {
  const now = new Date();
  const notes: string[] = [];
  const db = getAdminDb();
  const eventsStart = new Date("2026-07-08T00:00:00-07:00");
  const leadsStart = new Date(`${FIRST_MONTH}-01T00:00:00-07:00`);

  /* ── Firestore (required) ── */
  const fields = [
    "entity_id", "received_at", "raw_item.ABD_Id", "raw_item.Referrer_Id", "raw_item.Create_Date", "raw_item.Booked_Date",
    "raw_item.Item_Type", "raw_item.Status_Id", "raw_item.Transport.Deposit", "raw_item.Deposit",
    "raw_item.Transport.Total_Price", "raw_item.Transport.Price", "raw_item.Total_Price", "raw_item.Price",
    "raw_item.Shipper.Email", "raw_item.Shipper.First_Name", "raw_item.Shipper.Last_Name",
  ];
  const events: Array<{ receivedAt: Date | null; entityId: unknown; raw: Record<string, unknown>; created: Date | null; bookedAt: Date | null }> = [];
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  for (;;) {
    let q = db.collection("proabd_webhook_events").where("received_at", ">=", eventsStart).orderBy("received_at", "asc").select(...fields).limit(5000);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const d = doc.data();
      const raw = (d.raw_item ?? {}) as Record<string, unknown>;
      events.push({
        receivedAt: d.received_at?.toDate?.() ?? null,
        entityId: d.entity_id,
        raw,
        created: parseProabdDate(raw.Create_Date),
        bookedAt: parseProabdDate(raw.Booked_Date),
      });
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 5000) break;
  }
  const records = reduceRecords(events);

  const leadSnap = await db.collection("leads").where("createdAt", ">=", leadsStart)
    .select("createdAt", "submittedAt", "proabdAbdId", "leadRef", "source", "attribution", "contact.email", "contact.firstName", "contact.lastName", "contact.notes", "gclid")
    .get();
  const leads = leadSnap.docs.map((doc) => toLead(doc.data())).filter(Boolean);

  /* ── Google Ads spend (optional) ── */
  let spend: Map<string, number> | null = null;
  const campaignNames = new Map<string, string>();
  try {
    const todayKey = now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    const rows = await runGaql(`SELECT segments.date, campaign.id, campaign.name, metrics.cost_micros
      FROM campaign WHERE segments.date BETWEEN '${FIRST_MONTH}-01' AND '${todayKey}' AND metrics.cost_micros > 0`);
    spend = new Map();
    for (const r of rows) {
      const day = r.segments?.date as string; const id = String(r.campaign?.id ?? "");
      if (!day || !id) continue;
      campaignNames.set(id, r.campaign?.name ?? id);
      spend.set(`${day}|${id}`, (spend.get(`${day}|${id}`) ?? 0) + Number(r.metrics?.costMicros ?? 0) / 1e6);
    }
  } catch (err) {
    notes.push(`Google Ads spend unavailable (${err instanceof Error ? err.message : String(err)}): Google cost columns are blank, not zero.`);
  }

  const out = buildLeadSources({ records, leads, spend, campaignNames, curve: curveJson, now }) as unknown as Omit<LeadSourcesLive, "campaignNames" | "notes" | "fetchedAt">;
  return { ...out, campaignNames, notes, fetchedAt: now };
}
