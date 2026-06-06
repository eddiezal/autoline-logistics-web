/**
 * POST /api/payments/charge
 *
 * Browser tokenizes the card with Accept.js, then sends ONLY the opaque token
 * here. This route auth+captures via Authorize.Net server-side. No PAN ever
 * touches our server, so we stay out of PCI scope.
 *
 * Request body:
 *   {
 *     amountCents: number,            // integer cents
 *     opaque: { dataDescriptor, dataValue },  // from Accept.js
 *     refId?: string,                 // e.g. order number (<=20 chars)
 *     invoiceNumber?: string,
 *     description?: string,
 *     customerEmail?: string
 *   }
 *
 * Response (200): { approved, responseCode, transactionId, authCode, last4, message }
 * Response (4xx/502): { error }
 */

import { NextResponse } from "next/server";
import { chargeWithOpaqueData, isConfigured } from "@/lib/payments/authnet";
import {
  checkRateLimit,
  getClientIp,
  tooManyRequestsResponse,
} from "@/lib/ratelimit";

export const runtime = "nodejs";

function isOpaque(v: unknown): v is { dataDescriptor?: string; dataValue: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { dataValue?: unknown }).dataValue === "string" &&
    (v as { dataValue: string }).dataValue.length > 0
  );
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function POST(req: Request) {
  // Rate limit: 5 charge attempts per minute per IP. Card-testing bots iterate
  // many stolen PANs fast; legitimate customers retry maybe once or twice.
  // Burst over this and we 429 with Retry-After.
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `payments-charge:${ip}`,
    limit: 5,
    windowMs: 60_000,
  });
  if (!rl.success) return tooManyRequestsResponse(rl);

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const amountCents = body.amountCents;
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json(
      { error: "amountCents must be a positive number." },
      { status: 400 },
    );
  }
  if (!isOpaque(body.opaque)) {
    return NextResponse.json(
      { error: "Missing or invalid payment token." },
      { status: 400 },
    );
  }

  const result = await chargeWithOpaqueData({
    amountCents: Math.round(amountCents),
    opaque: {
      dataDescriptor: str(body.opaque.dataDescriptor) || "COMMON.ACCEPT.INAPP.PAYMENT",
      dataValue: body.opaque.dataValue,
    },
    refId: str(body.refId),
    invoiceNumber: str(body.invoiceNumber),
    description: str(body.description),
    customerEmail: str(body.customerEmail),
  });

  if (!result.ok) {
    // Gateway/config failure — 502 so the client can distinguish from a decline.
    console.warn("Charge failed:", result.error, result.code ?? "");
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Approved OR declined both return 200; the client branches on `approved`.
  return NextResponse.json({
    approved: result.approved,
    responseCode: result.responseCode,
    transactionId: result.transactionId,
    authCode: result.authCode,
    last4: result.accountLast4,
    message: result.message,
  });
}
