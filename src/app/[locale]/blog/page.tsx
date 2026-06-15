import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { getAllArticleSummaries } from "@/lib/blog/articles";

export const metadata: Metadata = {
  title: "Auto transport buyer guides. Plain English.",
  description:
    "Honest explainers on how car shipping pricing, deposits, and brokers actually work. Written for the customer who is trying to figure out if a quote is real before they pay.",
};

// Articles are static. Revalidate once a day in case we hot-edit content.
export const revalidate = 86400;

export default async function BlogIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const articles = getAllArticleSummaries();

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <div className="max-w-2xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("blog.hero.eyebrow")}
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                {t("blog.hero.title")}
              </h1>
              <p className="text-lg md:text-xl text-gray-300 mt-5 leading-relaxed">
                {t("blog.hero.lead")}
              </p>
            </div>
          </Container>
        </section>

        {/* Article list */}
        <section className="py-12 md:py-16 bg-white">
          <Container>
            <div className="max-w-3xl mx-auto">
              <h2 className="text-charcoal font-bold text-xl md:text-2xl mb-6">
                {t("blog.listHeading")}
              </h2>
              <div className="space-y-4">
                {articles.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/blog/${a.slug}` as "/blog/why-car-shipping-quotes-go-up"}
                    className="block bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-6 transition group"
                  >
                    <p className="text-orange text-[11px] font-bold uppercase tracking-[0.12em] mb-2">
                      {a.category} · {a.readMinutes} {t("blog.minRead")}
                    </p>
                    <h3 className="text-charcoal font-bold text-lg md:text-xl leading-snug mb-2 group-hover:text-orange transition">
                      {a.title}
                    </h3>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {a.subtitle}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}
