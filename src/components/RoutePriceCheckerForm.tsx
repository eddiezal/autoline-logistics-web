"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics/events";
import { sendEvent } from "@/lib/analytics/behavior";

/**
 * RoutePriceCheckerForm. Client component for /tools/route-price-checker.
 *
 * Form: from-ZIP / to-ZIP / vehicle-type / submit
 * Result: V4 table — sedan/SUV/pickup × today/30-day-tracking
 *
 * POSTs to /api/route-price-checker which (a) calls SD for all 3 vehicle
 * types, (b) writes the query to Firestore route_price_checker_queries,
 * (c) returns prices or unsupported_route/sd_error.
 *
 * Day-1 note: 30-day average column shows "Tracking" placeholders until
 * the cron has 30 days of price history (~2026-07-14). The structure is
 * built in now so we don't restructure later.
 */

type Vehicle = "sedan" | "suv" | "pickup";

interface PriceBracket {
  low: number;
  high: number;
  recommended: number;
}

interface ApiOk {
  status: "ok";
  fromZip: string;
  toZip: string;
  selectedVehicle: Vehicle;
  prices: Record<Vehicle, PriceBracket | null>;
}

interface ApiUnsupported {
  status: "unsupported_route";
  fromZip: string;
  toZip: string;
}

interface ApiError {
  status: "sd_error" | "invalid_zip";
  fromZip?: string;
  toZip?: string;
}

type ApiResponse = ApiOk | ApiUnsupported | ApiError;

function formatMoney(n: number): string {
  return n.toLocaleString("en-US");
}

export function RoutePriceCheckerForm({
  i18n,
}: {
  i18n: {
    fromZipLabel: string;
    fromZipPlaceholder: string;
    toZipLabel: string;
    toZipPlaceholder: string;
    vehicleLabel: string;
    vehicleSedan: string;
    vehicleSuv: string;
    vehiclePickup: string;
    submit: string;
    submitting: string;
    errorInvalidZip: string;
    errorService: string;
    unsupportedTitle: string;
    unsupportedBody: string;
    unsupportedCta: string;
    resultEyebrow: string;
    resultRoute: string;
    anchorEyebrow: string;
    rangeLabel: string;
    alsoConsider: string;
    rowSedan: string;
    rowSuv: string;
    rowPickup: string;
    transitLabel: string;
    transitValue: string;
    resultCta: string;
  };
}) {
  const [fromZip, setFromZip] = useState("");
  const [toZip, setToZip] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle>("sedan");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!/^\d{5}$/.test(fromZip) || !/^\d{5}$/.test(toZip)) {
      setError(i18n.errorInvalidZip);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/route-price-checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromZip,
          toZip,
          selectedVehicle: vehicle,
        }),
      });
      const data = (await res.json()) as ApiResponse;
      if (data.status === "invalid_zip") {
        setError(i18n.errorInvalidZip);
      } else if (data.status === "sd_error") {
        setError(i18n.errorService);
      } else {
        setResult(data);
        // First-party funnel (2026-07-22): record that a live price was
        // shown pre-submit, with the anchor value — powers the
        // price-band abandonment analysis on /admin.
        if (data.status === "ok") {
          const sel = data.prices[data.selectedVehicle];
          if (sel) {
            sendEvent("estimate_shown", {
              price: Math.round((sel.low + sel.high) / 2 / 25) * 25,
              tool: "route-checker",
            });
          }
        }
        track({
          name: "route_price_checked",
          props: {
            from_zip: fromZip,
            to_zip: toZip,
            vehicle_type: vehicle,
          },
        });
      }
    } catch {
      setError(i18n.errorService);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[0_4px_14px_rgba(0,0,0,0.06)]"
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
          <div>
            <label
              htmlFor="rpc-from"
              className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5"
            >
              {i18n.fromZipLabel}
            </label>
            <input
              id="rpc-from"
              type="text"
              inputMode="numeric"
              maxLength={5}
              pattern="\d{5}"
              required
              value={fromZip}
              onChange={(e) => setFromZip(e.target.value.replace(/\D/g, ""))}
              placeholder={i18n.fromZipPlaceholder}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-base text-charcoal placeholder-gray-400 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="rpc-to"
              className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5"
            >
              {i18n.toZipLabel}
            </label>
            <input
              id="rpc-to"
              type="text"
              inputMode="numeric"
              maxLength={5}
              pattern="\d{5}"
              required
              value={toZip}
              onChange={(e) => setToZip(e.target.value.replace(/\D/g, ""))}
              placeholder={i18n.toZipPlaceholder}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-base text-charcoal placeholder-gray-400 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="rpc-vehicle"
              className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5"
            >
              {i18n.vehicleLabel}
            </label>
            <select
              id="rpc-vehicle"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value as Vehicle)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-base text-charcoal bg-white focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/20"
              disabled={loading}
            >
              <option value="sedan">{i18n.vehicleSedan}</option>
              <option value="suv">{i18n.vehicleSuv}</option>
              <option value="pickup">{i18n.vehiclePickup}</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-orange hover:bg-orange-dark text-white font-bold text-sm uppercase tracking-wider px-6 py-2.5 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? i18n.submitting : i18n.submit}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600 font-semibold">{error}</p>
        )}
      </form>

      {/* Unsupported-route fallback */}
      {result && result.status === "unsupported_route" && (
        <div className="bg-orange-tint border border-orange/30 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-charcoal mb-2">
            {i18n.unsupportedTitle}
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            {i18n.unsupportedBody}
          </p>
          <Link
            href={{
              pathname: "/quote",
              query: { fromZip: result.fromZip, toZip: result.toZip },
            }}
            className="inline-block bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold text-sm px-5 py-2.5 rounded-lg transition"
          >
            {i18n.unsupportedCta} →
          </Link>
        </div>
      )}

      {/* Option A result panel: single anchor + supporting rows. */}
      {result && result.status === "ok" && (() => {
        const selectedLabel =
          result.selectedVehicle === "sedan"
            ? i18n.rowSedan
            : result.selectedVehicle === "suv"
              ? i18n.rowSuv
              : i18n.rowPickup;
        const selectedPrice = result.prices[result.selectedVehicle];
        const anchorMid = selectedPrice
          ? Math.round((selectedPrice.low + selectedPrice.high) / 2 / 25) * 25
          : null;
        const rangeStr = selectedPrice
          ? i18n.rangeLabel
              .replace("{low}", formatMoney(selectedPrice.low))
              .replace("{high}", formatMoney(selectedPrice.high))
          : null;
        const otherVehicles = (["sedan", "suv", "pickup"] as const).filter(
          (v) => v !== result.selectedVehicle,
        );
        return (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-[0_4px_14px_rgba(0,0,0,0.06)]">
            <div className="flex items-baseline justify-between px-5 py-3.5 border-b border-gray-200">
              <span className="text-orange text-[11px] font-bold uppercase tracking-wider">
                {i18n.resultEyebrow}
              </span>
              <span className="text-gray-700 text-sm font-semibold">
                {i18n.resultRoute
                  .replace("{from}", result.fromZip)
                  .replace("{to}", result.toZip)}
              </span>
            </div>

            {/* Anchor block: selected vehicle as the headline number. */}
            <div className="px-5 py-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-dark mb-1">
                {i18n.anchorEyebrow.replace("{vehicle}", selectedLabel)}
              </p>
              <p className="text-3xl md:text-4xl font-extrabold text-charcoal tracking-tight leading-none">
                {anchorMid !== null ? `$${formatMoney(anchorMid)}` : "—"}
              </p>
              {rangeStr ? (
                <p className="text-[12px] text-gray-600 mt-2 leading-snug">
                  {rangeStr}
                </p>
              ) : null}

              {/* Quiet supporting rows for the other two vehicles. */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  {i18n.alsoConsider}
                </p>
                <div className="space-y-1.5">
                  {otherVehicles.map((v) => {
                    const p = result.prices[v];
                    const label =
                      v === "sedan"
                        ? i18n.rowSedan
                        : v === "suv"
                          ? i18n.rowSuv
                          : i18n.rowPickup;
                    return (
                      <div
                        key={v}
                        className="flex items-baseline justify-between text-sm"
                      >
                        <span className="text-gray-700">{label}</span>
                        <span className="text-charcoal">
                          {p
                            ? `$${formatMoney(p.low)} - $${formatMoney(p.high)}`
                            : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-5 py-3 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm text-gray-700">
                {i18n.transitLabel}:{" "}
                <strong className="text-charcoal">{i18n.transitValue}</strong>
              </span>
              <Link
                href={{
                  pathname: "/quote",
                  query: {
                    fromZip: result.fromZip,
                    toZip: result.toZip,
                    vehicleType: result.selectedVehicle,
                  },
                }}
                className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold text-sm px-4 py-2 rounded-lg transition"
              >
                {i18n.resultCta} →
              </Link>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
