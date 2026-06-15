/**
 * POST /api/route-price-checker
 *
 * Endpoint behind /tools/route-price-checker. Takes a from-ZIP / to-ZIP /
 * selected-vehicle, calls Super Dispatch for ALL THREE vehicle types in
 * parallel (so the result panel can show sedan / SUV / pickup), writes
 * the query to Firestore for analytics, returns prices.
 *
 * Hawaii/Alaska detection by ZIP prefix happens BEFORE SD is called — SD
 * Pricing Insights only covers continental US, and we'd rather show a
 * friendly fallback than wait for SD's error.
 *
 * Per the cached-vs-quoted rule: this endpoint produces ESTIMATES for the
 * researcher. The actual locked quote happens at /quote, which hits SD live
 * with the customer's full booking info.
 */
import { NextResponse } from "next/server";
import { getSdPriceEstimate } from "@/lib/superdispatch/pricing";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Vehicle = "sedan" | "suv" | "pickup";
const VEHICLES: ReadonlyArray<Vehicle> = ["sedan", "suv", "pickup"];

function isZip(z: unknown): z is string {
  return typeof z === "string" && /^\d{5}$/.test(z);
}

/** Crude continental-US check by ZIP prefix.
 *  HI: 967xx, 968xx  ·  AK: 995xx-999xx  ·  PR/USVI: 006xx-009xx
 *  Anything else is treated as continental-US-eligible for SD. */
function isUnsupportedRoute(zip: string): boolean {
  const p3 = zip.slice(0, 3);
  if (p3 === "967" || p3 === "968") return true; // Hawaii
  if (zip >= "99500" && zip <= "99999") return true; // Alaska
  if (zip >= "00600" && zip <= "00999") return true; // PR / USVI
  return false;
}

interface PriceBracket {
  low: number;
  high: number;
  recommended: number;
}

async function logQuery(data: {
  fromZip: string;
  toZip: string;
  selectedVehicle: Vehicle;
  status: "ok" | "unsupported_route" | "sd_error" | "invalid_zip";
  prices?: Partial<Record<Vehicle, PriceBracket | null>>;
  errorReason?: string;
}): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection("route_price_checker_queries").add({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Never let logging failure block the user. Just warn.
    console.warn("[route-price-checker] failed to log query:", err);
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ status: "invalid_zip" as const }, { status: 400 });
  }

  const fromZip = body.fromZip;
  const toZip = body.toZip;
  const selectedVehicleRaw = body.selectedVehicle;

  if (!isZip(fromZip) || !isZip(toZip)) {
    return NextResponse.json({ status: "invalid_zip" as const }, { status: 400 });
  }

  const selectedVehicle: Vehicle = VEHICLES.includes(selectedVehicleRaw as Vehicle)
    ? (selectedVehicleRaw as Vehicle)
    : "sedan";

  // Unsupported-route gate (HI / AK / PR). Log + return friendly fallback.
  if (isUnsupportedRoute(fromZip) || isUnsupportedRoute(toZip)) {
    await logQuery({
      fromZip,
      toZip,
      selectedVehicle,
      status: "unsupported_route",
    });
    return NextResponse.json({
      status: "unsupported_route" as const,
      fromZip,
      toZip,
    });
  }

  // Fire all 3 vehicle types in parallel. SD's documented limit is 50 req/10s
  // per IP — well within our budget for one user click. Each call has its
  // own internal cache miss/hit path inside getSdPriceEstimate.
  const results = await Promise.all(
    VEHICLES.map((v) =>
      getSdPriceEstimate({
        pickup: { zip: fromZip },
        delivery: { zip: toZip },
        vehicleType: v,
        isInoperable: false,
        trailerType: "open",
      }),
    ),
  );

  const prices: Record<Vehicle, PriceBracket | null> = {
    sedan: null,
    suv: null,
    pickup: null,
  };
  VEHICLES.forEach((v, i) => {
    const r = results[i];
    if (r) {
      prices[v] = {
        low: r.low,
        high: r.high,
        recommended: r.price,
      };
    }
  });

  // Any successful estimate? If all three came back null, treat as SD error.
  const anyOk = Object.values(prices).some((p) => p !== null);

  await logQuery({
    fromZip,
    toZip,
    selectedVehicle,
    status: anyOk ? "ok" : "sd_error",
    prices,
    errorReason: anyOk ? undefined : "all SD calls returned null",
  });

  if (!anyOk) {
    return NextResponse.json({
      status: "sd_error" as const,
      fromZip,
      toZip,
    });
  }

  return NextResponse.json({
    status: "ok" as const,
    fromZip,
    toZip,
    selectedVehicle,
    prices,
  });
}
