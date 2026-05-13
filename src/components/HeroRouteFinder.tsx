"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  lookupZipApprox,
  zipPrefixToState,
  roadDistanceMiles,
  type MetroZip,
} from "@/data/zip-metros";

/**
 * Hero Route Finder — Approach A (route + estimated price range).
 *
 * Renders a form (From ZIP / To ZIP / Vehicle type) inside the hero of /.
 * On valid input, shows: route name, distance, corridor tag (HI/AK
 * auto-detected), an ESTIMATED price range (±10% rounded to $50),
 * pickup window, recommended tier — and a button forwarding to /quote
 * with the user's inputs pre-filled.
 *
 * Brand-tension management:
 *   The price is labeled "Estimated" with a footnote noting the locked
 *   price comes from /quote. Same pattern as the Ship vs Drive Calculator.
 *   Showing a RANGE (not a "starting from \$X") communicates honest
 *   uncertainty and matches what SD API will return later in Phase A.
 */

type VehicleKey =
  | "sedan"
  | "suv"
  | "truckStandard"
  | "truckLifted"
  | "van"
  | "motorcycle"
  | "classic"
  | "exotic";

const VEHICLE_OPTIONS: ReadonlyArray<{
  key: VehicleKey;
  category: "daily" | "premium" | "specialty";
}> = [
  { key: "sedan", category: "daily" },
  { key: "suv", category: "daily" },
  { key: "truckStandard", category: "daily" },
  { key: "truckLifted", category: "specialty" },
  { key: "van", category: "daily" },
  { key: "motorcycle", category: "specialty" },
  { key: "classic", category: "premium" },
  { key: "exotic", category: "premium" },
];

// ── Pricing math (mirrors ShipVsDriveCalculator constants) ─────────────
const PRICE_PER_MILE = 0.7;
const SHORT_HAUL_FLOOR = 350;
const HAWAII_BASE = 2800;
const ALASKA_BASE = 2200;

// Vehicle multipliers fold in tier recommendation:
// premium types (classic/exotic) bake in the ~1.5x Enclosed premium
const VEHICLE_MULT: Record<VehicleKey, number> = {
  sedan: 1.0,
  suv: 1.05,
  truckStandard: 1.1,
  truckLifted: 1.3,
  van: 1.05,
  motorcycle: 0.75,
  classic: 1.5, // Enclosed-tier baseline
  exotic: 1.5, // Enclosed-tier baseline
};

interface PriceRange {
  low: number;
  high: number;
}

function computePriceRange(
  distance: number,
  vehicleKey: VehicleKey,
  kind: "ground" | "hawaii" | "alaska",
): PriceRange {
  const mult = VEHICLE_MULT[vehicleKey];
  let center: number;
  if (kind === "hawaii") center = HAWAII_BASE * mult;
  else if (kind === "alaska") center = ALASKA_BASE * mult;
  else center = Math.max(SHORT_HAUL_FLOOR, distance * PRICE_PER_MILE * mult);

  // +/-10%, rounded to nearest $50 for clean display
  const low = Math.max(SHORT_HAUL_FLOOR, Math.round((center * 0.9) / 50) * 50);
  const high = Math.round((center * 1.1) / 50) * 50;
  return { low, high };
}

type RouteState =
  | { kind: "empty" }
  | {
      kind: "ok";
      from: MetroZip;
      to: MetroZip;
      distance: number;
      price: PriceRange;
    }
  | {
      kind: "hawaii" | "alaska";
      from: MetroZip | null;
      to: MetroZip | null;
      price: PriceRange;
    }
  | { kind: "unknown" }
  | { kind: "invalid" };

function computeRoute(
  fromZip: string,
  toZip: string,
  vehicleKey: VehicleKey,
): RouteState {
  if (fromZip.length === 0 && toZip.length === 0) return { kind: "empty" };
  if (fromZip.length !== 5 || toZip.length !== 5) return { kind: "empty" };
  if (!/^\d{5}$/.test(fromZip) || !/^\d{5}$/.test(toZip)) {
    return { kind: "invalid" };
  }

  const fromMatch = lookupZipApprox(fromZip);
  const toMatch = lookupZipApprox(toZip);
  const fromPrefix = zipPrefixToState(fromZip);
  const toPrefix = zipPrefixToState(toZip);

  const isHawaii =
    fromMatch?.entry.state === "HI" ||
    toMatch?.entry.state === "HI" ||
    fromPrefix === "HI" ||
    toPrefix === "HI";
  const isAlaska =
    fromMatch?.entry.state === "AK" ||
    toMatch?.entry.state === "AK" ||
    fromPrefix === "AK" ||
    toPrefix === "AK";

  if (isHawaii) {
    return {
      kind: "hawaii",
      from: fromMatch?.entry ?? null,
      to: toMatch?.entry ?? null,
      price: computePriceRange(0, vehicleKey, "hawaii"),
    };
  }
  if (isAlaska) {
    return {
      kind: "alaska",
      from: fromMatch?.entry ?? null,
      to: toMatch?.entry ?? null,
      price: computePriceRange(0, vehicleKey, "alaska"),
    };
  }
  if (!fromMatch || !toMatch) return { kind: "unknown" };

  const distance = Math.round(
    roadDistanceMiles(fromMatch.entry, toMatch.entry),
  );
  return {
    kind: "ok",
    from: fromMatch.entry,
    to: toMatch.entry,
    distance,
    price: computePriceRange(distance, vehicleKey, "ground"),
  };
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US");
}

export function HeroRouteFinder() {
  const t = useTranslations();
  const [fromZip, setFromZip] = useState("");
  const [toZip, setToZip] = useState("");
  const [vehicleKey, setVehicleKey] = useState<VehicleKey>("sedan");

  const route = useMemo(
    () => computeRoute(fromZip, toZip, vehicleKey),
    [fromZip, toZip, vehicleKey],
  );

  const vehicleCategory = useMemo(
    () =>
      VEHICLE_OPTIONS.find((v) => v.key === vehicleKey)?.category ?? "daily",
    [vehicleKey],
  );

  // Pre-fill /quote with current inputs
  const quoteHref = useMemo(
    () => ({
      pathname: "/quote" as const,
      query: {
        ...(fromZip ? { from: fromZip } : {}),
        ...(toZip ? { to: toZip } : {}),
        ...(vehicleKey ? { vehicle_type: vehicleKey } : {}),
      },
    }),
    [fromZip, toZip, vehicleKey],
  );

  return (
    <div className="bg-white text-charcoal rounded-3xl shadow-2xl shadow-black/30 p-6 md:p-8 mt-10 md:mt-12 max-w-5xl mx-auto">
      {/* Top: title + helper hint */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-5">
        <h2 className="text-xl md:text-2xl font-bold leading-tight">
          {t("home.heroRouteFinder.title")}
        </h2>
        <p className="text-xs md:text-sm text-gray-500 italic md:max-w-md">
          {t("home.heroRouteFinder.subtitle")}
        </p>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.4fr] gap-3">
        <ZipField
          label={t("home.heroRouteFinder.fromZip.label")}
          placeholder={t("home.heroRouteFinder.fromZip.placeholder")}
          value={fromZip}
          onChange={setFromZip}
        />
        <ZipField
          label={t("home.heroRouteFinder.toZip.label")}
          placeholder={t("home.heroRouteFinder.toZip.placeholder")}
          value={toZip}
          onChange={setToZip}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            {t("home.heroRouteFinder.vehicleType.label")}
          </label>
          <select
            value={vehicleKey}
            onChange={(e) => setVehicleKey(e.target.value as VehicleKey)}
            className="px-3.5 py-3 border border-gray-300 rounded-xl bg-white text-charcoal text-sm focus:outline-2 focus:outline-orange focus:border-orange"
          >
            {VEHICLE_OPTIONS.map((v) => (
              <option key={v.key} value={v.key}>
                {t(`home.heroRouteFinder.vehicleType.options.${v.key}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result panel — state-driven */}
      <ResultPanel
        state={route}
        vehicleCategory={vehicleCategory}
        quoteHref={quoteHref}
      />
    </div>
  );
}

function ZipField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </label>
      <input
        type="text"
        inputMode="numeric"
        maxLength={5}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
        className="px-3.5 py-3 border border-gray-300 rounded-xl bg-white text-charcoal text-sm focus:outline-2 focus:outline-orange focus:border-orange"
      />
    </div>
  );
}

function PriceLine({ price, label, sep }: { price: PriceRange; label: string; sep: string }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-orange-dark mb-1">
        {label}
      </p>
      <p className="text-2xl md:text-3xl font-extrabold text-charcoal tracking-tight leading-none">
        ${formatMoney(price.low)} {sep} ${formatMoney(price.high)}
      </p>
    </div>
  );
}

function ResultPanel({
  state,
  vehicleCategory,
  quoteHref,
}: {
  state: RouteState;
  vehicleCategory: "daily" | "premium" | "specialty";
  quoteHref: { pathname: "/quote"; query: Record<string, string> };
}) {
  const t = useTranslations();

  switch (state.kind) {
    case "empty":
      return (
        <p className="mt-5 text-sm text-gray-500 italic">
          {t("home.heroRouteFinder.statePrompt")}
        </p>
      );

    case "invalid":
      return (
        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
          <p className="text-sm text-amber-900 leading-relaxed mb-3">
            {t("home.heroRouteFinder.stateInvalid")}
          </p>
          <Link
            href={quoteHref}
            className="inline-flex items-center bg-orange hover:bg-orange-dark text-white text-sm font-bold px-5 py-2.5 rounded-full transition"
          >
            {t("home.heroRouteFinder.ctaInvalidZip")} →
          </Link>
        </div>
      );

    case "unknown":
      return (
        <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl px-4 py-4">
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            {t("home.heroRouteFinder.stateUnknown")}
          </p>
          <Link
            href={quoteHref}
            className="inline-flex items-center bg-orange hover:bg-orange-dark text-white text-sm font-bold px-5 py-2.5 rounded-full transition"
          >
            {t("home.heroRouteFinder.ctaLock")} →
          </Link>
        </div>
      );

    case "hawaii":
    case "alaska": {
      const namespace =
        state.kind === "hawaii"
          ? "home.heroRouteFinder.stateHawaii"
          : "home.heroRouteFinder.stateAlaska";
      const fromEntry = state.from;
      const toEntry = state.to;
      return (
        <div className="mt-5 bg-orange-tint/40 border border-orange-tint rounded-xl px-4 py-4">
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            {fromEntry && toEntry ? (
              <span className="text-base md:text-lg font-bold text-charcoal">
                {fromEntry.city}, {fromEntry.state}{" "}
                <span className="text-orange">→</span> {toEntry.city},{" "}
                {toEntry.state}
              </span>
            ) : null}
            <span className="inline-block bg-orange text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
              {t(`${namespace}.tag`)}
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed mb-1">
            {t(`${namespace}.note`)}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-3 italic">
            {t(`${namespace}.timeline`)}
          </p>

          <PriceLine
            price={state.price}
            label={t("home.heroRouteFinder.estimateLabel")}
            sep={t("home.heroRouteFinder.rangeSeparator")}
          />

          <p className="text-xs text-gray-500 italic mb-3 leading-snug">
            {t("home.heroRouteFinder.estimateFootnote")}
          </p>

          <Link
            href={quoteHref}
            className="inline-flex items-center bg-orange hover:bg-orange-dark text-white text-sm font-bold px-5 py-2.5 rounded-full transition"
          >
            {t("home.heroRouteFinder.ctaLock")} →
          </Link>
        </div>
      );
    }

    case "ok": {
      const tierLabelKey =
        vehicleCategory === "premium"
          ? "home.heroRouteFinder.stateOk.tierEnclosed"
          : vehicleCategory === "specialty"
            ? "home.heroRouteFinder.stateOk.tierSpecialty"
            : "home.heroRouteFinder.stateOk.tierOpen";

      return (
        <div className="mt-5 bg-orange-tint/40 border border-orange-tint rounded-xl px-4 py-4">
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <span className="text-base md:text-lg font-bold text-charcoal">
              {state.from.city}, {state.from.state}{" "}
              <span className="text-orange">→</span> {state.to.city},{" "}
              {state.to.state}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 mb-3">
            <span className="font-medium">
              ~{state.distance.toLocaleString("en-US")}{" "}
              {t("home.heroRouteFinder.stateOk.milesLabel")}
            </span>
            <span className="text-gray-400">·</span>
            <span>{t("home.heroRouteFinder.stateOk.pickupWindow")}</span>
          </div>

          <PriceLine
            price={state.price}
            label={t("home.heroRouteFinder.estimateLabel")}
            sep={t("home.heroRouteFinder.rangeSeparator")}
          />

          <p className="text-sm text-charcoal leading-relaxed mb-2">
            {t(tierLabelKey)}
          </p>
          <p className="text-xs text-gray-500 italic mb-3 leading-snug">
            {t("home.heroRouteFinder.estimateFootnote")}
          </p>

          <Link
            href={quoteHref}
            className="inline-flex items-center bg-orange hover:bg-orange-dark text-white text-sm font-bold px-5 py-2.5 rounded-full transition shadow-md shadow-orange/20"
          >
            {t("home.heroRouteFinder.ctaLock")} →
          </Link>
        </div>
      );
    }
  }
}
