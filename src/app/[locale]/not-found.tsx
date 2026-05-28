import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";

/**
 * Locale-aware 404 page.
 *
 * Triggered when a route under `/[locale]/...` doesn't match a known page,
 * or when a page explicitly calls `notFound()`. Renders in the active locale.
 */
export default function NotFound() {
  const t = useTranslations();

  return (
    <>
      <Header />

      <main className="flex-1 flex items-center">
        <Container>
          <div className="max-w-2xl py-20 md:py-28">
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("common.notFound.eyebrow")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold text-charcoal leading-tight">
              {t("common.notFound.title")}
            </h1>
            <p className="text-lg md:text-xl text-gray-700 mt-6 leading-relaxed">
              {t("common.notFound.description")}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/quote"
                className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-6 py-3 rounded-full transition"
              >
                {t("common.notFound.ctaPrimary")}
              </Link>
              <Link
                href="/corridors"
                className="bg-white border border-gray-200 hover:border-orange text-charcoal font-semibold px-6 py-3 rounded-full transition"
              >
                {t("common.notFound.ctaSecondary")}
              </Link>
              <Link
                href="/"
                className="text-charcoal/70 hover:text-orange font-semibold px-6 py-3 rounded-full transition"
              >
                {t("common.notFound.ctaHome")}
              </Link>
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </>
  );
}
