"use client";

import { useRef, useState, useId } from "react";
import { useTranslations } from "next-intl";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { track, captureGclid } from "@/lib/analytics/events";

const VEHICLE_TYPE_KEYS = [
  "sedan",
  "suv",
  "truckStandard",
  "truckLifted",
  "van",
  "motorcycle",
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
 * round-robins to the next agent (Nelson/Renee/Ginger), calls SD pricing
 * for the live estimate, saves the lead doc, and emails the agent via
 * Resend.
 *
 * On success, the form is replaced with an inline SuccessCard showing
 * the lead reference. On error, an inline message appears and the user
 * can retry.
 */
export function QuoteForm({
  fromCode,
  toCode,
}: {
  fromCode: string;
  toCode: string;
}) {
  const t = useTranslations();
  const required = t("quote.form.requiredMark");
  const siteKey =
    process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? HCAPTCHA_TEST_KEY;
  const usingTestKey = siteKey === HCAPTCHA_TEST_KEY;

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const captchaId = useId();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!captchaToken || pending) return;
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

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; leadRef?: string; error?: string };

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setPending(false);
        captchaRef.current?.resetCaptcha();
        setCaptchaToken(null);
        return;
      }

      setSuccess(data.leadRef ?? "");

      // Track the conversion. Two events fire: the funnel event
      // (quote_submitted) for GA4 reporting + the conversion event
      // (lead_form_submit) for Google Ads optimization. Same trigger,
      // different consumers.
      const gclid = captureGclid();
      const vehicleType = payload.vehicleType ?? "unknown";
      track({
        name: "quote_submitted",
        props: {
          from_state: fromCode,
          to_state: toCode,
          vehicle_type: vehicleType,
          gclid,
        },
      });
      track({
        name: "lead_form_submit",
        props: {
          from_state: fromCode,
          to_state: toCode,
          gclid,
        },
      });
    } catch (err) {
      console.error("[QuoteForm] submit failed", err);
      setError("Network error. Please check your connection and try again.");
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Origin */}
      <fieldset className="space-y-3">
        <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
          {t("quote.form.origin.legend")}
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
          <Field
            label={t("quote.form.origin.zip.label")}
            requiredMark={required}
            name="origin_zip"
            required
            placeholder={t("quote.form.origin.zip.placeholder")}
          />
          <Field
            label={t("quote.form.origin.state.label")}
            requiredMark={required}
            name="origin_state"
            required
            defaultValue={fromCode}
            placeholder={t("quote.form.origin.state.placeholder")}
          />
        </div>
      </fieldset>

      {/* Destination */}
      <fieldset className="space-y-3">
        <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
          {t("quote.form.destination.legend")}
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
          <Field
            label={t("quote.form.destination.zip.label")}
            requiredMark={required}
            name="destination_zip"
            required
            placeholder={t("quote.form.destination.zip.placeholder")}
          />
          <Field
            label={t("quote.form.destination.state.label")}
            requiredMark={required}
            name="destination_state"
            required
            defaultValue={toCode}
            placeholder={t("quote.form.destination.state.placeholder")}
          />
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
          options={VEHICLE_TYPE_KEYS.map((k) => ({
            value: k,
            label: t("quote.form.vehicle.type.options." + k),
          }))}
        />
      </fieldset>

      {/* Tier */}
      <fieldset className="space-y-3">
        <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
          {t("quote.form.tier.legend")}
        </legend>
        <p className="text-gray-600 text-sm">
          {t("quote.form.tier.description")}
        </p>
        <div className="space-y-2">
          <Radio
            name="tier"
            value="standby"
            label={t("quote.form.tier.options.standby.label")}
            sub={t("quote.form.tier.options.standby.sub")}
          />
          <Radio
            name="tier"
            value="priority"
            label={t("quote.form.tier.options.priority.label")}
            sub={t("quote.form.tier.options.priority.sub")}
            defaultChecked
          />
          <Radio
            name="tier"
            value="expedited"
            label={t("quote.form.tier.options.expedited.label")}
            sub={t("quote.form.tier.options.expedited.sub")}
          />
        </div>
      </fieldset>

      {/* Contact */}
      <fieldset className="space-y-3">
        <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
          {t("quote.form.contact.legend")}
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label={t("quote.form.contact.email.label")}
            requiredMark={required}
            name="email"
            type="email"
            required
            placeholder={t("quote.form.contact.email.placeholder")}
          />
          <Field
            label={t("quote.form.contact.phone.label")}
            requiredMark={required}
            name="phone"
            type="tel"
            required
            placeholder={t("quote.form.contact.phone.placeholder")}
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
          onExpire={() => setCaptchaToken(null)}
          onError={() => setCaptchaToken(null)}
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
  multiline = false,
}: {
  label: string;
  requiredMark: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
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
          defaultValue={defaultValue}
          rows={3}
          className={baseClass}
        />
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
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
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </span>
      <select
        name={name}
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

function Radio({
  name,
  value,
  label,
  sub,
  defaultChecked = false,
}: {
  name: string;
  value: string;
  label: string;
  sub: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-orange transition cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-1 accent-orange"
      />
      <div>
        <p className="font-semibold text-charcoal">{label}</p>
        <p className="text-gray-700 text-sm">{sub}</p>
      </div>
    </label>
  );
}
