import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { QuoteForm } from "@/components/QuoteForm";

export const metadata: Metadata = {
  title: "Get a locked price — Auto Line Logistics",
  description:
    "Tell us your origin, destination, and vehicle. Your coordinator will lock in a price within 1 business hour. No bait-and-switch. The quote is the contract.",
};

// Next 15+/16 pattern: searchParams is a Promise that must be awaited
export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const fromCode = (params.from ?? "").toUpperCase();
  const toCode = (params.to ?? "").toUpperCase();
  return <QuoteContent fromCode={fromCode} toCode={toCode} />;
}

function QuoteContent({ fromCode, toCode }: { fromCode: string; toCode: string }) {
  const t = useTranslations();
  const fromLabel = fromCode ? safeT(t, `quote.states.${fromCode}`) : "";
  const toLabel = toCode ? safeT(t, `quote.states.${toCode}`) : "";

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("quote.hero.eyebrow")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              {fromLabel && toLabel
                ? `${fromLabel} → ${toLabel}`
                : t("quote.hero.titleDefault")}
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              {t("quote.hero.description")}
            </p>
          </Container>
        </section>

        {/* Build status callout */}
        <section className="py-6 bg-orange-tint border-b border-orange/30">
          <Container>
            <p className="text-charcoal text-sm">{t("quote.buildStatus")}</p>
          </Container>
        </section>

        {/* Form */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-2xl">
              <QuoteForm fromCode={fromCode} toCode={toCode} />
            </div>
          </Container>
        </section>

        {/* Reassurance */}
        <section className="py-12 bg-gray-100">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Reassure
                title={t("quote.reassurance.cards.contract.title")}
                href="/price-promise"
                detail={t("quote.reassurance.cards.contract.detail")}
                backedBy={t("quote.reassurance.backedBy")}
              />
              <Reassure
                title={t("quote.reassurance.cards.coverage.title")}
                href="/damage-promise"
                detail={t("quote.reassurance.cards.coverage.detail")}
                backedBy={t("quote.reassurance.backedBy")}
              />
              <Reassure
                title={t("quote.reassurance.cards.named.title")}
                href="/people-promise"
                detail={t("quote.reassurance.cards.named.detail")}
                backedBy={t("quote.reassurance.backedBy")}
              />
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}

// safeT — try to read a key, fall back to empty string if missing.
// Two failure modes to handle:
// 1. Dev mode: next-intl throws on missing key (caught by try/catch).
// 2. Prod mode: next-intl returns the raw key as fallback (NOT thrown).
//    We detect this by comparing the result to the key itself.
// Bug observed 2026-06-19: /quote?from=90217&to=33126 (ZIP codes, not
// state codes) was rendering "quote.states.90217 → quote.states.33126"
// in the headline. Calculator/Hero CTAs pass ZIPs here; the quote page
// expects state codes. Until that's fixed upstream, this prevents the
// raw key from leaking into the UI.
function safeT(t: ReturnType<typeof useTranslations>, key: string): string {
  try {
    const value = t(key);
    return value === key ? "" : value;
  } catch {
    return "";
  }
}

function Reassure({
  title,
  href,
  detail,
  backedBy,
}: {
  title: string;
  href: "/price-promise" | "/damage-promise" | "/people-promise";
  detail: string;
  backedBy: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
    >
      <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
        {backedBy}
      </p>
      <p className="font-bold text-charcoal text-lg group-hover:text-orange transition">
        {title} →
      </p>
      <p className="text-gray-700 text-sm mt-2 leading-relaxed">{detail}</p>
    </Link>
  );
}
