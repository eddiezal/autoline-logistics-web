"use client";

import { useRef, useState, useId } from "react";
import { useTranslations } from "next-intl";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import {
  track,
  captureGclid,
  captureUtm,
  captureLandingPath,
  getFirstTouchAt,
  getFirstTouchUtm,
} from "@/lib/analytics/events";
import { sendEvent, getVisitorId } from "@/lib/analytics/behavior";
import { lookupZipApprox, zipPrefixToState } from "@/data/zip-metros";
import type { HeroHandoff } from "@/lib/hero-handoff";

const VEHICLE_TYPE_KEYS = [
  "sedan",
  "suv",
  "truckStandard",
  "truckLifted",
  "van",
  "classic",
  "other",
] as const;

// hCaptcha test site key. Always passes. Replace via NEXT_PUBLIC_HCAPTCHA_SITE_KEY
// once a real hCaptcha account is provisioned at https://hcaptcha.com.
const HCAPTCHA_TEST_KEY = "10000000-ffff-ffff-ffff-000000000001";

/**
 * /quote intake form (client component).
 *
 * Submits to POST /api/lead which validates the captcha server-side,
 * calls SD pricing for the live estimate, saves the lead doc, creates the
 * ProABD lead (ProABD assigns the agent), and emails the owner copy via
 * Resend.
 *
 * On success, the form is replaced with an inline SuccessCard showing
 * the lead reference. On error, an inline message appears and the user
 * can retry.
 *
 * RELEASE 1 (2026-08-12, form-optimization spec):
 *  - Last name REMOVED (not hidden — removed; CRM accepts empty; collect
 *    at booking if ever needed).
 *  - Service-tier radios REMOVED: customers were choosing a product
 *    before seeing what it costs. Tiers become the priced OUTPUT in the
 *    Release-2 flow; until then the server defaults the tier and agents
 *    quote all three.
 *  - Field-level funnel + technical-friction instrumentation (form_field,
 *    form_friction, submit_attempted, lead_persisted — see behavior.ts).
 *    Every event carries fv = FORM_VERSION so funnel reads split by
 *    release without deploy-timestamp archaeology.
 *  - Autofill/inputmode hints on every field (free completion-rate).
 */
const FORM_VERSION = "quote-r1-20260812";

export function QuoteForm({ handoff }: { handoff: HeroHandoff }) {
  const t = useTranslations();
  const required = t("quote.form.requiredMark");
  const siteKey =
    process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? HCAPTCHA_TEST_KEY;
  const usingTestKey = siteKey === HCAPTCHA_TEST_KEY;

  const [originZip, setOriginZip] = useState(handoff.originZip ?? "");
  const [destinationZip, setDestinationZip] = useState(
    handoff.destinationZip ?? "",
  );
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // First-party funnel: fire form_started once on first interaction, and
  // (Release 1) per-field focus/complete events — names only, never values.
  const formStartedSent = useRef(false);
  const fieldEventsSent = useRef<Set<string>>(new Set());
  // Narrow the focus/blur target to an actual form control (excludes the
  // hCaptcha iframe and the form element itself). instanceof both narrows
  // the TS type and guarantees .name/.value exist.
  function asFormControl(
    target: EventTarget | null,
  ): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      return target;
    }
    return null;
  }
  function onFocusInstrument(e: React.FocusEvent<HTMLFormElement>) {
    const el = asFormControl(e.target);
    if (!el) return;
    if (!formStartedSent.current) {
      formStartedSent.current = true;
      sendEvent("form_started", { fv: FORM_VERSION });
      // GA4 twin of form_started — MUST fire at the same moment, because the
      // lag-vs-loss monitor compares GA4 `quote_started` to first-party
      // `form_started` 1:1 (api/cron/lag-vs-loss, FS_RATIO_FLOOR).
      // The variant has existed in the FunnelEvent union since launch but
      // NOTHING ever emitted it, so that ratio was a structural 0 and the
      // monitor reported the "events die after page_view" signature on
      // 2026-08-12 — the first CLEAN settled day with >=5 form starts.
      // Earlier zeros were masked because they fell on the genuine 8/7 and
      // 8/11 outage days, where a 0 looked like corroboration.
      track({ name: "quote_started", props: {} });
    }
    const name = el.name;
    if (!name) return;
    const key = "focus:" + name;
    if (fieldEventsSent.current.has(key)) return;
    fieldEventsSent.current.add(key);
    sendEvent("form_field", { field: name, action: "focus", fv: FORM_VERSION });
  }
  function onBlurInstrument(e: React.FocusEvent<HTMLFormElement>) {
    const el = asFormControl(e.target);
    if (!el) return;
    const name = el.name;
    if (!name || !el.value.trim()) return;
    const key = "complete:" + name;
    if (fieldEventsSent.current.has(key)) return;
    fieldEventsSent.current.add(key);
    sendEvent("form_field", { field: name, action: "complete", fv: FORM_VERSION });
  }
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const captchaId = useId();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    sendEvent("submit_attempted", { fv: FORM_VERSION });
    if (!captchaToken) {
      // Button is disabled without a token, so reaching here means the
      // token expired between render and submit — friction, not intent.
      sendEvent("form_friction", { kind: "captcha_missing", fv: FORM_VERSION });
      return;
    }

    // US-only guard. The ZIP fields are plain text inputs, so before this
    // check the form happily accepted "Honduras" as a destination (real
    // launch-day lead, 2026-07-20). Server enforces the same rule.
    const ZIP_RE = /^\d{5}(-\d{4})?$/;
    if (!ZIP_RE.test(originZip.trim()) || !ZIP_RE.test(destinationZip.trim())) {
      setError(t("quote.form.zipInvalid"));
      sendEvent("form_friction", {
        kind: "validation_error",
        reason: "zip",
        fv: FORM_VERSION,
      });
      return;
    }

    setPending(true);
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);

    const payload: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (typeof v === "string") payload[k] = v;
    });
    payload.captchaToken = captchaToken;
    payload.referrer = typeof document !== "undefined" ? document.referrer : "";
    // Capture gclid up front so it lands in the lead doc and (later) flows
    // through to ProABD createLead for Google Ads OCI attribution.
    // captureGclid() reads URL first, falls back to the 60-day cookie.
    const submitGclid = captureGclid();
    if (submitGclid) payload.gclid = submitGclid;
    // Capture UTM params the same way (URL first, 60-day cookie fallback).
    // Added 2026-07-20: these were never sent before, so every Google Ads
    // lead rendered as organic/direct in the agent email + lead doc.
    const utm = captureUtm();
    if (utm?.utm_source) payload.utm_source = utm.utm_source;
    if (utm?.utm_medium) payload.utm_medium = utm.utm_medium;
    if (utm?.utm_campaign) payload.utm_campaign = utm.utm_campaign;
    if (utm?.utm_content) payload.utm_content = utm.utm_content;
    if (utm?.utm_term) payload.utm_term = utm.utm_term;
    // First-touch UTM set (2026-08-10, S1 assist analysis): the campaign
    // that STARTED this visitor's journey, distinct from the last-touch
    // set above. Lets reporting count assisted conversions per campaign.
    const firstUtm = getFirstTouchUtm();
    if (firstUtm?.utm_source) payload.first_utm_source = firstUtm.utm_source;
    if (firstUtm?.utm_medium) payload.first_utm_medium = firstUtm.utm_medium;
    if (firstUtm?.utm_campaign) payload.first_utm_campaign = firstUtm.utm_campaign;
    if (firstUtm?.utm_content) payload.first_utm_content = firstUtm.utm_content;
    if (firstUtm?.utm_term) payload.first_utm_term = firstUtm.utm_term;
    if (firstUtm?.gclid) payload.first_gclid = firstUtm.gclid;
    // Page attribution (added 2026-07-22): which page the form was
    // submitted on, which page started the visit (30-day first-touch
    // cookie), and the visitor's language. Locale derives from the URL
    // prefix — /es/... is Spanish, everything else English — and flows
    // to ProABD so agents see the customer's language.
    payload.page_path = window.location.pathname;
    const landingPath = captureLandingPath();
    if (landingPath) payload.landing_path = landingPath;
    payload.locale = /^\/es(\/|$)/.test(window.location.pathname) ? "es" : "en";
    // Behavior join (2026-07-22): visitor ID + first-touch time let the
    // dashboard chain pages → lead → ProABD outcome and compute
    // time-to-convert per lead.
    const vid = getVisitorId();
    if (vid) payload.visitor_id = vid;
    const ftAt = getFirstTouchAt();
    if (ftAt) payload.first_touch_at = String(ftAt);

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; leadRef?: string; error?: string };

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        // Technical friction, not voluntary abandonment — the visitor DID
        // submit. The 8/6–8/11 incidents taught us to tell these apart.
        sendEvent("form_friction", {
          kind: "api_error",
          status: res.status,
          fv: FORM_VERSION,
        });
        setPending(false);
        captchaRef.current?.resetCaptcha();
        setCaptchaToken(null);
        return;
      }

      setSuccess(data.leadRef ?? "");
      sendEvent("lead_persisted", { fv: FORM_VERSION });

      // Track the conversion. Two events fire: the funnel event
      // (quote_submitted) for GA4 reporting + the conversion event
      // (lead_form_submit) for Google Ads optimization. Same trigger,
      // different consumers. Reuse submitGclid so the backend doc and
      // the analytics events stay in sync.
      const gclid = submitGclid;
      const vehicleType = payload.vehicle_type ?? "unknown";
      // Derive state from ZIP for analytics (state codes used to come
      // from fromCode/toCode URL params; now they're derived from ZIP).
      const fromState =
        lookupZipApprox(originZip)?.entry.state ??
        zipPrefixToState(originZip) ??
        "";
      const toState =
        lookupZipApprox(destinationZip)?.entry.state ??
        zipPrefixToState(destinationZip) ??
        "";
      track({
        name: "quote_submitted",
        props: {
          from_state: fromState,
          to_state: toState,
          vehicle_type: vehicleType,
          gclid,
        },
      });
      track({
        name: "lead_form_submit",
        props: {
          from_state: fromState,
          to_state: toState,
          gclid,
        },
      });
    } catch (err) {
      console.error("[QuoteForm] submit failed", err);
      setError("Network error. Please check your connection and try again.");
      sendEvent("form_friction", { kind: "network_error", fv: FORM_VERSION });
      setPending(false);
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    }
  }

  if (success !== null) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 sm:p-8">
        <p className="text-green-700 text-sm font-semibold uppercase tracking-wider">
          {t("quote.form.success.eyebrow")}
        </p>
        <h2 className="text-2xl font-bold text-charcoal mt-2">
          {t("quote.form.success.title")}
        </h2>
        <p className="text-gray-700 mt-3 leading-relaxed">
          {t("quote.form.success.body")}
        </p>
        {success && (
          <p className="text-gray-600 text-sm mt-4">
            <span className="font-semibold">{t("quote.form.success.refLabel")}:</span> {success}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onFocusCapture={onFocusInstrument}
      onBlurCapture={onBlurInstrument}
      className="space-y-6"
    >
      {/* Hidden handoff fields — pre-quote selections the hero captured
          but the form doesn't expose visually. Flow into the lead doc
          via FormData on submit. */}
      {handoff.condition && (
        <input type="hidden" name="condition" value={handoff.condition} />
      )}
      {handoff.transportType && (
        <input type="hidden" name="transport" value={handoff.transportType} />
      )}

      {/* US-domestic-only notice — deters unservable international requests
          (esp. via the Spanish funnel) before they reach an agent. */}
      <p className="text-gray-600 text-sm rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        {t("quote.form.usOnly")}
      </p>

      {/* Origin */}
      <fieldset className="space-y-3">
        <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
          {t("quote.form.origin.legend")}
        </legend>
        <div>
          <Field
            label={t("quote.form.origin.zip.label")}
            requiredMark={required}
            name="origin_zip"
            required
            placeholder={t("quote.form.origin.zip.placeholder")}
            value={originZip}
            onChange={(e) => setOriginZip(e.target.value)}
            autoComplete="postal-code"
            inputMode="numeric"
          />
          <ZipPreview zip={originZip} />
        </div>
      </fieldset>

      {/* Destination */}
      <fieldset className="space-y-3">
        <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
          {t("quote.form.destination.legend")}
        </legend>
        <div>
          <Field
            label={t("quote.form.destination.zip.label")}
            requiredMark={required}
            name="destination_zip"
            required
            placeholder={t("quote.form.destination.zip.placeholder")}
            value={destinationZip}
            onChange={(e) => setDestinationZip(e.target.value)}
            inputMode="numeric"
          />
          <ZipPreview zip={destinationZip} />
        </div>
      </fieldset>

      {/* Vehicle */}
      <fieldset className="space-y-3">
        <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
          {t("quote.form.vehicle.legend")}
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field
            label={t("quote.form.vehicle.year.label")}
            requiredMark={required}
            name="vehicle_year"
            required
            placeholder={t("quote.form.vehicle.year.placeholder")}
            inputMode="numeric"
          />
          <Field
            label={t("quote.form.vehicle.make.label")}
            requiredMark={required}
            name="vehicle_make"
            required
            placeholder={t("quote.form.vehicle.make.placeholder")}
          />
          <Field
            label={t("quote.form.vehicle.model.label")}
            requiredMark={required}
            name="vehicle_model"
            required
            placeholder={t("quote.form.vehicle.model.placeholder")}
          />
        </div>
        <Select
          label={t("quote.form.vehicle.type.label")}
          name="vehicle_type"
          defaultValue={handoff.vehicleType}
          options={VEHICLE_TYPE_KEYS.map((k) => ({
            value: k,
            label: t("quote.form.vehicle.type.options." + k),
          }))}
        />
      </fieldset>

      {/* Tier radios REMOVED (Release 1, 2026-08-12): asking customers to
          choose Standby/Priority/Expedited BEFORE seeing any prices made
          them pick a product blind. Tiers return as the priced OUTPUT in
          the Release-2 result screen. A hero handoff that carried a timing
          preference still flows through so agents see it. */}
      {handoff.timing && (
        <input type="hidden" name="tier" value={handoff.timing} />
      )}

      {/* Contact */}
      <fieldset className="space-y-3">
        <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
          {t("quote.form.contact.legend")}
        </legend>
        {/* Last name REMOVED (Release 1): the CRM accepts an empty last
            name and an "optional" field is still perceived work. Collected
            at booking instead. */}
        <Field
          label={t("quote.form.contact.firstName.label")}
          requiredMark={required}
          name="first_name"
          required
          placeholder={t("quote.form.contact.firstName.placeholder")}
          autoComplete="given-name"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label={t("quote.form.contact.email.label")}
            requiredMark={required}
            name="email"
            type="email"
            required
            placeholder={t("quote.form.contact.email.placeholder")}
            autoComplete="email"
          />
          <Field
            label={t("quote.form.contact.phone.label")}
            requiredMark={required}
            name="phone"
            type="tel"
            required
            placeholder={t("quote.form.contact.phone.placeholder")}
            autoComplete="tel"
          />
        </div>
        <Field
          label={t("quote.form.contact.notes.label")}
          requiredMark={required}
          name="notes"
          placeholder={t("quote.form.contact.notes.placeholder")}
          multiline
        />
      </fieldset>

      {/* hCaptcha */}
      <fieldset className="space-y-3" id={captchaId}>
        <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
          {t("quote.form.verification.legend")}
        </legend>
        <HCaptcha
          ref={captchaRef}
          sitekey={siteKey}
          onVerify={(token) => setCaptchaToken(token)}
          onExpire={() => {
            setCaptchaToken(null);
            sendEvent("form_friction", { kind: "captcha_expired", fv: FORM_VERSION });
          }}
          onError={() => {
            setCaptchaToken(null);
            // CAPTCHA breakage reads as "visitor abandoned" in naive funnel
            // math. It is not. (See the 7/24 captcha-truncation incident.)
            sendEvent("form_friction", { kind: "captcha_error", fv: FORM_VERSION });
          }}
        />
        {usingTestKey && (
          <p className="text-gray-500 text-xs italic">
            {t("quote.form.verification.testModeNote")}
          </p>
        )}
      </fieldset>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={!captchaToken || pending}
          className="bg-brand-accent hover:bg-brand-accent-hover disabled:bg-gray-300 disabled:cursor-not-allowed text-brand-accent-ink font-semibold px-8 py-3 rounded-full transition"
        >
          {pending ? t("quote.form.submit.pending") : t("quote.form.submit.button")}
        </button>
        <p className="text-gray-500 text-xs mt-3">
          {t("quote.form.submit.footnote")}
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  requiredMark,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
  value,
  onChange,
  multiline = false,
  autoComplete,
  inputMode,
}: {
  label: string;
  requiredMark: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  multiline?: boolean;
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
}) {
  const baseClass =
    "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 text-charcoal";
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-orange">{requiredMark}</span>}
      </span>
      {multiline ? (
        <textarea
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={value === undefined ? defaultValue : undefined}
          value={value}
          onChange={onChange}
          rows={3}
          className={baseClass}
        />
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={value === undefined ? defaultValue : undefined}
          value={value}
          onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
          autoComplete={autoComplete}
          inputMode={inputMode}
          className={baseClass}
        />
      )}
    </label>
  );
}

function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 text-charcoal bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}


// ZipPreview — small gray "City, State" hint rendered below the ZIP input.
// Derives from the curated metro table first (gets city + state), then falls
// back to the USPS prefix→state map (state only) for ZIPs not in the metro
// table. Stays hidden until at least 3 digits are typed.
function ZipPreview({ zip }: { zip: string }) {
  if (!zip || zip.length < 3) return null;
  const cityState = (() => {
    if (/^\d{5}$/.test(zip)) {
      const approx = lookupZipApprox(zip);
      if (approx) return `${approx.entry.city}, ${approx.entry.state}`;
      const state = zipPrefixToState(zip);
      if (state) return state;
    }
    return null;
  })();
  if (!cityState) {
    if (zip.length >= 5) {
      return (
        <p className="mt-1.5 text-xs text-gray-500">
          Coordinator will confirm your location.
        </p>
      );
    }
    return null;
  }
  return (
    <p className="mt-1.5 text-xs text-gray-600">
      {cityState}
    </p>
  );
}

