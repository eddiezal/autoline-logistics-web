import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";

/**
 * /resources — hub page for educational content.
 *
 * Created May 17, 2026 in response to Ben's "only 5 pages" comment.
 * The site actually has 17+ routes but the navbar showed 5; this page
 * + the Resources nav link surface the depth without bloating the nav.
 *
 * Layout 1 (Equal 3-card grid):
 *   - Hero: centered title + lead
 *   - 3 peer cards: Anti-scam guide / Ship vs Drive / All tools
 *   - Coming-soon strip: 3 article previews + email capture
 *
 * Evolutionary path:
 *   - When content grows past 5 resources, switch to Layout 3
 *     (list/index style) in place — no navbar change needed.
 *   - When you want hover-preview polish, upgrade Nav A → Nav C
 *     (clickable + dropdown) in place — no page change needed.
 *   - Both paths are non-destructive.
 *
 * Email capture is currently a non-functional form (sends nowhere).
 * Wire to Resend (or similar) once Ben provisions service accounts —
 * see open action item: [Eddie] Provision service accounts.
 */
export const metadata: Metadata = {
  title: "Resources — Auto Line Logistics",
  description:
    "Honest tools and guides for anyone shipping a car. Anti-scam guide, calculators, and monthly articles on the broker industry.",
};

export default function ResourcesPage() {
  const t = useTranslations();

  return (
    <>
      <Header />
      <main className="bg-white">
        {/* Hero */}
        <section className="py-16 md:py-20">
          <Container>
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-orange text-xs font-bold uppercase tracking-[0.12em] mb-3">
                {t("resources.hero.eyebrow")}
              </p>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-charcoal leading-[1.1] tracking-tight mb-4">
                {t("resources.hero.title")}
              </h1>
              <p className="text-base md:text-lg text-gray-700 leading-relaxed">
                {t("resources.hero.lead")}
              </p>
            </div>
          </Container>
        </section>

        {/* 3-card grid — live resources today */}
        <section className="pb-16 md:pb-20">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
              <ResourceCard
                href="/anti-scam"
                eyebrow={t("resources.cards.antiScam.eyebrow")}
                icon="⚠"
                title={t("resources.cards.antiScam.title")}
                description={t("resources.cards.antiScam.description")}
                cta={t("resources.cards.antiScam.cta")}
              />
              <ResourceCard
                href="/tools/ship-vs-drive"
                eyebrow={t("resources.cards.shipVsDrive.eyebrow")}
                icon="🧮"
                title={t("resources.cards.shipVsDrive.title")}
                description={t("resources.cards.shipVsDrive.description")}
                cta={t("resources.cards.shipVsDrive.cta")}
              />
              <ResourceCard
                href="/tools"
                eyebrow={t("resources.cards.allTools.eyebrow")}
                icon="🛠"
                title={t("resources.cards.allTools.title")}
                description={t("resources.cards.allTools.description")}
                cta={t("resources.cards.allTools.cta")}
              />
            </div>
          </Container>
        </section>

        {/* Coming-soon strip — 3 article previews + email capture.
            Amber background signals "this is upcoming content."
            The email form is currently non-functional (no backend wired);
            wire to Resend or similar once service accounts land. */}
        <section className="pb-20 md:pb-24">
          <Container>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-6 md:gap-8 items-center">
              <div>
                <p className="text-amber-800 text-xs font-extrabold uppercase tracking-[0.1em] mb-2">
                  {t("resources.comingSoon.eyebrow")}
                </p>
                <h2 className="text-xl md:text-2xl font-extrabold text-charcoal mb-4 leading-tight tracking-tight">
                  {t("resources.comingSoon.title")}
                </h2>
                <ul className="space-y-2 text-sm md:text-base text-gray-700 leading-relaxed">
                  <li>
                    <span className="font-bold text-charcoal">
                      {t("resources.comingSoon.articles.1.month")}:
                    </span>{" "}
                    {t("resources.comingSoon.articles.1.title")}
                  </li>
                  <li>
                    <span className="font-bold text-charcoal">
                      {t("resources.comingSoon.articles.2.month")}:
                    </span>{" "}
                    {t("resources.comingSoon.articles.2.title")}
                  </li>
                  <li>
                    <span className="font-bold text-charcoal">
                      {t("resources.comingSoon.articles.3.month")}:
                    </span>{" "}
                    {t("resources.comingSoon.articles.3.title")}
                  </li>
                </ul>
              </div>
              <div>
                <label
                  htmlFor="resources-notify-email"
                  className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-700 mb-2"
                >
                  {t("resources.comingSoon.ctaLabel")}
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    id="resources-notify-email"
                    type="email"
                    placeholder={t("resources.comingSoon.emailPlaceholder")}
                    className="px-3.5 py-3 border border-gray-300 rounded-lg bg-white text-charcoal text-sm focus:outline-2 focus:outline-orange focus:border-orange"
                  />
                  <button
                    type="button"
                    className="bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold text-sm px-5 py-3 rounded-lg transition"
                  >
                    {t("resources.comingSoon.ctaButton")}
                  </button>
                  <p className="text-[11px] text-gray-500 italic leading-snug mt-1">
                    {t("resources.comingSoon.ctaFootnote")}
                  </p>
                </div>
              </div>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

/** ResourceCard — peer card for the /resources page 3-grid. Each card
 *  represents one live resource: eyebrow chip + emoji icon + title +
 *  description + cta link. Whole card is clickable (wrapping Link). */
function ResourceCard({
  href,
  eyebrow,
  icon,
  title,
  description,
  cta,
}: {
  href: "/anti-scam" | "/tools" | "/tools/ship-vs-drive";
  eyebrow: string;
  icon: string;
  title: string;
  description: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-3 transition hover:border-orange hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-2">
        <span
          className="text-lg leading-none"
          role="img"
          aria-label={eyebrow}
        >
          {icon}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-orange-dark">
          {eyebrow}
        </span>
      </div>
      <h2 className="text-lg md:text-xl font-extrabold text-charcoal leading-tight tracking-tight">
        {title}
      </h2>
      <p className="text-sm text-gray-700 leading-relaxed flex-1">
        {description}
      </p>
      <span className="text-sm font-bold text-orange-dark group-hover:underline mt-1">
        {cta}
      </span>
    </Link>
  );
}
