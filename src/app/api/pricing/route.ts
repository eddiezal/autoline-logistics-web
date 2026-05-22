/**
 * POST /api/pricing — returns an SD market price for a mainland route+vehicle,
 * or { source: "unavailable" }. Browser calls this; token stays server-side.
 */
import { NextResponse } from "next/server";
import { getSdPriceEstimate } from "@/lib/superdispatch/pricing";

export const runtime = "nodejs";

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; body: unknown }>();

function isZip(z: unknown): z is string {
  return typeof z === "string" && /^\d{5}$/.test(z);
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// Our vehicle keys -> SD's vehicle type enum. CONFIRM SD's enum from the live
// response/docs — trucks + classic/exotic are best-guess.
const SD_VEHICLE: Record<string, string> = {
  sedan: "sedan",
  suv: "suv",
  truckStandard: "pickup",
  truckLifted: "pickup",
  van: "van",
  motorcycle: "motorcycle",
  classic: "sedan",
  exotic: "sedan",
};

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ source: "unavailable" }, { status: 400 });
  }

  const fromZip = body.fromZip;
  const toZip = body.toZip;
  if (!isZip(fromZip) || !isZip(toZip)) {
    return NextResponse.json({ source: "unavailable" }, { status: 400 });
  }

  const sdVehicle = SD_VEHICLE[String(body.vehicleType)] || "sedan";
  const trailer: "open" | "enclosed" =
    body.transportType === "enclosed" ? "enclosed" : "open";
  const isInoperable = Boolean(body.isInoperable);

  const key = `${fromZip}|${toZip}|${sdVehicle}|${trailer}|${isInoperable ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.body);
  }

  const estimate = await getSdPriceEstimate({
    pickup: { city: str(body.fromCity), state: str(body.fromState), zip: fromZip },
    delivery: { city: str(body.toCity), state: str(body.toState), zip: toZip },
    vehicleType: sdVehicle,
    isInoperable,
    trailerType: trailer,
  });

  const responseBody = estimate
    ? {
        source: "sd",
        price: estimate.price,
        low: estimate.low,
        high: estimate.high,
        confidence: estimate.confidence,
      }
    : { source: "unavailable" };
  if (estimate) cache.set(key, { at: Date.now(), body: responseBody });
  return NextResponse.json(responseBody);
}
