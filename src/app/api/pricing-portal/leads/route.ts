/**
 * GET /api/pricing-portal/leads?limit=8
 *
 * The popup queue: the most recent distinct ProABD quote/order records by ingest time,
 * each priced live (see priceRecord). Priced in parallel; SD's 50 req / 10 s budget and the
 * 15-minute shipment-hash cache keep this comfortably under the limit at demo scale.
 * Read-only. Auth as by-ref.
 */

import "server-only";
import { authorize, json, preflight } from "@/lib/pricing/portal-http";
import { latestRecords, priceRecord } from "@/lib/pricing/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit")) || 8));
  try {
    const events = await latestRecords(limit);
    const cards = await Promise.all(events.map((ev) => priceRecord(ev)));
    return json(req, cards);
  } catch (err) {
    console.error("[pricing-portal/leads] failed", err);
    return json(req, { error: "pricing failed" }, 500);
  }
}
