/**
 * POST /api/webhooks/proabd
 *
 * Receives Superflo Export API webhook events for ProABD lead/quote/order
 * changes. Fires every 1-5 minutes with a batch of 50-100 items per Brian's
 * spec on the 2026-07-01 call.
 *
 * Each item in the batch includes:
 *   - insert/update flag (action)
 *   - entity type: lead, quote, or order
 *   - the full record data (Shipper + Transport + Vehicles shape)
 *   - our GCLID if we passed it on createLead
 *
 * See Notion "ProABD API Integration" page for the full call outcome +
 * confirmed payload shape.
 *
 * Auth: shared secret in X-Superflo-Secret header. Pattern is a placeholder
 * until Brian confirms his actual scheme (shared secret vs HMAC signature
 * vs IP allowlist). The env var PROABD_WEBHOOK_SECRET is validated with
 * crypto.timingSafeEqual. Once Brian answers, the header name and/or the
 * validation logic gets swapped, but the URL stays the same, so Cheli can
 * still enable the subscription on their side without waiting.
 *
 * Failure policy (matches sGTM receiver, deviates from CallRail):
 *   Superflo does NOT retry Custom HTTP Request tags on failure. Return
 *   200 on Firestore write failure (log the error) so we don't silently
 *   drop future events. Analytics loss is preferable to breaking the
 *   forwarding chain.
 *
 * Multi-tenant: tenant_id from TENANT_ID env var (defaults to
 *   "autoline-logistics"). Same pattern as sGTM receiver so future SaaS
 *   tenant onboarding is a Vercel config change, not a schema migration.
 *
 * Payload handling: Superflo sends either a single event object OR an
 *   array of events per Brian's "batch of 50-100 items" spec. We handle
 *   both shapes.
 *
 * Related:
 *   - src/app/api/webhooks/callrail/route.ts (reference)
 *   - src/app/api/webhooks/sgtm-events/route.ts (closest sibling)
 *   - Notion: ProABD API Integration page
 *   - Memory: autoline_proabd_technical
 * Added 2026-07-02 as task #118.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Single Superflo event item.
 *  Fields are best-guess based on Brian's verbal description on the 7/1
 *  call. Actual sample payloads pending; update once received. */
interface SuperfloEventItem {
  /** "insert" or "update" indicator. */
  action?: "insert" | "update" | string;
  /** Entity type: "lead", "quote", or "order". */
  entity_type?: "lead" | "quote" | "order" | string;
  /** The record data (Shipper + Transport + Vehicles + our GCLID). */
  data?: Record<string, unknown>;
  /** Alternate field name if Superflo nests differently. */
  record?: Record<string, unknown>;
  /** Convenience field: their record identifier (ABD_Id, quote_id, order_id). */
  id?: string | number;
  /** Any additional fields Superflo sends. */
  [key: string]: unknown;
}

/** Batch envelope: either a single event or an array of events. */
type SuperfloPayload = SuperfloEventItem | SuperfloEventItem[];

/** Verify the shared secret in a timing-safe way.
 *  Same approach as CallRail + sGTM: string equality with
 *  crypto.timingSafeEqual to prevent side-channel enumeration. */
function verifySecret(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const providedBuf = Buffer.from(provided.trim());
  const expectedBuf = Buffer.from(expected.trim());
  if (providedBuf.length !== expectedBuf.length) return false;
  try {
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const secret = process.env.PROABD_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[proabd webhook] PROABD_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook receiver not configured" },
      { status: 503 },
    );
  }

  // Accept auth via URL query param OR header. Brian noted 2026-07-06
  // that "most customers use a key in the URL" so ?secret=xxx is supported
  // alongside the header options.
  const url = new URL(req.url);
  const providedSecret =
    url.searchParams.get("secret") ??
    req.headers.get("x-superflo-secret") ??
    req.headers.get("x-proabd-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  // Read raw body FIRST so we can log/capture it regardless of auth outcome.
  // Superflo actively started posting to us 2026-07-08 with no header we
  // recognized. Debug mode lets us capture their actual payload shape while
  // we sort out the auth mechanism with Brian.
  const rawBody = await req.text();
  const verified = verifySecret(providedSecret, secret);
  const debugMode = process.env.PROABD_WEBHOOK_DEBUG_MODE === "true";

  if (!verified && !debugMode) {
    console.warn("[proabd webhook] secret verification failed", {
      hasHeader: providedSecret !== null,
      providedLen: providedSecret?.length ?? 0,
      bodyLen: rawBody.length,
    });
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  if (!verified && debugMode) {
    console.warn(
      "[proabd webhook] DEBUG MODE ACCEPTING UNAUTH: bodyLen=" + rawBody.length +
      " preview=" + rawBody.slice(0, 500),
    );
  }
  let payload: SuperfloPayload;
  try {
    payload = JSON.parse(rawBody) as SuperfloPayload;
  } catch (err) {
    console.warn("[proabd webhook] bad JSON payload", {
      err: err instanceof Error ? err.message : String(err),
      bodyLen: rawBody.length,
    });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Normalize to array. Handles both single-event and batch payloads.
  const items: SuperfloEventItem[] = Array.isArray(payload) ? payload : [payload];

  if (items.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const tenantId = process.env.TENANT_ID ?? "autoline-logistics";
  const receivedAt = FieldValue.serverTimestamp();
  const batchId = crypto.randomUUID();

  let successCount = 0;
  let failureCount = 0;

  try {
    const db = getAdminDb();
    // Firestore has a 500-writes-per-batch limit. Superflo says up to
    // 100 items so a single batch is safely under. If they change,
    // chunk here.
    const batch = db.batch();
    const col = db.collection("proabd_webhook_events");

    for (const item of items) {
      const doc = col.doc();
      // Extract commonly-useful fields for indexing, keep raw payload.
      const record = item.data ?? item.record ?? null;
      const entityType =
        typeof item.entity_type === "string" ? item.entity_type : null;
      const action = typeof item.action === "string" ? item.action : null;
      const entityId =
        typeof item.id === "string" || typeof item.id === "number"
          ? String(item.id)
          : null;

      batch.set(doc, {
        tenant_id: tenantId,
        batch_id: batchId,
        verified,
        action,
        entity_type: entityType,
        entity_id: entityId,
        record,
        raw_item: item,
        received_at: receivedAt,
        parsed: false, // Set true once downstream parser processes it.
      });
      successCount++;
    }

    await batch.commit();
  } catch (err) {
    // See ProABD Integration Notion page "Failure handling". Return 200
    // so Superflo doesn't see this as an outage; we log the error to
    // Vercel + Firestore alert if configured.
    console.error("[proabd webhook] Firestore batch write failed", {
      tenant_id: tenantId,
      batch_id: batchId,
      item_count: items.length,
      err: err instanceof Error ? err.message : String(err),
    });
    failureCount = items.length;
    return NextResponse.json({
      ok: true,
      persisted: false,
      logged: true,
      batch_id: batchId,
      failures: failureCount,
    });
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    batch_id: batchId,
    count: successCount,
  });
}
