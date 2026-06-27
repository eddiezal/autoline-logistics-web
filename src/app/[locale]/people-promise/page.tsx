import type { Metadata } from "next";
import { useTranslations, useLocale } from "next-intl";
import { StructuredData } from "@/components/StructuredData";
import {
  breadcrumbSchema,
  faqPageSchema,
  SITE_URL,
} from "@/lib/seo/schemas";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ, type FAQItem } from "@/components/FAQ";
import { PromiseFooterNav } from "@/components/PromiseFooterNav";

export const metadata: Metadata = {
  title: "People Promise — Real people, by name",
  description:
    "Family-owned and operated since 2011. Bilingual coverage in English and Spanish. Named coordinator on every shipment. Real names on the company.",
};

const COMMITMENT_KEYS = ["named", "bilingual", "family", "noScript"] as const;
const TIMELINE_INDICES = [0, 1, 2, 3, 4, 5] as const;

export default function PeoplePromisePage() {
  const t = useTranslations();
  const faqs: FAQItem[] = [0, 1, 2, 3, 4, 5].map((i) => ({
    q: t(`peoplePromise.faq.items.${i}.q`),
    a: t(`peoplePromise.faq.items.${i}.a`),
  }));

  // Structured data: BreadcrumbList + FAQPage. Uses sync useLocale for the
  // locale-prefixed canonical URL (matches the corridor HI/AK pattern).
  const locale = useLocale();
  const localePath = locale === "es" ? "/es" : "";
  const canonicalUrl = `${SITE_URL}${localePath}/people-promise`;
  const pageStructuredData = [
    breadcrumbSchema([
      { name: "Home", url: `${SITE_URL}${localePath}/` },
      { name: "People Promise", url: canonicalUrl },
    ]),
    faqPageSchema(faqs),
  ];

  return (
    <>
      <StructuredData data={pageStructuredData} />
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("common.promiseEyebrow.3")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              {t("peoplePromise.hero.title")}
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              {t("peoplePromise.hero.subtitle")}
            </p>
          </Container>
        </section>

        {/* Anti-pattern callout */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("common.labels.whyThisMatters")}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                {t("peoplePromise.antiPattern.title")}
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>{t("peoplePromise.antiPattern.body.0")}</p>
                <p>{t("peoplePromise.antiPattern.body.1")}</p>
                <p className="font-semibold text-charcoal">
                  {t("peoplePromise.antiPattern.punchline")}
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Commitments */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("peoplePromise.commitments.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              {t("peoplePromise.commitments.title")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {COMMITMENT_KEYS.map((key) => (
                <Commitment
                  key={key}
                  title={t(`peoplePromise.commitments.cards.${key}.title`)}
                  description={t(`peoplePromise.commitments.cards.${key}.description`)}
                />
              ))}
            </div>
          </Container>
        </section>

        {/* Day in the life */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("peoplePromise.timeline.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              {t("peoplePromise.timeline.title")}
            </h2>

            <div className="space-y-4">
              {TIMELINE_INDICES.map((i) => (
                <TimelineRow
                  key={i}
                  time={t(`peoplePromise.timeline.rows.${i}.time`)}
                  description={t(`peoplePromise.timeline.rows.${i}.description`)}
                />
              ))}
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-gray-100">
          <Container>
            <FAQ items={faqs} title={t("peoplePromise.faq.title")} />
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                {t("peoplePromise.cta.title")}
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                {t("peoplePromise.cta.description")}
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/quote"
                  className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("peoplePromise.cta.primary")}
                </Link>
                <Link
                  href="/about"
                  className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("peoplePromise.cta.secondary")}
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <PromiseFooterNav current="people" />
      <Footer />
    </>
  );
}

function Commitment({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-orange transition">
      <p className="font-bold text-charcoal text-lg mb-2">{title}</p>
      <p className="text-gray-700 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function TimelineRow({
  time,
  description,
}: {
  time: string;
  description: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 p-5 bg-gray-100 rounded-xl">
      <p className="text-orange font-bold text-sm">{time}</p>
      <p className="text-gray-700 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
