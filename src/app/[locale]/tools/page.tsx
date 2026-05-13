import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";

export const metadata: Metadata = {
  title: "Helpful tools — Auto Line Logistics",
  description:
    "Ship vs drive cost calculator, route price checker, price drop alerts, and a printable shipping checklist. Use what helps. No signup required.",
};

/**
 * /tools — index page for customer-facing utilities (§1 scoped).
 *
 * Cards link to each tool's dedicated route. "Coming soon" tools render as
 * non-interactive cards with a status chip. Live tools are clickable.
 *
 * Order of tools (matters for paid-ad targeting; high-intent first):
 *   1. Ship vs Drive Calculator   — live
 *   2. Route Price Checker        — coming-soon (blocks on SD/CD pricing)
 *   3. Price Drop Alerts          — coming-soon (blocks on email service)
 *   4. Shipping Checklist         — coming-soon (part of customer prep portal)
 */
type ToolKey =
  | "shipVsDrive"
  | "routePriceChecker"
  | "priceDropAlerts"
  | "shippingChecklist";

const TOOLS: ReadonlyArray<{
  key: ToolKey;
  href: "/tools/ship-vs-drive" | null;
  live: boolean;
}> = [
  { key: "shipVsDrive", href: "/tools/ship-vs-drive", live: true },
  { key: "routePriceChecker", href: null, live: false },
  { key: "priceDropAlerts", href: null, live: false },
  { key: "shippingChecklist", href: null, live: false },
];

export default function ToolsIndex() {
  const t = useTranslations();

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("tools.hero.eyebrow")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
              {t("tools.hero.title")}
            </h1>
            <p className="text-xl md:text-2xl text-gray-100 mt-4 max-w-2xl leading-relaxed">
              {t("tools.hero.description")}
            </p>
          </Container>
        </section>

        {/* Tool grid */}
        <section className="py-16 bg-white">
          <Container>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-10">
              {t("tools.cardsHeading")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {TOOLS.map(({ key, href, live }) => (
                <ToolCard
                  key={key}
                  title={t(`tools.cards.${key}.title`)}
                  summary={t(`tools.cards.${key}.summary`)}
                  href={href}
                  live={live}
                  liveLabel={t("tools.liveLabel")}
                  soonLabel={t("tools.comingSoonLabel")}
                  ctaLive={t("tools.cards.shipVsDrive.ctaLive")}
                />
              ))}
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                {t("tools.finalCta.title")}
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                {t("tools.finalCta.description")}
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/quote"
                  className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  {t("tools.finalCta.primary")}
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

function ToolCard({
  title,
  summary,
  href,
  live,
  liveLabel,
  soonLabel,
  ctaLive,
}: {
  title: string;
  summary: string;
  href: "/tools/ship-vs-drive" | null;
  live: boolean;
  liveLabel: string;
  soonLabel: string;
  ctaLive: string;
}) {
  const baseClass = live
    ? "bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-6 transition group cursor-pointer"
    : "bg-white border border-dashed border-gray-300 rounded-2xl p-6 opacity-80";

  const content = (
    <>
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${
            live
              ? "bg-orange-tint text-orange"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {live ? liveLabel : soonLabel}
        </span>
      </div>
      <h3
        className={`text-xl font-bold mb-2 ${
          live
            ? "text-charcoal group-hover:text-orange transition"
            : "text-gray-500"
        }`}
      >
        {title}
      </h3>
      <p className="text-gray-700 text-sm leading-relaxed">{summary}</p>
      {live && (
        <p className="text-orange font-semibold text-sm mt-4 group-hover:text-orange-dark">
          {ctaLive}
        </p>
      )}
    </>
  );

  if (live && href) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    );
  }

  return <div className={baseClass}>{content}</div>;
}
