import type { Metadata } from "next";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { CorridorAnalytics } from "@/components/CorridorAnalytics";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ, type FAQItem } from "@/components/FAQ";
import { SubDestinationGrid } from "@/components/SubDestinationGrid";
import { getCorridor } from "@/lib/corridors";
import { StructuredData } from "@/components/StructuredData";
import {
  breadcrumbSchema,
  faqPageSchema,
  serviceSchema,
  SITE_URL,
} from "@/lib/seo/schemas";

// Cost-angle metadata (2026-07-22): GSC impressions run BOTH directions
// ("ship car from california to hawaii" AND "shipping car from hawaii to
// california") — title and description carry both. No live price here:
// the SD Pricing API doesn't cover HI, so no number to anchor honestly.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const es = locale === "es";
  return es
    ? {
        title: "Costo de enviar un auto entre California y Hawái — precio bloqueado",
        description:
          "Transporte de vehículos de California a Hawái y de Hawái a California, vía puertos de Long Beach u Oakland. Coordinación puerta-puerto-puerta, todas las islas. Precio bloqueado. Familias militares (PCS) confían en nosotros.",
      }
    : {
        title: "Cost to Ship a Car from California to Hawaii (and Back) — Locked Price",
        description:
          "Vehicle shipping California to Hawaii AND Hawaii to California via Long Beach or Oakland ports. Door-to-port-to-door, all islands, locked-price quotes. Trusted by military PCS families and relocations.",
      };
}

const ROUTE_LEGS = ["1", "2", "3", "4", "5", "6"] as const;
const SPECIALTY_KEYS = ["ev", "classic", "motorcycle", "oversized", "personal", "ag"] as const;

export default function CaliforniaHawaiiCorridor() {
  const t = useTranslations();
  const corridor = getCorridor("california-hawaii")!;
  const faqs: FAQItem[] = [0, 1, 2, 3, 4, 5, 6].map((i) => ({
    q: t(`corridors.californiaHawaii.faq.items.${i}.q`),
    a: t(`corridors.californiaHawaii.faq.items.${i}.a`),
  }));

  // Build structured data for this corridor page. HI/AK use the sync
  // useLocale hook because the component is sync (vs FAQ_INDEXES corridors
  // which await params for the locale). Same schema output.
  const locale = useLocale();
  const localePath = locale === "es" ? "/es" : "";
  const canonicalUrl = `${SITE_URL}${localePath}/corridors/california-hawaii`;
  const corridorStructuredData = [
    breadcrumbSchema([
      { name: "Home", url: `${SITE_URL}${localePath}/` },
      { name: "Corridors", url: `${SITE_URL}${localePath}/corridors` },
      { name: "California to Hawaii", url: canonicalUrl },
    ]),
    serviceSchema({
      url: canonicalUrl,
      name: "Auto Transport from California to Hawaii",
      description:
        "Mainland-to-Hawaii vehicle transport via Long Beach or Oakland ports, with door-to-door coordination to Oahu, Maui, Big Island, and Kauai. Locked-price quotes. Trusted by military PCS families and snowbird relocations.",
      areaServed: { origin: "California", destination: "Hawaii" },
    }),
    faqPageSchema(faqs),
  ];

  return (
    <>
      <StructuredData data={corridorStructuredData} />
      <Header />
      <CorridorAnalytics corridorSlug="california-hawaii" fromState="CA" toState="HI" />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaHawaii.hero.eyebrow")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              {t("corridors.californiaHawaii.hero.title")}
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              {t("corridors.californiaHawaii.hero.description")}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href={{ pathname: "/quote", query: { from: "CA", to: "HI" } }}
                className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-6 py-3 rounded-full transition"
              >
                {t("corridors.californiaHawaii.hero.ctaPrimary")}
              </Link>
              <a
                href="#how-it-works"
                className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
              >
                {t("corridors.californiaHawaii.hero.ctaSecondary")}
              </a>
            </div>
          </Container>
        </section>

        {/* Why this corridor is different */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("corridors.californiaHawaii.whyDifferent.eyebrow")}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                {t("corridors.californiaHawaii.whyDifferent.title")}
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>{t("corridors.californiaHawaii.whyDifferent.body.0")}</p>
                <p>{t("corridors.californiaHawaii.whyDifferent.body.1")}</p>
                <p className="font-semibold text-charcoal">
                  {t("corridors.californiaHawaii.whyDifferent.punchline")}
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaHawaii.route.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              {t("corridors.californiaHawaii.route.title")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ROUTE_LEGS.map((n) => (
                <RouteLeg
                  key={n}
                  num={n}
                  title={t(`corridors.californiaHawaii.route.legs.${n}.title`)}
                  detail={t(`corridors.californiaHawaii.route.legs.${n}.detail`)}
                />
              ))}
            </div>
          </Container>
        </section>

        {/* Sub-destinations */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaHawaii.subDestinations.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {t("corridors.californiaHawaii.subDestinations.title")}
            </h2>
            <p className="text-gray-700 max-w-2xl mb-10">
              {t("corridors.californiaHawaii.subDestinations.description")}
            </p>
            <SubDestinationGrid
              destinations={corridor.subDestinations ?? []}
              fromCode="CA"
              toCode="HI"
              corridorKey="californiaHawaii"
            />
          </Container>
        </section>

        {/* Specialty vehicles */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaHawaii.specialty.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {t("corridors.californiaHawaii.specialty.title")}
            </h2>
            <p className="text-gray-700 max-w-2xl mb-10">
              {t("corridors.californiaHawaii.specialty.description")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {SPECIALTY_KEYS.map((key) => (
                <SpecialtyCard
                  key={key}
                  title={t(`corridors.californiaHawaii.specialty.cards.${key}.title`)}
                  summary={t(`corridors.californiaHawaii.specialty.cards.${key}.summary`)}
                  detail={t(`corridors.californiaHawaii.specialty.cards.${key}.detail`)}
                />
              ))}
            </div>

            <p className="text-gray-500 text-sm mt-8 italic max-w-2xl">
              {t("corridors.californiaHawaii.specialty.footnote")}
            </p>
          </Container>
        </section>

        {/* Service tiers */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaHawaii.tiers.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {t("corridors.californiaHawaii.tiers.title")}
            </h2>
            <p className="text-gray-700 max-w-2xl mb-8">
              {t("corridors.californiaHawaii.tiers.description")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <TierTile
                tier={t("corridors.californiaHawaii.tiers.tiles.standby.tier")}
                window={t("corridors.californiaHawaii.tiers.tiles.standby.window")}
                description={t("corridors.californiaHawaii.tiers.tiles.standby.description")}
              />
              <TierTile
                tier={t("corridors.californiaHawaii.tiers.tiles.priority.tier")}
                window={t("corridors.californiaHawaii.tiers.tiles.priority.window")}
                description={t("corridors.californiaHawaii.tiers.tiles.priority.description")}
                highlight
                mostPopularLabel={t("common.labels.mostPopular")}
              />
              <TierTile
                tier={t("corridors.californiaHawaii.tiers.tiles.expedited.tier")}
                window={t("corridors.californiaHawaii.tiers.tiles.expedited.window")}
                description={t("corridors.californiaHawaii.tiers.tiles.expedited.description")}
              />
            </div>

            <p className="text-gray-500 text-sm mt-6 italic">
              {t("corridors.californiaHawaii.tiers.footnote")}
            </p>
          </Container>
        </section>

        {/* Triple Promise tie-in */}
        <section className="py-16 bg-gray-100">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("corridors.californiaHawaii.triplePromise.eyebrow")}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                {t("corridors.californiaHawaii.triplePromise.title")}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <Link
                  href="/price-promise"
                  className="bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    {t("corridors.californiaHawaii.triplePromise.cards.price.eyebrow")}
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    {t("corridors.californiaHawaii.triplePromise.cards.price.headline")}
                  </p>
                </Link>
                <Link
                  href="/damage-promise"
                  className="bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    {t("corridors.californiaHawaii.triplePromise.cards.damage.eyebrow")}
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    {t("corridors.californiaHawaii.triplePromise.cards.damage.headline")}
                  </p>
                </Link>
                <Link
                  href="/people-promise"
                  className="bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    {t("corridors.californiaHawaii.triplePromise.cards.people.eyebrow")}
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    {t("corridors.californiaHawaii.triplePromise.cards.people.headline")}
                  </p>
                </Link>
              </div>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-white">
          <Container>
            <FAQ items={faqs} title={t("corridors.californiaHawaii.faq.title")} />
            <p className="text-gray-700 mt-8 max-w-3xl">
              {t("corridors.shared.quoteGuide.lead")}{" "}
              <Link
                href={`/blog/${locale === "es" ? "cotizacion-precisa-envio-auto" : "accurate-car-shipping-quote"}` as "/blog/why-car-shipping-quotes-go-up"}
                className="text-brand-accent font-semibold underline underline-offset-4"
              >
                {t("corridors.shared.quoteGuide.label")}
              </Link>
            </p>
          </Container>
        </section>

        {/* Reverse direction (2026-07-22): GSC shows "shipping car from
            hawaii to california" impressing as heavily as the outbound. */}
        <section className="py-16 bg-gray-100">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("corridors.californiaHawaii.reverse.eyebrow")}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                {t("corridors.californiaHawaii.reverse.title")}
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>{t("corridors.californiaHawaii.reverse.body.0")}</p>
                <p>{t("corridors.californiaHawaii.reverse.body.1")}</p>
              </div>
              <Link
                href={{ pathname: "/quote", query: { from: "HI", to: "CA" } }}
                className="inline-block mt-6 bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-6 py-3 rounded-full transition"
              >
                {t("corridors.californiaHawaii.reverse.cta")}
              </Link>
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                {t("corridors.californiaHawaii.finalCta.title")}
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                {t("corridors.californiaHawaii.finalCta.description")}
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href={{ pathname: "/quote", query: { from: "CA", to: "HI" } }}
                  className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("corridors.californiaHawaii.finalCta.primary")}
                </Link>
                <Link
                  href="/corridors/california-alaska"
                  className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("corridors.californiaHawaii.finalCta.secondary")}
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}

function SpecialtyCard({
  title,
  summary,
  detail,
}: {
  title: string;
  summary: string;
  detail: string;
}) {
  return (
    <details className="group bg-white border border-gray-200 rounded-2xl hover:border-orange transition">
      <summary className="cursor-pointer p-5 flex items-start justify-between gap-4 list-none">
        <div className="flex-1">
          <p className="font-bold text-charcoal">{title}</p>
          <p className="text-orange font-semibold text-sm mt-1">{summary}</p>
        </div>
        <span
          aria-hidden
          className="text-orange text-2xl leading-none flex-shrink-0 transition group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="px-5 pb-5 text-gray-700 text-sm leading-relaxed">{detail}</p>
    </details>
  );
}

function RouteLeg({
  num,
  title,
  detail,
}: {
  num: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-4 p-5 bg-white rounded-xl border border-gray-200">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-orange text-white font-bold flex-shrink-0">
        {num}
      </span>
      <div>
        <p className="font-semibold text-charcoal">{title}</p>
        <p className="text-gray-700 text-sm mt-1 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

function TierTile({
  tier,
  window: tierWindow,
  description,
  highlight = false,
  mostPopularLabel,
}: {
  tier: string;
  window: string;
  description: string;
  highlight?: boolean;
  mostPopularLabel?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-6 border ${
        highlight
          ? "border-orange bg-orange-tint shadow-md"
          : "border-gray-200 bg-white"
      }`}
    >
      {highlight && mostPopularLabel && (
        <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
          {mostPopularLabel}
        </p>
      )}
      <p className="text-2xl font-bold text-charcoal">{tier}</p>
      <p className="text-orange font-semibold text-sm mt-1">{tierWindow}</p>
      <p className="text-gray-700 mt-4 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
