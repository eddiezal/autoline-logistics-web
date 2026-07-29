/**
 * POST /api/estimate-email — "Email me this estimate" capture.
 *
 * Spec: claude/estimate-email-capture-spec.md (2026-07-29). Converts an
 * anonymous Route Price Checker research signal into a contactable capture:
 * ONE transactional email with the estimate + a prefilled /quote link.
 *
 * Deliberate constraints (v1):
 * - NO ProABD push — a researcher who typed an email did not ask for a
 *   sales call. Captures reach the CRM only if they later submit /quote.
 * - ONE email per capture, ever. No sequences without explicit consent.
 * - The event stream never carries the address (PII stays out of
 *   site_events); the email lives only on the estimate_captures doc.
 * - The quote link is tagged utm_source=estimate_email so the return
 *   visit doesn't misattribute to paid search.
 *
 * Language discipline (metric contract §8): these are CAPTURED ESTIMATES,
 * never "leads". Capture→lead joins happen at read time via emailKey
 * against P4 identity entities.
 */
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { normalizeEmailKey } from "@/lib/leads/identity";
import { sendLeadEmail } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Vehicle = "sedan" | "suv" | "pickup";
const VEHICLES: ReadonlyArray<Vehicle> = ["sedan", "suv", "pickup"];

const SITE = "https://www.autolinelogistics.com";

/** Per-session and per-IP caps — abuse brake, not a funnel constraint. */
const MAX_PER_SESSION = 3;
const MAX_PER_IP_PER_DAY = 10;

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 && s.length <= max ? s : null;
}

const isZip = (z: unknown): z is string => typeof z === "string" && /^\d{5}$/.test(z);

function money(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

interface EmailCopy {
  subject: string;
  title: string;
  routeLine: (from: string, to: string, vehicle: string) => string;
  rangeLine: (low: string, high: string, date: string) => string;
  lockBold: string;
  lockRest: string;
  cta: string;
  orCall: string;
  footerAsk: string;
}

const COPY: Record<"en" | "es", EmailCopy> = {
  en: {
    subject: "Your car shipping estimate",
    title: "Your car shipping estimate",
    routeLine: (f, t, v) => `${f} → ${t} · ${v} · Open transport`,
    rangeLine: (l, h, d) => `Typical range ${l} – ${h} · checked ${d}`,
    lockBold: "The price we email is the price we quote.",
    lockRest: "Carrier supply moves prices week to week — lock yours in when you're ready.",
    cta: "Get my exact quote",
    orCall: "or call us at (714) 660-7558",
    footerAsk:
      "You asked for this estimate on autolinelogistics.com. We won't email you again unless you ask.",
  },
  es: {
    subject: "Tu cotización de transporte de auto",
    title: "Tu cotización de transporte de auto",
    routeLine: (f, t, v) => `${f} → ${t} · ${v} · Transporte abierto`,
    rangeLine: (l, h, d) => `Rango típico ${l} – ${h} · consultado ${d}`,
    lockBold: "El precio que te enviamos es el precio que cotizamos.",
    lockRest:
      "Los precios cambian semana a semana con la oferta de transportistas — asegura el tuyo cuando quieras.",
    cta: "Obtener mi cotización exacta",
    orCall: "o llámanos al (714) 660-7558",
    footerAsk:
      "Pediste esta cotización en autolinelogistics.com. No te volveremos a escribir a menos que tú lo pidas.",
  },
};

const VEHICLE_LABEL: Record<"en" | "es", Record<Vehicle, string>> = {
  en: { sedan: "Sedan", suv: "SUV / Crossover", pickup: "Pickup" },
  es: { sedan: "Sedán", suv: "SUV / Crossover", pickup: "Pickup" },
};

function buildEmail(args: {
  locale: "en" | "es";
  fromZip: string;
  toZip: string;
  vehicle: Vehicle;
  price: number;
  low: number;
  high: number;
  quoteUrl: string;
}): { subject: string; text: string; html: string } {
  const c = COPY[args.locale];
  const vLabel = VEHICLE_LABEL[args.locale][args.vehicle];
  const date = new Date().toLocaleDateString(args.locale === "es" ? "es-US" : "en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const route = c.routeLine(args.fromZip, args.toZip, vLabel);
  const range = c.rangeLine(money(args.low), money(args.high), date);

  const text = [
    c.title,
    "",
    route,
    money(args.price),
    range,
    "",
    `${c.lockBold} ${c.lockRest}`,
    "",
    `${c.cta}: ${args.quoteUrl}`,
    c.orCall,
    "",
    c.footerAsk,
    "Auto Line Logistics, Inc · Los Angeles, CA",
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f6;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f6;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
        <tr><td style="background:#061F16;padding:18px 24px">
          <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#7ee2a0;text-transform:uppercase">Auto Line Logistics</div>
          <div style="font-size:18px;font-weight:bold;color:#ffffff;margin-top:5px">${c.title}</div>
        </td></tr>
        <tr><td style="padding:20px 24px 8px">
          <div style="font-size:13px;color:#6b7280">${route}</div>
          <div style="font-size:32px;font-weight:800;color:#061F16;margin:6px 0 2px">${money(args.price)}</div>
          <div style="font-size:13px;color:#6b7280">${range}</div>
        </td></tr>
        <tr><td style="padding:14px 24px 0">
          <div style="background:#fafcfa;border:1px solid #e5e7eb;border-radius:10px;padding:11px 14px;font-size:13px;color:#374151">
            <b>${c.lockBold}</b> ${c.lockRest}
          </div>
        </td></tr>
        <tr><td style="padding:16px 24px 6px">
          <a href="${args.quoteUrl}" style="display:block;text-align:center;background:#128A3A;color:#ffffff;font-weight:bold;font-size:14px;padding:13px;border-radius:10px;text-decoration:none">${c.cta} →</a>
          <div style="text-align:center;font-size:12.5px;color:#6b7280;padding:10px 0 12px">${c.orCall}</div>
        </td></tr>
        <tr><td style="border-top:1px solid #e5e7eb;padding:12px 24px 16px">
          <div style="font-size:10.5px;color:#9ca3af;line-height:1.6">${c.footerAsk}<br>Auto Line Logistics, Inc · Los Angeles, CA</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject: c.subject, text, html };
}

export async function POST(req: Request): Promise<NextResponse> {
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  // ── Validate ──
  const email = str(b.email, 254);
  const emailKey = email !== null ? normalizeEmailKey(email) : null;
  if (email === null || emailKey === null) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  const fromZip = b.fromZip;
  const toZip = b.toZip;
  if (!isZip(fromZip) || !isZip(toZip)) {
    return NextResponse.json({ ok: false, error: "invalid_zip" }, { status: 400 });
  }
  const vehicle = VEHICLES.includes(b.vehicle as Vehicle) ? (b.vehicle as Vehicle) : "sedan";
  const price = Number(b.price);
  const low = Number(b.low);
  const high = Number(b.high);
  const sane = (n: number) => Number.isFinite(n) && n >= 100 && n <= 20000;
  if (!sane(price) || !sane(low) || !sane(high) || low > high || price < low - 200 || price > high + 200) {
    return NextResponse.json({ ok: false, error: "invalid_price" }, { status: 400 });
  }
  const locale: "en" | "es" = b.locale === "es" ? "es" : "en";
  const sid = str(b.sid, 60);

  // Session attribution — same clamping as /api/events.
  let attr: Record<string, string | boolean> | null = null;
  if (b.attr && typeof b.attr === "object") {
    attr = {};
    const a = b.attr as Record<string, unknown>;
    const idOnly = (v: unknown): string | null => {
      const s = str(v, 30);
      return s && /^\d{1,20}$/.test(s) ? s : null;
    };
    const src = str(a.src, 60);
    if (src) attr.src = src.toLowerCase();
    const med = str(a.med, 60);
    if (med) attr.med = med.toLowerCase();
    const campaignId = idOnly(a.campaignId);
    if (campaignId) attr.campaignId = campaignId;
    const adGroupId = idOnly(a.adGroupId);
    if (adGroupId) attr.adGroupId = adGroupId;
    if (a.gclid === true) attr.gclid = true;
    if (Object.keys(attr).length === 0) attr = null;
  }

  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

  try {
    const db = getAdminDb();
    const col = db.collection("estimate_captures");

    // ── Rate limits (soft-fail 429; the UI keeps the /quote CTA visible) ──
    if (sid) {
      const bySession = await col.where("sid", "==", sid).limit(MAX_PER_SESSION).get();
      if (bySession.size >= MAX_PER_SESSION) {
        return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
      }
    }
    const byIp = await col.where("ip", "==", ip).limit(30).get();
    const dayAgo = Date.now() - 86_400_000;
    const ipRecent = byIp.docs.filter((d) => {
      const at = d.get("createdAt")?.toDate?.() as Date | undefined;
      return at ? at.getTime() > dayAgo : true;
    }).length;
    if (ipRecent >= MAX_PER_IP_PER_DAY) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    // ── Store first (capture survives a failed send), then send ──
    const quoteUrl =
      `${SITE}${locale === "es" ? "/es" : ""}/quote?fromZip=${fromZip}&toZip=${toZip}` +
      `&vehicleType=${vehicle}&utm_source=estimate_email&utm_medium=email`;

    const docRef = await col.add({
      email,
      emailKey,
      fromZip,
      toZip,
      vehicle,
      price: Math.round(price),
      low: Math.round(low),
      high: Math.round(high),
      locale,
      sid: sid ?? null,
      attr,
      ip,
      tool: "route-checker",
      emailStatus: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    const msg = buildEmail({ locale, fromZip, toZip, vehicle, price, low, high, quoteUrl });
    const sent = await sendLeadEmail({
      to: [email],
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      tags: [{ name: "type", value: "estimate_capture" }],
    });

    await docRef.update({
      emailStatus: sent.ok ? "sent" : "failed",
      ...(sent.id ? { resendId: sent.id } : {}),
      ...(sent.error ? { emailError: sent.error.slice(0, 500) } : {}),
    });

    if (!sent.ok) {
      return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[estimate-email] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
