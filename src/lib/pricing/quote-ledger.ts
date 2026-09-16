/**
 * Pricing quote ledger (SERVER ONLY).
 *
 * Every time the portal prices a ProABD record we persist the point-in-time
 * Super Dispatch estimate alongside what the card recommended and what the CRM
 * held at that moment. This is the write half's first piece and exists for one
 * reason: the SD-vs-settled backtest today can only run on WEBSITE orders,
 * because only /api/lead stores a quote-time carrier estimate. Purchased leads
 * (Taylor, iRelocation, Live Transport) never touched our pricing code, and SD
 * cannot be re-queried retroactively without market drift. From the moment
 * this ships, every record the card opens, from every source, gets the same
 * silent shadow field, so in 3 to 4 weeks scripts/backtest-tool-quotes.mjs can
 * join these docs to settled Carrier_Pay across all sources.
 *
 * Doctrine: the raw carrier estimate lives HERE and in no API response. Nothing
 * in this module is read by the card. Writes are best-effort and never block
 * or fail the card.
 *
 * Collection: pricingQuotes
 * Doc id:     `${abdId}_${normalizedShipmentHash}` — one doc per (record, truthful
 *             shipment). Re-pricing the same shipment bumps seenCount/lastSeenAt
 *             and never overwrites the FIRST estimate (that is the backtest value).
 */

import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

export const PRICING_QUOTES_COLLECTION = "pricingQuotes";

export interface QuoteLedgerEntry {
  abdId: string;
  stage: string;                       // lead | quote | order
  referrerId: string;
  source: string;                      // chip label
  route: string;                       // "City, ST → City, ST"
  pickup: { state: string; zip: string };
  delivery: { state: string; zip: string };
  vehicle: string;                     // label
  inputs: {
    trailer: "open" | "enclosed" | null;
    operable: boolean | null;
    vehicleClass: string | null;
    resolvedBy: "model" | "make" | "unresolved";
    sdVehicleType: string;             // what we actually sent SD
  };
  /** Raw SD, pre-markup. Server-only. */
  carrierEstimate: { price: number; low: number; high: number; confidence: number | null };
  /** Customer-facing (SD + flat fee, $5 rounding). What the card showed. */
  recommended: { price: number; low: number; high: number };
  /** ProABD price at the moment we priced (0/null = unpriced). */
  crmPriceAtPricing: number | null;
  mileage: number | null;
  normalizedShipmentHash: string;
  assessmentVersion: string;
  pricingModel: string;
  pricedAt: number;                    // epoch ms of the SD call that produced carrierEstimate
}

/**
 * Persist a priced quote. Idempotent per (abdId, shipment hash). Never throws.
 */
export async function recordPricedQuote(e: QuoteLedgerEntry): Promise<void> {
  try {
    const db = getAdminDb();
    const id = `${e.abdId}_${e.normalizedShipmentHash}`;
    const ref = db.collection(PRICING_QUOTES_COLLECTION).doc(id);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        tx.update(ref, {
          lastSeenAt: FieldValue.serverTimestamp(),
          seenCount: FieldValue.increment(1),
          // The CRM price can move between renders; keep the latest observed
          // alongside the first, both are useful to the backtest.
          crmPriceLatest: e.crmPriceAtPricing,
          stageLatest: e.stage,
        });
      } else {
        tx.set(ref, {
          ...e,
          crmPriceLatest: e.crmPriceAtPricing,
          stageLatest: e.stage,
          firstSeenAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp(),
          seenCount: 1,
          surface: "lanelock_card",
        });
      }
    });
  } catch (err) {
    console.warn("[quote-ledger] write failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }
}
