/**
 * POST /api/webhooks/sgtm-events
 *
 * Receives events forked by our server-side GTM (sGTM) container and writes
 * them to Firestore analytics_events. sGTM keeps forwarding to GA4 in
 * parallel via its GA4 Event Forwarder tag; this endpoint captures our own
 * first-party copy for reporting, cross-source joins, and future SaaS
 * tenant onboarding.
 *
 * Auth: shared secret in X-SGTM-Secret header. Matches CallRail's approach.
 *
 * Failure policy (deviates from CallRail intentionally):
 *   sGTM does NOT retry Custom HTTP Request tags on failure. Returning 500
 *   would silently drop the event. So on Firestore write failure we LOG the
 *   error but return 200 anyway. Analytics loss is preferable to breaking
 *   the sGTM forwarding chain for downstream consumers.
 *
 * Multi-tenant: tenant_id read from TENANT_ID env var (defaults to
 *   "autoline-logistics"). Adding new tenants is an env var change, not a
 *   schema migration.
 *
 * Raw payload preserved on every doc for debugging + migration path.
 * Firestore storage cost negligible; storage-vs-debuggability trade-off
 * decided in favor of always keeping the raw JSON.
 *
 * Related: src/app/api/webhooks/callrail/route.ts (reference pattern).
 * Notion: Automated Reporting & Analytics Pipeline page for full spec.
 * Added 2026-07-01 as Phase 1a of the reporting pipeline (task #123).
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** sGTM Custom HTTP Request tag payload shape.
 *  Every field is a sGTM built-in variable; the tag config is a JSON template. */
interface SgtmEventPayload {
  /** Event name, e.g. "quote_submitted", "page_view", "calculator_completed". */
  event_name: string;
  /** GA4 persistent client identifier (survives across sessions on same device). */
  client_id?: string;
  /** GA4 session identifier (single visit). */
  session_id?: string;
  /** Client-reported timestamp in microseconds. Server timestamp is source of truth. */
  timestamp_micros?: number;
  /** Full URL when the event fired. */
  page_location?: string;
  /** Referrer URL that brought the visitor. */
  page_referrer?: string;
  /** Browser identification string. */
  user_agent?: string;
  /** Nested event-specific parameters (from_state, to_state, gclid, etc.). */
  event_params?: Record<string, unknown>;
  /** Any additional fields sGTM sends. */
  [key: string]: unknown;
}

/** Verify the shared secret in a timing-safe way.
 *  Same approach as CallRail: string equality (not HMAC) but with
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
  const secret = process.env.SGTM_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[sgtm webhook] SGTM_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook receiver not configured" },
      { status: 503 },
    );
  }

  const providedSecret = req.headers.get("x-sgtm-secret");
  if (!verifySecret(providedSecret, secret)) {
    console.warn("[sgtm webhook] secret verification failed", {
      hasHeader: providedSecret !== null,
      providedLen: providedSecret?.length ?? 0,
    });
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const rawBody = await req.text();
  let payload: SgtmEventPayload;
  try {
    payload = JSON.parse(rawBody) as SgtmEventPayload;
  } catch (err) {
    console.warn("[sgtm webhook] bad JSON payload", {
      err: err instanceof Error ? err.message : String(err),
      bodyLen: rawBody.length,
    });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.event_name || typeof payload.event_name !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid event_name" },
      { status: 400 },
    );
  }

  // Multi-tenant identifier. Env-var driven for future SaaS onboarding.
  const tenantId = process.env.TENANT_ID ?? "autoline-logistics";

  const eventDoc = {
    tenant_id: tenantId,
    event_name: payload.event_name,
    event_params: payload.event_params ?? {},
    client_id: payload.client_id ?? null,
    session_id: payload.session_id ?? null,
    page_location: payload.page_location ?? null,
    page_referrer: payload.page_referrer ?? null,
    user_agent: payload.user_agent ?? null,
    event_timestamp_micros: payload.timestamp_micros ?? null,
    timestamp: FieldValue.serverTimestamp(),
    // Full JSON as received. See Notion Phase 1a decision #2.
    raw_payload: payload,
  };

  try {
    const db = getAdminDb();
    await db.collection("analytics_events").add(eventDoc);
  } catch (err) {
    // See Notion Phase 1a "Failure handling" table. Return 200 to keep
    // sGTM's Custom HTTP Request tag from dropping the event silently on
    // its next retry (there is no retry). We log the failure so we can
    // spot it in Vercel logs; the sGTM → GA4 forwarder still fires.
    console.error("[sgtm webhook] Firestore write failed", {
      tenant_id: tenantId,
      event_name: payload.event_name,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: true, logged: true, persisted: false });
  }

  return NextResponse.json({ ok: true, persisted: true });
}
