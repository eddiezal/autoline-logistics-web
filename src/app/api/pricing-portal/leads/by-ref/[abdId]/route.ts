/**
 * GET /api/pricing-portal/leads/by-ref/{abdId}
 *
 * One ProABD record -> one LaneLock pricing card, priced live against Super Dispatch with
 * the record's REAL route, vehicle class, operability and trailer type. Read-only: nothing
 * is written to ProABD or to Firestore. See src/lib/pricing/portal.ts for the doctrine.
 *
 * Auth: X-LaneLock-Key: <LANELOCK_API_KEY>   (pilot stopgap; Firebase sign-in later)
 * 404 when the id has never appeared in the webhook stream (the extension shows
 * "No priced quote for #… yet").
 *
 * Added 2026-09-09 — the read-only half of PR4, unblocked once the field-defaults read
 * showed the CRM flags are real selections (claude/field-defaults-findings-2026-09-09.md).
 */

import "server-only";
import { authorize, json, preflight } from "@/lib/pricing/portal-http";
import { latestEventFor, priceRecord } from "@/lib/pricing/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request, ctx: { params: Promise<{ abdId: string }> }) {
  const denied = authorize(req);
  if (denied) return denied;

  const { abdId } = await ctx.params;
  const id = String(abdId ?? "").trim();
  if (!/^\d{5,10}$/.test(id)) return json(req, { error: "abdId must be a numeric ProABD id" }, 400);

  try {
    const ev = await latestEventFor(id);
    if (!ev) return json(req, { error: "not found", externalRef: id }, 404);
    const card = await priceRecord(ev);
    return json(req, card);
  } catch (err) {
    console.error("[pricing-portal/by-ref] failed", err);
    return json(req, { error: "pricing failed" }, 500);
  }
}
