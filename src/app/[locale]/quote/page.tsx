import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";

export const metadata: Metadata = {
  title: "Get a locked price — Auto Line Logistics",
  description:
    "Tell us your origin, destination, and vehicle. Your coordinator will lock in a price within 1 business hour. No bait-and-switch. The quote is the contract.",
};

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

// Next 15+/16 pattern: searchParams is a Promise that must be awaited
export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const fromCode = (params.from ?? "").toUpperCase();
  const toCode = (params.to ?? "").toUpperCase();
  return <QuoteContent fromCode={fromCode} toCode={toCode} />;
}

function QuoteContent({ fromCode, toCode }: { fromCode: string; toCode: string }) {
  const t = useTranslations();
  const fromLabel = fromCode ? safeT(t, `quote.states.${fromCode}`) : "";
  const toLabel = toCode ? safeT(t, `quote.states.${toCode}`) : "";
  const required = t("quote.form.requiredMark");

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("quote.hero.eyebrow")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              {fromLabel && toLabel
                ? `${fromLabel} → ${toLabel}`
                : t("quote.hero.titleDefault")}
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              {t("quote.hero.description")}
            </p>
          </Container>
        </section>

        {/* Build status callout */}
        <section className="py-6 bg-orange-tint border-b border-orange/30">
          <Container>
            <p className="text-charcoal text-sm">{t("quote.buildStatus")}</p>
          </Container>
        </section>

        {/* Form */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-2xl">
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

                {/* Submit */}
                <div className="pt-4">
                  <button
                    type="submit"
                    className="bg-orange hover:bg-orange-dark text-white font-semibold px-8 py-3 rounded-full transition"
                  >
                    {t("quote.form.submit.button")}
                  </button>
                  <p className="text-gray-500 text-xs mt-3">
                    {t("quote.form.submit.footnote")}
                  </p>
                </div>
              </form>
            </div>
          </Container>
        </section>

        {/* Reassurance */}
        <section className="py-12 bg-gray-100">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Reassure
                title={t("quote.reassurance.cards.contract.title")}
                href="/price-promise"
                detail={t("quote.reassurance.cards.contract.detail")}
                backedBy={t("quote.reassurance.backedBy")}
              />
              <Reassure
                title={t("quote.reassurance.cards.coverage.title")}
                href="/damage-promise"
                detail={t("quote.reassurance.cards.coverage.detail")}
                backedBy={t("quote.reassurance.backedBy")}
              />
              <Reassure
                title={t("quote.reassurance.cards.named.title")}
                href="/people-promise"
                detail={t("quote.reassurance.cards.named.detail")}
                backedBy={t("quote.reassurance.backedBy")}
              />
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}

// safeT — try to read a key, fall back to empty string if missing.
function safeT(t: ReturnType<typeof useTranslations>, key: string): string {
  try {
    return t(key);
  } catch {
    return "";
  }
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

function Reassure({
  title,
  href,
  detail,
  backedBy,
}: {
  title: string;
  href: "/price-promise" | "/damage-promise" | "/people-promise";
  detail: string;
  backedBy: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
    >
      <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
        {backedBy}
      </p>
      <p className="font-bold text-charcoal text-lg group-hover:text-orange transition">
        {title} →
      </p>
      <p className="text-gray-700 text-sm mt-2 leading-relaxed">{detail}</p>
    </Link>
  );
}
