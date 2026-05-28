/**
 * POST /api/payments/webhook
 *
 * Receives Authorize.Net webhook notifications (payment captured, refunded,
 * voided, held, etc.). Verifies the X-ANET-Signature HMAC before trusting
 * anything, then branches on eventType.
 *
 * IMPORTANT: we must read the RAW body for signature verification — Auth.net
 * signs the exact bytes it sent, so we cannot use req.json() first (that would
 * re-serialize and can change whitespace/ordering). We read text(), verify,
 * then parse.
 *
 * The status-update handler is stubbed for now — it will write to the Firestore
 * `Payment` entity (see portal-design/architecture-v1.md §3) once the portal
 * datastore is live. Until then we verify + log so we can confirm the signature
 * path against real sandbox webhooks.
 *
 * Configure the endpoint URL + event subscriptions in the Auth.net dashboard
 * (Account → Settings → Webhooks). For local testing, tunnel with e.g. a
 * trycloudflare/ngrok URL pointing at /api/payments/webhook.
 */

import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/authnet";

export const runtime = "nodejs";

interface AnetNotification {
  notificationId?: string;
  eventType?: string; // e.g. "net.authorize.payment.authcapture.created"
  eventDate?: string;
  payload?: {
    responseCode?: number;
    authCode?: string;
    avsResponse?: string;
    authAmount?: number;
    entityName?: string; // "transaction"
    id?: string; // transaction id
  };
}

export async function POST(req: Request) {
  // 1. Raw body — required for signature verification.
  const raw = await req.text();
  const signature = req.headers.get("x-anet-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    console.warn("Auth.net webhook: signature verification FAILED");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // 2. Parse only after the signature checks out.
  let event: AnetNotification;
  try {
    event = JSON.parse(raw) as AnetNotification;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const type = event.eventType || "";
  const transId = event.payload?.id || "";

  // 3. Branch on event type. Handlers are stubs until the Firestore Payment
  //    entity is live — for now we log so we can confirm the live event shapes.
  switch (true) {
    case type.includes("authcapture"):
    case type.includes("capture"):
      // TODO(Firestore): mark Payment captured, set transactionId, surface in portal.
      console.info(`[anet webhook] capture: tx=${transId} amount=${event.payload?.authAmount}`);
      break;
    case type.includes("refund"):
      // TODO(Firestore): mark Payment refunded.
      console.info(`[anet webhook] refund: tx=${transId}`);
      break;
    case type.includes("void"):
      // TODO(Firestore): mark Payment voided.
      console.info(`[anet webhook] void: tx=${transId}`);
      break;
    case type.includes("fraud") || type.includes("held"):
      // TODO(Firestore): flag Payment held for review.
      console.info(`[anet webhook] held/fraud: tx=${transId}`);
      break;
    default:
      console.info(`[anet webhook] unhandled eventType="${type}" tx=${transId}`);
  }

  // 4. Always 200 quickly on a verified event so Auth.net doesn't retry.
  return NextResponse.json({ received: true });
}
