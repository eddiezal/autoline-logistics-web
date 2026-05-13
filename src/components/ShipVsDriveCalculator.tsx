"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Ship vs Drive Calculator — §1 named deliverable.
 *
 * Math-only v1. No external API dependencies. All assumptions are documented
 * as named constants below — tune as we get real signal.
 *
 * Future v2 (post-SD): swap SHIP_PRICE_PER_MILE with a live SD pricing call.
 */

// ── Drive-side assumptions ────────────────────────────────────────────────
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
const HOTEL_NIGHTLY_USD = 150;
const FOOD_PER_DRIVER_PER_DAY_USD = 50;
const IRS_MILEAGE_RATE_USD = 0.67;
const DRIVE_MILES_PER_DAY = 500;
const WORK_HOURS_PER_DAY = 8;

// ── Ship-side estimate (placeholder until SD API lands) ───────────────────
// Industry averages for open-carrier B2C. Vehicle multipliers reflect
// real-world surcharge patterns. Will be replaced with SD live pricing in v2.
const SHIP_BASE_PER_MILE_USD = 0.7; // mid-market priority tier base
const SHIP_TIER_MULTIPLIER = { standby: 0.85, priority: 1.0, expedited: 1.35 };
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
const SHIP_SHORT_HAUL_FLOOR_USD = 350; // minimum carrier engagement cost
const SHIP_DAYS_PER_500_MILES = 1.5; // rough door-to-door pace including pickup window

type VehicleType =
  | "sedan"
  | "suv"
  | "truckStandard"
  | "truckLifted"
  | "van"
  | "motorcycle"
  | "classic"
  | "other";

const VEHICLE_OPTIONS: ReadonlyArray<VehicleType> = [
  "sedan",
  "suv",
  "truckStandard",
  "truckLifted",
  "van",
  "motorcycle",
  "classic",
  "other",
];

export function ShipVsDriveCalculator() {
  const t = useTranslations();

  // Defaults: a typical cross-country sedan move
  const [distance, setDistance] = useState(1500);
  const [vehicle, setVehicle] = useState<VehicleType>("sedan");
  const [fuelPrice, setFuelPrice] = useState(4.5);
  const [drivers, setDrivers] = useState<1 | 2>(1);
  const [hourlyRate, setHourlyRate] = useState<number | "">("");

  const calc = useMemo(
    () => computeComparison({ distance, vehicle, fuelPrice, drivers, hourlyRate: hourlyRate || 0 }),
    [distance, vehicle, fuelPrice, drivers, hourlyRate]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 lg:gap-10">
      {/* ── INPUTS ─────────────────────────────────────────────────────── */}
      <div className="bg-gray-100 border border-gray-200 rounded-2xl p-6 h-fit">
        <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-4">
          {t("shipVsDrive.inputs.legend")}
        </p>

        <div className="space-y-5">
          {/* Distance */}
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">
              {t("shipVsDrive.inputs.distance.label")}
            </span>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={100}
                max={3500}
                step={50}
                value={distance}
                onChange={(e) => setDistance(Number(e.target.value))}
                className="flex-1 accent-orange"
              />
              <input
                type="number"
                min={100}
                max={3500}
                value={distance}
                onChange={(e) => setDistance(Number(e.target.value))}
                className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-charcoal text-sm text-right"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {t("shipVsDrive.inputs.distance.helper")}
            </p>
          </label>

          {/* Vehicle type */}
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">
              {t("shipVsDrive.inputs.vehicleType.label")}
            </span>
            <select
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value as VehicleType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-charcoal text-sm"
            >
              {VEHICLE_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {t(`shipVsDrive.inputs.vehicleType.options.${v}`)}
                </option>
              ))}
            </select>
          </label>

          {/* Fuel price */}
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">
              {t("shipVsDrive.inputs.fuelPrice.label")}
            </span>
            <input
              type="number"
              min={2}
              max={10}
              step={0.1}
              value={fuelPrice}
              onChange={(e) => setFuelPrice(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-charcoal text-sm"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              {t("shipVsDrive.inputs.fuelPrice.helper")}
            </p>
          </label>

          {/* Drivers */}
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">
              {t("shipVsDrive.inputs.drivers.label")}
            </span>
            <select
              value={drivers}
              onChange={(e) => setDrivers(Number(e.target.value) as 1 | 2)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-charcoal text-sm"
            >
              <option value={1}>{t("shipVsDrive.inputs.drivers.options.one")}</option>
              <option value={2}>{t("shipVsDrive.inputs.drivers.options.two")}</option>
            </select>
          </label>

          {/* Hourly rate (optional) */}
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1.5">
              {t("shipVsDrive.inputs.hourlyRate.label")}
            </span>
            <input
              type="number"
              min={0}
              max={500}
              step={5}
              placeholder="0"
              value={hourlyRate}
              onChange={(e) =>
                setHourlyRate(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-charcoal text-sm"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              {t("shipVsDrive.inputs.hourlyRate.helper")}
            </p>
          </label>
        </div>
      </div>

      {/* ── RESULTS ────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Drive card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-3">
            {t("shipVsDrive.drive.title")}
          </p>
          <CostRow label={t("shipVsDrive.drive.fuel")} value={calc.drive.fuel} />
          <CostRow
            label={`${t("shipVsDrive.drive.hotels")} · ${
              calc.drive.hotelNights === 1
                ? t("shipVsDrive.drive.hotelsCount", { count: calc.drive.hotelNights })
                : t("shipVsDrive.drive.hotelsCountPlural", { count: calc.drive.hotelNights })
            }`}
            value={calc.drive.hotels}
          />
          <CostRow label={t("shipVsDrive.drive.food")} value={calc.drive.food} />
          <CostRow
            label={t("shipVsDrive.drive.wear")}
            value={calc.drive.wear}
            helper={t("shipVsDrive.drive.wearHelper")}
          />
          {calc.drive.time > 0 && (
            <CostRow
              label={t("shipVsDrive.drive.time")}
              value={calc.drive.time}
              helper={t("shipVsDrive.drive.timeHelper", { days: calc.drive.days })}
            />
          )}
          <div className="border-t border-gray-200 mt-4 pt-4 flex items-baseline justify-between">
            <span className="font-bold text-charcoal">
              {t("shipVsDrive.drive.totalLabel")}
            </span>
            <span className="font-bold text-2xl text-charcoal">
              ${formatMoney(calc.drive.total)}
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-2 italic">
            {t("shipVsDrive.drive.daysLabel", { days: calc.drive.days })}
          </p>
        </div>

        {/* Ship card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-3">
            {t("shipVsDrive.ship.title")}
          </p>
          <CostRow
            label={t("shipVsDrive.ship.tierStandby")}
            value={calc.ship.standby}
          />
          <CostRow
            label={t("shipVsDrive.ship.tierPriority")}
            value={calc.ship.priority}
          />
          <CostRow
            label={t("shipVsDrive.ship.tierExpedited")}
            value={calc.ship.expedited}
          />
          <div className="border-t border-gray-200 mt-4 pt-4 flex items-baseline justify-between">
            <span className="font-bold text-charcoal">
              {t("shipVsDrive.ship.totalLabel")}
            </span>
            <span className="font-bold text-2xl text-charcoal">
              ${formatMoney(calc.ship.standby)}–${formatMoney(calc.ship.expedited)}
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-2 italic">
            {t("shipVsDrive.ship.daysLabel")} · {t("shipVsDrive.ship.noWearLabel")}
          </p>
          <p className="text-gray-500 text-xs mt-1 italic">
            {t("shipVsDrive.ship.footnote")}
          </p>
        </div>

        {/* Comparison */}
        <div className="bg-orange-tint border border-orange/30 rounded-2xl p-6">
          <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-3">
            {t("shipVsDrive.comparison.title")}
          </p>
          <p className="text-charcoal text-xl md:text-2xl font-semibold leading-snug">
            {calc.comparison.savingsBucket === "ship"
              ? t("shipVsDrive.comparison.savings", {
                  amount: formatMoney(calc.comparison.savings),
                })
              : calc.comparison.savingsBucket === "drive"
              ? t("shipVsDrive.comparison.savingsNegative", {
                  amount: formatMoney(Math.abs(calc.comparison.savings)),
                })
              : t("shipVsDrive.comparison.savingsTie")}
          </p>
          {calc.comparison.savingsBucket === "ship" && (
            <p className="text-gray-700 text-base mt-2">
              {t("shipVsDrive.comparison.timeSaved", {
                days: calc.drive.days - calc.ship.days,
              })}
            </p>
          )}
          <p className="text-gray-700 text-sm mt-4 italic">
            {t("shipVsDrive.comparison.thinkAlso")}
          </p>
        </div>

        {/* CTA */}
        <div className="bg-charcoal text-white rounded-2xl p-6 md:p-8">
          <h3 className="text-2xl md:text-3xl font-bold leading-tight">
            {t("shipVsDrive.cta.title")}
          </h3>
          <p className="text-gray-300 mt-3">{t("shipVsDrive.cta.description")}</p>
          <Link
            href="/quote"
            className="inline-block mt-5 bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
          >
            {t("shipVsDrive.cta.primary")}
          </Link>
        </div>

        {/* Footnote */}
        <p className="text-gray-500 text-xs italic leading-relaxed">
          {t("shipVsDrive.footnote")}
        </p>
      </div>
    </div>
  );
}

function CostRow({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <div className="text-gray-700 text-sm leading-tight">
        <span>{label}</span>
        {helper && (
          <span className="block text-xs text-gray-500 italic">{helper}</span>
        )}
      </div>
      <span className="text-charcoal font-medium text-sm tabular-nums whitespace-nowrap">
        ${formatMoney(value)}
      </span>
    </div>
  );
}

// ── Math ──────────────────────────────────────────────────────────────────

interface CalcInput {
  distance: number;
  vehicle: VehicleType;
  fuelPrice: number;
  drivers: 1 | 2;
  hourlyRate: number;
}

function computeComparison(input: CalcInput) {
  // Drive side
  const mpg = MPG_BY_VEHICLE[input.vehicle];
  const fuel = (input.distance / mpg) * input.fuelPrice;
  const days = Math.max(1, Math.ceil(input.distance / DRIVE_MILES_PER_DAY));
  const hotelNights = Math.max(0, days - 1);
  const hotels = hotelNights * HOTEL_NIGHTLY_USD;
  const food = days * input.drivers * FOOD_PER_DRIVER_PER_DAY_USD;
  const wear = input.distance * IRS_MILEAGE_RATE_USD;
  const time = days * WORK_HOURS_PER_DAY * input.hourlyRate;
  const driveTotal = fuel + hotels + food + wear + time;

  // Ship side
  const vehicleMult = SHIP_VEHICLE_MULTIPLIER[input.vehicle];
  const rawShip = Math.max(
    SHIP_SHORT_HAUL_FLOOR_USD,
    input.distance * SHIP_BASE_PER_MILE_USD * vehicleMult
  );
  const standby = rawShip * SHIP_TIER_MULTIPLIER.standby;
  const priority = rawShip * SHIP_TIER_MULTIPLIER.priority;
  const expedited = rawShip * SHIP_TIER_MULTIPLIER.expedited;
  const shipDays = Math.max(
    2,
    Math.ceil((input.distance / 500) * SHIP_DAYS_PER_500_MILES)
  );

  // Comparison — compare drive vs the mid-tier (priority) ship cost
  const savings = driveTotal - priority;
  let savingsBucket: "ship" | "drive" | "tie";
  if (Math.abs(savings) < 50) {
    savingsBucket = "tie";
  } else if (savings > 0) {
    savingsBucket = "ship";
  } else {
    savingsBucket = "drive";
  }

  return {
    drive: {
      fuel,
      hotels,
      hotelNights,
      food,
      wear,
      time,
      days,
      total: driveTotal,
    },
    ship: {
      standby,
      priority,
      expedited,
      days: shipDays,
    },
    comparison: {
      savings,
      savingsBucket,
    },
  };
}

function formatMoney(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
