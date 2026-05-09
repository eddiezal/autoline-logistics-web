import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ, type FAQItem } from "@/components/FAQ";
import { PromiseFooterNav } from "@/components/PromiseFooterNav";

export const metadata: Metadata = {
  title: "Damage Promise — Coverage beyond the carrier",
  description:
    "$75K bond. $500K contingent cargo liability. 24-hour claim acknowledgment. 14-day resolution target. We handle the carrier so you don't have to.",
};

// Scenario "covered" status is structural (not translatable copy) — kept here
// to avoid trying to read booleans through t().
const SCENARIOS: ReadonlyArray<{ key: string; covered: boolean }> = [
  { key: "doorDing", covered: true },
  { key: "theft", covered: true },
  { key: "tireDebris", covered: false },
  { key: "weather", covered: false },
  { key: "mechanical", covered: true },
];

export default function DamagePromisePage() {
  const t = useTranslations();
  const faqs: FAQItem[] = [0, 1, 2, 3, 4, 5].map((i) => ({
    q: t(`damagePromise.faq.items.${i}.q`),
    a: t(`damagePromise.faq.items.${i}.a`),
  }));

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("common.promiseEyebrow.2")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              {t("damagePromise.hero.title")}
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              {t("damagePromise.hero.subtitle")}
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
                {t("damagePromise.antiPattern.title")}
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>{t("damagePromise.antiPattern.body.0")}</p>
                <p>{t("damagePromise.antiPattern.body.1")}</p>
                <p className="font-semibold text-charcoal">
                  {t("damagePromise.antiPattern.punchline")}
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Coverage stats */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("damagePromise.coverage.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              {t("damagePromise.coverage.title")}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <CoverageStat
                amount={t("damagePromise.coverage.stats.bond.amount")}
                label={t("damagePromise.coverage.stats.bond.label")}
                description={t("damagePromise.coverage.stats.bond.description")}
              />
              <CoverageStat
                amount={t("damagePromise.coverage.stats.contingent.amount")}
                label={t("damagePromise.coverage.stats.contingent.label")}
                description={t("damagePromise.coverage.stats.contingent.description")}
              />
              <CoverageStat
                amount={t("damagePromise.coverage.stats.ack.amount")}
                label={t("damagePromise.coverage.stats.ack.label")}
                description={t("damagePromise.coverage.stats.ack.description")}
              />
              <CoverageStat
                amount={t("damagePromise.coverage.stats.resolution.amount")}
                label={t("damagePromise.coverage.stats.resolution.label")}
                description={t("damagePromise.coverage.stats.resolution.description")}
              />
            </div>
          </Container>
        </section>

        {/* Common scenarios */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("damagePromise.scenarios.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              {t("damagePromise.scenarios.title")}
            </h2>

            <div className="space-y-6">
              {SCENARIOS.map(({ key, covered }) => (
                <Scenario
                  key={key}
                  title={t(`damagePromise.scenarios.items.${key}.title`)}
                  detail={t(`damagePromise.scenarios.items.${key}.detail`)}
                  covered={covered}
                  coveredLabel={t("common.labels.covered")}
                  notCoveredLabel={t("common.labels.notCovered")}
                />
              ))}
            </div>
          </Container>
        </section>

        {/* Claim process */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("damagePromise.steps.eyebrow")}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              {t("damagePromise.steps.title")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(["1", "2", "3"] as const).map((n) => (
                <Step
                  key={n}
                  number={t(`damagePromise.steps.items.${n}.number`)}
                  title={t(`damagePromise.steps.items.${n}.title`)}
                  detail={t(`damagePromise.steps.items.${n}.detail`)}
                />
              ))}
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-white">
          <Container>
            <FAQ items={faqs} title={t("damagePromise.faq.title")} />
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                {t("damagePromise.cta.title")}
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                {t("damagePromise.cta.description")}
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/quote"
                  className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("damagePromise.cta.primary")}
                </Link>
                <Link
                  href="/people-promise"
                  className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("damagePromise.cta.secondary")}
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <PromiseFooterNav current="damage" />
      <Footer />
    </>
  );
}

function CoverageStat({
  amount,
  label,
  description,
}: {
  amount: string;
  label: string;
  description: string;
}) {
  return (
    <div className="bg-white border-l-4 border-orange p-6 rounded-r-xl">
      <p className="text-3xl md:text-4xl font-bold text-charcoal">{amount}</p>
      <p className="text-charcoal font-semibold text-sm mt-2">{label}</p>
      <p className="text-gray-700 text-sm mt-2 leading-relaxed">{description}</p>
    </div>
  );
}

function Scenario({
  title,
  detail,
  covered,
  coveredLabel,
  notCoveredLabel,
}: {
  title: string;
  detail: string;
  covered: boolean;
  coveredLabel: string;
  notCoveredLabel: string;
}) {
  return (
    <div className="flex items-start gap-4 p-5 bg-gray-100 rounded-xl">
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold flex-shrink-0 mt-0.5 ${
          covered ? "bg-success text-white" : "bg-gray-300 text-charcoal"
        }`}
        aria-label={covered ? coveredLabel : notCoveredLabel}
      >
        {covered ? "✓" : "—"}
      </span>
      <div>
        <p className="font-semibold text-charcoal">{title}</p>
        <p className="text-gray-700 text-sm mt-1 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200">
      <p className="text-orange text-3xl font-bold">{number}</p>
      <p className="text-charcoal font-bold text-lg mt-2">{title}</p>
      <p className="text-gray-700 text-sm mt-2 leading-relaxed">{detail}</p>
    </div>
  );
}
