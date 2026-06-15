import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { getArticlesByCluster } from "@/lib/blog/articles";
import { getLiveCorridors } from "@/lib/corridors";
import type { ArticleSummary } from "@/lib/blog/types";

export const metadata: Metadata = {
  title:
    "Car Shipping Buyer Guides: Avoid Scams, Fake Quotes, and Deposit Traps",
  description:
    "Plain-English answers to the scary questions before you book auto transport. Honest explainers, plus a realistic quote when you're ready.",
};

// Articles are static. Daily revalidate keeps the index fresh as we add posts.
export const revalidate = 86400;

const CLUSTER_ORDER = [
  "avoiding-scams",
  "understanding-industry",
  "planning-shipment",
] as const;

export default async function BlogIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const grouped = getArticlesByCluster();
  const corridors = getLiveCorridors();

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero: SEO-anchored H1 + human subtitle */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("blog.hero.eyebrow")}
              </p>
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                {t("blog.hero.title")}
              </h1>
              <p className="text-lg md:text-xl text-gray-300 mt-5 leading-relaxed">
                {t("blog.hero.subtitle")}
              </p>
            </div>
          </Container>
        </section>

        {/* Conversion module — "Check my quote" trust play.
            Matches the emotional state of the visitor who arrived here from
            Google after getting a too-low quote and wondering if it's real. */}
        <section className="py-10 md:py-12 bg-orange-tint border-b border-orange/20">
          <Container>
            <div className="max-w-4xl flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="flex-1">
                <p className="text-orange-dark text-[11px] font-bold uppercase tracking-wider mb-2">
                  {t("blog.checkQuote.eyebrow")}
                </p>
                <h2 className="text-charcoal text-xl md:text-2xl font-bold leading-snug mb-2">
                  {t("blog.checkQuote.title")}
                </h2>
                <p className="text-gray-700 text-sm md:text-base leading-relaxed max-w-2xl">
                  {t("blog.checkQuote.body")}
                </p>
              </div>
              <Link
                href="/tools/route-price-checker"
                className="inline-flex items-center justify-center bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold text-sm md:text-base px-6 py-3 rounded-lg transition whitespace-nowrap"
              >
                {t("blog.checkQuote.cta")} &rarr;
              </Link>
            </div>
          </Container>
        </section>

        {/* Topical clusters — each is a semantic section with its own H2.
            Google reads this as topical depth + crawls the linked spokes. */}
        <section className="py-12 md:py-16 bg-white">
          <Container>
            <div className="max-w-5xl space-y-14">
              {CLUSTER_ORDER.map((cluster) => {
                const articles = grouped[cluster];
                if (articles.length === 0) return null;
                return (
                  <ClusterSection
                    key={cluster}
                    title={t(`blog.clusters.${cluster}.title`)}
                    lead={t(`blog.clusters.${cluster}.lead`)}
                    articles={articles}
                    minReadLabel={t("blog.minRead")}
                  />
                );
              })}

              {/* Popular routes: links to live corridor pages.
                  Different content type (route landing pages, not articles)
                  but same topical-authority signal. */}
              {corridors.length > 0 && (
                <div>
                  <h2 className="text-charcoal font-bold text-2xl md:text-3xl mb-2 tracking-tight">
                    {t("blog.clusters.popular-routes.title")}
                  </h2>
                  <p className="text-gray-700 text-base leading-relaxed mb-6 max-w-2xl">
                    {t("blog.clusters.popular-routes.lead")}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {corridors.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/corridors/${c.slug}` as "/corridors/california-texas"}
                        className="block bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-5 transition group"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-orange-dark bg-orange-tint px-2.5 py-1 rounded-full inline-block mb-3">
                          {t("blog.clusters.popular-routes.routeTag")}
                        </p>
                        <h3 className="text-charcoal font-bold text-base md:text-lg leading-snug mb-2 group-hover:text-orange transition">
                          {t(`quote.states.${c.fromState}`)} to{" "}
                          {t(`quote.states.${c.toState}`)}
                        </h3>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {t("blog.clusters.popular-routes.routeBlurb")}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}

function ClusterSection({
  title,
  lead,
  articles,
  minReadLabel,
}: {
  title: string;
  lead: string;
  articles: ReadonlyArray<ArticleSummary>;
  minReadLabel: string;
}) {
  return (
    <div>
      <h2 className="text-charcoal font-bold text-2xl md:text-3xl mb-2 tracking-tight">
        {title}
      </h2>
      <p className="text-gray-700 text-base leading-relaxed mb-6 max-w-2xl">
        {lead}
      </p>
      <div
        className={
          // Single-article clusters render in one column so the lone card
          // doesn't sit in an empty 2-col grid. 2+ articles use the 2-col
          // grid for scan density.
          articles.length === 1
            ? "grid grid-cols-1 max-w-xl gap-4"
            : "grid grid-cols-1 md:grid-cols-2 gap-4"
        }
      >
        {articles.map((a) => (
          <Link
            key={a.slug}
            href={`/blog/${a.slug}` as "/blog/why-car-shipping-quotes-go-up"}
            className="block bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-5 transition group"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-dark bg-orange-tint px-2.5 py-1 rounded-full inline-block mb-3">
              {a.category} · {a.readMinutes} {minReadLabel}
            </p>
            <h3 className="text-charcoal font-bold text-base md:text-lg leading-snug mb-2 group-hover:text-orange transition">
              {a.title}
            </h3>
            <p className="text-gray-700 text-sm leading-relaxed">{a.subtitle}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
