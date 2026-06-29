/**
 * Super Dispatch . Pricing Insights client (SERVER ONLY).
 * Imported only by /api/pricing . never a client component . so the token
 * never reaches the browser. Do NOT add "use client".
 *
 * Endpoint:  POST https://pricing-insights.superdispatch.com/api/v1/recommended-price
 * Auth:      X-API-Key header (static token).
 * Coverage:  continental US only (no AK/HI/PR/cross-border).
 * Rate:      50 req / 10s per IP (covered by route debounce + 3h cache).
 *
 * Request body (confirmed from SD reference):
 *   { pickup:{city?,state?,zip}, delivery:{city?,state?,zip},
 *     trailer_type:"open"|"enclosed", vehicles:[{type, is_inoperable}] }
 * Response is { meta, data } . exact price/confidence field names inside `data`
 * are confirmed on the first live call (parseResponse tries the common shapes).
 *
 * VEHICLE TYPE MAPPING (added 2026-06-29 after AL-260629-USC5MC silent failure):
 *   Customer-facing forms offer "classic", "motorcycle", "van", "truckStandard",
 *   "truckLifted", "other" in addition to "sedan" / "suv" / "pickup". SD only
 *   recognizes the latter three. We map at this boundary so the original type
 *   is still preserved in Firestore + agent email, while SD gets a usable input.
 */

import "server-only";
import { applyCustomerMarkup } from "@/lib/pricing/markup";

export interface PriceQuery {
  pickup: { city?: string; state?: string; zip: string };
  delivery: { city?: string; state?: string; zip: string };
  vehicleType: string;
  isInoperable: boolean;
  trailerType: "open" | "enclosed";
}

export interface PriceEstimate {
  price: number;
  low: number;
  high: number;
  confidence: number | null;
  source: "sd";
}

const env = {
  apiKey:
    process.env.SD_PRICING_API_KEY?.trim() ||
    process.env.SD_PRICING_ACCESS_TOKEN?.trim() ||
    "",
  baseUrl: (process.env.SD_PRICING_BASE_URL?.trim() || "").replace(/\/$/, ""),
  quotePath: process.env.SD_PRICING_QUOTE_PATH?.trim() || "",
};

function isConfigured(): boolean {
  return Boolean(env.apiKey && env.baseUrl && env.quotePath);
}

/**
 * Map our customer-facing vehicle types to what SD's Pricing Insights API
 * actually accepts ("sedan" | "suv" | "pickup"). Anything else gets silently
 * normalized so the SD call succeeds. The original type stays intact on the
 * lead doc and agent email; this only affects what hits SD.
 */
function toSdVehicleType(raw: string): "sedan" | "suv" | "pickup" {
  const v = raw.toLowerCase().trim();
  if (v === "sedan" || v === "suv" || v === "pickup") return v;
  // Truck variants . map to pickup (closest SD body class).
  if (
    v === "truck" ||
    v === "truckstandard" ||
    v === "truck_standard" ||
    v === "trucklifted" ||
    v === "truck_lifted"
  ) {
    return "pickup";
  }
  // Van + minivan . closest is SUV body class for SD pricing purposes.
  if (v === "van" || v === "minivan") return "suv";
  // classic, motorcycle, exotic, other, unknown . sedan is the sensible baseline.
  return "sedan";
}

function loc(l: { city?: string; state?: string; zip: string }) {
  return {
    ...(l.city ? { city: l.city } : {}),
    ...(l.state ? { state: l.state } : {}),
    zip: l.zip,
  };
}

function buildPayload(q: PriceQuery): Record<string, unknown> {
  return {
    pickup: loc(q.pickup),
    delivery: loc(q.delivery),
    trailer_type: q.trailerType,
    vehicles: [{ type: toSdVehicleType(q.vehicleType), is_inoperable: q.isInoperable }],
  };
}

// Response is { meta, data }; price/confidence live in data. Tries common names.
function parseResponse(json: Record<string, unknown>): PriceEstimate | null {
  const num = (v: unknown): number | null => {
    const n = typeof v === "string" ? parseFloat(v) : (v as number);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const root = (json.data as Record<string, unknown>) || json;
  const price =
    num(root.price) ??
    num(root.recommended_price) ??
    num(root.recommendation) ??
    num(root.median) ??
    num(root.mean);
  if (price == null) return null;
  const low = num(root.low) ?? num(root.min) ?? Math.round(price * 0.9);
  const high = num(root.high) ?? num(root.max) ?? Math.round(price * 1.1);
  const confidence =
    num(root.confidence) ?? num(root.confidence_score) ?? num(root.score);
  return { price, low, high, confidence, source: "sd" };
}

/**
 * Fetch a price estimate from Super Dispatch.
 *
 * By default the customer-facing markup is applied (see
 * src/lib/pricing/markup.ts). For calibration / internal tools that need
 * the raw SD market number, pass { markup: false }.
 */
export async function getSdPriceEstimate(
  q: PriceQuery,
  opts: { markup?: boolean } = {},
): Promise<PriceEstimate | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(env.baseUrl + env.quotePath, {
      method: "POST",
      headers: {
        "X-API-Key": env.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(buildPayload(q)),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`SD pricing call failed: ${res.status} ${res.statusText} (raw type: ${q.vehicleType})`);
      return null;
    }
    const json = (await res.json()) as Record<string, unknown>;
    const raw = parseResponse(json);
    if (!raw) return null;
    return opts.markup === false ? raw : applyCustomerMarkup(raw);
  } catch (err) {
    console.warn("SD pricing error:", err);
    return null;
  }
}
