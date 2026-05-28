import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { AntiScamCard } from "@/components/AntiScamCard";

/**
 * Anti-Scam Hub — destination page for the homepage's Anti-Scam Educator
 * section. Surfaces the three featured "questions to ask any broker" cards
 * in expanded form + a "Coming next" article queue (we publish monthly).
 *
 * The three featured cards reuse the same i18n strings as the homepage
 * (home.antiScam.questions.*) so copy stays consistent. Hub-specific copy
 * (hero, "coming next" articles, final CTA) lives under antiScamHub.*.
 */

export const metadata: Metadata = {
  title: "Anti-scam guide — Auto Line Logistics",
  description:
    "Three questions every customer should ask any broker before booking — plus monthly articles on the games brokers play.",
};

const ARTICLE_KEYS: ReadonlyArray<"1" | "2" | "3"> = ["1", "2", "3"];

export default function AntiScamHubPage() {
  const t = useTranslations();

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <span className="inline-flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider bg-amber-900/40 px-3 py-1.5 rounded-full mb-4">
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              {t("antiScamHub.hero.eyebrow")}
            </span>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
              {t("antiScamHub.hero.title")}{" "}
              <span className="text-orange">
                {t("antiScamHub.hero.titleAccent")}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-gray-100 mt-6 max-w-2xl leading-relaxed">
              {t("antiScamHub.hero.lead")}
            </p>
          </Container>
        </section>

        {/* ── Featured questions (reuses homepage's question content) ─── */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("antiScamHub.featured.eyebrow")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal max-w-3xl leading-tight">
              {t("antiScamHub.featured.title")}
            </h2>
            <p className="text-gray-700 text-lg mt-4 max-w-2xl leading-relaxed">
              {t("antiScamHub.featured.lead")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <AntiScamCard
                num={1}
                question={t("home.antiScam.questions.leadGen.question")}
                whyAskLabel={t("home.antiScam.whyAskLabel")}
                whyAsk={t("home.antiScam.questions.leadGen.whyAsk")}
                honestAnswerLabel={t("home.antiScam.honestAnswerLabel")}
                honestAnswer={t("home.antiScam.questions.leadGen.honestAnswer")}
              />
              <AntiScamCard
                num={2}
                question={t("home.antiScam.questions.carrier.question")}
                whyAskLabel={t("home.antiScam.whyAskLabel")}
                whyAsk={t("home.antiScam.questions.carrier.whyAsk")}
                honestAnswerLabel={t("home.antiScam.honestAnswerLabel")}
                honestAnswer={t("home.antiScam.questions.carrier.honestAnswer")}
              />
              <AntiScamCard
                num={3}
                question={t("home.antiScam.questions.transit.question")}
                whyAskLabel={t("home.antiScam.whyAskLabel")}
                whyAsk={t("home.antiScam.questions.transit.whyAsk")}
                honestAnswerLabel={t("home.antiScam.honestAnswerLabel")}
                honestAnswer={t("home.antiScam.questions.transit.honestAnswer")}
              />
            </div>
          </Container>
        </section>

        {/* ── Coming next: monthly article queue ───────────────────────── */}
        <section className="py-16 md:py-20 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("antiScamHub.coming.eyebrow")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal max-w-3xl leading-tight">
              {t("antiScamHub.coming.title")}
            </h2>
            <p className="text-gray-700 text-lg mt-4 max-w-2xl leading-relaxed">
              {t("antiScamHub.coming.lead")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              {ARTICLE_KEYS.map((k) => (
                <ComingArticleCard
                  key={k}
                  month={t(`antiScamHub.coming.articles.${k}.month`)}
                  tag={t(`antiScamHub.coming.articles.${k}.tag`)}
                  title={t(`antiScamHub.coming.articles.${k}.title`)}
                  summary={t(`antiScamHub.coming.articles.${k}.summary`)}
                  comingSoonLabel={t("antiScamHub.coming.comingSoonLabel")}
                />
              ))}
            </div>
          </Container>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <div className="bg-charcoal text-white rounded-3xl p-8 md:p-12 text-center">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("antiScamHub.cta.eyebrow")}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight max-w-2xl mx-auto">
                {t("antiScamHub.cta.title")}
              </h2>
              <p className="text-lg text-gray-100 mt-4 max-w-2xl mx-auto leading-relaxed">
                {t("antiScamHub.cta.lead")}
              </p>
              <Link
                href="/quote"
                className="inline-block mt-8 bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-7 py-3.5 rounded-full transition"
              >
                {t("antiScamHub.cta.button")} →
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}

// ── Coming article placeholder card ──────────────────────────────────────
function ComingArticleCard({
  month,
  tag,
  title,
  summary,
  comingSoonLabel,
}: {
  month: string;
  tag: string;
  title: string;
  summary: string;
  comingSoonLabel: string;
}) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-6 flex flex-col opacity-90">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-dark bg-orange-tint px-2.5 py-1 rounded-full">
          {tag}
        </span>
        <span className="text-[11px] font-semibold text-gray-500">
          {comingSoonLabel} {month}
        </span>
      </div>
      <h3 className="text-lg font-bold text-charcoal leading-snug mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-700 leading-relaxed flex-1">{summary}</p>
    </div>
  );
}
