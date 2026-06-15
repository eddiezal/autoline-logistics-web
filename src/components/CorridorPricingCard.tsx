/**
 * Corridor pricing snapshot card. Server component.
 *
 * Reads Firestore cache only — never calls SD. Per the cached ≠ quoted rule,
 * this card is display-only. The "See today's locked price" link below the
 * card sends the visitor to /quote, which hits SD live.
 *
 * Staleness rule (computed against the freshest snapshot of the 3):
 *   <48h  → "Today's pricing" eyebrow, full card
 *   48-72h → "Recent pricing" eyebrow, softened copy
 *   >72h  → card hidden, "Get today's locked price" CTA shown instead
 *
 * If Firestore is empty (cron hasn't run yet) we render the hidden state.
 */
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { getCorridor } from "@/lib/corridors";
import {
  readCorridorPricing,
  snapshotStaleness,
  type PricingSnapshot,
  type PricingVehicleType,
  type StalenessTier,
} from "@/lib/pricing/firestore";

function formatMoney(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Pick the freshest-tier classification across all snapshots. If any snapshot
 * is fresh, the card renders fresh (we'd rather show *some* live data even if
 * one vehicle type is stale). Only when ALL snapshots are hidden do we hide.
 */
function aggregateStaleness(
  snapshots: ReadonlyArray<PricingSnapshot | null>,
  now: Date,
): StalenessTier {
  const tiers = snapshots
    .filter((s): s is PricingSnapshot => s !== null && s.status === "fresh")
    .map((s) => snapshotStaleness(s, now));
  if (tiers.length === 0) return "hidden";
  if (tiers.includes("fresh")) return "fresh";
  if (tiers.includes("softened")) return "softened";
  return "hidden";
}

export async function CorridorPricingCard({
  corridorSlug,
  locale,
}: {
  corridorSlug: string;
  locale: string;
}) {
  const t = await getTranslations({ locale });
  const corridor = getCorridor(corridorSlug);
  if (!corridor || !corridor.pricing) return null;

  const snapshots = await readCorridorPricing(corridorSlug);
  const now = new Date();
  const tier = aggregateStaleness(snapshots, now);

  // Staleness: hidden tier renders the "no fresh data" fallback CTA.
  if (tier === "hidden") {
    return (
      <aside className="bg-white text-charcoal rounded-2xl p-6 shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
        <p className="text-orange text-[11px] font-bold uppercase tracking-wider mb-3">
          {t("corridorPricing.fallback.eyebrow")}
        </p>
        <p className="text-charcoal text-base leading-relaxed mb-4">
          {t("corridorPricing.fallback.body")}
        </p>
        <Link
          href={{ pathname: "/quote", query: { from: corridor.fromState, to: corridor.toState } }}
          className="inline-block bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-5 py-2 rounded-full text-sm transition"
        >
          {t("corridorPricing.fallback.cta")}
        </Link>
      </aside>
    );
  }

  const eyebrowKey = tier === "fresh" ? "todays" : "recent";

  // Build rows ordered by vehicle type (sedan, suv, pickup). The first row
  // (sedan) is rendered as "featured" — slightly bolder label — so the
  // entry-tier price reads at a glance for the scanning visitor.
  const rows = snapshots
    .filter((s): s is PricingSnapshot => s !== null && s.status === "fresh")
    .map((s, i) => ({
      vehicle: s.vehicleType,
      label: t(`corridorPricing.vehicleLabels.${s.vehicleType}`),
      priceLow: s.priceLow,
      priceHigh: s.priceHigh,
      featured: i === 0,
    }));

  // V1 design: compact card, single transit bar (not a big verdict box),
  // quietLink folded into the card footer instead of a separate row below.
  return (
    <aside className="bg-white text-charcoal rounded-2xl p-5 shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
      {/* Eyebrow + route */}
      <div className="flex items-baseline justify-between mb-3 pb-2.5 border-b border-gray-200">
        <p className="text-orange text-[11px] font-bold uppercase tracking-wider">
          {t(`corridorPricing.eyebrow.${eyebrowKey}`)}
        </p>
        <p className="text-gray-500 text-xs">
          {t("corridorPricing.routeLabel", {
            from: corridor.fromState,
            to: corridor.toState,
          })}
        </p>
      </div>

      {/* Per-vehicle rows. Sedan (first) bolder for entry-tier signal. */}
      <div className="space-y-1">
        {rows.map((r) => (
          <div
            key={r.vehicle}
            className="flex items-baseline justify-between py-0.5"
          >
            <span
              className={
                r.featured
                  ? "text-charcoal text-sm font-semibold"
                  : "text-gray-700 text-sm"
              }
            >
              {r.label}
            </span>
            <span className="font-bold text-charcoal text-sm">
              ${formatMoney(r.priceLow)} – ${formatMoney(r.priceHigh)}
            </span>
          </div>
        ))}
      </div>

      {/* Transit bar — single horizontal row, not a full verdict box. */}
      <div className="flex items-center justify-between mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
        <span className="text-green-700 text-[11px] font-bold uppercase tracking-wider">
          {t("corridorPricing.transit.eyebrow")}
        </span>
        <span className="text-charcoal text-sm font-bold">
          {t("corridorPricing.transit.value", {
            min: corridor.pricing.transitMinDays,
            max: corridor.pricing.transitMaxDays,
          })}
        </span>
      </div>

      {/* Card footer — quietLink folded in, not a competing CTA. */}
      <div className="mt-3 pt-2.5 border-t border-gray-200 text-center">
        <Link
          href={{ pathname: "/quote", query: { from: corridor.fromState, to: corridor.toState } }}
          className="text-orange hover:text-orange-dark text-[11px] font-bold uppercase tracking-wider transition"
        >
          {t("corridorPricing.quietLink")} →
        </Link>
      </div>
    </aside>
  );
}

// Convenience export of the vehicle types this card knows how to render.
export type { PricingVehicleType };
