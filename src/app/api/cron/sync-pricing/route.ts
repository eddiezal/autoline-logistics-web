/**
 * GET /api/cron/sync-pricing
 *
 * Runs 2x daily via Vercel Cron (6 AM + 5 PM PT). Fetches Super Dispatch
 * Pricing Insights for each corridor in getPricingCorridors() × each
 * supported vehicle type, writes the snapshot to Firestore.
 *
 * Auth: Vercel sets `Authorization: Bearer <CRON_SECRET>` on cron invocations.
 *       We reject any request missing the matching secret.
 *
 * Concurrency: SEQUENTIAL. SD docs the limit at 50 req / 10s per IP. Even
 *              at full corridor scope (80 × 3 = 240 calls) we'd want to
 *              stay well under that — so we run sequentially with a tiny
 *              spacing delay. Day-1 scope is 3 calls per run; trivial.
 *
 * Retry: each SD call retries up to 3 times with exponential backoff
 *        (1s, 4s, 16s) on 429 / 5xx / network failures. Final failure
 *        records an error in Firestore WITHOUT clobbering the last-good
 *        price values.
 *
 * Failure mode: a single corridor+vehicle failure logs to console + records
 *               error status, but does NOT abort the rest of the sweep.
 */
import { NextResponse } from "next/server";
import { getSdPriceEstimate } from "@/lib/superdispatch/pricing";
import { getPricingCorridors, type Corridor } from "@/lib/corridors";
import {
  writePricingSnapshot,
  writePricingError,
  PRICING_VEHICLE_TYPES,
  type PricingVehicleType,
} from "@/lib/pricing/firestore";

export const runtime = "nodejs";
// Force dynamic — never cache the cron handler response itself.
export const dynamic = "force-dynamic";

const BACKOFF_MS = [1000, 4000, 16000] as const;
const INTER_CALL_DELAY_MS = 300; // gentle spacing between SD calls

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CallResult {
  corridor: string;
  vehicle: PricingVehicleType;
  status: "ok" | "error";
  error?: string;
  priceLow?: number;
  priceHigh?: number;
}

async function fetchWithRetry(
  corridor: Corridor,
  vehicle: PricingVehicleType,
): Promise<CallResult> {
  if (!corridor.pricing) {
    return {
      corridor: corridor.slug,
      vehicle,
      status: "error",
      error: "no pricing config on corridor",
    };
  }
  const p = corridor.pricing;

  let lastErr: string | null = null;
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      const est = await getSdPriceEstimate({
        pickup: { city: p.originCity, state: p.originState, zip: p.originZip },
        delivery: { city: p.destCity, state: p.destState, zip: p.destZip },
        vehicleType: vehicle,
        isInoperable: false,
        trailerType: "open",
      });

      if (est) {
        await writePricingSnapshot(corridor.slug, vehicle, {
          priceLow: est.low,
          priceHigh: est.high,
          recommendedPrice: est.price,
          confidence: est.confidence,
        });
        return {
          corridor: corridor.slug,
          vehicle,
          status: "ok",
          priceLow: est.low,
          priceHigh: est.high,
        };
      }

      // null estimate = SD call returned non-OK or unparseable shape.
      // Treat as a retryable failure; existing client logs the underlying
      // status via console.warn.
      lastErr = "sd returned null estimate";
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }

    if (attempt < BACKOFF_MS.length) {
      await sleep(BACKOFF_MS[attempt]);
    }
  }

  // All retries exhausted.
  const errorMsg = lastErr ?? "unknown SD failure";
  try {
    await writePricingError(corridor.slug, vehicle, errorMsg);
  } catch (writeErr) {
    console.error(
      `[cron/sync-pricing] failed to write error doc for ${corridor.slug}/${vehicle}:`,
      writeErr,
    );
  }
  console.error(
    `[cron/sync-pricing] gave up on ${corridor.slug}/${vehicle}: ${errorMsg}`,
  );
  return {
    corridor: corridor.slug,
    vehicle,
    status: "error",
    error: errorMsg,
  };
}

export async function GET(req: Request) {
  // Auth gate — Vercel Cron sets this header; manual triggers must too.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const corridors = getPricingCorridors();
  const results: CallResult[] = [];
  const startedAt = Date.now();

  // Sequential to stay well under SD's 50req/10s ceiling regardless of scope.
  for (const corridor of corridors) {
    for (const vehicle of PRICING_VEHICLE_TYPES) {
      const result = await fetchWithRetry(corridor, vehicle);
      results.push(result);
      await sleep(INTER_CALL_DELAY_MS);
    }
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json({
    ok: errorCount === 0,
    corridorsScanned: corridors.length,
    totalCalls: results.length,
    okCount,
    errorCount,
    elapsedMs,
    results,
  });
}
