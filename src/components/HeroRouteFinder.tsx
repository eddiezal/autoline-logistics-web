"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buildQuoteHref } from "@/lib/hero-handoff";
import {
  lookupZipApprox,
  zipPrefixToState,
  roadDistanceMiles,
  type MetroZip,
} from "@/data/zip-metros";

/**
 * Hero Route Finder — Progressive Disclosure (V2, May 17 2026).
 *
 * Two-step in-place form:
 *   Step 1 (always visible): From ZIP + To ZIP (side-by-side) + Vehicle type
 *   Step 2 (revealed once both ZIPs are valid 5-digit): Condition,
 *     Transport, Timing — as pill-style segmented controls.
 *
 * Returns a LOCKED price (not a range) once step 1 is complete.
 * Shows a validity badge ("Locked for 7 days · No deposit required").
 *
 * Pricing math today is client-side; the Super Dispatch API swap is a
 * one-function change once credentials land (replace computeLockedPrice
 * with an SD fetch). The form structure + copy already reflect the
 * SD-live future state — that's the deliberate "build for tomorrow"
 * decision, not a bug.
 *
 * Coordinator is NOT involved at the quote step — automation gives the
 * price, the named coordinator owns the relationship from BOOKING
 * onward. This resolves the prior "instant quote vs coordinator
 * confirms" contradiction the homepage had.
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

type ConditionKey = "drivable" | "nonDrivable";
type TransportKey = "open" | "enclosed";
type TimingKey = "flexible" | "withinWeek" | "asap";

const VEHICLE_OPTIONS: ReadonlyArray<VehicleKey> = [
  "sedan",
  "suv",
  "truckStandard",
  "truckLifted",
  "van",
  "motorcycle",
  "classic",
  "exotic",
];

const CONDITION_OPTIONS: ReadonlyArray<ConditionKey> = [
  "drivable",
  "nonDrivable",
];
const TRANSPORT_OPTIONS: ReadonlyArray<TransportKey> = ["open", "enclosed"];
const TIMING_OPTIONS: ReadonlyArray<TimingKey> = [
  "flexible",
  "withinWeek",
  "asap",
];

// ── Pricing math (client-side estimate; swap with SD API later) ────────
const PRICE_PER_MILE = 0.7;
const SHORT_HAUL_FLOOR = 350;
const HAWAII_BASE = 2800;
const ALASKA_BASE = 2200;

// Independent multipliers. Transport is no longer baked into vehicle —
// user picks it explicitly now, so we can't double-count.
const VEHICLE_MULT: Record<VehicleKey, number> = {
  sedan: 1.0,
  suv: 1.05,
  truckStandard: 1.1,
  truckLifted: 1.3,
  van: 1.05,
  motorcycle: 0.75,
  classic: 1.2, // extra care, slightly premium baseline
  exotic: 1.2,
};

const TRANSPORT_MULT: Record<TransportKey, number> = {
  open: 1.0,
  enclosed: 1.5, // industry-standard enclosed premium
};

const CONDITION_MULT: Record<ConditionKey, number> = {
  drivable: 1.0,
  nonDrivable: 1.25, // winch-loading surcharge
};

const TIMING_MULT: Record<TimingKey, number> = {
  flexible: 0.9, // standby tier savings
  withinWeek: 1.0, // priority (default)
  asap: 1.4, // expedited premium
};

function computeLockedPrice(
  distance: number,
  vehicleKey: VehicleKey,
  conditionKey: ConditionKey,
  transportKey: TransportKey,
  timingKey: TimingKey,
  kind: "ground" | "hawaii" | "alaska",
): number {
  const mult =
    VEHICLE_MULT[vehicleKey] *
    TRANSPORT_MULT[transportKey] *
    CONDITION_MULT[conditionKey] *
    TIMING_MULT[timingKey];

  let center: number;
  if (kind === "hawaii") center = HAWAII_BASE * mult;
  else if (kind === "alaska") center = ALASKA_BASE * mult;
  else center = Math.max(SHORT_HAUL_FLOOR, distance * PRICE_PER_MILE * mult);

  // Round to nearest $25 for clean display.
  return Math.max(SHORT_HAUL_FLOOR, Math.round(center / 25) * 25);
}

type RouteState =
  | { kind: "incomplete" }
  | {
      kind: "ok";
      from: MetroZip;
      to: MetroZip;
      distance: number;
      price: number;
    }
  | {
      kind: "hawaii" | "alaska";
      from: MetroZip | null;
      to: MetroZip | null;
      price: number;
    }
  | { kind: "unknown" }
  | { kind: "invalid" };

function computeRoute(
  fromZip: string,
  toZip: string,
  vehicleKey: VehicleKey,
  conditionKey: ConditionKey,
  transportKey: TransportKey,
  timingKey: TimingKey,
): RouteState {
  if (fromZip.length === 0 && toZip.length === 0) return { kind: "incomplete" };
  if (fromZip.length !== 5 || toZip.length !== 5) return { kind: "incomplete" };
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
      price: computeLockedPrice(
        0,
        vehicleKey,
        conditionKey,
        transportKey,
        timingKey,
        "hawaii",
      ),
    };
  }
  if (isAlaska) {
    return {
      kind: "alaska",
      from: fromMatch?.entry ?? null,
      to: toMatch?.entry ?? null,
      price: computeLockedPrice(
        0,
        vehicleKey,
        conditionKey,
        transportKey,
        timingKey,
        "alaska",
      ),
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
    price: computeLockedPrice(
      distance,
      vehicleKey,
      conditionKey,
      transportKey,
      timingKey,
      "ground",
    ),
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
  const [conditionKey, setConditionKey] = useState<ConditionKey>("drivable");
  const [transportKey, setTransportKey] = useState<TransportKey>("open");
  const [timingKey, setTimingKey] = useState<TimingKey>("withinWeek");

  // Step 1 complete = both ZIPs are 5 digits each.
  const step1Complete =
    fromZip.length === 5 &&
    toZip.length === 5 &&
    /^\d{5}$/.test(fromZip) &&
    /^\d{5}$/.test(toZip);

  const route = useMemo(
    () =>
      computeRoute(
        fromZip,
        toZip,
        vehicleKey,
        conditionKey,
        transportKey,
        timingKey,
      ),
    [fromZip, toZip, vehicleKey, conditionKey, transportKey, timingKey],
  );

  // Live SD pricing override. POSTs to our /api/pricing route (token stays
  // server-side). Replaces the local estimate with SD's market price when
  // available; otherwise the local computeLockedPrice estimate stands. Dormant
  // until SD_PRICING_* env vars are set.
  const [liveEstimate, setLiveEstimate] = useState<{
    price: number;
    low?: number;
    high?: number;
  } | null>(null);
  useEffect(() => {
    setLiveEstimate(null);
    // SD Pricing Insights covers the continental US only — HI/AK (and every
    // non-"ok" state) keep the local estimate, so only mainland routes hit SD.
    if (route.kind !== "ok") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromZip,
          toZip,
          fromCity: route.from.city,
          fromState: route.from.state,
          toCity: route.to.city,
          toState: route.to.state,
          vehicleType: vehicleKey,
          isInoperable: conditionKey === "nonDrivable",
          transportType: transportKey,
        }),
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.source === "sd" && typeof d.price === "number") {
            const mult = TIMING_MULT[timingKey];
            const adjusted =
              Math.round((d.price * mult) / 25) * 25;
            const adjLow =
              typeof d.low === "number"
                ? Math.round((d.low * mult) / 25) * 25
                : undefined;
            const adjHigh =
              typeof d.high === "number"
                ? Math.round((d.high * mult) / 25) * 25
                : undefined;
            setLiveEstimate({ price: adjusted, low: adjLow, high: adjHigh });
          }
        })
        .catch(() => {});
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [route.kind, fromZip, toZip, vehicleKey, conditionKey, transportKey, timingKey]);

  // Pre-fill /quote with all six inputs via the shared handoff
  // contract (src/lib/hero-handoff.ts). Adding a new param is a
  // one-line change to HeroHandoff; the rest of the chain auto-flows.
  const quoteHref = useMemo(
    () =>
      buildQuoteHref({
        originZip: fromZip,
        destinationZip: toZip,
        vehicleType: vehicleKey,
        condition: conditionKey,
        transportType: transportKey,
        timing: timingKey,
      }),
    [fromZip, toZip, vehicleKey, conditionKey, transportKey, timingKey],
  );

  return (
    <div className="bg-white text-charcoal rounded-3xl shadow-2xl shadow-black/30 p-6 md:p-7 mt-10 md:mt-12 max-w-md mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-2xl md:text-3xl font-bold leading-tight">
          {t("home.heroRouteFinder.title")}
        </h2>
        <p className="text-sm text-gray-600 mt-2 leading-snug">
          {t("home.heroRouteFinder.subtitle")}
        </p>
      </div>

      {/* Step 1 — ZIPs side-by-side + vehicle dropdown */}
      <div className="grid grid-cols-2 gap-3 mb-3">
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
      </div>
      <div className="flex flex-col gap-1.5 mb-3">
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          {t("home.heroRouteFinder.vehicleType.label")}
        </label>
        <select
          value={vehicleKey}
          onChange={(e) => setVehicleKey(e.target.value as VehicleKey)}
          className="px-3.5 py-3 border border-gray-300 rounded-xl bg-white text-charcoal text-sm focus:outline-2 focus:outline-orange focus:border-orange"
        >
          {VEHICLE_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {t(`home.heroRouteFinder.vehicleType.options.${v}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Step 2 — revealed once both ZIPs are valid.
          Three segmented controls: condition / transport / timing.
          Keeps the card visually short until the user has committed
          enough to want detail. */}
      {step1Complete && (
        <div className="mt-1 pt-4 border-t border-gray-100">
          <SegmentedField
            label={t("home.heroRouteFinder.condition.label")}
            options={CONDITION_OPTIONS}
            getLabel={(o) => t(`home.heroRouteFinder.condition.options.${o}`)}
            value={conditionKey}
            onChange={setConditionKey}
          />
          <SegmentedField
            label={t("home.heroRouteFinder.transport.label")}
            options={TRANSPORT_OPTIONS}
            getLabel={(o) => t(`home.heroRouteFinder.transport.options.${o}`)}
            value={transportKey}
            onChange={setTransportKey}
          />
          <SegmentedField
            label={t("home.heroRouteFinder.timing.label")}
            options={TIMING_OPTIONS}
            getLabel={(o) => t(`home.heroRouteFinder.timing.options.${o}`)}
            value={timingKey}
            onChange={setTimingKey}
          />
        </div>
      )}

      {/* Primary CTA — always visible. Label flips when step 1 is done. */}
      <Link
        href={quoteHref}
        className="mt-4 block w-full bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink text-center font-bold text-base px-6 py-3.5 rounded-xl transition shadow-md shadow-orange/20"
      >
        {step1Complete
          ? `${t("home.heroRouteFinder.ctaLock")} →`
          : `${t("home.heroRouteFinder.ctaContinue")} →`}
      </Link>

      {/* "How pricing works" trust link — subtle, below the CTA.
          Quiet skeptic-soothing for the user who wants the mechanism
          explained before they commit. Goes to /price-promise. */}
      <div className="mt-3 text-center">
        <Link
          href="/price-promise"
          className="text-xs text-gray-500 hover:text-orange-dark underline-offset-2 hover:underline transition"
        >
          {t("home.heroRouteFinder.howPricingWorks")}
        </Link>
      </div>

      {/* Result panel — only renders when there's a real route. */}
      <ResultPanel state={route} quoteHref={quoteHref} liveEstimate={liveEstimate} />
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

/** SegmentedField — pill-style radio group for short option lists.
 *  Selected pill gets orange border + tint background; unselected stay
 *  neutral. Used for the 3 step-2 fields (condition, transport, timing)
 *  so the form stays compact and tappable on mobile. */
function SegmentedField<T extends string>({
  label,
  options,
  getLabel,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<T>;
  getLabel: (o: T) => string;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 mb-3">
      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </label>
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((o) => {
          const selected = o === value;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              className={
                selected
                  ? "px-2.5 py-2 text-xs font-bold rounded-lg border-2 border-orange bg-orange-tint text-orange-dark transition"
                  : "px-2.5 py-2 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:border-gray-400 transition"
              }
            >
              {getLabel(o)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PriceDisplay({
  price,
  label,
  range,
}: {
  price: number;
  label: string;
  range?: string | null;
}) {
  return (
    <div className="mb-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-orange-dark mb-1">
        {label}
      </p>
      <p className="text-3xl md:text-4xl font-extrabold text-charcoal tracking-tight leading-none">
        ${formatMoney(price)}
      </p>
      {range ? (
        <p className="text-[11px] text-gray-600 mt-2 leading-snug">{range}</p>
      ) : null}
    </div>
  );
}

function ResultPanel({
  state,
  quoteHref,
  liveEstimate,
}: {
  state: RouteState;
  quoteHref: { pathname: "/quote"; query: Record<string, string> };
  liveEstimate: { price: number; low?: number; high?: number } | null;
}) {
  const t = useTranslations();

  // Option A range subtitle. Only renders when SD returned a real bracket.
  const rangeLabel =
    liveEstimate &&
    typeof liveEstimate.low === "number" &&
    typeof liveEstimate.high === "number" &&
    liveEstimate.low < liveEstimate.high
      ? t("home.heroRouteFinder.rangeLabel", {
          low: formatMoney(liveEstimate.low),
          high: formatMoney(liveEstimate.high),
        })
      : null;

  switch (state.kind) {
    case "incomplete":
      return null;

    case "invalid":
      return (
        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4">
          <p className="text-sm text-amber-900 leading-relaxed mb-3">
            {t("home.heroRouteFinder.stateInvalid")}
          </p>
          <Link
            href={quoteHref}
            className="inline-flex items-center bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink text-sm font-bold px-5 py-2.5 rounded-full transition"
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
            className="inline-flex items-center bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink text-sm font-bold px-5 py-2.5 rounded-full transition"
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

          <PriceDisplay
            price={liveEstimate?.price ?? state.price}
            label={t("home.heroRouteFinder.lockedLabel")}
            range={rangeLabel}
          />
        </div>
      );
    }

    case "ok": {
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
          </div>

          <PriceDisplay
            price={liveEstimate?.price ?? state.price}
            label={t("home.heroRouteFinder.lockedLabel")}
            range={rangeLabel}
          />
        </div>
      );
    }
  }
}
