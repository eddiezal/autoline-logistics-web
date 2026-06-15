import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ, type FAQItem } from "@/components/FAQ";
import { SubDestinationGrid } from "@/components/SubDestinationGrid";
import { CorridorPricingCard } from "@/components/CorridorPricingCard";
import { getCorridor } from "@/lib/corridors";

export const metadata: Metadata = {
  title: "Ship a car California to Texas. Locked-price corridor.",
  description:
    "Auto transport from California to Texas. Often cheaper than driving once you count gas, hotels, and wear-and-tear. Locked all-in price. No deposit. Real-time portal tracking. Dallas, Houston, Austin, San Antonio.",
};

// Re-read Firestore pricing snapshot at most every 5 minutes. The cron only
// writes 2x daily so this is more than fresh enough, and it keeps the page
// statically cacheable for SEO. Without this, Next.js would bake the page at
// build time and serve stale (or empty) Firestore data forever.
export const revalidate = 300;

const CUSTOMER_KEYS = ["jobRelocators", "multiVehicle", "highValue"] as const;
const FAQ_INDEXES = [0, 1, 2, 3, 4] as const;

export default async function CaliforniaTexasCorridor({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const corridor = getCorridor("california-texas")!;
  const faqs: FAQItem[] = FAQ_INDEXES.map((i) => ({
    q: t(`corridors.californiaTexas.faq.items.${i}.q`),
    a: t(`corridors.californiaTexas.faq.items.${i}.a`),
  }));

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero. Cost-anchored. Two-column on desktop, stacked on mobile.
            Left: price chip + H1 + subhead + CTAs.
            Right: cost-comparison card showing the math up front. */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 lg:gap-16 items-start">
              {/* Left column: copy + CTAs */}
              <div>
                {/* Consolidated price chip. Replaces the small eyebrow + separate
                    pill from V1. Brighter green, more pop, acts as the visual
                    anchor above the H1. */}
                <p className="inline-block bg-green-500/15 border border-green-400/50 text-green-300 text-sm md:text-base font-semibold rounded-full px-4 py-2 mb-6">
                  {t("corridors.californiaTexas.hero.priceCallout")}
                </p>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                  {t("corridors.californiaTexas.hero.title")}
                </h1>
                <p className="text-lg md:text-xl text-gray-300 mt-5 max-w-xl leading-relaxed">
                  {t("corridors.californiaTexas.hero.description")}
                </p>

                <div className="flex flex-wrap gap-3 mt-8">
                  <Link
                    href={{ pathname: "/quote", query: { from: "CA", to: "TX" } }}
                    className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-6 py-3 rounded-full transition"
                  >
                    {t("corridors.californiaTexas.hero.ctaPrimary")}
                  </Link>
                  <a
                    href="#math"
                    className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
                  >
                    {t("corridors.californiaTexas.hero.ctaSecondary")}
                  </a>
                </div>
              </div>

              {/* Right column: corridor pricing snapshot. Reads from Firestore
                  (populated by /api/cron/sync-pricing). Per the cached-vs-quoted
                  rule, this card is display-only. The quiet link below sends
                  visitors to /quote, which hits SD live for the real lock. */}
              <CorridorPricingCard corridorSlug="california-texas" locale={locale} />
            </div>
          </Container>
        </section>

        {/* The math: cost story */}
        <section id="math" className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("corridors.californiaTexas.math.eyebrow")}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                {t("corridors.californiaTexas.math.title")}
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>{t("corridors.californiaTexas.math.body.0")}</p>
                <p>{t("corridors.californiaTexas.math.body.1")}</p>
                <p className="font-semibold text-charcoal">
                  {t("corridors.californiaTexas.math.punchline")}
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Who saves the most */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaTexas.customers.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-8">
              {t("corridors.californiaTexas.customers.title")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {CUSTOMER_KEYS.map((k) => (
                <article
                  key={k}
                  className="bg-white border border-gray-200 rounded-2xl p-6"
                >
                  <h3 className="text-lg font-bold text-charcoal mb-2">
                    {t(`corridors.californiaTexas.customers.items.${k}.title`)}
                  </h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {t(`corridors.californiaTexas.customers.items.${k}.body`)}
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
              {t("corridors.californiaTexas.subDest.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {t("corridors.californiaTexas.subDest.title")}
            </h2>
            <p className="text-gray-700 max-w-2xl leading-relaxed mb-8">
              {t("corridors.californiaTexas.subDest.lead")}
            </p>
            <SubDestinationGrid
              destinations={corridor.subDestinations ?? []}
              fromCode="CA"
              toCode="TX"
              corridorKey="californiaTexas"
            />
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-gray-100">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("corridors.californiaTexas.faq.eyebrow")}
              </p>
              <FAQ items={faqs} title={t("corridors.californiaTexas.faq.title")} />
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                {t("corridors.californiaTexas.finalCta.title")}
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                {t("corridors.californiaTexas.finalCta.body")}
              </p>
              <Link
                href={{ pathname: "/quote", query: { from: "CA", to: "TX" } }}
                className="inline-block bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-8 py-3 rounded-full transition"
              >
                {t("corridors.californiaTexas.finalCta.cta")}
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}
