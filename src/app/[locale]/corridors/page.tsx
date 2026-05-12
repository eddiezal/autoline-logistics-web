import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import {
  CORRIDORS,
  getLiveCorridors,
  getComingSoonCorridors,
  corridorCatalogKey,
  type Corridor,
} from "@/lib/corridors";

export const metadata: Metadata = {
  title: "All corridors — Auto Line Logistics",
  description:
    "Locked-price auto transport on every major US corridor. California to Hawaii, Alaska, Texas, Florida, New York, and more. Door-to-door, named coordinator, no surprises.",
};

export default function CorridorsIndex() {
  const t = useTranslations();
  const live = getLiveCorridors();
  const comingSoon = getComingSoonCorridors();

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.index.hero.eyebrow")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              {t("corridors.index.hero.title")}
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              {t("corridors.index.hero.description")}
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
              >
                {t("corridors.index.hero.cta")}
              </Link>
            </div>
          </Container>
        </section>

        {/* Live corridors */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.index.live.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {t("corridors.index.live.titleTemplate", { count: live.length })}
            </h2>
            <p className="text-gray-700 max-w-2xl mb-10">
              {t("corridors.index.live.description")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {live.map((c) => (
                <CorridorCard key={c.slug} corridor={c} live />
              ))}
            </div>
          </Container>
        </section>

        {/* Coming soon corridors */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("corridors.index.comingSoon.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {t("corridors.index.comingSoon.titleTemplate", {
                count: comingSoon.length,
              })}
            </h2>
            <p className="text-gray-700 max-w-2xl mb-10">
              {t("corridors.index.comingSoon.description")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comingSoon.map((c) => (
                <CorridorCard key={c.slug} corridor={c} live={false} />
              ))}
            </div>
          </Container>
        </section>

        {/* The promise */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("corridors.index.promiseTieIn.eyebrow")}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                {t("corridors.index.promiseTieIn.title")}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  href="/price-promise"
                  className="bg-gray-100 border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    {t("corridors.index.promiseTieIn.cards.price.eyebrow")}
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    {t("corridors.index.promiseTieIn.cards.price.headline")}
                  </p>
                </Link>
                <Link
                  href="/damage-promise"
                  className="bg-gray-100 border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    {t("corridors.index.promiseTieIn.cards.damage.eyebrow")}
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    {t("corridors.index.promiseTieIn.cards.damage.headline")}
                  </p>
                </Link>
                <Link
                  href="/people-promise"
                  className="bg-gray-100 border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    {t("corridors.index.promiseTieIn.cards.people.eyebrow")}
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    {t("corridors.index.promiseTieIn.cards.people.headline")}
                  </p>
                </Link>
              </div>
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                {t("corridors.index.finalCta.title")}
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                {t("corridors.index.finalCta.descriptionTemplate", {
                  count: CORRIDORS.length,
                })}
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/quote"
                  className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("corridors.index.finalCta.primary")}
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

function CorridorCard({ corridor, live }: { corridor: Corridor; live: boolean }) {
  const t = useTranslations();
  const className = live
    ? "bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-6 transition group"
    : "bg-white border border-gray-200 rounded-2xl p-6 opacity-75 hover:opacity-100 transition group";

  const catalogKey = corridorCatalogKey(corridor.slug);
  const fromName = t(`quote.states.${corridor.fromState}`);
  const toName = t(`quote.states.${corridor.toState}`);
  const shortDesc = t(`corridors.catalog.${catalogKey}.shortDesc`);

  const content = (
    <>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-2xl font-bold text-charcoal group-hover:text-orange transition">
          {fromName} ↔ {toName}
        </p>
        {!live && (
          <span className="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-gray-200 text-gray-700 flex-shrink-0">
            {t("corridors.index.card.soonBadge")}
          </span>
        )}
      </div>
      <p className="text-orange font-semibold text-sm mb-3">
        {corridor.fromState} ↔ {corridor.toState}
      </p>
      <p className="text-gray-700 text-sm leading-relaxed">{shortDesc}</p>
      {live && (
        <p className="text-orange font-semibold text-sm mt-4 group-hover:text-orange-dark">
          {t("corridors.index.card.ctaLive")}
        </p>
      )}
      {!live && (
        <Link
          href={{
            pathname: "/quote",
            query: { from: corridor.fromState, to: corridor.toState },
          }}
          className="inline-block text-orange font-semibold text-sm mt-4 hover:text-orange-dark"
        >
          {t("corridors.index.card.ctaComingSoon")}
        </Link>
      )}
    </>
  );

  if (live) {
    return (
      <Link
        href={`/corridors/${corridor.slug}` as "/corridors/california-hawaii"}
        className={className}
      >
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

