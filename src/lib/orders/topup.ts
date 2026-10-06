/**
 * Orders book top-up (SERVER ONLY) — the automated version of the manual
 * two-script flow (scripts/export-orders-from-webhook.mjs +
 * scripts/import-orders.mjs), adopted 2026-08-19, cron-ported 2026-10-05.
 *
 * Keeps the /admin order book (Business view, fees, deposit coverage) fresh
 * BETWEEN Kacy's monthly ProABD exports by upserting `orders` docs from the
 * `proabd_webhook_events` mirror — in memory, no CSV. Division of labor is
 * unchanged: this is the freshness top-up; Kacy's monthly export stays the
 * authoritative full-book reconciliation (run through scripts/import-orders.mjs
 * as before), and scripts/export-orders-from-webhook.mjs remains for manual
 * runs and --validate.
 *
 * Differences from the CSV path, both deliberate:
 *   · Window defaults to the last 7 DAYS, not since Jul 8. The cron runs
 *     daily, so anything older is already upserted; the manual script keeps
 *     the full window for backfills.
 *   · Only fields the webhook actually carries are written. The CSV import
 *     writes "" for columns the top-up CSV never has (names, cities), which
 *     merge-overwrites real values from Kacy's export — this module doesn't.
 *
 * After the upsert it recomputes the §6.1 fee-coverage summary
 * (scripts/check-deposit-coverage.mjs core) and writes it to
 * `data_health/orders_topup`, so freshness + coverage are inspectable
 * without a terminal. The /admin "Orders import N days old" banner clears
 * automatically: it reads max(importedAt) over `orders`, which this bumps.
 */

import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { ptToIso } from "@/lib/proabd/shipment-sync";

type Raw = Record<string, unknown>;

export type OrdersTopupResult = {
  sinceDays: number;
  eventsRead: number;
  orderEvents: number;
  distinctOrders: number;
  upserted: number;
  skippedNoMoney: number;
  createdFromBookedDate: number;
  createdFromCreateDate: number;
  coverage: {
    realShipments: number;
    byStage: Record<string, number>;
    bookedOrLater: number;
    withDeposit: number;
    coveragePct: number | null;
    bookedFeeCents: number;
    monthlyPT: Record<string, { n: number; sumCents: number }>;
  };
  ms: number;
};

const BOOKED_STAGES = new Set(["booked", "prep", "inTransit", "delivered", "completed"]);

function toDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function runOrdersTopup(opts: { sinceDays?: number } = {}): Promise<OrdersTopupResult> {
  const started = Date.now();
  const db = getAdminDb();
  const sinceDays = Math.min(Math.max(opts.sinceDays ?? 7, 1), 95);
  const since = new Date(Date.now() - sinceDays * 86_400_000);

  /* ---- 1 · latest order event per ABD_Id (events asc, later overwrites) ---- */
  const snap = await db
    .collection("proabd_webhook_events")
    .where("received_at", ">=", since)
    .orderBy("received_at", "asc")
    .get();

  let orderEvents = 0;
  const byId = new Map<string, Raw>();
  for (const doc of snap.docs) {
    const d = doc.data();
    const item = d.raw_item as Raw | undefined;
    if (!item || String(d.entity_type ?? item.Item_Type) !== "order") continue;
    const id = String(item.ABD_Id ?? "");
    if (!id) continue;
    orderEvents++;
    byId.set(id, item);
  }

  /* ---- 2 · upsert orders (merge; only webhook-carried fields) ---- */
  let upserted = 0;
  let skippedNoMoney = 0;
  let createdFromBookedDate = 0;
  let createdFromCreateDate = 0;
  let batch = db.batch();
  const now = Timestamp.now();

  for (const [id, item] of byId) {
    const transport = (item.Transport ?? {}) as Raw;
    const shipper = (item.Shipper ?? {}) as Raw;
    const price = Number(transport.Price ?? "");
    const deposit = Number(transport.Deposit ?? "");
    if (!Number.isFinite(price) && !Number.isFinite(deposit)) {
      skippedNoMoney++;
      continue;
    }
    const bookedRaw = String(item.Booked_Date ?? "");
    let createdAt: Date | null = null;
    if (bookedRaw && bookedRaw !== "0000-00-00 00:00:00") {
      createdAt = toDate(ptToIso(bookedRaw));
      if (createdAt) createdFromBookedDate++;
    }
    if (!createdAt) {
      createdAt = toDate(ptToIso(String(item.Create_Date ?? "")));
      if (createdAt) createdFromCreateDate++;
    }

    batch.set(
      db.collection("orders").doc(id),
      {
        orderId: id,
        email: String(shipper.Email ?? "").toLowerCase(),
        orderCreatedAt: createdAt ? Timestamp.fromDate(createdAt) : null,
        price: Number.isFinite(price) ? price : 0,
        deposit: Number.isFinite(deposit) ? deposit : 0,
        source: "webhook-topup-cron",
        importedAt: now,
      },
      { merge: true },
    );
    upserted++;
    if (upserted % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();

  /* ---- 3 · §6.1 fee-coverage summary (check-deposit-coverage.mjs core) ---- */
  const shipSnap = await db.collection("shipments").get();
  const byStage: Record<string, number> = {};
  let realShipments = 0;
  let bookedOrLater = 0;
  let withDeposit = 0;
  let bookedFeeCents = 0;
  const monthlyPT: Record<string, { n: number; sumCents: number }> = {};

  for (const doc of shipSnap.docs) {
    const d = doc.data();
    if (doc.id.startsWith("ALL-TEST") || /eddiezal28@gmail\.com/i.test(String(d.ownerEmail ?? ""))) continue;
    realShipments++;
    const stage = String(d.stage ?? d.status ?? "unknown");
    byStage[stage] = (byStage[stage] ?? 0) + 1;
    if (!BOOKED_STAGES.has(stage)) continue;
    bookedOrLater++;
    const dep = Number(d.proabdDepositCents);
    if (!Number.isFinite(dep) || dep <= 0) continue;
    withDeposit++;
    bookedFeeCents += dep;
    const at: Date | null = d.updatedFromProabdAt?.toDate?.() ?? d.createdAt?.toDate?.() ?? null;
    const mk = at
      ? at.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit" })
      : "unknown";
    const m = (monthlyPT[mk] ??= { n: 0, sumCents: 0 });
    m.n++;
    m.sumCents += dep;
  }

  const coverage = {
    realShipments,
    byStage,
    bookedOrLater,
    withDeposit,
    coveragePct: bookedOrLater ? Math.round((withDeposit / bookedOrLater) * 1000) / 10 : null,
    bookedFeeCents,
    monthlyPT,
  };

  const result: OrdersTopupResult = {
    sinceDays,
    eventsRead: snap.size,
    orderEvents,
    distinctOrders: byId.size,
    upserted,
    skippedNoMoney,
    createdFromBookedDate,
    createdFromCreateDate,
    coverage,
    ms: Date.now() - started,
  };

  /* ---- 4 · data_health doc: freshness + coverage, inspectable anywhere ---- */
  await db.collection("data_health").doc("orders_topup").set({
    ...result,
    ranAt: Timestamp.now(),
  });

  return result;
}
