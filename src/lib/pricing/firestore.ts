/**
 * Firestore read/write helpers for corridor pricing snapshots.
 *
 * Schema:
 *   corridors/{corridorSlug}/pricing/{vehicleType}
 *
 * Vehicle type is the SD vehicle enum: "sedan" | "suv" | "pickup".
 *
 * IMPORTANT: cached values here are display-only. The /quote flow must always
 * hit SD live, never read from this collection. See
 * docs/corridor-pricing-spec.md and the pricing-authority-split memory rule.
 */
import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { SD_VEHICLE_TYPES, type SdVehicleType } from "@/lib/superdispatch/pricing";

// Re-export from the SD client so we have one source of truth for the enum.
// If SD ever supports a wider vehicle set, update there and the cron + this
// collection schema pick it up automatically.
export type PricingVehicleType = SdVehicleType;
export const PRICING_VEHICLE_TYPES: ReadonlyArray<PricingVehicleType> = SD_VEHICLE_TYPES;

export interface PricingSnapshot {
  vehicleType: PricingVehicleType;
  priceLow: number;
  priceHigh: number;
  recommendedPrice: number | null;
  confidence: number | null;
  fetchedAt: Date;
  source: "super_dispatch";
  status: "fresh" | "error";
  lastError: string | null;
}

interface PricingDoc {
  priceLow: number;
  priceHigh: number;
  recommendedPrice: number | null;
  confidence: number | null;
  fetchedAt: Timestamp;
  source: "super_dispatch";
  status: "fresh" | "error";
  lastError: string | null;
}

function docPath(corridorSlug: string, vehicleType: PricingVehicleType): string {
  return `corridors/${corridorSlug}/pricing/${vehicleType}`;
}

/**
 * Write a pricing snapshot for a corridor + vehicle type.
 * Uses server timestamp for fetchedAt so client clock skew doesn't matter.
 */
export async function writePricingSnapshot(
  corridorSlug: string,
  vehicleType: PricingVehicleType,
  data: {
    priceLow: number;
    priceHigh: number;
    recommendedPrice: number | null;
    confidence: number | null;
  },
): Promise<void> {
  const db = getAdminDb();
  await db.doc(docPath(corridorSlug, vehicleType)).set(
    {
      priceLow: data.priceLow,
      priceHigh: data.priceHigh,
      recommendedPrice: data.recommendedPrice,
      confidence: data.confidence,
      fetchedAt: FieldValue.serverTimestamp(),
      source: "super_dispatch" as const,
      status: "fresh" as const,
      lastError: null,
    },
    { merge: false },
  );
}

/**
 * Record an error for a corridor + vehicle type WITHOUT overwriting last-good
 * price values. We keep the previous priceLow/priceHigh in place so the page
 * can still render from a recent snapshot while we investigate the failure.
 */
export async function writePricingError(
  corridorSlug: string,
  vehicleType: PricingVehicleType,
  errorMsg: string,
): Promise<void> {
  const db = getAdminDb();
  await db.doc(docPath(corridorSlug, vehicleType)).set(
    {
      status: "error" as const,
      lastError: errorMsg,
      // NOTE: intentionally NOT updating fetchedAt or price fields here.
      // The render-side staleness rule will eventually hide the card if
      // fetchedAt drifts past 72h.
    },
    { merge: true },
  );
}

/**
 * Read a single pricing snapshot. Returns null if missing.
 */
export async function readPricingSnapshot(
  corridorSlug: string,
  vehicleType: PricingVehicleType,
): Promise<PricingSnapshot | null> {
  const db = getAdminDb();
  const snap = await db.doc(docPath(corridorSlug, vehicleType)).get();
  if (!snap.exists) return null;
  const d = snap.data() as PricingDoc;
  return {
    vehicleType,
    priceLow: d.priceLow,
    priceHigh: d.priceHigh,
    recommendedPrice: d.recommendedPrice ?? null,
    confidence: d.confidence ?? null,
    fetchedAt: d.fetchedAt.toDate(),
    source: d.source,
    status: d.status,
    lastError: d.lastError ?? null,
  };
}

/**
 * Read all 3 vehicle-type snapshots for a corridor. Missing types come back
 * as null entries in the returned array. Order matches PRICING_VEHICLE_TYPES.
 */
export async function readCorridorPricing(
  corridorSlug: string,
): Promise<Array<PricingSnapshot | null>> {
  return Promise.all(
    PRICING_VEHICLE_TYPES.map((v) => readPricingSnapshot(corridorSlug, v)),
  );
}

/**
 * Age of a snapshot in milliseconds, used by the render-side staleness rule.
 */
export function snapshotAgeMs(s: PricingSnapshot, now: Date = new Date()): number {
  return now.getTime() - s.fetchedAt.getTime();
}

export const STALENESS = {
  FRESH_MAX_MS: 48 * 60 * 60 * 1000, // < 48h: render normally
  SOFTENED_MAX_MS: 72 * 60 * 60 * 1000, // 48-72h: render with softened copy
  // > 72h: hide the card, replace with "Get today's locked price" CTA
} as const;

export type StalenessTier = "fresh" | "softened" | "hidden";

export function snapshotStaleness(
  s: PricingSnapshot,
  now: Date = new Date(),
): StalenessTier {
  const age = snapshotAgeMs(s, now);
  if (age < STALENESS.FRESH_MAX_MS) return "fresh";
  if (age < STALENESS.SOFTENED_MAX_MS) return "softened";
  return "hidden";
}
