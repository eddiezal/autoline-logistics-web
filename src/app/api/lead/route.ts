/**
 * POST /api/lead . quote-form intake endpoint.
 *
 * Validates the captcha, picks the next agent via Firestore round-robin,
 * calls SD pricing for the live estimate, saves the lead doc, and sends
 * an agent notification via Resend.
 *
 * Customer-facing email is NOT sent in Phase 1. The customer sees an
 * inline success state on the form ("an agent will contact you within
 * 1 business hour") and the assigned agent does the outreach manually
 * via ProABD.
 *
 * Returns: { ok: true, leadRef } on success.
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { verifyHcaptcha } from "@/lib/hcaptcha";
import { checkRateLimit, getClientIp, tooManyRequestsResponse } from "@/lib/ratelimit";
import { pickNextAgent, AGENTS, QA_BCC_EMAIL } from "@/lib/leads/agents";
import { buildLeadEmail, buildCustomerEmail } from "@/lib/leads/emailTemplate";
import {
  getSdPriceEstimate,
  toSdVehicleType,
  type SdVehicleType,
} from "@/lib/superdispatch/pricing";
import { sendLeadEmail } from "@/lib/email/resend";
import { zipPrefixToState, lookupZipApprox } from "@/data/zip-metros";

export const runtime = "nodejs";

const TIERS = ["standby", "priority", "expedited"] as const;
type Tier = (typeof TIERS)[number];

const DEV_SKIP_FIRESTORE =
  process.env.NODE_ENV !== "production" &&
  process.env.DEV_SKIP_FIRESTORE === "true";

const DEV_OVERRIDE_RECIPIENT =
  process.env.NODE_ENV !== "production"
    ? process.env.DEV_OVERRIDE_RECIPIENT?.trim() || null
    : null;

interface IncomingPayload {
  origin_zip?: unknown;
  origin_state?: unknown;
  destination_zip?: unknown;
  destination_state?: unknown;
  vehicle_year?: unknown;
  vehicle_make?: unknown;
  vehicle_model?: unknown;
  vehicle_type?: unknown;
  tier?: unknown;
  email?: unknown;
  phone?: unknown;
  notes?: unknown;
  captchaToken?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  variant?: unknown;
  referrer?: unknown;
}

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireStr(v: unknown, max = 200): string | null {
  const s = str(v);
  if (!s || s.length > max) return null;
  return s;
}

function generateLeadRef(): string {
  const now = new Date();
  const ymd =
    String(now.getUTCFullYear()).slice(2) +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return "AL-" + ymd + "-" + rand;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: "lead:" + ip,
    limit: 5,
    windowMs: 60_000,
  });
  if (!rl.success) return tooManyRequestsResponse(rl);

  let body: IncomingPayload;
  try {
    body = (await req.json()) as IncomingPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const captchaOk = await verifyHcaptcha(str(body.captchaToken));
  if (!captchaOk) {
    return NextResponse.json(
      { ok: false, error: "Captcha verification failed. Please try again." },
      { status: 400 },
    );
  }

  const originZip = requireStr(body.origin_zip, 10);
  const destinationZip = requireStr(body.destination_zip, 10);
  // State is derived from ZIP server-side (USPS prefix mapping).
  // No longer trust user-supplied state — see 2026-06-22 form refactor.
  const originState = originZip
    ? (lookupZipApprox(originZip)?.entry.state ?? zipPrefixToState(originZip) ?? "")
    : "";
  const destinationState = destinationZip
    ? (lookupZipApprox(destinationZip)?.entry.state ?? zipPrefixToState(destinationZip) ?? "")
    : "";
  const vehicleYear = requireStr(body.vehicle_year, 4);
  const vehicleMake = requireStr(body.vehicle_make, 60);
  const vehicleModel = requireStr(body.vehicle_model, 60);
  const vehicleType = requireStr(body.vehicle_type, 30);
  const email = requireStr(body.email, 200);
  const phone = requireStr(body.phone, 30);
  const notes = str(body.notes);

  const rawTier = str(body.tier);
  const tier: Tier =
    rawTier && (TIERS as ReadonlyArray<string>).includes(rawTier)
      ? (rawTier as Tier)
      : "priority";

  const missing: string[] = [];
  if (!originZip) missing.push("origin_zip");
  if (!destinationZip) missing.push("destination_zip");
  if (!vehicleYear) missing.push("vehicle_year");
  if (!vehicleMake) missing.push("vehicle_make");
  if (!vehicleModel) missing.push("vehicle_model");
  if (!vehicleType) missing.push("vehicle_type");
  if (!email) missing.push("email");
  if (!phone) missing.push("phone");
  if (missing.length) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields", fields: missing },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email!)) {
    return NextResponse.json(
      { ok: false, error: "Email format is invalid." },
      { status: 400 },
    );
  }

  let assigned: Awaited<ReturnType<typeof pickNextAgent>>;
  if (DEV_SKIP_FIRESTORE) {
    console.warn("[/api/lead] DEV_SKIP_FIRESTORE=true . hardcoding to first agent, skipping Firestore");
    assigned = { agent: AGENTS[0]!, index: 0 };
  } else {
    try {
      assigned = await pickNextAgent();
    } catch (err) {
      console.error("[/api/lead] round-robin assignment failed", err);
      return NextResponse.json(
        { ok: false, error: "Internal error assigning agent. Please retry." },
        { status: 500 },
      );
    }
  }

  // Mapping happens regardless of SD success so we record both raw + mapped
  // types on every lead. Lets us audit which body class SD priced this lead as.
  const sdVehicleType: SdVehicleType = toSdVehicleType(vehicleType!);

  let estimate: {
    source: "sd" | "unavailable";
    sdVehicleType: SdVehicleType;
    price?: number;
    low?: number;
    high?: number;
    confidence?: number;
  } | null = null;
  try {
    const sd = await getSdPriceEstimate({
      pickup: { state: originState!, zip: originZip! },
      delivery: { state: destinationState!, zip: destinationZip! },
      vehicleType: vehicleType!,
      isInoperable: false,
      trailerType: "open",
    });
    estimate = sd
      ? {
          source: "sd",
          sdVehicleType: sd.sdVehicleType,
          price: sd.price,
          low: sd.low,
          high: sd.high,
          confidence: sd.confidence ?? undefined,
        }
      : { source: "unavailable", sdVehicleType };
  } catch (err) {
    console.error("[/api/lead] SD pricing failed (non-fatal)", err);
    estimate = { source: "unavailable", sdVehicleType };
  }

  const leadRef = generateLeadRef();
  const submittedAt = new Date().toISOString();

  const db = DEV_SKIP_FIRESTORE ? null : getAdminDb();
  const leadDoc = {
    leadRef,
    submittedAt,
    createdAt: FieldValue.serverTimestamp(),
    origin: { zip: originZip, state: originState },
    destination: { zip: destinationZip, state: destinationState },
    vehicle: { year: vehicleYear, make: vehicleMake, model: vehicleModel, type: vehicleType },
    tier,
    contact: { email, phone, notes: notes ?? null },
    assignedAgent: { email: assigned.agent.email, firstName: assigned.agent.firstName, index: assigned.index },
    estimate,
    attribution: {
      utmSource: str(body.utm_source) ?? null,
      utmMedium: str(body.utm_medium) ?? null,
      utmCampaign: str(body.utm_campaign) ?? null,
      utmContent: str(body.utm_content) ?? null,
      variant: str(body.variant) ?? null,
      referrer: str(body.referrer) ?? null,
    },
    status: "pending_agent_contact" as const,
  };

  if (db) {
    try {
      await db.collection("leads").add(leadDoc);
    } catch (err) {
      console.error("[/api/lead] failed to save lead", err);
      return NextResponse.json(
        { ok: false, error: "Internal error saving lead. Please retry." },
        { status: 500 },
      );
    }
  } else {
    console.log("[/api/lead] DEV: would have persisted lead " + leadRef);
  }

  const { subject, text, html } = buildLeadEmail({
    leadRef,
    agentFirstName: assigned.agent.firstName,
    customer: { email: email!, phone: phone!, notes },
    origin: { city: "", state: originState!, zip: originZip! },
    destination: { city: "", state: destinationState!, zip: destinationZip! },
    vehicle: { year: vehicleYear!, make: vehicleMake!, model: vehicleModel!, type: vehicleType! },
    tier,
    estimate,
    attribution: {
      utmSource: str(body.utm_source),
      utmMedium: str(body.utm_medium),
      utmCampaign: str(body.utm_campaign),
      utmContent: str(body.utm_content),
      variant: str(body.variant),
      referrer: str(body.referrer),
    },
    submittedAt,
  });

  const recipientsTo = DEV_OVERRIDE_RECIPIENT ? [DEV_OVERRIDE_RECIPIENT] : [assigned.agent.email];
  const recipientsBcc = DEV_OVERRIDE_RECIPIENT ? undefined : [QA_BCC_EMAIL];
  if (DEV_OVERRIDE_RECIPIENT) {
    console.warn("[/api/lead] DEV_OVERRIDE_RECIPIENT set . redirecting email to " + DEV_OVERRIDE_RECIPIENT);
  }

  const sendResult = await sendLeadEmail({
    to: recipientsTo,
    bcc: recipientsBcc,
    replyTo: email!,
    subject,
    text,
    html,
    tags: [
      { name: "leadRef", value: leadRef },
      { name: "agent", value: assigned.agent.firstName.toLowerCase() },
      { name: "tier", value: tier },
    ],
  });

  if (!sendResult.ok) {
    console.error("[/api/lead] Resend send failed for lead " + leadRef + ": " + sendResult.error);
  } else if (db) {
    try {
      await db
        .collection("leads")
        .where("leadRef", "==", leadRef)
        .limit(1)
        .get()
        .then((snap) => {
          if (!snap.empty) {
            return snap.docs[0]!.ref.update({
              emailMessageId: sendResult.id ?? null,
              emailSentAt: FieldValue.serverTimestamp(),
            });
          }
        });
    } catch (err) {
      console.warn("[/api/lead] failed to stamp resend id on lead", err);
    }
  } else {
    console.log("[/api/lead] DEV: Resend send ok, id=" + (sendResult.id ?? "?"));
  }

  // Customer-facing confirmation email.
  //
  // Sent after the agent notification so the lead never blocks on customer
  // delivery. Failures are logged but non-fatal. Reply-to is the admin inbox
  // so any customer reply lands somewhere monitored.
  try {
    const customerEmail = buildCustomerEmail({
      leadRef,
      origin: { city: "", state: originState!, zip: originZip! },
      destination: { city: "", state: destinationState!, zip: destinationZip! },
      vehicle: {
        year: vehicleYear!,
        make: vehicleMake!,
        model: vehicleModel!,
      },
      tier,
    });
    const customerSend = await sendLeadEmail({
      to: [email!],
      replyTo: "admin@autolinelogistics.com",
      subject: customerEmail.subject,
      text: customerEmail.text,
      html: customerEmail.html,
      tags: [
        { name: "leadRef", value: leadRef },
        { name: "emailType", value: "customer-confirmation" },
        { name: "tier", value: tier },
      ],
    });
    if (!customerSend.ok) {
      console.error(
        "[/api/lead] customer confirmation send failed for " +
          leadRef +
          ": " +
          customerSend.error,
      );
    } else if (db) {
      try {
        await db
          .collection("leads")
          .where("leadRef", "==", leadRef)
          .limit(1)
          .get()
          .then((snap) => {
            if (!snap.empty) {
              return snap.docs[0]!.ref.update({
                customerEmailMessageId: customerSend.id ?? null,
                customerEmailSentAt: FieldValue.serverTimestamp(),
              });
            }
          });
      } catch (err) {
        console.warn(
          "[/api/lead] failed to stamp customer email id on lead",
          err,
        );
      }
    } else {
      console.log(
        "[/api/lead] DEV: customer confirmation send ok, id=" +
          (customerSend.id ?? "?"),
      );
    }
  } catch (err) {
    // Never let customer-email problems break the lead flow. The agent has
    // already been notified; the lead is in Firestore; the customer saw the
    // inline success state. A failed confirmation is an inconvenience, not
    // an outage.
    console.error("[/api/lead] customer confirmation threw", err);
  }

  return NextResponse.json({ ok: true, leadRef });
}
