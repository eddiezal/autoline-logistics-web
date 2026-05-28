import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";

/**
 * /services — the depth page for the Services section on the homepage.
 * Mirrors the /anti-scam pattern: homepage teases, this page provides
 * the full breakdown with comparison table + per-tier detail.
 *
 * Tier content lives at services.tiers.* (shared with homepage section)
 * so copy stays in sync between the two surfaces.
 */

export const metadata: Metadata = {
  title: "Services — Auto Line Logistics",
  description:
    "Three ways to move your vehicle: Open Transport, Enclosed Premium, and Ocean Routes for Hawaii + Alaska. All backed by our Damage Promise.",
};

// Vehicle matrix structure — keys map into i18n services.vehicleMatrix.rows.*
// statusType controls visual styling (green/amber/gray)
const VEHICLE_ROWS: ReadonlyArray<{
  key: string;
  statusType: "ok" | "warn" | "scope";
}> = [
  { key: "sedan", statusType: "ok" },
  { key: "suv", statusType: "ok" },
  { key: "truckStandard", statusType: "ok" },
  { key: "truckLifted", statusType: "warn" },
  { key: "van", statusType: "ok" },
  { key: "motorcycle", statusType: "ok" },
  { key: "classic", statusType: "ok" },
  { key: "exotic", statusType: "ok" },
  { key: "inoperable", statusType: "warn" },
  { key: "multiCar", statusType: "ok" },
  { key: "hawaiiAlaska", statusType: "ok" },
  { key: "oversizedCommercial", statusType: "warn" },
  { key: "rv", statusType: "scope" },
  { key: "boat", statusType: "scope" },
  { key: "heavyEquipment", statusType: "scope" },
];

// FAQ keys map into i18n services.faq.items.*
const FAQ_KEYS = [
  "openVsEnclosed",
  "motorcycle",
  "inoperable",
  "hawaiiAlaskaTimeline",
  "multiVehicle",
  "oversizedCommercial",
  "doorToDoor",
  "damagePromiseAllTiers",
] as const;

export default function ServicesPage() {
  const t = useTranslations();

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-4">
              {t("services.hero.eyebrow")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
              {t("services.hero.title")}{" "}
              <span className="text-orange">
                {t("services.hero.titleAccent")}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-100 mt-6 max-w-2xl leading-relaxed">
              {t("services.hero.lead")}
            </p>
          </Container>
        </section>

        {/* ── Featured + 2 supporting (same shape as homepage Services) ── */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-5">
              {/* Featured: Open Transport */}
              <div className="relative bg-gradient-to-b from-orange-tint via-white to-white border-2 border-orange rounded-2xl p-7 md:p-8 shadow-[0_12px_32px_rgba(132,204,22,0.08)] flex flex-col gap-4">
                <span className="absolute -top-3 left-7 inline-block bg-orange text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                  {t("services.tiers.open.badge")}
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-12 h-12 rounded-xl bg-orange text-white flex items-center justify-center flex-shrink-0">
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M3 17h2v-1h12v1h2v-7l-2.5-5.5h-11L3 10v7zm14-9h-1.5L17 11h-3v-3h2.5L18 5.5h-3V3H5.5L4 6.5V8h3v3H4v6h1v-1h14v1h.5z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-charcoal leading-tight">
                    {t("services.tiers.open.name")}
                  </h2>
                </div>
                <p className="text-charcoal font-semibold text-base md:text-lg leading-snug">
                  {t("services.tiers.open.headline")}
                </p>
                <p className="text-gray-700 text-sm md:text-base leading-relaxed">
                  {t("services.tiers.open.description")}
                </p>
                <ul className="flex flex-col gap-2 mt-1">
                  {[
                    t("services.tiers.open.feature1"),
                    t("services.tiers.open.feature2"),
                    t("services.tiers.open.feature3"),
                    t("services.tiers.open.feature4"),
                    t("services.tiers.open.feature5"),
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-charcoal">
                      <span className="inline-flex items-center justify-center w-[18px] h-[18px] bg-orange text-white rounded-full text-[10px] font-bold flex-shrink-0 mt-0.5">
                        ✓
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
                  <Link
                    href="/quote"
                    className="inline-flex items-center bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink text-sm font-bold px-5 py-2.5 rounded-full transition"
                  >
                    {t("services.tiers.open.ctaButton")} →
                  </Link>
                  <span className="text-sm text-gray-500 italic">
                    {t("services.tiers.open.helper")}
                  </span>
                </div>
              </div>

              {/* Side stack: Enclosed + Ocean */}
              <div className="grid grid-rows-2 gap-5">
                <Link
                  href="/quote"
                  className="group bg-white border border-gray-200 rounded-2xl p-5 md:p-6 flex flex-col gap-2.5 transition hover:border-orange hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-orange-tint text-orange-dark flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M20 8h-3V4H3v13h2v-2h2v2h12V8z" />
                      </svg>
                    </div>
                    <h3 className="text-base md:text-lg font-bold text-charcoal leading-snug">
                      {t("services.tiers.enclosed.name")}
                    </h3>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed flex-1">
                    {t("services.tiers.enclosed.description")}
                  </p>
                  <span className="text-sm text-orange-dark font-semibold mt-1">
                    {t("services.tiers.enclosed.ctaButton")} →
                  </span>
                </Link>
                <Link
                  href="/corridors"
                  className="group bg-white border border-gray-200 rounded-2xl p-5 md:p-6 flex flex-col gap-2.5 transition hover:border-orange hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-orange-tint text-orange-dark flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M20 21c-1.4 0-2.7-.7-3.5-1.7C15.7 20.3 14.4 21 13 21s-2.7-.7-3.5-1.7C8.7 20.3 7.4 21 6 21H2v-2h4c1.4 0 2.7-.6 3.5-1.5C10.3 18.4 11.6 19 13 19s2.7-.6 3.5-1.5C17.3 18.4 18.6 19 20 19h2v2h-2z" />
                      </svg>
                    </div>
                    <h3 className="text-base md:text-lg font-bold text-charcoal leading-snug">
                      {t("services.tiers.ocean.name")}
                    </h3>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed flex-1">
                    {t("services.tiers.ocean.description")}
                  </p>
                  <span className="text-sm text-orange-dark font-semibold mt-1">
                    {t("services.tiers.ocean.ctaButton")} →
                  </span>
                </Link>
              </div>
            </div>
          </Container>
        </section>

        {/* ── Comparison table ─────────────────────────────────────────── */}
        <section className="py-16 md:py-20 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("services.compare.eyebrow")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal mb-8 max-w-2xl">
              {t("services.compare.title")}
            </h2>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm md:text-base">
                  <thead className="bg-charcoal text-white">
                    <tr>
                      <th className="px-5 md:px-6 py-4 font-semibold">
                        {t("services.compare.colService")}
                      </th>
                      <th className="px-5 md:px-6 py-4 font-semibold">
                        {t("services.compare.colTrailer")}
                      </th>
                      <th className="px-5 md:px-6 py-4 font-semibold">
                        {t("services.compare.colTimeline")}
                      </th>
                      <th className="px-5 md:px-6 py-4 font-semibold">
                        {t("services.compare.colBestFor")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-charcoal">
                    <tr className="bg-orange-tint/30">
                      <td className="px-5 md:px-6 py-4 font-bold">
                        {t("services.tiers.open.name")}
                      </td>
                      <td className="px-5 md:px-6 py-4">
                        {t("services.compare.openTrailer")}
                      </td>
                      <td className="px-5 md:px-6 py-4">
                        {t("services.compare.openTimeline")}
                      </td>
                      <td className="px-5 md:px-6 py-4">
                        {t("services.compare.openBestFor")}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-5 md:px-6 py-4 font-bold">
                        {t("services.tiers.enclosed.name")}
                      </td>
                      <td className="px-5 md:px-6 py-4">
                        {t("services.compare.enclosedTrailer")}
                      </td>
                      <td className="px-5 md:px-6 py-4">
                        {t("services.compare.enclosedTimeline")}
                      </td>
                      <td className="px-5 md:px-6 py-4">
                        {t("services.compare.enclosedBestFor")}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-5 md:px-6 py-4 font-bold">
                        {t("services.tiers.ocean.name")}
                      </td>
                      <td className="px-5 md:px-6 py-4">
                        {t("services.compare.oceanTrailer")}
                      </td>
                      <td className="px-5 md:px-6 py-4">
                        {t("services.compare.oceanTimeline")}
                      </td>
                      <td className="px-5 md:px-6 py-4">
                        {t("services.compare.oceanBestFor")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Container>
        </section>

                {/* ── Vehicle Matrix — V1 table style ────────────────────────── */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("services.vehicleMatrix.eyebrow")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal mb-3 max-w-3xl leading-tight">
              {t("services.vehicleMatrix.title")}
            </h2>
            <p className="text-gray-700 text-base md:text-lg mb-8 max-w-2xl leading-relaxed">
              {t("services.vehicleMatrix.lead")}
            </p>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-charcoal text-white">
                    <tr>
                      <th className="px-4 md:px-5 py-3.5 font-semibold text-xs uppercase tracking-wider">
                        {t("services.vehicleMatrix.colVehicle")}
                      </th>
                      <th className="px-4 md:px-5 py-3.5 font-semibold text-xs uppercase tracking-wider">
                        {t("services.vehicleMatrix.colTier")}
                      </th>
                      <th className="px-4 md:px-5 py-3.5 font-semibold text-xs uppercase tracking-wider">
                        {t("services.vehicleMatrix.colNotes")}
                      </th>
                      <th className="px-4 md:px-5 py-3.5 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">
                        {t("services.vehicleMatrix.colStatus")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {VEHICLE_ROWS.map((r, i) => {
                      const isScope = r.statusType === "scope";
                      const statusClass =
                        r.statusType === "ok"
                          ? "text-green-700"
                          : r.statusType === "warn"
                            ? "text-amber-700"
                            : "text-gray-500";
                      const statusPrefix =
                        r.statusType === "ok" ? "✓ " : r.statusType === "warn" ? "✓ " : "— ";
                      const rowClass = isScope
                        ? "bg-gray-50 text-gray-500"
                        : i % 2 === 1
                          ? "bg-gray-50"
                          : "";
                      return (
                        <tr
                          key={r.key}
                          className={`border-t border-gray-200 ${rowClass}`}
                        >
                          <td className="px-4 md:px-5 py-3.5 font-semibold align-top whitespace-nowrap">
                            {t(`services.vehicleMatrix.rows.${r.key}.vehicle`)}
                          </td>
                          <td className="px-4 md:px-5 py-3.5 align-top">
                            {t(`services.vehicleMatrix.rows.${r.key}.tier`)}
                          </td>
                          <td className="px-4 md:px-5 py-3.5 align-top text-gray-700">
                            {t(`services.vehicleMatrix.rows.${r.key}.notes`)}
                          </td>
                          <td
                            className={`px-4 md:px-5 py-3.5 align-top font-bold whitespace-nowrap ${statusClass}`}
                          >
                            {statusPrefix}
                            {t(`services.vehicleMatrix.rows.${r.key}.status`)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Container>
        </section>

        {/* ── FAQ — accordion (V1 style) ───────────────────────────────── */}
        <section className="py-16 md:py-20 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("services.faq.eyebrow")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal mb-8 max-w-2xl">
              {t("services.faq.title")}
            </h2>

            <div className="flex flex-col gap-2.5">
              {FAQ_KEYS.map((k) => (
                <details
                  key={k}
                  className="group bg-white border border-gray-200 rounded-xl overflow-hidden open:border-orange open:shadow-md transition"
                >
                  <summary className="cursor-pointer px-5 py-4 flex justify-between items-center gap-3 font-semibold text-charcoal list-none [&::-webkit-details-marker]:hidden">
                    <span className="text-base">
                      {t(`services.faq.items.${k}.q`)}
                    </span>
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-tint text-orange-dark group-open:bg-orange group-open:text-white flex items-center justify-center font-bold text-lg transition leading-none">
                      <span className="group-open:hidden">+</span>
                      <span className="hidden group-open:inline">−</span>
                    </span>
                  </summary>
                  <div className="px-5 pb-5 text-gray-700 text-sm md:text-base leading-relaxed">
                    {t(`services.faq.items.${k}.a`)}
                  </div>
                </details>
              ))}
            </div>
          </Container>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <div className="bg-charcoal text-white rounded-3xl p-8 md:p-12 text-center">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("services.cta.eyebrow")}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight max-w-2xl mx-auto">
                {t("services.cta.title")}
              </h2>
              <p className="text-lg text-gray-100 mt-4 max-w-2xl mx-auto leading-relaxed">
                {t("services.cta.lead")}
              </p>
              <Link
                href="/quote"
                className="inline-block mt-8 bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-7 py-3.5 rounded-full transition"
              >
                {t("services.cta.button")} →
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}
