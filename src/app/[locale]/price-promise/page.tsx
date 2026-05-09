import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ, type FAQItem } from "@/components/FAQ";
import { PromiseFooterNav } from "@/components/PromiseFooterNav";

export const metadata: Metadata = {
  title: "Price Promise — Locked-price auto transport",
  description:
    "Three service tiers. Whichever you pick, the price locks at booking. No post-assignment surcharges. No carrier-cost-overage calls. The quote is the contract.",
};

export default function PricePromisePage() {
  const t = useTranslations();
  const faqs: FAQItem[] = [0, 1, 2, 3, 4, 5].map((i) => ({
    q: t(`pricePromise.faq.items.${i}.q`),
    a: t(`pricePromise.faq.items.${i}.a`),
  }));

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("common.promiseEyebrow.1")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              {t("pricePromise.hero.title")}
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              {t("pricePromise.hero.subtitle")}
            </p>
          </Container>
        </section>

        {/* Anti-pattern callout — Anti-Scam Educator voice */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("common.labels.whyThisMatters")}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                {t("pricePromise.antiPattern.title")}
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>{t("pricePromise.antiPattern.body.0")}</p>
                <p>{t("pricePromise.antiPattern.body.1")}</p>
                <p className="font-semibold text-charcoal">
                  {t("pricePromise.antiPattern.punchline")}
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Tier selection */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("pricePromise.tiers.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {t("pricePromise.tiers.title")}
            </h2>
            <p className="text-gray-700 max-w-2xl">
              {t("pricePromise.tiers.intro")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              <TierCard
                tier={t("pricePromise.tiers.cards.standby.tier")}
                window={t("pricePromise.tiers.cards.standby.window")}
                description={t("pricePromise.tiers.cards.standby.description")}
                bestFor={t("pricePromise.tiers.cards.standby.bestFor")}
                bestForLabel={t("pricePromise.tiers.bestForLabel")}
              />
              <TierCard
                tier={t("pricePromise.tiers.cards.priority.tier")}
                window={t("pricePromise.tiers.cards.priority.window")}
                description={t("pricePromise.tiers.cards.priority.description")}
                bestFor={t("pricePromise.tiers.cards.priority.bestFor")}
                bestForLabel={t("pricePromise.tiers.bestForLabel")}
                mostPopularLabel={t("common.labels.mostPopular")}
                highlight
              />
              <TierCard
                tier={t("pricePromise.tiers.cards.expedited.tier")}
                window={t("pricePromise.tiers.cards.expedited.window")}
                description={t("pricePromise.tiers.cards.expedited.description")}
                bestFor={t("pricePromise.tiers.cards.expedited.bestFor")}
                bestForLabel={t("pricePromise.tiers.bestForLabel")}
              />
            </div>
          </Container>
        </section>

        {/* The promise — explicit commitment */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl mx-auto p-8 bg-orange-tint rounded-2xl border border-orange/30">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("pricePromise.commitment.eyebrow")}
              </p>
              <p className="text-charcoal text-xl md:text-2xl font-semibold leading-snug mb-4">
                {t("pricePromise.commitment.headline")}
              </p>
              <ul className="space-y-2 text-gray-700">
                <li>✓ {t("pricePromise.commitment.items.0")}</li>
                <li>✓ {t("pricePromise.commitment.items.1")}</li>
                <li>✓ {t("pricePromise.commitment.items.2")}</li>
                <li>✓ {t("pricePromise.commitment.items.3")}</li>
                <li>✓ {t("pricePromise.commitment.items.4")}</li>
              </ul>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-gray-100">
          <Container>
            <FAQ items={faqs} title={t("pricePromise.faq.title")} />
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                {t("pricePromise.cta.title")}
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                {t("pricePromise.cta.description")}
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/quote"
                  className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("pricePromise.cta.primary")}
                </Link>
                <Link
                  href="/people-promise"
                  className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("pricePromise.cta.secondary")}
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <PromiseFooterNav current="price" />
      <Footer />
    </>
  );
}

function TierCard({
  tier,
  window: pickupWindow,
  description,
  bestFor,
  bestForLabel,
  mostPopularLabel,
  highlight = false,
}: {
  tier: string;
  window: string;
  description: string;
  bestFor: string;
  bestForLabel: string;
  mostPopularLabel?: string;
  highlight?: boolean;
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
      <p className="text-orange font-semibold text-sm mt-1">{pickupWindow}</p>
      <p className="text-gray-700 mt-4 text-sm leading-relaxed">{description}</p>
      <p className="text-gray-500 mt-3 text-xs italic border-t border-gray-200 pt-3">
        {bestForLabel} {bestFor}
      </p>
    </div>
  );
}
