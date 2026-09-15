/**
 * ProABD webhook record -> truthful shipment input for the pricing gate.
 *
 * The one thin ProABD adapter (spec §15: "backend authoritative; extension thin").
 * Reads `raw_item` exactly as the export serializes it (confirmed live 2026-07-24 and
 * in proabd-field-census-2026-09-06.md):
 *   Transport.Origin.{Zipcode,State,City}  Transport.Destination.{...}
 *   Transport.Vehicles[].{v_year,v_make,v_model,veh_op}   (veh_op "1" = running, "0" = not)
 *   Transport.Carrier = TRAILER TYPE ("Open"/"Enclosed"), NOT a carrier name
 *   Transport.Price / Deposit / Carrier_Pay, Mileage, Referrer, Referrer_Id, UserName
 *
 * Field-defaults findings (2026-09-09) shape two rules here:
 *   1. A NON-default CRM value (enclosed / not running) is an explicit agent selection
 *      and is passed through as known.
 *   2. A DEFAULT value (open / running) is passed through as known too — it is a
 *      populated CRM field, not "unknown" — but on a classic/exotic vehicle the
 *      trailer default is flagged CONFIRM_TRANSPORT because on that vehicle mix it
 *      is indistinguishable from "not asked." The card shows the price and the
 *      question. Policy (whether to block behind the question) lives in PR2/PR4.
 *
 * Pure: no I/O, no env. Unit-tested in proabd-shipment.test.mjs.
 */

import type { RawShipmentInput } from "./assessment";
import { resolveVehicleClassSeed, isPremiumShaped } from "./vehicle-class-seed";

export interface ProabdVehicle {
  year: string;
  make: string;
  model: string;
  /** null when the export carries no veh_op value */
  operable: boolean | null;
}

export type CardFlag = "CONFIRM_TRANSPORT" | "TRANSPORT_AGENT_SELECTED" | "OPERABILITY_AGENT_SELECTED";

export interface ProabdShipment {
  abdId: string;
  stage: string;             // "quote" | "order" | "lead" | ""
  referrerId: string;
  referrer: string;
  userName: string;
  route: string;             // "Ramsey, NJ -> Winnetka, CA"
  origin: { zip: string; state: string; city: string };
  destination: { zip: string; state: string; city: string };
  vehicles: ProabdVehicle[];
  trailer: "open" | "enclosed" | null;
  mileage: number | null;
  crmPrice: number | null;   // Transport.Price as currently in the CRM (may be 0 / unpriced)
  vehicleLabel: string;      // "2025 Mazda CX-30 · Open · Running"
  input: RawShipmentInput;   // what the gate assesses
  resolvedBy: "model" | "make" | "unresolved";
  flags: CardFlag[];
}

const s = (v: unknown) => (v == null ? "" : String(v)).trim();
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
};
function dig(o: unknown, path: string): unknown {
  let cur: unknown = o;
  for (const k of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function trailerOf(raw: unknown): "open" | "enclosed" | null {
  const v = s(dig(raw, "Transport.Carrier")).toLowerCase();
  if (v === "open") return "open";
  if (v === "enclosed") return "enclosed";
  return null;
}

function vehiclesOf(raw: unknown): ProabdVehicle[] {
  const arr = dig(raw, "Transport.Vehicles");
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => {
    const op = s((v as Record<string, unknown>)?.veh_op);
    return {
      year: s((v as Record<string, unknown>)?.v_year),
      make: s((v as Record<string, unknown>)?.v_make),
      model: s((v as Record<string, unknown>)?.v_model),
      operable: op === "1" ? true : op === "0" ? false : null,
    };
  });
}

const cap = (t: string) => t.replace(/\b\w/g, (c) => c.toUpperCase());

/** Build the gate input + card labels from one webhook event's raw_item. */
export function shipmentFromProabd(abdId: string, stage: string, raw: unknown): ProabdShipment {
  const origin = { zip: s(dig(raw, "Transport.Origin.Zipcode")), state: s(dig(raw, "Transport.Origin.State")).toUpperCase(), city: s(dig(raw, "Transport.Origin.City")) };
  const destination = { zip: s(dig(raw, "Transport.Destination.Zipcode")), state: s(dig(raw, "Transport.Destination.State")).toUpperCase(), city: s(dig(raw, "Transport.Destination.City")) };
  const vehicles = vehiclesOf(raw);
  const v0 = vehicles[0];
  const trailer = trailerOf(raw);

  const seed = v0 ? resolveVehicleClassSeed(v0.make, v0.model, v0.year) : { cls: null, by: "unresolved" as const };

  const input: RawShipmentInput = {
    origin: { zip: origin.zip || null, state: origin.state || null },
    destination: { zip: destination.zip || null, state: destination.state || null },
    vehicle: v0
      ? {
          year: v0.year || null,
          make: v0.make || null,
          model: v0.model || null,
          // The seed's answer rides in as the structured category so assessment.ts keeps
          // its deny-lists ahead of it. Unresolved -> null -> needs_input("vehicle").
          category: seed.cls,
          operable: v0.operable,
        }
      : null,
    transportType: trailer,
    vehicleCount: vehicles.length || null,
  };

  const flags: CardFlag[] = [];
  if (trailer === "enclosed") flags.push("TRANSPORT_AGENT_SELECTED");
  if (v0 && v0.operable === false) flags.push("OPERABILITY_AGENT_SELECTED");
  if (trailer === "open" && v0 && isPremiumShaped(v0.year, v0.make)) flags.push("CONFIRM_TRANSPORT");

  const routeLabel = [origin.city ? `${cap(origin.city)}, ${origin.state}` : origin.state || origin.zip,
    destination.city ? `${cap(destination.city)}, ${destination.state}` : destination.state || destination.zip].join(" → ");
  const vehLabel = v0
    ? [`${v0.year} ${v0.make} ${v0.model}`.replace(/\s+/g, " ").trim(),
       trailer ? cap(trailer) : "Trailer ?",
       v0.operable === true ? "Running" : v0.operable === false ? "Not running" : "Running ?"]
        .join(" · ") + (vehicles.length > 1 ? ` (+${vehicles.length - 1} more)` : "")
    : "No vehicle on record";

  return {
    abdId,
    stage,
    referrerId: s(dig(raw, "Referrer_Id")),
    referrer: s(dig(raw, "Referrer")),
    userName: s(dig(raw, "UserName")),
    route: routeLabel,
    origin,
    destination,
    vehicles,
    trailer,
    mileage: num(dig(raw, "Mileage")),
    crmPrice: num(dig(raw, "Transport.Price")),
    vehicleLabel: vehLabel,
    input,
    resolvedBy: seed.by,
    flags,
  };
}

/** Source chip label for the card, mirroring the extension's SIM vocabulary. */
export function sourceLabel(referrerId: string, referrer: string): string {
  switch (referrerId) {
    case "8": return "WEBSITE";
    case "18493": return "WEBSITE ES";
    case "207": return "IRELOCATION";
    case "503": return "TAYLOR PREMIUM";
    case "18": return "TAYLOR SHARED";
    case "15315": return "LIVE TRANSPORT";
    case "0": case "": return "PHONE";
    default: return (referrer || `REF ${referrerId}`).toUpperCase().slice(0, 18);
  }
}
