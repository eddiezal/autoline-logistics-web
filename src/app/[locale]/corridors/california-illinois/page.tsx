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
  title: "Ship a car California to Illinois. Locked-price corridor.",
  description:
    "Auto transport from California to Illinois. Locked all-in price. No deposit. Real-time portal tracking. Chicago, Naperville, Aurora, Joliet.",
};

// Re-read Firestore pricing snapshot at most every 5 minutes. The cron only
// writes 2x daily so this is more than fresh enough.
export const revalidate = 300;

const CUSTOMER_KEYS = ["jobRelocators", "multiVehicle", "highValue"] as const;
const FAQ_INDEXES = [0, 1, 2, 3, 4] as const;

export default async function CaliforniaIllinoisCorridor({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const corridor = getCorridor("california-illinois")!;
  const faqs: FAQItem[] = FAQ_INDEXES.map((i) => ({
    q: t(`corridors.californiaIllinois.faq.items.${i}.q`),
    a: t(`corridors.californiaIllinois.faq.items.${i}.a`),
  }));

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 lg:gap-16 items-start">
              <div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                  {t("corridors.californiaIllinois.hero.title")}
                </h1>
                <p className="text-lg md:text-xl text-gray-300 mt-5 max-w-xl leading-relaxed">
                  {t("corridors.californiaIllinois.hero.description")}
                </p>

                <div className="flex flex-wrap gap-3 mt-8">
                  <Link
                    href={{ pathname: "/quote", query: { from: "CA", to: "IL" } }}
                    className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-6 py-3 rounded-full transition"
                  >
                    {t("corridors.californiaIllinois.hero.ctaPrimary")}
                  </Link>
                  <a
                    href="#math"
                    className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
                  >
                    {t("corridors.californiaIllinois.hero.ctaSecondary")}
                  </a>
                </div>
              </div>

              <CorridorPricingCard corridorSlug="california-illinois" locale={locale} />
            </div>
          </Container>
        </section>

        {/* Math */}
        <section id="math" className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("corridors.californiaIllinois.math.eyebrow")}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                {t("corridors.californiaIllinois.math.title")}
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>{t("corridors.californiaIllinois.math.body.0")}</p>
                <p>{t("corridors.californiaIllinois.math.body.1")}</p>
                <p className="font-semibold text-charcoal">
                  {t("corridors.californiaIllinois.math.punchline")}
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Who saves the most */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaIllinois.customers.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-8">
              {t("corridors.californiaIllinois.customers.title")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {CUSTOMER_KEYS.map((k) => (
                <article
                  key={k}
                  className="bg-white border border-gray-200 rounded-2xl p-6"
                >
                  <h3 className="text-lg font-bold text-charcoal mb-2">
                    {t(`corridors.californiaIllinois.customers.items.${k}.title`)}
                  </h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {t(`corridors.californiaIllinois.customers.items.${k}.body`)}
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
              {t("corridors.californiaIllinois.subDest.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {t("corridors.californiaIllinois.subDest.title")}
            </h2>
            <p className="text-gray-700 max-w-2xl leading-relaxed mb-8">
              {t("corridors.californiaIllinois.subDest.lead")}
            </p>
            <SubDestinationGrid
              destinations={corridor.subDestinations ?? []}
              fromCode="CA"
              toCode="IL"
              corridorKey="californiaIllinois"
            />
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-gray-100">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("corridors.californiaIllinois.faq.eyebrow")}
              </p>
              <FAQ items={faqs} title={t("corridors.californiaIllinois.faq.title")} />
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                {t("corridors.californiaIllinois.finalCta.title")}
              </h2>
              <p className="text-lg text-gray-300 mb-8">
                {t("corridors.californiaIllinois.finalCta.body")}
              </p>
              <Link
                href={{ pathname: "/quote", query: { from: "CA", to: "IL" } }}
                className="inline-block bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-8 py-3 rounded-full transition"
              >
                {t("corridors.californiaIllinois.finalCta.cta")}
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}
