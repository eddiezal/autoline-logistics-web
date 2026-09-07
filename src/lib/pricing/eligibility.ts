/**
 * Pricing input-integrity gate (spec v3.4). PRIMARY gate: a shipment may be
 * AUTO-priced by SuperDispatch only when every economically material field maps
 * FAITHFULLY (no silent defaults) into a supported SD request. Otherwise the
 * result is NEEDS_INPUT (ask for the missing field) or SPECIALTY_REVIEW
 * (complete, but unsupported / unusual / conflicting).
 *
 * WHY: the NH->CO loss came from silently mapping a 21-ft RV trailer ("other")
 * to "sedan" and trusting SD's answer. That is an estimate for the WRONG
 * shipment, not a wider-uncertainty estimate. Same failure mode as the
 * hardcoded operable/open defaults. This module refuses to lie to SD.
 *
 * PURE + self-contained on purpose: no server-only deps, no env, no I/O, no @/
 * imports — unit-testable in isolation and safe to import anywhere. Distance and
 * inop/enclosed are SEPARATE policy flags (uncertainty policy), not integrity.
 * Fail closed: on any resolver failure -> SPECIALTY_REVIEW, never default to sedan.
 */

export const RULESET_VERSION = "eligibility-v1-2026-09-06";
export const ESTIMATE_TTL_MS = 24 * 60 * 60 * 1000; // 24h quote validity (v3.3 staleness)

// SD prices only these three body classes. MUST stay in sync with
// SD_VEHICLE_TYPES in src/lib/superdispatch/pricing.ts (kept local for purity).
export const SUPPORTED_CLASSES = ["sedan", "suv", "pickup"] as const;
export type SupportedClass = (typeof SUPPORTED_CLASSES)[number];

export type ReasonCode =
  | "ORIGIN_MISSING"
  | "DESTINATION_MISSING"
  | "VEHICLE_IDENTITY_MISSING"
  | "OPERABILITY_MISSING"
  | "TRANSPORT_TYPE_MISSING"
  | "DIMENSIONS_REQUIRED"
  | "VEHICLE_UNRESOLVED"
  | "VEHICLE_CLASS_UNSUPPORTED"
  | "MODIFICATION_REPORTED"
  | "VIN_MISMATCH"
  | "PRE_1981_VEHICLE"
  | "INOPERABLE_POLICY_REVIEW"
  | "ENCLOSED_POLICY_REVIEW"
  | "DISTANCE_POLICY_REVIEW"
  | "SD_REQUEST_FAILED";

export interface RawShipmentInput {
  origin?: { zip?: string | null; state?: string | null } | null;
  destination?: { zip?: string | null; state?: string | null } | null;
  vehicle?: {
    year?: string | number | null;
    make?: string | null;
    model?: string | null;
    category?: string | null; // structured category from the form
    type?: string | null;     // legacy free "type" (e.g. "other")
    operable?: boolean | null; // KNOWN operability; null/undefined = unknown
    modified?: boolean | null;
    vin?: string | null;
    lengthFt?: number | null;
  } | null;
  transportType?: "open" | "enclosed" | null; // KNOWN; null/undefined = unknown
  miles?: number | null;
}

export interface SDRequest {
  pickup: { state: string; zip: string };
  delivery: { state: string; zip: string };
  vehicleType: SupportedClass; // resolved & explicit — never a silent default
  isInoperable: boolean;       // from a KNOWN value
  trailerType: "open" | "enclosed"; // from a KNOWN value
}

export type ResolvedFrom = "category" | "make_model_map" | "deny_list" | "unresolved";

export interface ResolvedVehicle {
  cls: SupportedClass | null; // null when unresolved or unsupported
  resolvedFrom: ResolvedFrom;
  supported: boolean;
}

export type EligibilityStatus = "auto_eligible" | "needs_input" | "specialty_review";

export interface PricingInputSnapshot {
  rulesetVersion: string;
  evaluatedAt: string;
  estimateExpiresAt: string;
  original: RawShipmentInput;
  resolvedVehicle: ResolvedVehicle;
  resolvedOperability: boolean | null;
  resolvedTransport: "open" | "enclosed" | null;
  miles: number | null;
  decision: EligibilityStatus;
  reasons: ReasonCode[];
  sdRequest: SDRequest | null;
}

export type PricingEligibility =
  | { status: "auto_eligible"; request: SDRequest; snapshot: PricingInputSnapshot }
  | { status: "needs_input"; reasons: ReasonCode[]; snapshot: PricingInputSnapshot }
  | { status: "specialty_review"; reasons: ReasonCode[]; snapshot: PricingInputSnapshot };

export interface EligibilityPolicy {
  reviewInoperable: boolean;
  reviewEnclosed: boolean;
  distanceReviewOverMiles: number | null;
  reviewUnknownDistance: boolean;
}

export const DEFAULT_POLICY: EligibilityPolicy = {
  reviewInoperable: true,        // no settled inop data yet
  reviewEnclosed: true,          // no settled enclosed data yet
  distanceReviewOverMiles: 1299, // v3.4 evidence-bounded AUTO ceiling (uncertainty policy, not a model)
  reviewUnknownDistance: false,
};

// --- resolver data (Phase 1 seed; Phase 2 = NHTSA vPIC VIN decode + fuller map) ---
const NONCAR_RE = /\brv\b|trailer|hitch|camper|motor\s?home|\bboat\b|forest river|jayco|keystone|coachmen|winnebago|cruiser rv|equipment|forklift|bobcat|skid ?steer/i;
const HEAVY_TRUCK_RE = /\bf-?[2-5]50\b|\b[23]500\b|\b2500\s*hd\b|dually|super\s?duty|box truck|flatbed/i;
const MODIFIED_RE = /\blifted\b|\blowered\b|\bmodified\b|oversized tires?/i;

// Explicit UNSUPPORTED categories only. "other"/"" are NOT here — they fall
// through to the model seed so a real car typed "other" still resolves.
const CATEGORY_MAP: Record<string, SupportedClass | "UNSUPPORTED"> = {
  car: "sedan", sedan: "sedan", coupe: "sedan", hatchback: "sedan", wagon: "sedan",
  suv: "suv", crossover: "suv", van: "suv", minivan: "suv",
  pickup: "pickup", truck: "pickup",
  rv: "UNSUPPORTED", trailer: "UNSUPPORTED", boat: "UNSUPPORTED",
  motorcycle: "UNSUPPORTED", equipment: "UNSUPPORTED", oversized: "UNSUPPORTED",
};

const MODEL_SEED: Array<{ re: RegExp; cls: SupportedClass }> = [
  { re: /\bmazda\s*-?\s*3\b|\bmazda3\b/i, cls: "sedan" },
  { re: /\bcamry\b|\bcorolla\b|\baccord\b|\bcivic\b|\bsentra\b|\baltima\b|\bmalibu\b|\bimpala\b|\bjetta\b|\belantra\b|\bsonata\b/i, cls: "sedan" },
  { re: /\bequinox\b|\brav-?4\b|\bcr-?v\b|\bhighlander\b|\bexplorer\b|\btahoe\b|\bsuburban\b|\bpilot\b|\bescape\b|\brogue\b|\bcx-?5\b/i, cls: "suv" },
  { re: /\bf-?150\b|\bsilverado\s*1500\b|\bram\s*1500\b|\btacoma\b|\bsierra\s*1500\b/i, cls: "pickup" },
];

function s(v: unknown): string { return (v == null ? "" : String(v)).trim(); }

function resolveVehicle(v: NonNullable<RawShipmentInput["vehicle"]>): ResolvedVehicle {
  const make = s(v.make), model = s(v.model);
  const mm = (make + " " + model).trim();
  const catRaw = s(v.category).toLowerCase();
  const typeRaw = s(v.type).toLowerCase();

  // 1) Non-car / heavy indicators in make/model always win.
  if (mm && (NONCAR_RE.test(mm) || HEAVY_TRUCK_RE.test(mm))) {
    return { cls: null, resolvedFrom: "deny_list", supported: false };
  }
  // 2) Structured category (customer-selected) is the primary source.
  //    "other"/"unknown"/"" are treated as no-category and fall through.
  const catKey = (catRaw && catRaw !== "other" && catRaw !== "unknown")
    ? catRaw
    : (typeRaw && typeRaw !== "other" && typeRaw !== "unknown" ? typeRaw : "");
  if (catKey && catKey in CATEGORY_MAP) {
    const mapped = CATEGORY_MAP[catKey];
    if (mapped === "UNSUPPORTED") return { cls: null, resolvedFrom: "category", supported: false };
    return { cls: mapped, resolvedFrom: "category", supported: true };
  }
  // 3) No usable category: seed model map.
  if (mm) {
    for (const { re, cls } of MODEL_SEED) if (re.test(mm)) return { cls, resolvedFrom: "make_model_map", supported: true };
    return { cls: null, resolvedFrom: "unresolved", supported: false }; // present but unknown -> Phase 2 vPIC
  }
  return { cls: null, resolvedFrom: "unresolved", supported: false };
}

export function evaluateEligibility(
  input: RawShipmentInput,
  policy: EligibilityPolicy = DEFAULT_POLICY,
): PricingEligibility {
  const now = Date.now();
  const miles = (typeof input.miles === "number" && input.miles > 0) ? input.miles : null;
  const needs: ReasonCode[] = [];
  const review: ReasonCode[] = [];
  let resolvedVehicle: ResolvedVehicle = { cls: null, resolvedFrom: "unresolved", supported: false };
  let resolvedOperability: boolean | null = null;
  let resolvedTransport: "open" | "enclosed" | null = null;
  let sdRequest: SDRequest | null = null;

  try {
    const oZip = s(input.origin?.zip), oState = s(input.origin?.state);
    const dZip = s(input.destination?.zip), dState = s(input.destination?.state);
    if (!oZip || !oState) needs.push("ORIGIN_MISSING");
    if (!dZip || !dState) needs.push("DESTINATION_MISSING");

    const v = input.vehicle ?? {};
    const hasIdentity = !!(s(v.category) || s(v.make) || s(v.model));
    if (!hasIdentity) {
      needs.push("VEHICLE_IDENTITY_MISSING");
    } else {
      resolvedVehicle = resolveVehicle(v);
      const yr = Number(s(v.year));
      if (Number.isFinite(yr) && yr > 1900 && yr < 1981) review.push("PRE_1981_VEHICLE");
      if (v.modified === true || MODIFIED_RE.test(s(v.make) + " " + s(v.model))) review.push("MODIFICATION_REPORTED");
      if (resolvedVehicle.resolvedFrom === "unresolved") review.push("VEHICLE_UNRESOLVED");
      else if (!resolvedVehicle.supported) review.push("VEHICLE_CLASS_UNSUPPORTED");
    }

    if (input.vehicle?.operable === true || input.vehicle?.operable === false) resolvedOperability = input.vehicle.operable;
    else needs.push("OPERABILITY_MISSING");

    if (input.transportType === "open" || input.transportType === "enclosed") resolvedTransport = input.transportType;
    else needs.push("TRANSPORT_TYPE_MISSING");

    // Policy layer (truthful-but-uncertain routing; separate from integrity).
    if (resolvedOperability === false && policy.reviewInoperable) review.push("INOPERABLE_POLICY_REVIEW");
    if (resolvedTransport === "enclosed" && policy.reviewEnclosed) review.push("ENCLOSED_POLICY_REVIEW");
    if (policy.distanceReviewOverMiles != null) {
      if (miles != null && miles > policy.distanceReviewOverMiles) review.push("DISTANCE_POLICY_REVIEW");
      else if (miles == null && policy.reviewUnknownDistance) review.push("DISTANCE_POLICY_REVIEW");
    }

    if (needs.length === 0 && review.length === 0 && resolvedVehicle.cls && resolvedOperability !== null && resolvedTransport) {
      sdRequest = {
        pickup: { state: oState, zip: oZip },
        delivery: { state: dState, zip: dZip },
        vehicleType: resolvedVehicle.cls,
        isInoperable: !resolvedOperability, // resolvedOperability is the operable-flag (true=operable)
        trailerType: resolvedTransport,
      };
    }
  } catch {
    review.push("SD_REQUEST_FAILED"); // fail closed — never fabricate/default
    sdRequest = null;
  }

  let status: EligibilityStatus;
  let reasons: ReasonCode[];
  if (needs.length) { status = "needs_input"; reasons = needs; }
  else if (review.length) { status = "specialty_review"; reasons = review; }
  else if (sdRequest) { status = "auto_eligible"; reasons = []; }
  else { status = "specialty_review"; reasons = ["SD_REQUEST_FAILED"]; }

  const snapshot: PricingInputSnapshot = {
    rulesetVersion: RULESET_VERSION,
    evaluatedAt: new Date(now).toISOString(),
    estimateExpiresAt: new Date(now + ESTIMATE_TTL_MS).toISOString(),
    original: input,
    resolvedVehicle,
    resolvedOperability,
    resolvedTransport,
    miles,
    decision: status,
    reasons,
    sdRequest,
  };

  if (status === "auto_eligible" && sdRequest) return { status: "auto_eligible", request: sdRequest, snapshot };
  if (status === "needs_input") return { status: "needs_input", reasons, snapshot };
  return { status: "specialty_review", reasons, snapshot };
}
