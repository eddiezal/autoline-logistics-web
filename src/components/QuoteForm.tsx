"use client";

import { useRef, useState, useId } from "react";
import { useTranslations } from "next-intl";
import HCaptcha from "@hcaptcha/react-hcaptcha";

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

// hCaptcha test site key — always passes. Replace via NEXT_PUBLIC_HCAPTCHA_SITE_KEY
// once you provision a real hCaptcha account at https://hcaptcha.com.
const HCAPTCHA_TEST_KEY = "10000000-ffff-ffff-ffff-000000000001";

/**
 * /quote intake form (client component).
 *
 * Currently submits via mailto (browser opens user's email client). Once
 * Super Dispatch integration lands and we have a real server endpoint, this
 * will switch to a Server Action that validates the hCaptcha token
 * server-side and creates the SD shipment.
 *
 * The captcha widget here gates the submit button — bot scripts can still
 * fill the form but can't trigger the mailto handoff without solving the
 * challenge. Real server-side validation comes with the Server Action.
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
  const captchaRef = useRef<HCaptcha>(null);
  const captchaId = useId();

  return (
    <form
      action="mailto:info@autolinelogistics.com"
      method="post"
      encType="text/plain"
      className="space-y-6"
    >
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
          options={VEHICLE_TYPE_KEYS.map((k) =>
            t(`quote.form.vehicle.type.options.${k}`)
          )}
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

      {/* Submit */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={!captchaToken}
          className="bg-brand-accent hover:bg-brand-accent-hover disabled:bg-gray-300 disabled:cursor-not-allowed text-brand-accent-ink font-semibold px-8 py-3 rounded-full transition"
        >
          {t("quote.form.submit.button")}
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
  options: string[];
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
          <option key={o} value={o}>
            {o}
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
