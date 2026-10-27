/**
 * Instant-price gate (2026-10-26). Decides when the site must NOT show or
 * hand an agent an instant price, so a human quotes the shipment instead.
 *
 * WHY: the Oct 26 quote study (claude/ledger-2026-10-26-quote-vs-recommended-
 * study.md) found the site price covers the carrier on 84% of booked orders,
 * but a small tail was badly underpriced: a box truck ($920 vs $3,400 carrier
 * pay), an RV travel trailer, a 1957 classic, and four non-running cars.
 * Non-running was the strongest signal: 4 of 12 underpriced orders vs 1 of 63
 * healthy ones. Those vehicles go to an agent; everything else is unchanged.
 *
 * Deliberately NARROWER than eligibility.ts (spec v3.4, still instrumentation
 * only): that gate also routes on distance and on unknown operability or
 * transport, which would withhold most leads. This one acts only on evidence.
 *
 * PURE: no env, no I/O, no @/ imports. Unit-tested in instant-price-gate.test.mjs.
 */

export const GATE_VERSION = "instant-price-gate-v1-2026-10-26";

export type WithholdReason = "NON_STANDARD_VEHICLE" | "CLASSIC_VEHICLE" | "INOPERABLE";

export interface InstantPriceInput {
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
  /** Form vehicle type key (sedan, suv, classic, other, ...). */
  type?: string | null;
  /** "operable" | "inoperable" | null (not asked). */
  condition?: string | null;
}

export interface InstantPriceDecision {
  withhold: boolean;
  reasons: WithholdReason[];
  version: string;
}

// RVs, trailers, boats, equipment. Matched on make + model text.
const NON_CAR_RE =
  /\brv\b|trailer|\bhitch\b|camper|motor\s?home|fifth\s?wheel|\bboat\b|jet\s?ski|forest river|jayco|keystone|coachmen|winnebago|airstream|equipment|forklift|bobcat|skid\s?steer|\btractor\b/i;

// Commercial trucks and buses. NOT heavy-duty pickups (F-250, 2500HD):
// the market estimate prices those as pickups and the study shows no misses.
const COMMERCIAL_RE =
  /freightliner|kenworth|peterbilt|\bmack\b|\bhino\b|isuzu\s?(npr|nqr|frr)|box\s?truck|flat\s?bed|step\s?van|\bbus\b|\bsemi\b/i;

const LABELS: Record<WithholdReason, { en: string; es: string }> = {
  NON_STANDARD_VEHICLE: { en: "not a standard car (RV, trailer or commercial truck)", es: "no es un auto estándar (RV, remolque o camión comercial)" },
  CLASSIC_VEHICLE: { en: "classic or pre-1981 vehicle", es: "vehículo clásico o anterior a 1981" },
  INOPERABLE: { en: "vehicle doesn't run", es: "el vehículo no funciona" },
};

function s(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

export function decideInstantPrice(input: InstantPriceInput): InstantPriceDecision {
  const reasons: WithholdReason[] = [];
  const mm = (s(input.make) + " " + s(input.model)).trim();
  if (mm && (NON_CAR_RE.test(mm) || COMMERCIAL_RE.test(mm))) reasons.push("NON_STANDARD_VEHICLE");

  const year = Number(s(input.year));
  const preModern = Number.isFinite(year) && year > 1900 && year < 1981;
  if (s(input.type).toLowerCase() === "classic" || preModern) reasons.push("CLASSIC_VEHICLE");

  if (s(input.condition).toLowerCase() === "inoperable") reasons.push("INOPERABLE");

  return { withhold: reasons.length > 0, reasons, version: GATE_VERSION };
}

export function withholdReasonLabel(reason: WithholdReason, locale: "en" | "es" = "en"): string {
  return LABELS[reason][locale];
}
