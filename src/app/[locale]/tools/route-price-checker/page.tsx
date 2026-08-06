import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { RoutePriceCheckerForm } from "@/components/RoutePriceCheckerForm";
import { localeAlternates } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
  title: "Car shipping cost calculator. Real prices, no signup.",
  description:
    "Get today's auto-transport price range for any ZIP-to-ZIP route in the continental US. Live carrier pricing, no email gate, no signup. Plus a 30-day average comparison as our pricing data grows.",
    alternates: localeAlternates(locale, "/tools/route-price-checker"),
  };
}

// The form panel is the conversion moment. Page revalidates rarely since the
// form itself fetches live data on submit.
export const revalidate = 3600;

export default async function RoutePriceCheckerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <div className="max-w-2xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("routePriceChecker.hero.eyebrow")}
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                {t("routePriceChecker.hero.title")}
              </h1>
              <p className="text-lg md:text-xl text-gray-300 mt-5 leading-relaxed">
                {t("routePriceChecker.hero.lead")}
              </p>
            </div>
          </Container>
        </section>

        {/* Form + result panel */}
        <section className="py-12 md:py-16 bg-gray-50">
          <Container>
            <div className="max-w-3xl">
              <RoutePriceCheckerForm
                i18n={{
                  fromZipLabel: t("routePriceChecker.form.fromZipLabel"),
                  fromZipPlaceholder: t("routePriceChecker.form.fromZipPlaceholder"),
                  toZipLabel: t("routePriceChecker.form.toZipLabel"),
                  toZipPlaceholder: t("routePriceChecker.form.toZipPlaceholder"),
                  vehicleLabel: t("routePriceChecker.form.vehicleLabel"),
                  vehicleSedan: t("routePriceChecker.form.vehicleSedan"),
                  vehicleSuv: t("routePriceChecker.form.vehicleSuv"),
                  vehiclePickup: t("routePriceChecker.form.vehiclePickup"),
                  submit: t("routePriceChecker.form.submit"),
                  submitting: t("routePriceChecker.form.submitting"),
                  errorInvalidZip: t("routePriceChecker.form.errorInvalidZip"),
                  errorService: t("routePriceChecker.form.errorService"),
                  unsupportedTitle: t("routePriceChecker.result.unsupportedTitle"),
                  unsupportedBody: t("routePriceChecker.result.unsupportedBody"),
                  unsupportedCta: t("routePriceChecker.result.unsupportedCta"),
                  resultEyebrow: t("routePriceChecker.result.eyebrow"),
                  resultRoute: t("routePriceChecker.result.route"),
                  anchorEyebrow: t("routePriceChecker.result.anchorEyebrow"),
                  rangeLabel: t("routePriceChecker.result.rangeLabel"),
                  alsoConsider: t("routePriceChecker.result.alsoConsider"),
                  rowSedan: t("routePriceChecker.result.rowSedan"),
                  rowSuv: t("routePriceChecker.result.rowSuv"),
                  rowPickup: t("routePriceChecker.result.rowPickup"),
                  transitLabel: t("routePriceChecker.result.transitLabel"),
                  transitValue: t("routePriceChecker.result.transitValue"),
                  resultCta: t("routePriceChecker.result.cta"),
                  capTitle: t("routePriceChecker.capture.title"),
                  capSub: t("routePriceChecker.capture.sub"),
                  capPlaceholder: t("routePriceChecker.capture.placeholder"),
                  capButton: t("routePriceChecker.capture.button"),
                  capSending: t("routePriceChecker.capture.sending"),
                  capFine: t("routePriceChecker.capture.fine"),
                  capErrorEmail: t("routePriceChecker.capture.errorEmail"),
                  capErrorSend: t("routePriceChecker.capture.errorSend"),
                  capSentTitle: t("routePriceChecker.capture.sentTitle"),
                  capSentBody: t("routePriceChecker.capture.sentBody"),
                }}
                locale={locale}
              />
            </div>
          </Container>
        </section>

        {/* Trust strip — 3 small callouts under the form */}
        <section className="py-12 md:py-16 bg-white">
          <Container>
            <div className="max-w-3xl grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-orange text-[11px] font-bold uppercase tracking-wider mb-2">
                  {t("routePriceChecker.callouts.1.eyebrow")}
                </p>
                <h3 className="text-charcoal font-bold text-base mb-1">
                  {t("routePriceChecker.callouts.1.title")}
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {t("routePriceChecker.callouts.1.body")}
                </p>
              </div>
              <div>
                <p className="text-orange text-[11px] font-bold uppercase tracking-wider mb-2">
                  {t("routePriceChecker.callouts.2.eyebrow")}
                </p>
                <h3 className="text-charcoal font-bold text-base mb-1">
                  {t("routePriceChecker.callouts.2.title")}
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {t("routePriceChecker.callouts.2.body")}
                </p>
              </div>
              <div>
                <p className="text-orange text-[11px] font-bold uppercase tracking-wider mb-2">
                  {t("routePriceChecker.callouts.3.eyebrow")}
                </p>
                <h3 className="text-charcoal font-bold text-base mb-1">
                  {t("routePriceChecker.callouts.3.title")}
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {t("routePriceChecker.callouts.3.body")}
                </p>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}
