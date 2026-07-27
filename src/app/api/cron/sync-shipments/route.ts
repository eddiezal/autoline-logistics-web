/**
 * GET /api/cron/sync-shipments
 *
 * Sweeps unparsed ProABD webhook events into portal `shipments` docs
 * (see src/lib/proabd/shipment-sync.ts). Two roles:
 *
 *   1. Backfill: the events collection has been accumulating since Jul 8
 *      with parsed:false. Each invocation drains up to ~500 events per
 *      inner sweep, looping while more remain within a ~50s budget.
 *   2. Safety net: the webhook route also triggers a sweep inline on every
 *      delivery, so in steady state this cron finds little to do. It backs
 *      up the inline path if a webhook invocation dies mid-sweep.
 *
 * Auth: same convention as sync-pricing — Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`; manual/backfill calls must pass
 * the same header.
 *
 * vercel.json entry (add alongside the existing sync-pricing entries):
 *   { "path": "/api/cron/sync-shipments", "schedule": "0 13 * * *" }
 * (Daily is fine — the inline webhook sweep is the primary path.)
 */
import { NextResponse } from "next/server";
import { sweepShipmentSync, type SweepResult } from "@/lib/proabd/shipment-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIME_BUDGET_MS = 50_000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const sweeps: SweepResult[] = [];
  let more = true;

  while (more && Date.now() - started < TIME_BUDGET_MS) {
    const r = await sweepShipmentSync({ limit: 500 });
    sweeps.push(r);
    more = r.more;
    if (r.scanned === 0) break;
  }

  const total = sweeps.reduce(
    (acc, r) => ({
      scanned: acc.scanned + r.scanned,
      recordsSeen: acc.recordsSeen + r.recordsSeen,
      shipmentsUpserted: acc.shipmentsUpserted + r.shipmentsUpserted,
      skippedPreOrder: acc.skippedPreOrder + r.skippedPreOrder,
      errors: acc.errors + r.errors,
    }),
    { scanned: 0, recordsSeen: 0, shipmentsUpserted: 0, skippedPreOrder: 0, errors: 0 },
  );

  // ---- Webhook liveness check (added 2026-07-27 after the Jul 22-27
  // silent stall: Superflo posted to the non-www URL, got 301s, dropped
  // every delivery for 5 days and nobody noticed). If the newest webhook
  // event is older than the threshold, scream in the logs — Vercel log
  // alerts / the weekly digest can pick this up. Superflo posts every
  // 1-5 min during business activity; >12h of silence spanning a weekday
  // is almost certainly a broken subscription, not a quiet business.
  const STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000;
  let webhookStale = false;
  let lastDeliveryIso: string | null = null;
  try {
    const { getAdminDb } = await import("@/lib/firebase/admin");
    const newest = await getAdminDb()
      .collection("proabd_webhook_events")
      .orderBy("received_at", "desc")
      .limit(1)
      .get();
    const ts = newest.docs[0]?.get("received_at")?.toDate?.() as Date | undefined;
    if (ts) {
      lastDeliveryIso = ts.toISOString();
      webhookStale = Date.now() - ts.getTime() > STALE_THRESHOLD_MS;
    } else {
      webhookStale = true; // no events at all — definitely broken
    }
    if (webhookStale) {
      console.error(
        `[sync-shipments] ⚠️ WEBHOOK STALE: last Superflo delivery ${lastDeliveryIso ?? "NEVER"} ` +
        `(threshold ${STALE_THRESHOLD_MS / 3_600_000}h). Check the subscription URL (must include www) ` +
        `and secret with Superflo. See claude/proabd-createlead-integration-notes.md GOTCHA 5.`,
      );
    }
  } catch (err) {
    console.warn("[sync-shipments] liveness check failed (non-fatal)", err);
  }

  console.log("[sync-shipments]", JSON.stringify({ ...total, sweeps: sweeps.length, more, webhookStale, lastDeliveryIso }));
  return NextResponse.json({
    ok: true,
    ...total,
    sweeps: sweeps.length,
    backlogRemaining: more,
    webhookStale,
    lastDelivery: lastDeliveryIso,
  });
}
