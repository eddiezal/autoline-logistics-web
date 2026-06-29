/**
 * Corridor pricing snapshot card. Server component.
 *
 * Reads Firestore cache only - never calls SD. Per the cached != quoted rule,
 * this card is display-only. The "Get my quote" link below the card sends the
 * visitor to /quote, which hits SD live.
 *
 * Staleness rule (computed against the freshest snapshot of the 3):
 *   <48h   "Today's estimate" eyebrow, full card
 *   48-72h "Recent estimate" eyebrow, softened copy
 *   >72h   card hidden, "Get today's estimate" CTA shown instead
 *
 * If Firestore is empty (cron hasn't run yet) we render the hidden state.
 *
 * Option A layout (2026-06-29):
 *   eyebrow + route
 *   $ANCHOR (sedan midpoint, rounded to nearest $25)
 *   caption: "Sedan, open trailer. Other vehicles below."
 *   SUV/pickup rows (sedan is the anchor, not a row)
 *   transit bar
 *   "Get my quote" footer link
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

  // All fresh snapshots, indexed by vehicle for the Option A anchor + rows.
  const fresh = snapshots.filter(
    (s): s is PricingSnapshot => s !== null && s.status === "fresh",
  );
  const sedan = fresh.find((s) => s.vehicleType === "sedan");
  const others = fresh.filter((s) => s.vehicleType !== "sedan");

  // Option A anchor: sedan midpoint, rounded to nearest $25. If sedan is
  // missing (cron only got SUV/pickup that day) fall back to the first
  // available vehicle as the anchor.
  const anchorSnap = sedan ?? fresh[0];
  if (!anchorSnap) return null; // shouldn't happen, tier != hidden means >=1 fresh
  const anchorMid =
    Math.round((anchorSnap.priceLow + anchorSnap.priceHigh) / 2 / 25) * 25;

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

      {/* Option A anchor: sedan midpoint as the headline. Caption below. */}
      <div className="mb-3">
        <p className="text-3xl font-extrabold text-charcoal tracking-tight leading-none">
          ${formatMoney(anchorMid)}
        </p>
        <p className="text-xs text-gray-600 mt-1.5 leading-snug">
          {t("corridorPricing.anchorCaption")}
        </p>
      </div>

      {/* Supporting rows for other vehicles (sedan is the anchor above). */}
      {others.length > 0 && (
        <div className="space-y-1">
          {others.map((s) => (
            <div
              key={s.vehicleType}
              className="flex items-baseline justify-between py-0.5"
            >
              <span className="text-gray-700 text-sm">
                {t(`corridorPricing.vehicleLabels.${s.vehicleType}`)}
              </span>
              <span className="text-charcoal text-sm">
                ${formatMoney(s.priceLow)} - ${formatMoney(s.priceHigh)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Transit bar. Single horizontal row, not a full verdict box. */}
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

      {/* Card footer. quietLink folded in, not a competing CTA. */}
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
