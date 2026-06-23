/**
 * POST /api/webhooks/callrail
 *
 * Receives CallRail call-completed webhook events, validates the HMAC
 * signature, maps to our internal Lead schema, writes to Firestore, and
 * fires a GA4 call_completed event via Measurement Protocol.
 *
 * Auth: CallRail signs every webhook with HMAC-SHA256. The signature is in
 *       the `signature` header. We compute the expected signature from
 *       CALLRAIL_WEBHOOK_SECRET and reject any mismatch.
 *
 * Idempotency: dedupe by CallRail call ID. If we've already written a lead
 *              for this call (e.g. CallRail retried), no-op gracefully.
 *
 * Fire-and-forget side effects:
 *   - Firestore write to `leads` collection with source: "call"
 *   - GA4 call_completed event via Measurement Protocol
 *   - (Future) agent email notification when we wire it in Phase 2
 *
 * Added 2026-06-23 as part of CallRail Phase 1 rollout. See:
 *   CallRail-Kickoff-Plan.md
 *   CallRail-Strategy.md
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CallRail webhook payload, narrowed to fields we use.
 *  CallRail's full schema has more, but we don't need them yet. */
interface CallRailPayload {
  /** CallRail's globally unique call ID. Used for idempotency. */
  id: string;
  /** Source pool name as configured in CallRail dashboard (e.g. "Google Paid"). */
  source: string;
  /** Caller's phone number, E.164 format. */
  caller_number?: string;
  /** Tracking number the caller dialed (lets us know which pool routed). */
  called_number?: string;
  /** ISO8601 timestamp of call start. */
  start_time?: string;
  /** Call duration in seconds. */
  duration?: number;
  /** "inbound" or "outbound". We only care about inbound. */
  direction?: "inbound" | "outbound";
  /** Signed URL to call recording (if recording enabled). */
  recording?: string;
  /** Signed URL to transcript (if Conversation Intelligence tier). */
  transcript?: string;
  /** Page the visitor was on when they called. */
  landing_page?: string;
  /** HTTP referrer that brought them to the site. */
  referrer?: string;
  /** UTM params parsed from the landing URL. */
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  /** CallRail company + customer IDs (for auditing). */
  company_id?: string;
  customer_id?: string;
}

/** Verify the CallRail HMAC-SHA256 signature. */
function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  // CallRail sends "sha256=<hex>" format. Strip the prefix if present.
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const provided = signature.replace(/^sha256=/, "");
  // Timing-safe comparison.
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex"),
    );
  } catch {
    return false;
  }
}

/** Fire a GA4 call_completed event via Measurement Protocol.
 *  Non-blocking — we don't await this in the main flow. */
async function fireGa4Event(payload: CallRailPayload): Promise<void> {
  const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_MEASUREMENT_PROTOCOL_SECRET;
  if (!measurementId || !apiSecret) {
    console.warn("[callrail webhook] GA4 measurement protocol secret not configured; skipping event");
    return;
  }
  // Use the call ID as a stable client_id when we don't have a cookie-based
  // one. This is best-effort attribution; real session-linking will require
  // CallRail's GA4 connector in a later phase.
  const clientId = `callrail.${payload.id}`;
  const body = {
    client_id: clientId,
    events: [
      {
        name: "call_completed",
        params: {
          call_source: payload.source,
          call_duration_sec: payload.duration ?? 0,
          call_direction: payload.direction ?? "inbound",
          landing_page: payload.landing_page ?? "",
          referrer: payload.referrer ?? "",
          utm_source: payload.utm_source ?? "",
          utm_medium: payload.utm_medium ?? "",
          utm_campaign: payload.utm_campaign ?? "",
          callrail_id: payload.id,
        },
      },
    ],
  };
  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  } catch (err) {
    console.error("[callrail webhook] GA4 event fire failed:", err);
  }
}

export async function POST(req: Request) {
  const secret = process.env.CALLRAIL_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[callrail webhook] CALLRAIL_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook receiver not configured" },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("signature") ?? req.headers.get("x-callrail-signature");

  if (!verifySignature(rawBody, signature, secret)) {
    console.warn("[callrail webhook] signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: CallRailPayload;
  try {
    payload = JSON.parse(rawBody) as CallRailPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.id) {
    return NextResponse.json({ error: "Missing call id" }, { status: 400 });
  }

  // Only process inbound calls. Outbound calls are agent-initiated and
  // don't represent leads.
  if (payload.direction && payload.direction !== "inbound") {
    return NextResponse.json({ ok: true, skipped: "outbound" });
  }

  const db = getAdminDb();
  const callDocRef = db.collection("leads").doc(`call_${payload.id}`);

  // Idempotency check: if this call ID already wrote a lead, no-op.
  // CallRail occasionally retries webhooks on transient failures.
  const existing = await callDocRef.get();
  if (existing.exists) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const submittedAt = payload.start_time ?? new Date().toISOString();
  const leadDoc = {
    leadRef: `CALL-${payload.id}`,
    source: "call" as const,
    submittedAt,
    createdAt: FieldValue.serverTimestamp(),
    // Origin / destination / vehicle stay null until agent collects them
    // during the call (Phase 2 post-call outcome capture flow).
    origin: null,
    destination: null,
    vehicle: null,
    tier: null,
    contact: {
      phone: payload.caller_number ?? null,
      email: null,
      notes: null,
    },
    // Assignment happens in CallRail (the call already rang the agent).
    // We do not pre-assign here.
    assignedAgent: null,
    estimate: null,
    callMeta: {
      callrailId: payload.id,
      calledNumber: payload.called_number ?? null,
      durationSec: payload.duration ?? null,
      recordingUrl: payload.recording ?? null,
      transcriptUrl: payload.transcript ?? null,
      sourcePool: payload.source,
      landingPage: payload.landing_page ?? null,
    },
    attribution: {
      utmSource: payload.utm_source ?? null,
      utmMedium: payload.utm_medium ?? null,
      utmCampaign: payload.utm_campaign ?? null,
      utmContent: payload.utm_content ?? null,
      referrer: payload.referrer ?? null,
    },
    // Status starts as "completed" (the call ended). Agents update with
    // outcome (quoted / booked / lost / unfit) via the Phase 2 dashboard.
    status: "call_completed" as const,
  };

  try {
    await callDocRef.set(leadDoc);
  } catch (err) {
    console.error("[callrail webhook] Firestore write failed:", err);
    return NextResponse.json(
      { error: "Failed to persist call lead" },
      { status: 500 },
    );
  }

  // Fire GA4 event in the background. Don't block the webhook response
  // on GA4 latency — CallRail expects fast acks.
  fireGa4Event(payload).catch((err) =>
    console.error("[callrail webhook] GA4 background fire failed:", err),
  );

  return NextResponse.json({ ok: true, leadRef: leadDoc.leadRef });
}
