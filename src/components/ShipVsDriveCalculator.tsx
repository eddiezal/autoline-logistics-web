"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  lookupZipApprox,
  zipPrefixToState,
  roadDistanceMiles,
} from "@/data/zip-metros";

/**
 * Ship vs Drive Calculator — §1 named deliverable.
 *
 * v2 design (2026-05-13):
 *  - Two-card side-by-side, data-driven winner
 *  - ZIP inputs with prefix fallback (92107 matches our 92101 entry)
 *  - Single vehicle dropdown (year/make/model dropped — they don't affect math)
 *  - Edge cases: HI / AK / short-haul / invalid ZIP all render in main view
 *
 * Mockup: ship-vs-drive-mockup.html (project root, not deployed).
 */

// ── Vehicle taxonomy ──────────────────────────────────────────────────────
type VehicleType =
  | "sedan"
  | "suv"
  | "truckStandard"
  | "truckLifted"
  | "van"
  | "motorcycle"
  | "classic"
  | "other";

const VEHICLE_TYPES: ReadonlyArray<VehicleType> = [
  "sedan",
  "suv",
  "truckStandard",
  "truckLifted",
  "van",
  "motorcycle",
  "classic",
  "other",
];

const MPG_BY_VEHICLE: Record<VehicleType, number> = {
  sedan: 32,
  suv: 24,
  truckStandard: 20,
  truckLifted: 14,
  van: 22,
  motorcycle: 45,
  classic: 18,
  other: 25,
};

const SHIP_VEHICLE_MULTIPLIER: Record<VehicleType, number> = {
  sedan: 1.0,
  suv: 1.05,
  truckStandard: 1.1,
  truckLifted: 1.3,
  van: 1.05,
  motorcycle: 0.75,
  classic: 1.15,
  other: 1.0,
};

// ── Math constants ────────────────────────────────────────────────────────
const HOTEL_NIGHTLY_USD = 150;
const FOOD_PER_DRIVER_PER_DAY_USD = 50;
const WEAR_PER_MILE_USD = 0.2; // real marginal cost, not IRS depreciation
const DRIVE_MILES_PER_DAY = 500;
const DEFAULT_FUEL_PRICE_USD = 4.5;
const MIN_TOLLS_FOOD_PER_DAY = 12;

const SHIP_BASE_PER_MILE_USD = 0.7;
const SHIP_SHORT_HAUL_FLOOR_USD = 350;
const SHIP_DAYS_PER_500_MILES = 1.5;
const SHIP_HAWAII_BASE_USD = 2800;
const SHIP_ALASKA_BASE_USD = 2200;

const SHORT_HAUL_THRESHOLD_MI = 200;
const WASH_THRESHOLD_USD = 50;

// ── Hourly-rate presets ───────────────────────────────────────────────────
type RatePreset = "rate25" | "rate50" | "rate100" | "dontCount";
const RATE_VALUES: Record<RatePreset, number> = {
  rate25: 25,
  rate50: 50,
  rate100: 100,
  dontCount: 0,
};
const RATE_OPTIONS: ReadonlyArray<RatePreset> = [
  "rate25",
  "rate50",
  "rate100",
  "dontCount",
];

type Branch = "ok" | "hawaii" | "alaska" | "invalid";

// ── Component ─────────────────────────────────────────────────────────────
export function ShipVsDriveCalculator() {
  const searchParams = useSearchParams();
  const [fromZip, setFromZip] = useState<string>(
    () => searchParams.get("from") ?? "90210"
  );
  const [toZip, setToZip] = useState<string>(
    () => searchParams.get("to") ?? "78701"
  );
  const [vehicleType, setVehicleType] = useState<VehicleType>("sedan");
  const [ratePreset, setRatePreset] = useState<RatePreset>("rate50");

  const calc = useMemo(
    () =>
      computeComparison({
        fromZip,
        toZip,
        vehicleType,
        hourlyRate: RATE_VALUES[ratePreset],
      }),
    [fromZip, toZip, vehicleType, ratePreset]
  );

  const quoteHref = useMemo(() => {
    const query: Record<string, string> = {};
    if (fromZip) query.from = fromZip;
    if (toZip) query.to = toZip;
    if (vehicleType) query.vehicle_type = vehicleType;
    return { pathname: "/quote" as const, query };
  }, [fromZip, toZip, vehicleType]);

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 lg:gap-8">
        <InputsPanel
          fromZip={fromZip} setFromZip={setFromZip}
          toZip={toZip} setToZip={setToZip}
          fromMeta={calc.fromMeta} toMeta={calc.toMeta}
          vehicleType={vehicleType} setVehicleType={setVehicleType}
          ratePreset={ratePreset} setRatePreset={setRatePreset}
        />
        <div className="flex flex-col gap-4">
          <ResultsView calc={calc} quoteHref={quoteHref} />
        </div>
      </div>
    </div>
  );
}

// ── Inputs panel ──────────────────────────────────────────────────────────
interface ZipMeta {
  status: "ok" | "unknown" | "invalid";
  city?: string;
  state?: string;
}

function InputsPanel(props: {
  fromZip: string; setFromZip: (v: string) => void;
  toZip: string;   setToZip:   (v: string) => void;
  fromMeta: ZipMeta; toMeta: ZipMeta;
  vehicleType: VehicleType; setVehicleType: (v: VehicleType) => void;
  ratePreset: RatePreset;   setRatePreset:   (v: RatePreset) => void;
}) {
  const t = useTranslations();
  return (
    <div className="bg-gray-100 border border-gray-200 rounded-2xl p-5 h-fit">
      <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-4">
        {t("shipVsDrive.inputs.legend")}
      </p>

      <ZipField
        label={t("shipVsDrive.inputs.fromZip.label")}
        placeholder={t("shipVsDrive.inputs.fromZip.placeholder")}
        value={props.fromZip}
        onChange={props.setFromZip}
        meta={props.fromMeta}
      />
      <ZipField
        label={t("shipVsDrive.inputs.toZip.label")}
        placeholder={t("shipVsDrive.inputs.toZip.placeholder")}
        value={props.toZip}
        onChange={props.setToZip}
        meta={props.toMeta}
      />

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t("shipVsDrive.inputs.vehicleType.label")}
        </label>
        <select
          value={props.vehicleType}
          onChange={(e) => props.setVehicleType(e.target.value as VehicleType)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-charcoal text-sm"
        >
          {VEHICLE_TYPES.map((k) => (
            <option key={k} value={k}>
              {t(`shipVsDrive.inputs.vehicleType.options.${k}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t("shipVsDrive.inputs.hourlyRate.label")}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {RATE_OPTIONS.map((r) => {
            const selected = props.ratePreset === r;
            return (
              <button
                type="button"
                key={r}
                onClick={() => props.setRatePreset(r)}
                className={[
                  "px-2.5 py-2 rounded-lg text-sm font-medium border transition text-left",
                  selected
                    ? "bg-orange-tint border-orange text-charcoal"
                    : "bg-white border-gray-200 text-gray-700 hover:border-gray-300",
                ].join(" ")}
              >
                {t(`shipVsDrive.inputs.hourlyRate.options.${r}`)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ZipField({
  label,
  placeholder,
  value,
  onChange,
  meta,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  meta: ZipMeta;
}) {
  const t = useTranslations();
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <input
        type="text"
        inputMode="numeric"
        maxLength={5}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-charcoal text-sm bg-white"
      />
      {meta.status === "ok" && meta.city && (
        <p className="text-xs text-green-700 font-medium mt-1 flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 bg-green-700 text-white rounded-full text-[9px] font-bold">
            +
          </span>
          {meta.city}, {meta.state}
        </p>
      )}
      {meta.status === "unknown" && (
        <p className="text-xs text-amber-700 font-medium mt-1">
          {t("shipVsDrive.inputs.zipUnknown")}
        </p>
      )}
      {meta.status === "invalid" && value.length === 5 && (
        <p className="text-xs text-red-700 font-medium mt-1">
          {t("shipVsDrive.inputs.zipError")}
        </p>
      )}
    </div>
  );
}

// ── Results view ──────────────────────────────────────────────────────────
function ResultsView({
  calc,
  quoteHref,
}: {
  calc: Calc;
  quoteHref: { pathname: "/quote"; query: Record<string, string> };
}) {
  const t = useTranslations();
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_44px_1fr] items-stretch gap-0">
        <ShipCard calc={calc} />
        <div className="flex items-center justify-center md:py-0 py-2 font-bold text-sm tracking-widest text-gray-500">
          VS
        </div>
        <DriveCard calc={calc} />
      </div>

      <VerdictBox calc={calc} />

      <div className="flex flex-wrap gap-2.5">
        <Link
          href={quoteHref}
          className="inline-flex items-center px-5 py-2.5 rounded-full bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink text-sm font-semibold transition"
        >
          {t("shipVsDrive.ctas.primary")}
        </Link>
        <button
          type="button"
          disabled
          className="inline-flex items-center px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-500 text-sm font-semibold opacity-60 cursor-not-allowed"
        >
          {t("shipVsDrive.ctas.secondary")}
        </button>
      </div>

      <p className="text-gray-500 text-xs italic leading-relaxed mt-2">
        {t("shipVsDrive.footnote")}
      </p>
    </>
  );
}

// ── Ship card ─────────────────────────────────────────────────────────────
function ShipCard({ calc }: { calc: Calc }) {
  const t = useTranslations();
  const isWinner = calc.winner === "ship";
  const branch = calc.branch;

  if (branch === "invalid") {
    return (
      <CardShell variant="unavailable">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
          {t("shipVsDrive.ship.label")}
        </p>
        <h3 className="text-base font-semibold text-charcoal mb-1">
          {t("shipVsDrive.ship.invalidTitle")}
        </h3>
        <div className="text-3xl font-bold text-gray-500 my-1">—</div>
        <p className="text-xs text-gray-500 italic mb-3">
          {t("shipVsDrive.ship.invalidTimeline")}
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          {t("shipVsDrive.ship.invalidMsg")}
        </p>
      </CardShell>
    );
  }

  const titleKey =
    branch === "hawaii" ? "shipVsDrive.ship.titleHawaii"
    : branch === "alaska" ? "shipVsDrive.ship.titleAlaska"
    : "shipVsDrive.ship.title";
  const tierKey =
    branch === "hawaii" ? "shipVsDrive.ship.tierHawaii"
    : branch === "alaska" ? "shipVsDrive.ship.tierAlaska"
    : "shipVsDrive.ship.tierPriority";
  const tierLinkKey =
    branch === "hawaii" ? "shipVsDrive.ship.tierLinkHawaii"
    : branch === "alaska" ? "shipVsDrive.ship.tierLinkAlaska"
    : "shipVsDrive.ship.tierLinkAll";

  return (
    <CardShell variant={isWinner ? "winner" : "neutral"}>
      <div className="flex items-center gap-1.5 mb-1">
        {isWinner && (
          <span className="inline-flex items-center justify-center w-[18px] h-[18px] bg-orange text-white rounded-full text-[11px] font-bold">
            +
          </span>
        )}
        <p className={[
          "text-[11px] font-semibold uppercase tracking-wider",
          isWinner ? "text-orange" : "text-gray-500",
        ].join(" ")}>
          {t("shipVsDrive.ship.label")}
        </p>
      </div>
      <h3 className="text-base font-semibold text-charcoal mb-1">
        {t(titleKey)}
      </h3>
      <p className="text-xs text-gray-500 mb-2.5 leading-snug">
        {t(tierKey)} ·{" "}
        <Link href="/price-promise" className="text-orange hover:underline font-medium">
          {t(tierLinkKey)}
        </Link>
      </p>

      <div className="text-3xl md:text-4xl font-bold text-charcoal mb-1 tracking-tight">
        ~${formatMoney(calc.ship.price)}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {branch === "ok"
          ? t("shipVsDrive.ship.timeline", { days: calc.ship.days })
          : t("shipVsDrive.ship.timelinePort")}
      </p>

      <ul className="border-t border-gray-200 pt-3 space-y-1">
        {branch === "ok" && (
          <>
            <BreakdownRow lbl={t("shipVsDrive.ship.breakdown.estimatedPrice")} val={`~$${formatMoney(calc.ship.price)}`} />
            <BreakdownRow lbl={t("shipVsDrive.ship.breakdown.yourTime")} val="$0" zero />
            <BreakdownRow lbl={t("shipVsDrive.ship.breakdown.wear")} val="$0" zero />
            <BreakdownRow lbl={t("shipVsDrive.ship.breakdown.fuelHotelTolls")} val="$0" zero />
          </>
        )}
        {branch === "hawaii" && (
          <>
            <BreakdownRow lbl={t("shipVsDrive.ship.breakdown.estimatedPrice")} val={`~$${formatMoney(calc.ship.price)}`} />
            <BreakdownRow lbl={t("shipVsDrive.ship.breakdown.oceanTransit")} val={t("shipVsDrive.ship.breakdown.included")} />
            <BreakdownRow lbl={t("shipVsDrive.ship.breakdown.portFees")} val={t("shipVsDrive.ship.breakdown.included")} />
            <BreakdownRow lbl={t("shipVsDrive.ship.breakdown.islandDelivery")} val={t("shipVsDrive.ship.breakdown.included")} />
          </>
        )}
        {branch === "alaska" && (
          <>
            <BreakdownRow lbl={t("shipVsDrive.ship.breakdown.estimatedPrice")} val={`~$${formatMoney(calc.ship.price)}`} />
            <BreakdownRow lbl={t("shipVsDrive.ship.breakdown.inlandLeg")} val={t("shipVsDrive.ship.breakdown.included")} />
            <BreakdownRow lbl={t("shipVsDrive.ship.breakdown.oceanFromTacoma")} val={t("shipVsDrive.ship.breakdown.included")} />
            <BreakdownRow lbl={t("shipVsDrive.ship.breakdown.anchorageDelivery")} val={t("shipVsDrive.ship.breakdown.included")} />
          </>
        )}
      </ul>
    </CardShell>
  );
}

// ── Drive card ────────────────────────────────────────────────────────────
function DriveCard({ calc }: { calc: Calc }) {
  const t = useTranslations();
  const isWinner = calc.winner === "drive";
  const branch = calc.branch;

  if (branch === "hawaii") {
    return (
      <CardShell variant="ocean">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-900 mb-1">
          {t("shipVsDrive.drive.label")}
        </p>
        <h3 className="text-base font-semibold text-blue-900 mb-1">
          {t("shipVsDrive.drive.titleOcean")}
        </h3>
        <div className="text-3xl font-bold text-blue-900 my-1">—</div>
        <p className="text-xs text-blue-900/80 italic mb-3">
          {t("shipVsDrive.drive.subtitleOcean")}
        </p>
        <p className="text-sm text-blue-900 leading-relaxed">
          {t("shipVsDrive.drive.oceanMsg")}
        </p>
      </CardShell>
    );
  }

  if (branch === "invalid") {
    return (
      <CardShell variant="unavailable">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
          {t("shipVsDrive.drive.label")}
        </p>
        <h3 className="text-base font-semibold text-charcoal mb-1">
          {t("shipVsDrive.drive.invalidTitle")}
        </h3>
        <div className="text-3xl font-bold text-gray-500 my-1">—</div>
        <p className="text-xs text-gray-500 italic mb-3">
          {t("shipVsDrive.drive.invalidTimeline")}
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          {t("shipVsDrive.drive.invalidMsg")}
        </p>
      </CardShell>
    );
  }

  const d = calc.drive;
  const drivingHours = Math.max(1, Math.round(d.distance / 60));
  const isAlaska = branch === "alaska";

  const titleStr = isAlaska
    ? t("shipVsDrive.drive.titleAlaska", { days: d.days })
    : d.days === 1
    ? t("shipVsDrive.drive.titleShort", { hours: drivingHours })
    : t("shipVsDrive.drive.titleLong", { hours: drivingHours });

  const timelineStr = isAlaska
    ? t("shipVsDrive.drive.timelineAlaska", {
        days: d.days,
        miles: d.distance.toLocaleString("en-US"),
      })
    : d.days === 1
    ? t("shipVsDrive.drive.timelineSameDay", { hours: drivingHours })
    : t("shipVsDrive.drive.timelineMulti", { days: d.days, hours: drivingHours });

  return (
    <CardShell variant={isWinner ? "winner" : "neutral"}>
      <div className="flex items-center gap-1.5 mb-1">
        {isWinner && (
          <span className="inline-flex items-center justify-center w-[18px] h-[18px] bg-orange text-white rounded-full text-[11px] font-bold">
            +
          </span>
        )}
        <p className={[
          "text-[11px] font-semibold uppercase tracking-wider",
          isWinner ? "text-orange" : "text-gray-500",
        ].join(" ")}>
          {t("shipVsDrive.drive.label")}
        </p>
      </div>
      <h3 className="text-base font-semibold text-charcoal mb-1">{titleStr}</h3>
      <p className="text-xs text-gray-500 mb-2.5 invisible">spacer</p>

      <div className="text-3xl md:text-4xl font-bold text-charcoal mb-1 tracking-tight">
        ${formatMoney(d.total)}
      </div>
      <p className="text-xs text-gray-500 mb-4">{timelineStr}</p>

      <ul className="border-t border-gray-200 pt-3 space-y-1">
        <BreakdownRow
          lbl={t("shipVsDrive.drive.breakdown.fuel", {
            miles: d.distance.toLocaleString("en-US"),
          })}
          val={`$${formatMoney(d.fuel)}`}
        />
        <BreakdownRow
          lbl={
            d.hotelNights === 0 ? t("shipVsDrive.drive.breakdown.hotelNone")
            : d.hotelNights === 1 ? t("shipVsDrive.drive.breakdown.hotelOne")
            : t("shipVsDrive.drive.breakdown.hotelMany", { nights: d.hotelNights })
          }
          val={d.hotels === 0 ? "$0" : `$${formatMoney(d.hotels)}`}
          zero={d.hotels === 0}
        />
        <BreakdownRow
          lbl={t("shipVsDrive.drive.breakdown.tollsFood")}
          val={`$${formatMoney(d.tollsFood)}`}
        />
        <BreakdownRow
          lbl={t("shipVsDrive.drive.breakdown.wear")}
          val={`$${formatMoney(d.wear)}`}
        />
        <BreakdownRow
          lbl={
            d.time > 0
              ? t("shipVsDrive.drive.breakdown.timeRated", {
                  hours: drivingHours,
                  rate: d.hourlyRate,
                })
              : t("shipVsDrive.drive.breakdown.timeNotCounted")
          }
          val={d.time > 0 ? `$${formatMoney(d.time)}` : t("shipVsDrive.drive.breakdown.notCounted")}
          zero={d.time === 0}
        />
        <BreakdownRow
          lbl={t("shipVsDrive.drive.breakdown.risk")}
          val={
            isAlaska
              ? t("shipVsDrive.drive.breakdown.riskHigh")
              : d.distance < SHORT_HAUL_THRESHOLD_MI
              ? t("shipVsDrive.drive.breakdown.riskLow")
              : t("shipVsDrive.drive.breakdown.variable")
          }
        />
      </ul>
    </CardShell>
  );
}

// ── Verdict box ───────────────────────────────────────────────────────────
function VerdictBox({ calc }: { calc: Calc }) {
  const t = useTranslations();
  const drivingHours = calc.drive
    ? Math.max(1, Math.round(calc.drive.distance / 60))
    : 0;

  let headline = "";
  let sub = "";

  switch (calc.branch) {
    case "hawaii":
      headline = t("shipVsDrive.verdict.hawaii");
      sub = t("shipVsDrive.verdict.hawaiiSub");
      break;
    case "alaska":
      headline = t("shipVsDrive.verdict.alaska");
      sub = t("shipVsDrive.verdict.alaskaSub");
      break;
    case "invalid":
      headline = t("shipVsDrive.verdict.invalid");
      sub = t("shipVsDrive.verdict.invalidSub");
      break;
    case "ok": {
      const diff = Math.abs(calc.savings);
      if (diff < WASH_THRESHOLD_USD) {
        headline = t("shipVsDrive.verdict.wash");
        sub = t("shipVsDrive.verdict.washSub");
      } else if (calc.winner === "ship") {
        headline = t("shipVsDrive.verdict.shipWins", {
          savings: formatMoney(diff),
          hours: drivingHours,
        });
        sub = t("shipVsDrive.verdict.shipWinsSub");
      } else {
        headline = t("shipVsDrive.verdict.driveWins", {
          savings: formatMoney(diff),
        });
        sub = t("shipVsDrive.verdict.driveWinsSub");
      }
      break;
    }
  }

  return (
    <div className="bg-orange-tint border border-orange/30 rounded-2xl px-5 py-4">
      <p className="text-charcoal text-base md:text-lg font-semibold leading-snug">
        {headline}
      </p>
      <p className="text-gray-700 text-sm md:text-[15px] italic mt-1 leading-snug">
        {sub}
      </p>
    </div>
  );
}

// ── Card shell + breakdown row ────────────────────────────────────────────
type CardVariant = "neutral" | "winner" | "ocean" | "unavailable";

function CardShell({
  variant,
  children,
}: {
  variant: CardVariant;
  children: React.ReactNode;
}) {
  const cls = {
    neutral: "bg-white border-2 border-gray-200",
    winner:
      "bg-gradient-to-b from-orange-tint to-white border-2 border-orange shadow-[0_8px_24px_rgba(132,204,22,0.12)]",
    ocean: "bg-gradient-to-b from-blue-100 to-white border-2 border-blue-300",
    unavailable: "bg-gray-100 border-2 border-gray-200",
  }[variant];

  return (
    <div className={`${cls} rounded-2xl p-5 md:p-6 flex flex-col`}>
      {children}
    </div>
  );
}

function BreakdownRow({
  lbl,
  val,
  zero,
}: {
  lbl: string;
  val: string;
  zero?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between text-[13px] py-0.5">
      <span className="text-gray-700">{lbl}</span>
      <span
        className={[
          "font-medium tabular-nums whitespace-nowrap",
          zero ? "text-gray-500" : "text-charcoal",
        ].join(" ")}
      >
        {val}
      </span>
    </li>
  );
}

function formatMoney(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// ── Math ──────────────────────────────────────────────────────────────────
interface CalcInput {
  fromZip: string;
  toZip: string;
  vehicleType: VehicleType;
  hourlyRate: number;
}

interface Calc {
  branch: Branch;
  fromMeta: ZipMeta;
  toMeta: ZipMeta;
  winner: "ship" | "drive" | "wash";
  savings: number;
  ship: { price: number; days: number };
  drive: {
    distance: number;
    fuel: number;
    hotels: number;
    hotelNights: number;
    tollsFood: number;
    wear: number;
    time: number;
    days: number;
    total: number;
    hourlyRate: number;
  };
}

function computeComparison(input: CalcInput): Calc {
  const fromMeta = resolveZip(input.fromZip);
  const toMeta = resolveZip(input.toZip);

  const oneSideHawaii = fromMeta.state === "HI" || toMeta.state === "HI";
  const oneSideAlaska = fromMeta.state === "AK" || toMeta.state === "AK";

  if (fromMeta.status === "invalid" || toMeta.status === "invalid") {
    return invalidResult(fromMeta, toMeta);
  }
  if (oneSideHawaii) return hawaiiResult(fromMeta, toMeta, input);
  if (oneSideAlaska) return alaskaResult(fromMeta, toMeta, input);
  if (fromMeta.status === "unknown" || toMeta.status === "unknown") {
    return invalidResult(fromMeta, toMeta);
  }

  const fromEntry = lookupZipApprox(input.fromZip)?.entry;
  const toEntry = lookupZipApprox(input.toZip)?.entry;
  if (!fromEntry || !toEntry) return invalidResult(fromMeta, toMeta);

  const distance = Math.round(roadDistanceMiles(fromEntry, toEntry));
  const drive = computeDrive(distance, input.vehicleType, input.hourlyRate);
  const shipPrice = Math.round(
    Math.max(
      SHIP_SHORT_HAUL_FLOOR_USD,
      distance * SHIP_BASE_PER_MILE_USD * SHIP_VEHICLE_MULTIPLIER[input.vehicleType]
    )
  );
  const shipDays = Math.max(
    2,
    Math.ceil((distance / DRIVE_MILES_PER_DAY) * SHIP_DAYS_PER_500_MILES)
  );

  const savings = drive.total - shipPrice;
  let winner: "ship" | "drive" | "wash";
  if (Math.abs(savings) < WASH_THRESHOLD_USD) winner = "wash";
  else if (savings > 0) winner = "ship";
  else winner = "drive";

  return {
    branch: "ok",
    fromMeta,
    toMeta,
    winner,
    savings,
    ship: { price: shipPrice, days: shipDays },
    drive,
  };
}

function computeDrive(distance: number, vt: VehicleType, hourlyRate: number) {
  const fuel = (distance / MPG_BY_VEHICLE[vt]) * DEFAULT_FUEL_PRICE_USD;
  const days = Math.max(1, Math.ceil(distance / DRIVE_MILES_PER_DAY));
  const hotelNights = Math.max(0, days - 1);
  const hotels = hotelNights * HOTEL_NIGHTLY_USD;
  const tollsFood = days * (FOOD_PER_DRIVER_PER_DAY_USD + MIN_TOLLS_FOOD_PER_DAY);
  const wear = distance * WEAR_PER_MILE_USD;
  const drivingHours = distance / 60;
  const time = drivingHours * hourlyRate;
  const total = fuel + hotels + tollsFood + wear + time;
  return {
    distance, fuel, hotels, hotelNights, tollsFood, wear, time, days, total, hourlyRate,
  };
}

function hawaiiResult(fromMeta: ZipMeta, toMeta: ZipMeta, input: CalcInput): Calc {
  return {
    branch: "hawaii",
    fromMeta,
    toMeta,
    winner: "ship",
    savings: 0,
    ship: {
      price: Math.round(SHIP_HAWAII_BASE_USD * SHIP_VEHICLE_MULTIPLIER[input.vehicleType]),
      days: 12,
    },
    drive: emptyDrive(input.hourlyRate),
  };
}

function alaskaResult(fromMeta: ZipMeta, toMeta: ZipMeta, input: CalcInput): Calc {
  const distance = 3400;
  const drive = computeDrive(distance, input.vehicleType, input.hourlyRate);
  const shipPrice = Math.round(SHIP_ALASKA_BASE_USD * SHIP_VEHICLE_MULTIPLIER[input.vehicleType]);
  return {
    branch: "alaska",
    fromMeta,
    toMeta,
    winner: "ship",
    savings: drive.total - shipPrice,
    ship: { price: shipPrice, days: 11 },
    drive,
  };
}

function invalidResult(fromMeta: ZipMeta, toMeta: ZipMeta): Calc {
  return {
    branch: "invalid",
    fromMeta,
    toMeta,
    winner: "wash",
    savings: 0,
    ship: { price: 0, days: 0 },
    drive: emptyDrive(0),
  };
}

function emptyDrive(hourlyRate: number) {
  return {
    distance: 0, fuel: 0, hotels: 0, hotelNights: 0,
    tollsFood: 0, wear: 0, time: 0, days: 0, total: 0, hourlyRate,
  };
}

// ── ZIP resolution ────────────────────────────────────────────────────────
function resolveZip(zip: string): ZipMeta {
  if (!/^\d{5}$/.test(zip)) return { status: "invalid" };

  // 1. Exact OR 3-digit-prefix match in the table → "ok"
  //    (92107 → 92101 San Diego, 90211 → 90210 Beverly Hills)
  const approx = lookupZipApprox(zip);
  if (approx) {
    return { status: "ok", city: approx.entry.city, state: approx.entry.state };
  }

  // 2. Hawaii or Alaska detected by prefix range
  const prefixState = zipPrefixToState(zip);
  if (prefixState) return { status: "unknown", state: prefixState };

  // 3. Plausible 5-digit ZIP but no metro / no recognized state
  return { status: "unknown" };
}
