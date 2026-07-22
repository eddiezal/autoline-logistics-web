import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { CorridorAnalytics } from "@/components/CorridorAnalytics";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ, type FAQItem } from "@/components/FAQ";
import { SubDestinationGrid } from "@/components/SubDestinationGrid";
import { CorridorPricingCard } from "@/components/CorridorPricingCard";
import { getCorridor } from "@/lib/corridors";
import { getCorridorAnchorPrice, formatAnchor } from "@/lib/seo/corridorMeta";
import { StructuredData } from "@/components/StructuredData";
import {
  breadcrumbSchema,
  faqPageSchema,
  serviceSchema,
  SITE_URL,
} from "@/lib/seo/schemas";

// Cost-angle metadata (2026-07-22) — see corridorMeta.ts for rationale.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const price = await getCorridorAnchorPrice("california-florida");
  const es = locale === "es";
  const title = price
    ? es
      ? `Costo de enviar un auto de California a Florida — desde ${formatAnchor(price)}`
      : `Cost to Ship a Car from California to Florida — From ${formatAnchor(price)}`
    : es
      ? "Costo de enviar un auto de California a Florida — precio bloqueado"
      : "Cost to Ship a Car from California to Florida — Locked Price";
  const description = es
    ? `Transporte de autos de California a Florida${price ? ` desde ${formatAnchor(price)} (precio real de esta semana)` : ""}. Precio total bloqueado, sin depósito, rastreo en tiempo real. Miami, Orlando, Tampa, Jacksonville.`
    : `Auto transport from California to Florida${price ? ` from ${formatAnchor(price)} — a real quote refreshed this week` : ""}. Locked all-in price, no deposit, real-time tracking. Miami, Orlando, Tampa, Jacksonville.`;
  return { title, description };
}

// Re-read Firestore pricing snapshot at most every 5 minutes. The cron only
// writes 2x daily so this is more than fresh enough.
export const revalidate = 300;

const CUSTOMER_KEYS = ["jobRelocators", "multiVehicle", "highValue"] as const;
const FAQ_INDEXES = [0, 1, 2, 3, 4] as const;

export default async function CaliforniaFloridaCorridor({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const corridor = getCorridor("california-florida")!;
  const faqs: FAQItem[] = FAQ_INDEXES.map((i) => ({
    q: t(`corridors.californiaFlorida.faq.items.${i}.q`),
    a: t(`corridors.californiaFlorida.faq.items.${i}.a`),
  }));

  // Build structured data for this corridor page. Three schemas:
  // 1. BreadcrumbList — search-result breadcrumb display
  // 2. Service — corridor service offering linked to Organization
  // 3. FAQPage — mirrors the rendered FAQ items for Google FAQ rich snippets
  const localePath = locale === "es" ? "/es" : "";
  const canonicalUrl = `${SITE_URL}${localePath}/corridors/california-florida`;
  const corridorStructuredData = [
    breadcrumbSchema([
      { name: "Home", url: `${SITE_URL}${localePath}/` },
      { name: "Corridors", url: `${SITE_URL}${localePath}/corridors` },
      { name: "California to Florida", url: canonicalUrl },
    ]),
    serviceSchema({
      url: canonicalUrl,
      name: "Auto Transport from California to Florida",
      description:
        "Locked-price coast-to-coast auto transport between California and Florida. Door-to-door pickup and delivery to Miami, Orlando, Tampa, and Jacksonville. Open or enclosed trailers.",
      areaServed: { origin: "California", destination: "Florida" },
    }),
    faqPageSchema(faqs),
  ];

  return (
    <>
      <StructuredData data={corridorStructuredData} />
      <Header />
      <CorridorAnalytics corridorSlug="california-florida" fromState="CA" toState="FL" />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 lg:gap-16 items-start">
              <div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                  {t("corridors.californiaFlorida.hero.title")}
                </h1>
                <p className="text-lg md:text-xl text-gray-300 mt-5 max-w-xl leading-relaxed">
                  {t("corridors.californiaFlorida.hero.description")}
                </p>

                <div className="flex flex-wrap gap-3 mt-8">
                  <Link
                    href={{ pathname: "/quote", query: { from: "CA", to: "FL" } }}
                    className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-6 py-3 rounded-full transition"
                  >
                    {t("corridors.californiaFlorida.hero.ctaPrimary")}
                  </Link>
                  <a
                    href="#math"
                    className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
                  >
                    {t("corridors.californiaFlorida.hero.ctaSecondary")}
                  </a>
                </div>
              </div>

              <CorridorPricingCard corridorSlug="california-florida" locale={locale} />
            </div>
          </Container>
        </section>

        {/* Math */}
        <section id="math" className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("corridors.californiaFlorida.math.eyebrow")}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                {t("corridors.californiaFlorida.math.title")}
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>{t("corridors.californiaFlorida.math.body.0")}</p>
                <p>{t("corridors.californiaFlorida.math.body.1")}</p>
                <p className="font-semibold text-charcoal">
                  {t("corridors.californiaFlorida.math.punchline")}
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Who saves the most */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaFlorida.customers.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-8">
              {t("corridors.californiaFlorida.customers.title")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {CUSTOMER_KEYS.map((k) => (
                <article
                  key={k}
                  className="bg-white border border-gray-200 rounded-2xl p-6"
                >
                  <h3 className="text-lg font-bold text-charcoal mb-2">
                    {t(`corridors.californiaFlorida.customers.items.${k}.title`)}
                  </h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {t(`corridors.californiaFlorida.customers.items.${k}.body`)}
                  </p>
                </article>
              ))}
            </div>
          </Container>
        </section>

        {/* Sub-destinations */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaFlorida.subDest.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {t("corridors.californiaFlorida.subDest.title")}
            </h2>
            <p className="text-gray-700 max-w-2xl leading-relaxed mb-8">
              {t("corridors.californiaFlorida.subDest.lead")}
            </p>
            <SubDestinationGrid
              destinations={corridor.subDestinations ?? []}
              fromCode="CA"
              toCode="FL"
              corridorKey="californiaFlorida"
            />
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-gray-100">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("corridors.californiaFlorida.faq.eyebrow")}
              </p>
              <FAQ items={faqs} title={t("corridors.californiaFlorida.faq.title")} />
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                {t("corridors.californiaFlorida.finalCta.title")}
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                {t("corridors.californiaFlorida.finalCta.body")}
              </p>
              <Link
                href={{ pathname: "/quote", query: { from: "CA", to: "FL" } }}
                className="inline-block bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-8 py-3 rounded-full transition"
              >
                {t("corridors.californiaFlorida.finalCta.cta")}
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}
