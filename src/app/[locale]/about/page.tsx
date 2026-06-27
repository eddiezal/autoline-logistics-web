import type { Metadata } from "next";
import Image from "next/image";
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

/**
 * About page — voice C+D (Modern Trust Operator + Anti-Scam Educator).
 *
 * TODO — placeholders awaiting confirmation from Ben:
 *   - Founding year — confirmed 2011 May 13 staging review
 *   - MC#, DOT#, BMC-84 bond number + holder name
 *   - Team member names, titles, bios, headshots beyond Ben
 *   - Real customer testimonials (none reproduced — placeholder only)
 *   - Office address (work address, not home)
 */

export const metadata: Metadata = {
  title: "About Auto Line Logistics — family-owned auto transport",
  description:
    "Family-owned auto transport based in Southern California. Locked-price quotes, named coordinators, and coverage beyond the carrier — built for the way real customers ship cars.",
};

const TEAM_KEYS = ["ben", "coordinator", "dispatch"] as const;
const TEAM_PLACEHOLDER: Record<(typeof TEAM_KEYS)[number], boolean> = {
  ben: false,
  coordinator: true,
  dispatch: true,
};
const CRED_KEYS = ["mc", "dot", "bond", "cargo"] as const;
const CRED_PENDING: Record<(typeof CRED_KEYS)[number], boolean> = {
  mc: false,
  dot: false,
  bond: true,
  cargo: false,
};
const INDUSTRY_BULLETS = [0, 1, 2, 3, 4] as const;
const OURS_BULLETS = [0, 1, 2, 3, 4] as const;

export default function AboutPage() {
  const t = useTranslations();
  const faqs: FAQItem[] = [0, 1, 2, 3, 4, 5].map((i) => ({
    q: t(`about.faq.items.${i}.q`),
    a: t(`about.faq.items.${i}.a`),
  }));

  // Structured data: BreadcrumbList + FAQPage. Uses sync useLocale for the
  // locale-prefixed canonical URL (matches the corridor HI/AK pattern).
  const locale = useLocale();
  const localePath = locale === "es" ? "/es" : "";
  const canonicalUrl = `${SITE_URL}${localePath}/about`;
  const pageStructuredData = [
    breadcrumbSchema([
      { name: "Home", url: `${SITE_URL}${localePath}/` },
      { name: "About", url: canonicalUrl },
    ]),
    faqPageSchema(faqs),
  ];

  return (
    <>
      <StructuredData data={pageStructuredData} />
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-24">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("about.hero.eyebrow")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
              {t("about.hero.title")}
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-6 max-w-2xl leading-relaxed">
              {t("about.hero.description")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/quote"
                className="inline-block bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-6 py-3 rounded-full transition"
              >
                {t("about.hero.ctaPrimary")}
              </Link>
              <Link
                href="/contact"
                className="inline-block bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-full transition border border-white/20"
              >
                {t("about.hero.ctaSecondary")}
              </Link>
            </div>
          </Container>
        </section>

        {/* Build status callout */}
        <section className="py-6 bg-orange-tint border-b border-orange/30">
          <Container>
            <p className="text-charcoal text-sm">{t("about.buildStatus")}</p>
          </Container>
        </section>

        {/* Story */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 lg:gap-16 items-start">
              <div className="max-w-2xl">
                <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                  {t("about.story.eyebrow")}
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                  {t("about.story.title")}
                </h2>
                <div className="mt-6 space-y-5 text-gray-700 leading-relaxed text-lg">
                  <p>{t("about.story.body.0")}</p>
                  <p>{t("about.story.body.1")}</p>
                  <p>{t("about.story.body.2")}</p>
                </div>
              </div>

              <aside className="bg-gray-100 border border-gray-200 rounded-2xl p-6 overflow-hidden">
                {/* Contextual photo — negative margin makes it extend to the rounded edges of the card */}
                <div className="relative -mx-6 -mt-6 mb-6 aspect-[4/3]">
                  <Image
                    src="/photography/about-sidebar.webp"
                    alt="Auto Line car-hauler trucks loaded with vehicles, mountain backdrop"
                    fill
                    sizes="(max-width: 1024px) 100vw, 360px"
                    className="object-cover"
                  />
                </div>
                <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-4">
                  {t("about.story.sidebar.eyebrow")}
                </p>
                <dl className="space-y-5">
                  <div>
                    <dt className="text-3xl font-bold text-charcoal">
                      {t("about.story.sidebar.stats.family.amount")}
                    </dt>
                    <dd className="text-gray-700 text-sm mt-1">
                      {t("about.story.sidebar.stats.family.description")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-3xl font-bold text-charcoal">
                      {t("about.story.sidebar.stats.coverage.amount")}
                    </dt>
                    <dd className="text-gray-700 text-sm mt-1">
                      {t("about.story.sidebar.stats.coverage.description")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-3xl font-bold text-charcoal">
                      {t("about.story.sidebar.stats.usBased.amount")}
                    </dt>
                    <dd className="text-gray-700 text-sm mt-1">
                      {t("about.story.sidebar.stats.usBased.description")}
                    </dd>
                  </div>
                </dl>
                <p className="text-gray-500 text-xs mt-6 italic">
                  {t("about.story.sidebar.footnote")}
                </p>
              </aside>
            </div>
          </Container>
        </section>

        {/* Triple Promise tie-in */}
        <section className="py-16 md:py-20 bg-gray-100">
          <Container>
            <div className="max-w-2xl mb-10">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("about.promiseTieIn.eyebrow")}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                {t("about.promiseTieIn.title")}
              </h2>
              <p className="text-gray-700 text-lg mt-4 leading-relaxed">
                {t("about.promiseTieIn.description")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/price-promise"
                className="bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-6 transition group"
              >
                <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                  {t("about.promiseTieIn.cards.price.eyebrow")}
                </p>
                <p className="text-2xl font-bold text-charcoal group-hover:text-orange transition">
                  {t("about.promiseTieIn.cards.price.headline")}
                </p>
                <p className="text-gray-700 text-sm mt-3 leading-relaxed">
                  {t("about.promiseTieIn.cards.price.description")}
                </p>
              </Link>
              <Link
                href="/damage-promise"
                className="bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-6 transition group"
              >
                <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                  {t("about.promiseTieIn.cards.damage.eyebrow")}
                </p>
                <p className="text-2xl font-bold text-charcoal group-hover:text-orange transition">
                  {t("about.promiseTieIn.cards.damage.headline")}
                </p>
                <p className="text-gray-700 text-sm mt-3 leading-relaxed">
                  {t("about.promiseTieIn.cards.damage.description")}
                </p>
              </Link>
              <Link
                href="/people-promise"
                className="bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-6 transition group"
              >
                <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                  {t("about.promiseTieIn.cards.people.eyebrow")}
                </p>
                <p className="text-2xl font-bold text-charcoal group-hover:text-orange transition">
                  {t("about.promiseTieIn.cards.people.headline")}
                </p>
                <p className="text-gray-700 text-sm mt-3 leading-relaxed">
                  {t("about.promiseTieIn.cards.people.description")}
                </p>
              </Link>
            </div>
          </Container>
        </section>

        {/* Anti-scam educator section — voice D */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("about.antiScam.eyebrow")}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                {t("about.antiScam.title")}
              </h2>
              <p className="text-gray-700 text-lg mt-4 leading-relaxed">
                {t("about.antiScam.lead")}
              </p>

              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-100 border border-gray-200 rounded-2xl p-6">
                  <p className="text-charcoal/60 text-xs font-semibold uppercase tracking-wider mb-3">
                    {t("about.antiScam.industry.title")}
                  </p>
                  <ul className="space-y-3 text-gray-700 text-[0.95rem] leading-relaxed">
                    {INDUSTRY_BULLETS.map((i) => (
                      <li key={i}>{t(`about.antiScam.industry.items.${i}`)}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-orange-tint border border-orange/30 rounded-2xl p-6">
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-3">
                    {t("about.antiScam.ours.title")}
                  </p>
                  <ul className="space-y-3 text-gray-700 text-[0.95rem] leading-relaxed">
                    {OURS_BULLETS.map((i) => (
                      <li key={i}>{t(`about.antiScam.ours.items.${i}`)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* People — leadership + team */}
        <section className="py-16 md:py-20 bg-gray-100">
          <Container>
            <div className="max-w-2xl mb-10">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("about.team.eyebrow")}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                {t("about.team.title")}
              </h2>
              <p className="text-gray-700 text-lg mt-4 leading-relaxed">
                {t("about.team.description")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TEAM_KEYS.map((key) => (
                <TeamCard
                  key={key}
                  name={t(`about.team.members.${key}.name`)}
                  role={t(`about.team.members.${key}.role`)}
                  bio={t(`about.team.members.${key}.bio`)}
                  headshotLabel={t("about.team.labels.headshot")}
                  photoPendingLabel={t("about.team.labels.photoPending")}
                  placeholder={TEAM_PLACEHOLDER[key]}
                />
              ))}
            </div>

            <p className="text-gray-500 text-sm mt-8 italic max-w-2xl">
              {t("about.team.footnote")}
            </p>
          </Container>
        </section>

        {/* Credentials */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <div className="max-w-2xl mb-10">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("about.credentials.eyebrow")}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                {t("about.credentials.title")}
              </h2>
              <p className="text-gray-700 text-lg mt-4 leading-relaxed">
                {t("about.credentials.description")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {CRED_KEYS.map((key) => (
                <CredentialCard
                  key={key}
                  label={t(`about.credentials.cards.${key}.label`)}
                  value={t(`about.credentials.cards.${key}.value`)}
                  note={t(`about.credentials.cards.${key}.note`)}
                  pendingLabel={t("about.credentials.pendingLabel")}
                  pending={CRED_PENDING[key]}
                />
              ))}
            </div>

            <div className="mt-8 bg-gray-100 border border-gray-200 rounded-2xl p-6 text-sm text-gray-700 leading-relaxed">
              <strong className="text-charcoal">
                {t("about.credentials.verifyCallout.leadIn")}
              </strong>{" "}
              {t("about.credentials.verifyCallout.body")}{" "}
              <a
                href="https://safer.fmcsa.dot.gov/CompanySnapshot.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange font-semibold hover:underline"
              >
                {t("about.credentials.verifyCallout.linkText")}
              </a>
              {t("about.credentials.verifyCallout.afterLink")}
            </div>
          </Container>
        </section>

        {/* Reviews placeholder */}
        <section className="py-16 md:py-20 bg-gray-100">
          <Container>
            <div className="max-w-2xl mb-10">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("about.reviews.eyebrow")}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                {t("about.reviews.title")}
              </h2>
              <p className="text-gray-700 text-lg mt-4 leading-relaxed">
                {t("about.reviews.description")}
              </p>
            </div>

            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center max-w-2xl">
              <p className="text-gray-600 text-sm italic">
                {t("about.reviews.emptyState")}
              </p>
              <p className="text-gray-500 text-xs mt-3">
                {t("about.reviews.footnote")}
              </p>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <div className="max-w-3xl">
              <FAQ title={t("about.faq.title")} items={faqs} />
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 md:py-20 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-bold leading-tight">
                {t("about.cta.title")}
              </h2>
              <p className="text-gray-300 text-lg mt-4 leading-relaxed">
                {t("about.cta.description")}
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/quote"
                  className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("about.cta.primary")}
                </Link>
                <Link
                  href="/contact"
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-full transition border border-white/20"
                >
                  {t("about.cta.secondary")}
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

/* ────────────────────────────────────────────────────────────────────────── */

function TeamCard({
  name,
  role,
  bio,
  headshotLabel,
  photoPendingLabel,
  placeholder = false,
}: {
  name: string;
  role: string;
  bio: string;
  headshotLabel: string;
  photoPendingLabel: string;
  placeholder?: boolean;
}) {
  return (
    <article
      className={`bg-white border rounded-2xl p-6 ${
        placeholder ? "border-dashed border-gray-300" : "border-gray-200"
      }`}
    >
      <div
        className={`w-full aspect-[4/5] rounded-xl mb-5 flex items-center justify-center ${
          placeholder ? "bg-gray-100" : "bg-orange-tint"
        }`}
      >
        <span
          className={`text-sm uppercase tracking-wider font-semibold ${
            placeholder ? "text-gray-400" : "text-orange"
          }`}
        >
          {placeholder ? photoPendingLabel : headshotLabel}
        </span>
      </div>
      <p className="text-xl font-bold text-charcoal">{name}</p>
      <p className="text-orange font-semibold text-sm mt-1">{role}</p>
      <p className="text-gray-700 text-sm mt-3 leading-relaxed">{bio}</p>
    </article>
  );
}

function CredentialCard({
  label,
  value,
  note,
  pendingLabel,
  pending = false,
}: {
  label: string;
  value: string;
  note: string;
  pendingLabel: string;
  pending?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 border ${
        pending
          ? "bg-gray-100 border-dashed border-gray-300"
          : "bg-white border-gray-200"
      }`}
    >
      <p className="text-charcoal/60 text-xs font-semibold uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`text-2xl font-bold mt-2 ${
          pending ? "text-gray-400" : "text-charcoal"
        }`}
      >
        {value}
      </p>
      <p className="text-gray-700 text-xs mt-2 leading-relaxed">{note}</p>
      {pending && (
        <p className="text-orange text-[0.7rem] font-semibold uppercase tracking-wider mt-3">
          {pendingLabel}
        </p>
      )}
    </div>
  );
}
