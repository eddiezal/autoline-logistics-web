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

  // Build rows ordered by vehicle type (sedan, suv, pickup).
  const rows = snapshots
    .filter((s): s is PricingSnapshot => s !== null && s.status === "fresh")
    .map((s) => ({
      vehicle: s.vehicleType,
      label: t(`corridorPricing.vehicleLabels.${s.vehicleType}`),
      priceLow: s.priceLow,
      priceHigh: s.priceHigh,
    }));

  return (
    <div className="space-y-3">
      <aside className="bg-white text-charcoal rounded-2xl p-6 shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
        {/* Eyebrow + route */}
        <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-gray-200">
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

        {/* Per-vehicle rows */}
        <div className="space-y-2 mb-4">
          {rows.map((r) => (
            <div
              key={r.vehicle}
              className="flex items-baseline justify-between"
            >
              <span className="text-gray-700 text-sm">{r.label}</span>
              <span className="font-bold text-charcoal text-sm">
                ${formatMoney(r.priceLow)} - ${formatMoney(r.priceHigh)}
              </span>
            </div>
          ))}
        </div>

        {/* Transit time verdict box */}
        <div className="bg-orange-tint border border-orange/20 rounded-lg p-4 text-center">
          <p className="text-orange text-[11px] font-bold uppercase tracking-wider mb-1">
            {t("corridorPricing.transit.eyebrow")}
          </p>
          <p className="text-charcoal text-xl font-extrabold mb-2">
            {t("corridorPricing.transit.value", {
              min: corridor.pricing.transitMinDays,
              max: corridor.pricing.transitMaxDays,
            })}
          </p>
          <p className="text-gray-700 text-xs leading-relaxed">
            {t("corridorPricing.transit.body")}
          </p>
        </div>
      </aside>

      {/* Quiet text link below the card. NOT a competing CTA. */}
      <div className="text-center">
        <Link
          href={{ pathname: "/quote", query: { from: corridor.fromState, to: corridor.toState } }}
          className="inline-block text-white/80 hover:text-white text-xs font-semibold uppercase tracking-wider transition"
        >
          {t("corridorPricing.quietLink")} →
        </Link>
      </div>
    </div>
  );
}

// Convenience export of the vehicle types this card knows how to render.
export type { PricingVehicleType };
