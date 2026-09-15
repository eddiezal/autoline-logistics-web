/**
 * Pricing portal — server-side pricing of ProABD records for the LaneLock card (SERVER ONLY).
 *
 * This is the READ-ONLY half of PR4: CRM record -> truthful shipment -> Axis 1 assessment ->
 * Super Dispatch (with the REAL operability and trailer, never hardcoded) -> customer markup
 * -> one recommended price for the agent. Nothing here writes to ProABD, evaluates policy,
 * or emits alerts; those stay behind PR3 C/D/E and their feature flags.
 *
 * Doctrine carried through (agent-pricing-portal-spec v3.5):
 *   - one price shown; the raw carrier estimate and any floor NEVER leave the server
 *   - SD failure -> PRICE_UNAVAILABLE, never a stale fallback
 *   - missing/unsupported input -> NEEDS_INPUT / UNSUPPORTED, never a guess
 *   - the record's CRM flags are read as populated values; a default trailer on a
 *     classic/exotic is flagged CONFIRM_TRANSPORT (field-defaults findings 2026-09-09)
 */

import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { assessShipment, ASSESSMENT_VERSION } from "@/lib/pricing/assessment";
import { applyCustomerMarkup, PRICING_MODEL } from "@/lib/pricing/markup";
import { getSdPriceEstimate } from "@/lib/superdispatch/pricing";
import { shipmentFromProabd, sourceLabel, type CardFlag } from "@/lib/pricing/proabd-shipment";

export type CardStatus = "READY" | "NEEDS_INPUT" | "UNSUPPORTED" | "PRICE_UNAVAILABLE";

/** What the extension renders. No carrier estimate, no floor, no PII beyond route city/state. */
export interface PricingCard {
  leadId: string;              // "abd-37403022"
  externalRef: string;         // ProABD ABD_Id
  stage: string;               // quote | order | lead
  source: string;              // chip label
  route: string;
  vehicle: string;
  status: CardStatus;
  recommended: number | null;  // customer price (SD + flat fee), rounded to $5
  low: number | null;
  high: number | null;
  confidence: number | null;
  pricedAt: number | null;     // epoch ms
  marketSource: string | null; // "Live Super Dispatch"
  needsInput: string | null;   // human reason when NEEDS_INPUT / UNSUPPORTED
  flags: CardFlag[];
  inputs: {
    trailer: "open" | "enclosed" | null;
    operable: boolean | null;
    vehicleClass: string | null;
    resolvedBy: "model" | "make" | "unresolved";
    provenance: "crm";
  };
  crmPrice: number | null;     // what ProABD currently holds (0/null = unpriced)
  mileage: number | null;
  meta: { assessmentVersion: string; pricingModel: string; normalizedShipmentHash: string | null; cached: boolean };
}

interface LatestEvent { entityId: string; entityType: string; receivedAt: Date | null; raw: unknown }

function toDate(v: unknown): Date | null {
  const d = (v as { toDate?: () => Date } | null)?.toDate?.();
  return d instanceof Date ? d : null;
}

/** Latest webhook event for an ABD id. No composite index needed: filter, then sort in memory. */
export async function latestEventFor(abdId: string): Promise<LatestEvent | null> {
  const db = getAdminDb();
  const snap = await db.collection("proabd_webhook_events").where("entity_id", "==", abdId).limit(200).get();
  if (snap.empty) return null;
  let best: LatestEvent | null = null;
  for (const doc of snap.docs) {
    const d = doc.data();
    const at = toDate(d.received_at);
    if (!best || (at && best.receivedAt && at > best.receivedAt) || (at && !best.receivedAt)) {
      best = { entityId: abdId, entityType: String(d.entity_type ?? "").toLowerCase(), receivedAt: at, raw: d.raw_item ?? {} };
    }
  }
  return best;
}

/** Most recent N distinct quote/order records by ingest time — the popup queue. */
export async function latestRecords(limit: number): Promise<LatestEvent[]> {
  const db = getAdminDb();
  const snap = await db.collection("proabd_webhook_events").orderBy("received_at", "desc").limit(Math.max(50, limit * 25)).get();
  const seen = new Set<string>();
  const out: LatestEvent[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const id = String(d.entity_id ?? "");
    const type = String(d.entity_type ?? "").toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (type !== "quote" && type !== "order") continue;
    out.push({ entityId: id, entityType: type, receivedAt: toDate(d.received_at), raw: d.raw_item ?? {} });
    if (out.length >= limit) break;
  }
  return out;
}

/* Short in-memory cache keyed by the truthful shipment hash: same shipment, same answer,
 * for CACHE_TTL_MS. Keeps repeated card renders from re-hitting SD (50 req / 10 s). */
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; price: { price: number; low: number; high: number; confidence: number | null } }>();

const MISSING_LABEL: Record<string, string> = {
  route: "Origin or destination ZIP missing",
  vehicle: "Vehicle class needs confirmation",
  operability: "Running / not running not set",
  transport_type: "Open / enclosed not set",
  dimensions: "Dimensions needed",
};
const UNSUPPORTED_LABEL: Record<string, string> = {
  RV_TRAILER: "RV / trailer — not auto-priced",
  HEAVY_TRUCK_DUALLY: "Heavy truck / dually — not auto-priced",
  MODIFIED_VEHICLE: "Modified vehicle — not auto-priced",
  VEHICLE_CLASS_UNSUPPORTED: "Vehicle class not auto-priced",
  MULTIPLE_VEHICLES: "Multiple vehicles — price each separately",
};

export async function priceRecord(ev: LatestEvent): Promise<PricingCard> {
  const sh = shipmentFromProabd(ev.entityId, ev.entityType, ev.raw);
  const assessment = assessShipment(sh.input);
  const base = {
    leadId: `abd-${ev.entityId}`,
    externalRef: ev.entityId,
    stage: ev.entityType,
    source: sourceLabel(sh.referrerId, sh.referrer),
    route: sh.route,
    vehicle: sh.vehicleLabel,
    flags: sh.flags,
    inputs: {
      trailer: sh.trailer,
      operable: sh.vehicles[0]?.operable ?? null,
      vehicleClass: assessment.status === "valid" ? assessment.snapshot.vehicleClass : null,
      resolvedBy: sh.resolvedBy,
      provenance: "crm" as const,
    },
    crmPrice: sh.crmPrice,
    mileage: sh.mileage,
    confidence: null,
    low: null,
    high: null,
  };
  const unpriced = (status: CardStatus, needsInput: string | null): PricingCard => ({
    ...base, status, recommended: null, pricedAt: null, marketSource: null, needsInput,
    meta: { assessmentVersion: ASSESSMENT_VERSION, pricingModel: PRICING_MODEL, normalizedShipmentHash: null, cached: false },
  });

  if (assessment.status === "needs_input") {
    return unpriced("NEEDS_INPUT", assessment.missingFields.map((f) => MISSING_LABEL[f] ?? f).join("; "));
  }
  if (assessment.status === "unsupported") {
    return unpriced("UNSUPPORTED", assessment.reasons.map((r) => UNSUPPORTED_LABEL[r] ?? r).join("; "));
  }

  const hash = assessment.normalizedShipmentHash;
  const hit = cache.get(hash);
  const now = Date.now();
  let priced: { price: number; low: number; high: number; confidence: number | null } | null = null;
  let cached = false;
  let pricedAt = now;
  if (hit && now - hit.at < CACHE_TTL_MS) {
    priced = hit.price; cached = true; pricedAt = hit.at;
  } else {
    const req = assessment.sdRequest;
    const raw = await getSdPriceEstimate(
      {
        pickup: { state: req.pickup.state, zip: req.pickup.zip },
        delivery: { state: req.delivery.state, zip: req.delivery.zip },
        vehicleType: req.vehicleType,
        isInoperable: req.isInoperable,   // REAL value from the CRM, never hardcoded
        trailerType: req.trailerType,     // REAL value from the CRM, never hardcoded
      },
      { markup: false },
    );
    if (raw) {
      const c = applyCustomerMarkup(raw);
      priced = { price: c.price, low: c.low, high: c.high, confidence: c.confidence };
      cache.set(hash, { at: now, price: priced });
      // raw.price (the carrier estimate) is intentionally NOT kept on the card.
    }
  }

  if (!priced) {
    return { ...unpriced("PRICE_UNAVAILABLE", "Live price unavailable — no stale fallback"),
      meta: { assessmentVersion: ASSESSMENT_VERSION, pricingModel: PRICING_MODEL, normalizedShipmentHash: hash, cached: false } };
  }
  return {
    ...base,
    status: "READY",
    recommended: priced.price,
    low: priced.low,
    high: priced.high,
    confidence: priced.confidence,
    pricedAt,
    marketSource: "Live Super Dispatch",
    needsInput: null,
    meta: { assessmentVersion: ASSESSMENT_VERSION, pricingModel: PRICING_MODEL, normalizedShipmentHash: hash, cached },
  };
}
