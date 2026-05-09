import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";

export const metadata: Metadata = {
  title: "Get a locked price — Auto Line Logistics",
  description:
    "Tell us your origin, destination, and vehicle. Your coordinator will lock in a price within 1 business hour. No bait-and-switch. The quote is the contract.",
};

const STATE_LABELS: Record<string, string> = {
  CA: "California",
  HI: "Hawaii",
  AK: "Alaska",
  TX: "Texas",
  NY: "New York",
  FL: "Florida",
};

// Next 15+/16 pattern: searchParams is a Promise that must be awaited
export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const fromCode = (params.from ?? "").toUpperCase();
  const toCode = (params.to ?? "").toUpperCase();
  const fromLabel = STATE_LABELS[fromCode] ?? "";
  const toLabel = STATE_LABELS[toCode] ?? "";

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Get a locked price
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              {fromLabel && toLabel
                ? `${fromLabel} → ${toLabel}`
                : "Tell us where, what, and when."}
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              The quote is the contract. Whatever number we send back is the
              number on your invoice. No bait-and-switch.
            </p>
          </Container>
        </section>

        {/* Build status callout */}
        <section className="py-6 bg-orange-tint border-b border-orange/30">
          <Container>
            <p className="text-charcoal text-sm">
              <strong>🚧 Build status:</strong> the live quote tool wires up
              when our Super Dispatch + Authorize.Net integrations land
              (~Week 6 of Phase A). Until then, submit the form below and
              your coordinator will lock in a price by reply email within 1
              business hour. No deposit at this stage.
            </p>
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
                    Where from
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
                    <Field
                      label="Origin ZIP code"
                      name="origin_zip"
                      required
                      placeholder="e.g. 90630"
                    />
                    <Field
                      label="State"
                      name="origin_state"
                      required
                      defaultValue={fromCode}
                      placeholder="CA"
                    />
                  </div>
                </fieldset>

                {/* Destination */}
                <fieldset className="space-y-3">
                  <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
                    Where to
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
                    <Field
                      label="Destination ZIP code"
                      name="destination_zip"
                      required
                      placeholder="e.g. 96813"
                    />
                    <Field
                      label="State"
                      name="destination_state"
                      required
                      defaultValue={toCode}
                      placeholder="HI"
                    />
                  </div>
                </fieldset>

                {/* Vehicle */}
                <fieldset className="space-y-3">
                  <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
                    Vehicle
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field
                      label="Year"
                      name="vehicle_year"
                      required
                      placeholder="2022"
                    />
                    <Field
                      label="Make"
                      name="vehicle_make"
                      required
                      placeholder="Toyota"
                    />
                    <Field
                      label="Model"
                      name="vehicle_model"
                      required
                      placeholder="Camry"
                    />
                  </div>
                  <Select
                    label="Vehicle type"
                    name="vehicle_type"
                    options={[
                      "Sedan",
                      "SUV / crossover",
                      "Truck (standard)",
                      "Truck (lifted / oversized)",
                      "Van / minivan",
                      "Motorcycle",
                      "Classic / collector vehicle",
                      "Other",
                    ]}
                  />
                </fieldset>

                {/* Tier */}
                <fieldset className="space-y-3">
                  <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
                    Service tier
                  </legend>
                  <p className="text-gray-600 text-sm">
                    Pick the urgency level that fits your timeline. We&apos;ll
                    confirm options and pricing in your reply.
                  </p>
                  <div className="space-y-2">
                    <Radio
                      name="tier"
                      value="standby"
                      label="Standby"
                      sub="7-day pickup window. Most flexible. Best value."
                    />
                    <Radio
                      name="tier"
                      value="priority"
                      label="Priority"
                      sub="3–5 day pickup window. Most popular."
                      defaultChecked
                    />
                    <Radio
                      name="tier"
                      value="expedited"
                      label="Expedited"
                      sub="24–48 hour pickup. Premium pricing."
                    />
                  </div>
                </fieldset>

                {/* Contact */}
                <fieldset className="space-y-3">
                  <legend className="text-orange text-sm font-semibold uppercase tracking-wider">
                    How we reach you
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="Email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                    />
                    <Field
                      label="Phone"
                      name="phone"
                      type="tel"
                      required
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <Field
                    label="Anything else we should know? (optional)"
                    name="notes"
                    placeholder="e.g. PCS orders, vehicle modifications, hard pickup window"
                    multiline
                  />
                </fieldset>

                {/* Submit */}
                <div className="pt-4">
                  <button
                    type="submit"
                    className="bg-orange hover:bg-orange-dark text-white font-semibold px-8 py-3 rounded-full transition"
                  >
                    Submit quote request
                  </button>
                  <p className="text-gray-500 text-xs mt-3">
                    Your coordinator replies with a locked price within 1
                    business hour. No deposit required to receive the quote.
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
                title="Quote = contract"
                href="/price-promise"
                detail="Whatever number you receive is the number on your invoice. No surcharges, no carrier-cost-overage calls."
              />
              <Reassure
                title="$575K coverage"
                href="/damage-promise"
                detail="$75K bond + $500K contingent cargo. We file claims directly with the carrier so you don't chase."
              />
              <Reassure
                title="Named coordinator"
                href="/people-promise"
                detail="One person, by name, owning your shipment from quote through delivery. Direct phone number at booking."
              />
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
  multiline = false,
}: {
  label: string;
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
        {required && <span className="text-orange"> *</span>}
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
}: {
  title: string;
  href: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
    >
      <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
        Backed by
      </p>
      <p className="font-bold text-charcoal text-lg group-hover:text-orange transition">
        {title} →
      </p>
      <p className="text-gray-700 text-sm mt-2 leading-relaxed">{detail}</p>
    </Link>
  );
}
