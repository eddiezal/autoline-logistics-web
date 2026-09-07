/**
 * PR2 — Pure policy disposition + quote-fingerprint (Axis 2 of the two-axis pricing model, spec v3.5).
 *
 * Two pure pieces, no I/O, no network, no SD call, no persistence:
 *   1. evaluatePolicy(): given a TRUTHFUL shipment (Axis 1 said `valid`) + distance + policy config,
 *      does policy allow auto-pricing now? Returns a DISPOSITION, never a priced quote — the price
 *      needs an SD response, which arrives in the PR4 worker.
 *   2. buildQuoteFingerprint(): hashes a CANONICAL structure (never the raw SD response, whose
 *      timestamps/request-ids would make economically identical quotes look different). Authored here,
 *      invoked by PR4 after it calls SD and computes the price.
 *
 * Distance is policy input here, NOT an Axis-1 integrity field — a shipment does not become invalid
 * because a threshold moved. The distance rule is behind a flag so its operational effect is
 * measurable and reversible independently of the deterministic input-integrity work.
 *
 * Self-contained on purpose (no imports), matching assessment.ts — unit-testable in isolation and
 * safe to import anywhere. PR4 passes the PR1 NormalizedShipment; it is structurally compatible with
 * the small input shapes below.
 */

export const POLICY_VERSION = "policy-v1-2026-09-06";
export const FINGERPRINT_VERSION = "qfp-v1-2026-09-06";

export type PolicyReason =
  | "DISTANCE_POLICY_REVIEW"
  | "INOPERABLE_POLICY_REVIEW"
  | "ENCLOSED_POLICY_REVIEW";

export type PolicyDisposition =
  | { status: "auto_allowed" }
  | { status: "manual_review"; reasons: PolicyReason[] };

/** The subset of the (truthful) shipment that policy actually reads. */
export interface PolicyShipmentView {
  isInoperable: boolean;
  trailerType: "open" | "enclosed";
}

export interface PricingPolicy {
  policyVersion: string;
  /** Feature flag (default OFF): the distance rule is an uncertainty policy, not a validated model. */
  distanceReviewEnabled: boolean;
  distanceReviewOverMiles: number | null;
  reviewUnknownDistance: boolean;
  reviewInoperable: boolean;
  reviewEnclosed: boolean;
}

export const DEFAULT_POLICY: PricingPolicy = {
  policyVersion: POLICY_VERSION,
  distanceReviewEnabled: false,  // stays OFF until the historical replay + a working review path (spec §9/§14)
  distanceReviewOverMiles: 1299, // uncertainty policy, not a validated breakpoint
  reviewUnknownDistance: false,
  reviewInoperable: true,        // no settled inoperable data yet — conservative
  reviewEnclosed: true,          // no settled enclosed data yet — conservative
};

/**
 * Pure. `miles` is supplied by the caller (PR4), separate from the shipment — distance is policy,
 * not input integrity. `null` miles = distance unknown (a valid shipment; policy may still review it).
 */
export function evaluatePolicy(
  shipment: PolicyShipmentView,
  miles: number | null,
  policy: PricingPolicy = DEFAULT_POLICY,
): PolicyDisposition {
  const reasons: PolicyReason[] = [];

  if (policy.distanceReviewEnabled && policy.distanceReviewOverMiles != null) {
    const m = typeof miles === "number" && Number.isFinite(miles) && miles > 0 ? miles : null;
    if (m != null && m > policy.distanceReviewOverMiles) reasons.push("DISTANCE_POLICY_REVIEW");
    else if (m == null && policy.reviewUnknownDistance) reasons.push("DISTANCE_POLICY_REVIEW");
  }
  if (shipment.isInoperable && policy.reviewInoperable) reasons.push("INOPERABLE_POLICY_REVIEW");
  if (shipment.trailerType === "enclosed" && policy.reviewEnclosed) reasons.push("ENCLOSED_POLICY_REVIEW");

  return reasons.length ? { status: "manual_review", reasons } : { status: "auto_allowed" };
}

// ---------------------------------------------------------------------------
// Quote fingerprint
// ---------------------------------------------------------------------------

/** Raw SD estimate as it may arrive — includes volatile metadata we must NOT hash. */
export interface RawSdEstimate {
  carrierEstimate?: number | null; // dollars
  currency?: string | null;
  // volatile / diagnostic — deliberately excluded from the fingerprint:
  requestId?: string | null;
  timestamp?: string | null;
  confidence?: number | null;
}

/** Only the price-affecting fields, currency canonicalized to integer cents. */
export interface CanonicalSdEstimate {
  carrierEstimateCents: number;
  currency: string;
}

export function canonicalizeSdEstimate(raw: RawSdEstimate): CanonicalSdEstimate {
  const dollars = typeof raw.carrierEstimate === "number" && Number.isFinite(raw.carrierEstimate)
    ? raw.carrierEstimate : 0;
  const currency = (raw.currency ? String(raw.currency) : "USD").trim().toUpperCase() || "USD";
  return { carrierEstimateCents: Math.round(dollars * 100), currency };
}

export interface QuoteFingerprintInput {
  normalizedShipmentHash: string;       // from PR1 — truthful shipment only
  sdEstimate: CanonicalSdEstimate;      // price-affecting SD fields only (via canonicalizeSdEstimate)
  sdPricingVersion?: string | null;     // SD data/pricing version if available
  formulaVersion: string;               // markup formula version
  policyVersion: string;                // pricing policy version
  policyConfig: PricingPolicy;          // the config that governs the disposition/price
}

/** FNV-1a 64-bit over a canonical string. Pure, dependency-free, stable across runtimes. */
function fnv1a64Hex(str: string): string {
  // Two independent FNV-1a 32-bit passes -> 16 hex chars. No BigInt, so it compiles
  // on TS targets below ES2020. Deterministic and pure.
  const fnv32 = (seed: number): number => {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  };
  const a = fnv32(0x811c9dc5);
  const b = fnv32(0x9e3779b9);
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

function canonicalPolicyConfig(p: PricingPolicy): string {
  // Fixed field order; only the config that affects the disposition/price.
  return [
    "dre:" + (p.distanceReviewEnabled ? "1" : "0"),
    "drm:" + (p.distanceReviewOverMiles == null ? "-" : String(p.distanceReviewOverMiles)),
    "rud:" + (p.reviewUnknownDistance ? "1" : "0"),
    "rin:" + (p.reviewInoperable ? "1" : "0"),
    "ren:" + (p.reviewEnclosed ? "1" : "0"),
  ].join(",");
}

/**
 * Pure. Hashes the canonical structure ONLY — identical economics yield an identical fingerprint even
 * if the raw SD response carried different timestamps/request-ids. Persist the raw SD response
 * separately (PR4) for audit; it is not part of this hash.
 */
export function buildQuoteFingerprint(input: QuoteFingerprintInput): string {
  const canonical = [
    FINGERPRINT_VERSION,
    "nsh:" + input.normalizedShipmentHash,
    "est:" + input.sdEstimate.carrierEstimateCents + ":" + input.sdEstimate.currency,
    "sdv:" + (input.sdPricingVersion ? String(input.sdPricingVersion) : "-"),
    "fv:" + input.formulaVersion,
    "pv:" + input.policyVersion,
    "pc:" + canonicalPolicyConfig(input.policyConfig),
  ].join("|");
  return fnv1a64Hex(canonical);
}
