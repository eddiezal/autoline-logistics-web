"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics/events";
import { sendEvent, getSessionId, getSessionAttribution } from "@/lib/analytics/behavior";
import { buildQuoteHref } from "@/lib/hero-handoff";

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

/**
 * Map the checker's 3 vehicle options onto QuoteForm's VEHICLE_TYPE_KEYS
 * so the handoff preselects the right dropdown entry ("pickup" is
 * "truckStandard" on the quote side).
 */
const HANDOFF_VEHICLE: Record<Vehicle, string> = {
  sedan: "sedan",
  suv: "suv",
  pickup: "truckStandard",
};

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
  locale,
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
    capTitle: string;
    capSub: string;
    capPlaceholder: string;
    capButton: string;
    capSending: string;
    capFine: string;
    capErrorEmail: string;
    capErrorSend: string;
    capSentTitle: string;
    capSentBody: string;
    handoffTitle: string;
    handoffSub: string;
    handoffButton: string;
    callPrompt: string;
    phone: string;
  };
  locale?: string;
}) {
  const [fromZip, setFromZip] = useState("");
  const [toZip, setToZip] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle>("sedan");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);

  /* ── "Email me this estimate" capture (spec 2026-07-29) ──
   * One transactional email, no CRM push. The event stream never carries
   * the address; capture→lead joins happen server-side via emailKey. */
  const [capEmail, setCapEmail] = useState("");
  const [capState, setCapState] = useState<
    "idle" | "sending" | "sent" | "error_email" | "error_send"
  >("idle");

  /** e•••@domain — enough for "sent to you", no full PII on screen. */
  function maskEmail(e: string): string {
    const at = e.indexOf("@");
    if (at <= 0) return e;
    return e[0] + "•••" + e.slice(at);
  }

  async function handleCapture(e: React.FormEvent) {
    e.preventDefault();
    if (capState === "sending" || result?.status !== "ok") return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(capEmail.trim())) {
      setCapState("error_email");
      return;
    }
    const sel = result.prices[result.selectedVehicle];
    if (!sel) return;
    setCapState("sending");
    try {
      // Same ordering rule as sendEvent: session id first (may clear a
      // stale attribution on rollover), THEN read attribution.
      const sid = getSessionId();
      const attr = getSessionAttribution();
      const res = await fetch("/api/estimate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: capEmail.trim(),
          fromZip: result.fromZip,
          toZip: result.toZip,
          vehicle: result.selectedVehicle,
          price: Math.round((sel.low + sel.high) / 2 / 25) * 25,
          low: sel.low,
          high: sel.high,
          locale: locale === "es" ? "es" : "en",
          sid,
          attr,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setCapState("sent");
        sendEvent("estimate_email_captured", { tool: "route-checker" });
      } else if (data.error === "invalid_email") {
        setCapState("error_email");
      } else {
        setCapState("error_send");
      }
    } catch {
      setCapState("error_send");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setCapState("idle");

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
          {/* HANDOFF FIX (2026-08-13): was {fromZip, toZip} — param names the
              /quote page never parsed, so customers re-typed their route.
              buildQuoteHref is the single source of truth; see hero-handoff.ts. */}
          <Link
            href={buildQuoteHref({
              originZip: result.fromZip,
              destinationZip: result.toZip,
            })}
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

              {/* ESTIMATE-MOMENT PRIMARY ASK (2026-08-13, behavioral-journey
                  study: 87% of visits exit immediately after this number
                  renders and only ~2% continue to the quote form). Audit-
                  approved hierarchy: primary = turn the range into a locked
                  quote with route+vehicle prefilled; secondary = talk to a
                  person; tertiary = the email capture below. The prefill
                  claim in the sub-line is honest ONLY because the handoff
                  params are fixed (see HANDOFF FIX comments). */}
              <div className="mt-5 bg-orange-tint border border-orange/30 rounded-xl p-4">
                <p className="text-[15px] font-bold text-charcoal leading-snug">
                  {i18n.handoffTitle}
                </p>
                <p className="text-[12.5px] text-gray-700 mt-1 leading-snug">
                  {i18n.handoffSub}
                </p>
                <Link
                  href={buildQuoteHref({
                    originZip: result.fromZip,
                    destinationZip: result.toZip,
                    vehicleType: HANDOFF_VEHICLE[result.selectedVehicle],
                  })}
                  onClick={() =>
                    track({
                      name: "pc_quote_handoff_click",
                      props: {
                        from_zip: result.fromZip,
                        to_zip: result.toZip,
                        vehicle_type: result.selectedVehicle,
                      },
                    })
                  }
                  className="mt-3 inline-block bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold text-sm px-5 py-2.5 rounded-lg transition"
                >
                  {i18n.handoffButton} →
                </Link>
                <p className="text-[12px] text-gray-600 mt-2.5">
                  {i18n.callPrompt}{" "}
                  <a
                    href={`tel:${i18n.phone.replace(/[^0-9+]/g, "")}`}
                    onClick={() =>
                      track({ name: "lead_phone_call", props: { source: "tel_link" } })
                    }
                    className="font-bold text-charcoal underline decoration-orange/50 underline-offset-2 whitespace-nowrap"
                  >
                    {i18n.phone}
                  </a>
                </p>
              </div>

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
              {/* HANDOFF FIX (2026-08-13): was {fromZip, toZip, vehicleType} —
                  none of which /quote parses (it reads from/to/vehicle_type).
                  Every click landed on an EMPTY form since launch. */}
              <Link
                href={buildQuoteHref({
                  originZip: result.fromZip,
                  destinationZip: result.toZip,
                  vehicleType: HANDOFF_VEHICLE[result.selectedVehicle],
                })}
                className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold text-sm px-4 py-2 rounded-lg transition"
              >
                {i18n.resultCta} →
              </Link>
            </div>

            {/* "Email me this estimate" — signal capture (spec 2026-07-29) */}
            {capState === "sent" ? (
              <div className="bg-orange-tint px-5 py-4 border-t border-gray-200">
                <div className="flex items-start gap-2.5">
                  <span className="flex-none w-[22px] h-[22px] rounded-full bg-brand-accent text-white text-[13px] font-black flex items-center justify-center mt-0.5">
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-bold text-charcoal">
                      {i18n.capSentTitle.replace("{email}", maskEmail(capEmail.trim()))}
                    </p>
                    <p className="text-[12.5px] text-gray-700 mt-0.5 leading-snug">
                      {i18n.capSentBody}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 border-t border-gray-200 bg-[#fafcfa]">
                <p className="text-sm font-bold text-charcoal">{i18n.capTitle}</p>
                <p className="text-[12px] text-gray-600 mb-2.5">{i18n.capSub}</p>
                <form onSubmit={handleCapture} className="flex gap-2">
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={capEmail}
                    onChange={(e) => {
                      setCapEmail(e.target.value);
                      if (capState === "error_email") setCapState("idle");
                    }}
                    placeholder={i18n.capPlaceholder}
                    disabled={capState === "sending"}
                    className={`flex-1 min-w-0 px-3 py-2.5 border rounded-lg text-sm text-charcoal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange/20 ${
                      capState === "error_email"
                        ? "border-red-400 focus:border-red-500"
                        : "border-gray-200 focus:border-orange"
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={capState === "sending"}
                    className="border-[1.5px] border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-accent-ink font-bold text-[12.5px] px-3.5 py-2.5 rounded-lg transition whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {capState === "sending" ? i18n.capSending : i18n.capButton}
                  </button>
                </form>
                {capState === "error_email" && (
                  <p className="text-[12px] text-red-600 font-semibold mt-1.5">
                    {i18n.capErrorEmail}
                  </p>
                )}
                {capState === "error_send" && (
                  <p className="text-[12px] text-gray-600 mt-1.5">{i18n.capErrorSend}</p>
                )}
                {capState !== "error_email" && capState !== "error_send" && (
                  <p className="text-[10.5px] text-gray-400 mt-1.5">{i18n.capFine}</p>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
