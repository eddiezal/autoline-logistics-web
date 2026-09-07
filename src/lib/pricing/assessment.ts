/**
 * PR1 — Pure shipment assessment (Axis 1 of the two-axis pricing model, spec v3.5).
 *
 * Answers ONE question: can this shipment be represented TRUTHFULLY to SuperDispatch?
 *   - valid       : every material field maps losslessly to a supported SD request.
 *   - needs_input : a material field is missing/ambiguous and the agent/customer CAN supply it.
 *   - unsupported : the shipment is complete but is not a class we can auto-price (RV, dually, etc.).
 *
 * This module is deliberately PURE: no I/O, no network, NO LLM, no env, no @/ imports, no policy.
 * Distance/inoperable/enclosed *policy* routing lives in PR2 (PolicyDisposition) — NOT here. A
 * shipment does not become invalid because a policy threshold changed. `normalizedShipmentHash`
 * is computed from truthful normalized shipment data ONLY, so it is stable across policy/formula
 * changes (the policy-and-SD-dependent `quoteFingerprint` is built later, in PR2/PR4).
 *
 * WHY it refuses to guess: the NH->CO loss came from silently mapping a 21-ft RV ("other") to
 * "sedan" and trusting SD's answer — an estimate for the WRONG shipment. Same failure mode as the
 * hardcoded operable/open defaults. No silent lossy defaults, ever. Fail closed.
 */

export const ASSESSMENT_VERSION = "assessment-v1-2026-09-06";

/** SD prices only these three body classes today. Keep in sync with the SD client. */
export const SUPPORTED_CLASSES = ["sedan", "suv", "pickup"] as const;
export type SupportedClass = (typeof SUPPORTED_CLASSES)[number];

export type MissingField =
  | "route"          // origin and/or destination ZIP+state absent
  | "vehicle"        // vehicle identity absent, or present but unresolved (agent can confirm)
  | "operability"    // operable flag unknown (never defaulted to operable)
  | "transport_type" // open/enclosed unknown (never defaulted to open)
  | "dimensions";    // oversized-but-otherwise-supported needs dimensions (reserved)

export type UnsupportedReason =
  | "RV_TRAILER"
  | "HEAVY_TRUCK_DUALLY"
  | "MODIFIED_VEHICLE"
  | "VEHICLE_CLASS_UNSUPPORTED"
  | "MULTIPLE_VEHICLES";

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
  vehicleCount?: number | null;               // >1 => MULTIPLE_VEHICLES (unsupported for auto)
  // NOTE: miles/distance is deliberately NOT an input here — distance is PR2 policy, not Axis 1.
}

/** The truthful, canonical shipment used for the SD request and the hash. No prices, no timestamps. */
export interface NormalizedShipment {
  origin: { zip: string; state: string };
  destination: { zip: string; state: string };
  vehicleClass: SupportedClass;
  isInoperable: boolean;
  trailerType: "open" | "enclosed";
  vehicleCount: number;
}

export interface SDRequest {
  pickup: { state: string; zip: string };
  delivery: { state: string; zip: string };
  vehicleType: SupportedClass; // resolved & explicit — never a silent default
  isInoperable: boolean;       // from a KNOWN value
  trailerType: "open" | "enclosed"; // from a KNOWN value
}

export type InputAssessment =
  | { status: "valid"; snapshot: NormalizedShipment; normalizedShipmentHash: string; sdRequest: SDRequest }
  | { status: "needs_input"; missingFields: MissingField[] }
  | { status: "unsupported"; reasons: UnsupportedReason[] };

// --- resolver data (Phase 1 deterministic seed; Phase 2 = a separate VIN/alias resolver service) ---
const RV_RE = /\brv\b|trailer|hitch|camper|motor\s?home|cruiser rv|forest river|jayco|keystone|coachmen|winnebago/i;
const NONCAR_RE = /\bboat\b|equipment|forklift|bobcat|skid ?steer/i;
const HEAVY_TRUCK_RE = /\bf-?[2-5]50\b|\b[23]500\b|\b2500\s*hd\b|dually|super\s?duty|box truck|flatbed/i;
const MODIFIED_RE = /\blifted\b|\blowered\b|\bmodified\b|oversized tires?/i;

// Explicit categories. "other"/"unknown"/"" are NOT here — they fall through to the model seed so a
// real car typed "other" still resolves, while an unrecognized one becomes needs_input (never sedan).
const CATEGORY_MAP: Record<string, SupportedClass | UnsupportedReason> = {
  car: "sedan", sedan: "sedan", coupe: "sedan", hatchback: "sedan", wagon: "sedan",
  suv: "suv", crossover: "suv", van: "suv", minivan: "suv",
  pickup: "pickup", truck: "pickup",
  rv: "RV_TRAILER", trailer: "RV_TRAILER", camper: "RV_TRAILER",
  boat: "VEHICLE_CLASS_UNSUPPORTED", motorcycle: "VEHICLE_CLASS_UNSUPPORTED",
  equipment: "VEHICLE_CLASS_UNSUPPORTED", oversized: "VEHICLE_CLASS_UNSUPPORTED",
};

const MODEL_SEED: Array<{ re: RegExp; cls: SupportedClass }> = [
  { re: /\bmazda\s*-?\s*3\b|\bmazda3\b/i, cls: "sedan" },
  { re: /\bcamry\b|\bcorolla\b|\baccord\b|\bcivic\b|\bsentra\b|\baltima\b|\bmalibu\b|\bimpala\b|\bjetta\b|\belantra\b|\bsonata\b/i, cls: "sedan" },
  { re: /\bequinox\b|\brav-?4\b|\bcr-?v\b|\bhighlander\b|\bexplorer\b|\btahoe\b|\bsuburban\b|\bpilot\b|\bescape\b|\brogue\b|\bcx-?5\b/i, cls: "suv" },
  { re: /\bf-?150\b|\bsilverado\s*1500\b|\bram\s*1500\b|\btacoma\b|\bsierra\s*1500\b/i, cls: "pickup" },
];

function s(v: unknown): string { return (v == null ? "" : String(v)).trim(); }

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

type VehicleResolution =
  | { kind: "class"; cls: SupportedClass }
  | { kind: "unsupported"; reason: UnsupportedReason }
  | { kind: "unresolved" }   // present but unknown -> needs_input (agent/resolver can confirm)
  | { kind: "missing" };     // no identity at all -> needs_input

function resolveVehicle(v: NonNullable<RawShipmentInput["vehicle"]>): VehicleResolution {
  const make = s(v.make), model = s(v.model);
  const mm = (make + " " + model).trim();
  const catRaw = s(v.category).toLowerCase();
  const typeRaw = s(v.type).toLowerCase();
  const hasIdentity = !!(catRaw || make || model);
  if (!hasIdentity) return { kind: "missing" };

  // 1) Hard unsupported signals in make/model always win (terminal).
  if (mm && (RV_RE.test(mm))) return { kind: "unsupported", reason: "RV_TRAILER" };
  if (mm && HEAVY_TRUCK_RE.test(mm)) return { kind: "unsupported", reason: "HEAVY_TRUCK_DUALLY" };
  if (mm && NONCAR_RE.test(mm)) return { kind: "unsupported", reason: "VEHICLE_CLASS_UNSUPPORTED" };
  if (v.modified === true || (mm && MODIFIED_RE.test(mm))) return { kind: "unsupported", reason: "MODIFIED_VEHICLE" };

  // 2) Structured category (customer-selected) is primary. "other"/"unknown"/"" fall through.
  const catKey = (catRaw && catRaw !== "other" && catRaw !== "unknown")
    ? catRaw
    : (typeRaw && typeRaw !== "other" && typeRaw !== "unknown" ? typeRaw : "");
  if (catKey && catKey in CATEGORY_MAP) {
    const mapped = CATEGORY_MAP[catKey];
    return (mapped === "sedan" || mapped === "suv" || mapped === "pickup")
      ? { kind: "class", cls: mapped }
      : { kind: "unsupported", reason: mapped };
  }

  // 3) No usable category: deterministic model seed. Unknown => unresolved (NOT a silent sedan).
  if (mm) {
    for (const { re, cls } of MODEL_SEED) if (re.test(mm)) return { kind: "class", cls };
    return { kind: "unresolved" };
  }
  return { kind: "unresolved" };
}

function canonicalString(n: NormalizedShipment): string {
  return [
    ASSESSMENT_VERSION,
    "o:" + n.origin.zip + ":" + n.origin.state,
    "d:" + n.destination.zip + ":" + n.destination.state,
    "cls:" + n.vehicleClass,
    "inop:" + (n.isInoperable ? "1" : "0"),
    "tt:" + n.trailerType,
    "n:" + n.vehicleCount,
  ].join("|");
}

/** Pure. Deterministic. Never throws for bad data — malformed input fails closed to needs_input. */
export function assessShipment(input: RawShipmentInput): InputAssessment {
  const unsupported: UnsupportedReason[] = [];
  const missing: MissingField[] = [];

  const oZip = s(input.origin?.zip), oState = s(input.origin?.state).toUpperCase();
  const dZip = s(input.destination?.zip), dState = s(input.destination?.state).toUpperCase();
  if (!oZip || !oState || !dZip || !dState) missing.push("route");

  const count = typeof input.vehicleCount === "number" && Number.isFinite(input.vehicleCount)
    ? Math.trunc(input.vehicleCount) : 1;
  if (count > 1) unsupported.push("MULTIPLE_VEHICLES");

  const v = input.vehicle ?? {};
  const res = resolveVehicle(v);
  let vehicleClass: SupportedClass | null = null;
  if (res.kind === "unsupported") unsupported.push(res.reason);
  else if (res.kind === "missing" || res.kind === "unresolved") missing.push("vehicle");
  else vehicleClass = res.cls;

  let isInoperable: boolean | null = null;
  if (v.operable === true) isInoperable = false;
  else if (v.operable === false) isInoperable = true;
  else missing.push("operability");

  let trailerType: "open" | "enclosed" | null = null;
  if (input.transportType === "open" || input.transportType === "enclosed") trailerType = input.transportType;
  else missing.push("transport_type");

  // Precedence: a hard-unsupported shipment is terminal — do not ask for fields on a shipment we
  // will not auto-price regardless (an RV with unknown operability is still unsupported).
  if (unsupported.length) return { status: "unsupported", reasons: dedupe(unsupported) };
  if (missing.length) return { status: "needs_input", missingFields: dedupe(missing) };

  // All present, resolved, supported.
  const snapshot: NormalizedShipment = {
    origin: { zip: oZip, state: oState },
    destination: { zip: dZip, state: dState },
    vehicleClass: vehicleClass as SupportedClass,
    isInoperable: isInoperable as boolean,
    trailerType: trailerType as "open" | "enclosed",
    vehicleCount: count,
  };
  const sdRequest: SDRequest = {
    pickup: { state: snapshot.origin.state, zip: snapshot.origin.zip },
    delivery: { state: snapshot.destination.state, zip: snapshot.destination.zip },
    vehicleType: snapshot.vehicleClass,
    isInoperable: snapshot.isInoperable,
    trailerType: snapshot.trailerType,
  };
  return {
    status: "valid",
    snapshot,
    normalizedShipmentHash: fnv1a64Hex(canonicalString(snapshot)),
    sdRequest,
  };
}

function dedupe<T>(xs: T[]): T[] { return Array.from(new Set(xs)); }
