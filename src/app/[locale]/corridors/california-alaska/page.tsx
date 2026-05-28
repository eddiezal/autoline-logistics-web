import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ, type FAQItem } from "@/components/FAQ";
import { SubDestinationGrid } from "@/components/SubDestinationGrid";
import { getCorridor } from "@/lib/corridors";

export const metadata: Metadata = {
  title: "Ship a car California to Alaska — PCS, oil/gas, retiree relocations",
  description:
    "California-to-Alaska vehicle transport via overland (Alaska Highway) or ocean (Tacoma to Anchorage). Locked-price quotes. Trusted by military PCS to JBER, Eielson, and Fort Wainwright.",
};

const SPECIALTY_KEYS = [
  "lifted",
  "oversizedSuv",
  "atv",
  "rv",
  "rooftop",
  "coldPrep",
] as const;
const ROUTE_POINTS = [0, 1, 2, 3, 4] as const;

export default function CaliforniaAlaskaCorridor() {
  const t = useTranslations();
  const corridor = getCorridor("california-alaska")!;
  const faqs: FAQItem[] = [0, 1, 2, 3, 4, 5, 6].map((i) => ({
    q: t(`corridors.californiaAlaska.faq.items.${i}.q`),
    a: t(`corridors.californiaAlaska.faq.items.${i}.a`),
  }));

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaAlaska.hero.eyebrow")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              {t("corridors.californiaAlaska.hero.title")}
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              {t("corridors.californiaAlaska.hero.description")}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href={{ pathname: "/quote", query: { from: "CA", to: "AK" } }}
                className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-6 py-3 rounded-full transition"
              >
                {t("corridors.californiaAlaska.hero.ctaPrimary")}
              </Link>
              <a
                href="#how-it-works"
                className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
              >
                {t("corridors.californiaAlaska.hero.ctaSecondary")}
              </a>
            </div>
          </Container>
        </section>

        {/* Why Alaska is different */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("corridors.californiaAlaska.whyDifferent.eyebrow")}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                {t("corridors.californiaAlaska.whyDifferent.title")}
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>{t("corridors.californiaAlaska.whyDifferent.body.0")}</p>
                <p>{t("corridors.californiaAlaska.whyDifferent.body.1")}</p>
                <p className="font-semibold text-charcoal">
                  {t("corridors.californiaAlaska.whyDifferent.punchline")}
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Two routes comparison */}
        <section id="how-it-works" className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaAlaska.routes.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              {t("corridors.californiaAlaska.routes.title")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <RouteCard
                title={t("corridors.californiaAlaska.routes.ocean.title")}
                bestFor={t("corridors.californiaAlaska.routes.ocean.bestFor")}
                bestForLabel={t("corridors.californiaAlaska.routes.bestForLabel")}
                points={ROUTE_POINTS.map((i) =>
                  t(`corridors.californiaAlaska.routes.ocean.points.${i}`)
                )}
              />
              <RouteCard
                title={t("corridors.californiaAlaska.routes.overland.title")}
                bestFor={t("corridors.californiaAlaska.routes.overland.bestFor")}
                bestForLabel={t("corridors.californiaAlaska.routes.bestForLabel")}
                points={ROUTE_POINTS.map((i) =>
                  t(`corridors.californiaAlaska.routes.overland.points.${i}`)
                )}
              />
            </div>
          </Container>
        </section>

        {/* Sub-destinations */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaAlaska.subDestinations.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {t("corridors.californiaAlaska.subDestinations.title")}
            </h2>
            <p className="text-gray-700 max-w-2xl mb-10">
              {t("corridors.californiaAlaska.subDestinations.description")}
            </p>
            <SubDestinationGrid
              destinations={corridor.subDestinations ?? []}
              fromCode="CA"
              toCode="AK"
              corridorKey="californiaAlaska"
            />
          </Container>
        </section>

        {/* Specialty vehicles */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaAlaska.specialty.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {t("corridors.californiaAlaska.specialty.title")}
            </h2>
            <p className="text-gray-700 max-w-2xl mb-10">
              {t("corridors.californiaAlaska.specialty.description")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {SPECIALTY_KEYS.map((key) => (
                <SpecialtyCard
                  key={key}
                  title={t(`corridors.californiaAlaska.specialty.cards.${key}.title`)}
                  summary={t(`corridors.californiaAlaska.specialty.cards.${key}.summary`)}
                  detail={t(`corridors.californiaAlaska.specialty.cards.${key}.detail`)}
                />
              ))}
            </div>

            <p className="text-gray-500 text-sm mt-8 italic max-w-2xl">
              {t("corridors.californiaAlaska.specialty.footnote")}
            </p>
          </Container>
        </section>

        {/* Service tiers */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.californiaAlaska.tiers.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {t("corridors.californiaAlaska.tiers.title")}
            </h2>
            <p className="text-gray-700 max-w-2xl mb-8">
              {t("corridors.californiaAlaska.tiers.description")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <TierTile
                tier={t("corridors.californiaAlaska.tiers.tiles.standby.tier")}
                window={t("corridors.californiaAlaska.tiers.tiles.standby.window")}
                description={t("corridors.californiaAlaska.tiers.tiles.standby.description")}
              />
              <TierTile
                tier={t("corridors.californiaAlaska.tiers.tiles.priority.tier")}
                window={t("corridors.californiaAlaska.tiers.tiles.priority.window")}
                description={t("corridors.californiaAlaska.tiers.tiles.priority.description")}
                highlight
                mostPopularLabel={t("common.labels.mostPopular")}
              />
              <TierTile
                tier={t("corridors.californiaAlaska.tiers.tiles.expedited.tier")}
                window={t("corridors.californiaAlaska.tiers.tiles.expedited.window")}
                description={t("corridors.californiaAlaska.tiers.tiles.expedited.description")}
              />
            </div>

            <p className="text-gray-500 text-sm mt-6 italic">
              {t("corridors.californiaAlaska.tiers.footnote")}
            </p>
          </Container>
        </section>

        {/* Triple Promise tie-in */}
        <section className="py-16 bg-gray-100">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("corridors.californiaAlaska.triplePromise.eyebrow")}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                {t("corridors.californiaAlaska.triplePromise.title")}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <Link
                  href="/price-promise"
                  className="bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    {t("corridors.californiaAlaska.triplePromise.cards.price.eyebrow")}
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    {t("corridors.californiaAlaska.triplePromise.cards.price.headline")}
                  </p>
                </Link>
                <Link
                  href="/damage-promise"
                  className="bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    {t("corridors.californiaAlaska.triplePromise.cards.damage.eyebrow")}
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    {t("corridors.californiaAlaska.triplePromise.cards.damage.headline")}
                  </p>
                </Link>
                <Link
                  href="/people-promise"
                  className="bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    {t("corridors.californiaAlaska.triplePromise.cards.people.eyebrow")}
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    {t("corridors.californiaAlaska.triplePromise.cards.people.headline")}
                  </p>
                </Link>
              </div>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-white">
          <Container>
            <FAQ items={faqs} title={t("corridors.californiaAlaska.faq.title")} />
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                {t("corridors.californiaAlaska.finalCta.title")}
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                {t("corridors.californiaAlaska.finalCta.description")}
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href={{ pathname: "/quote", query: { from: "CA", to: "AK" } }}
                  className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("corridors.californiaAlaska.finalCta.primary")}
                </Link>
                <Link
                  href="/corridors/california-hawaii"
                  className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("corridors.californiaAlaska.finalCta.secondary")}
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

function RouteCard({
  title,
  bestFor,
  bestForLabel,
  points,
}: {
  title: string;
  bestFor: string;
  bestForLabel: string;
  points: string[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <p className="text-xl font-bold text-charcoal">{title}</p>
      <p className="text-orange font-semibold text-sm mt-2">
        {bestForLabel} {bestFor}
      </p>
      <ul className="mt-4 space-y-2">
        {points.map((p, i) => (
          <li key={i} className="text-gray-700 text-sm flex items-start gap-2">
            <span className="text-orange flex-shrink-0">•</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
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
