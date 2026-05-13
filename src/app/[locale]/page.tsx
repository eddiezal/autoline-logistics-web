import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";

export default function Home() {
  const t = useTranslations();

  return (
    <>
      <Header />

      <main className="flex-1">
        {/*
          Hero — full-bleed photo background with a diagonal gradient overlay.
          - `min-h-[...]` enforces a consistent aspect ratio across viewports
            so object-cover doesn't crop the image inconsistently
          - Image rendered at full opacity; the overlay alone handles darkening
            (gives more control over where the photo "shows through")
          - `object-position` biased slightly right to keep the dominant truck +
            tree composition in the visible area when cropped
          - Gradient goes top-left → bottom-right (`to-br`) so the upper-left
            quadrant where the headline + description sit stays darkest, while
            the bottom-right (truck-cab area) breathes
          - Right edge fades into `to-black/15` (slightly cooler than charcoal)
            to neutralize the amber bleed from the warm streetlights
        */}
        <section className="relative bg-charcoal text-white py-20 md:py-28 min-h-[500px] md:min-h-[640px] overflow-hidden">
          {/* Background image */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/photography/hero-home.webp"
              alt="Auto Line car-hauler trucks on a snowy night"
              fill
              priority
              sizes="100vw"
              style={{ objectPosition: "65% center" }}
              className="object-cover"
            />
            {/* Diagonal gradient — heavy top-left for text legibility, light bottom-right so the image breathes. Right-edge bumped to `to-black/25` to calm the brightest streetlight clusters from competing with the orange CTA */}
            <div className="absolute inset-0 bg-gradient-to-br from-charcoal/95 via-charcoal/55 to-black/25" />
          </div>

          <Container className="relative z-10">
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-4">
              {t("home.hero.eyebrow")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
              {t("home.hero.title")}{" "}
              <span className="text-orange">{t("home.hero.titleAccent")}</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-100 mt-6 max-w-2xl">
              {t("home.hero.description")}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/quote"
                className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
              >
                {t("home.hero.ctaPrimary")}
              </Link>
              <Link
                href="/price-promise"
                className="border border-white/60 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
              >
                {t("home.hero.ctaSecondary")}
              </Link>
            </div>
          </Container>
        </section>

        {/* Triple Promise teaser */}
        <section className="py-20 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("home.triplePromise.eyebrow")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal max-w-2xl">
              {t("home.triplePromise.title")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <PromiseCard
                href="/price-promise"
                eyebrow={t("home.triplePromise.cards.price.eyebrow")}
                headline={t("home.triplePromise.cards.price.headline")}
                cta={t("home.triplePromise.cards.price.cta")}
              />
              <PromiseCard
                href="/damage-promise"
                eyebrow={t("home.triplePromise.cards.damage.eyebrow")}
                headline={t("home.triplePromise.cards.damage.headline")}
                cta={t("home.triplePromise.cards.damage.cta")}
              />
              <PromiseCard
                href="/people-promise"
                eyebrow={t("home.triplePromise.cards.people.eyebrow")}
                headline={t("home.triplePromise.cards.people.headline")}
                cta={t("home.triplePromise.cards.people.cta")}
              />
            </div>
          </Container>
        </section>

                {/* How It Works — 3-step explainer between promise and tools. Card-grid
            visual matches Triple Promise rhythm. Background gray-100 to break
            the white-white-gray stack of card grids. */}
        <section className="py-20 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("home.howItWorks.eyebrow")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal max-w-2xl">
              {t("home.howItWorks.title")}
            </h2>
            <p className="text-gray-700 text-lg mt-4 max-w-2xl leading-relaxed">
              {t("home.howItWorks.lead")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <HowItWorksCard
                num={1}
                label={t("home.howItWorks.steps.lock.label")}
                title={t("home.howItWorks.steps.lock.title")}
                description={t("home.howItWorks.steps.lock.description")}
                proof1={t("home.howItWorks.steps.lock.proof1")}
                proof2={t("home.howItWorks.steps.lock.proof2")}
              />
              <HowItWorksCard
                num={2}
                label={t("home.howItWorks.steps.pickup.label")}
                title={t("home.howItWorks.steps.pickup.title")}
                description={t("home.howItWorks.steps.pickup.description")}
                proof1={t("home.howItWorks.steps.pickup.proof1")}
                proof2={t("home.howItWorks.steps.pickup.proof2")}
              />
              <HowItWorksCard
                num={3}
                label={t("home.howItWorks.steps.track.label")}
                title={t("home.howItWorks.steps.track.title")}
                description={t("home.howItWorks.steps.track.description")}
                proof1={t("home.howItWorks.steps.track.proof1")}
                proof2={t("home.howItWorks.steps.track.proof2")}
              />
            </div>
          </Container>
        </section>

        {/* Helpful Tools section — surfaces the customer-facing utilities (§1 scoped). Drives ad traffic + adds visual depth. */}
        <section className="py-20 bg-white">
          <Container>
            <div className="max-w-2xl mb-10">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("helpfulTools.eyebrow")}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                {t("helpfulTools.title")}
              </h2>
              <p className="text-gray-700 text-lg mt-4 leading-relaxed">
                {t("helpfulTools.description")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ToolTeaser
                title={t("tools.cards.shipVsDrive.title")}
                summary={t("tools.cards.shipVsDrive.summary")}
                href="/tools/ship-vs-drive"
                live
                liveLabel={t("tools.liveLabel")}
                soonLabel={t("tools.comingSoonLabel")}
              />
              <ToolTeaser
                title={t("tools.cards.routePriceChecker.title")}
                summary={t("tools.cards.routePriceChecker.summary")}
                live={false}
                liveLabel={t("tools.liveLabel")}
                soonLabel={t("tools.comingSoonLabel")}
              />
              <ToolTeaser
                title={t("tools.cards.priceDropAlerts.title")}
                summary={t("tools.cards.priceDropAlerts.summary")}
                live={false}
                liveLabel={t("tools.liveLabel")}
                soonLabel={t("tools.comingSoonLabel")}
              />
              <ToolTeaser
                title={t("tools.cards.shippingChecklist.title")}
                summary={t("tools.cards.shippingChecklist.summary")}
                live={false}
                liveLabel={t("tools.liveLabel")}
                soonLabel={t("tools.comingSoonLabel")}
              />
            </div>

            <div className="mt-10">
              <Link
                href="/tools"
                className="inline-block text-orange font-semibold hover:text-orange-dark transition"
              >
                {t("helpfulTools.ctaAll")}
              </Link>
            </div>
          </Container>
        </section>

        {/* Build status banner — REMOVE once homepage is fleshed out and we go live on autolinelogistics.com */}
        <section className="py-12 bg-orange-tint border-t border-orange/20">
          <Container>
            <p className="text-charcoal font-semibold mb-1">
              🚧 Build status — Phase A bootstrap (updated May 9, 2026)
            </p>
            <p className="text-gray-700 text-sm">
              Live: Triple Promise pages, California ↔ Hawaii corridor,
              California ↔ Alaska corridor, corridor index, About page,
              quote intake form, EN/ES locale infrastructure (home page
              wired — other pages migrating in Phase 2). Next up: Super
              Dispatch + Authorize.Net integrations, server hardening
              (Sentry, hCaptcha), remaining page wire-ups for ES.
              Production cutover to{" "}
              <span className="font-semibold">autolinelogistics.com</span>{" "}
              target: end of Phase A.
            </p>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}

function HowItWorksCard({
  num,
  label,
  title,
  description,
  proof1,
  proof2,
}: {
  num: 1 | 2 | 3;
  label: string;
  title: string;
  description: string;
  proof1: string;
  proof2: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-7 transition hover:border-orange hover:shadow-lg flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-orange-tint text-orange-dark font-bold flex items-center justify-center">
          {num}
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
          {label}
        </span>
      </div>
      <h3 className="text-xl font-bold text-charcoal mb-3 leading-snug">
        {title}
      </h3>
      <p className="text-gray-700 text-sm md:text-base leading-relaxed flex-1">
        {description}
      </p>
      <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-dashed border-gray-200">
        <ProofPill>{proof1}</ProofPill>
        <ProofPill>{proof2}</ProofPill>
      </div>
    </div>
  );
}

function ProofPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-xs font-medium text-charcoal">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 bg-orange text-white rounded-full text-[9px] font-bold">
        ✓
      </span>
      {children}
    </span>
  );
}

function PromiseCard({
  href,
  eyebrow,
  headline,
  cta,
}: {
  href: string;
  eyebrow: string;
  headline: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group block border border-gray-200 rounded-2xl p-6 hover:border-orange hover:shadow-lg transition"
    >
      <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
        {eyebrow}
      </p>
      <h3 className="text-xl font-bold text-charcoal mb-4 leading-snug">
        {headline}
      </h3>
      <p className="text-orange font-semibold text-sm group-hover:text-orange-dark">
        {cta}
      </p>
    </Link>
  );
}

function ToolTeaser({
  title,
  summary,
  href,
  live,
  liveLabel,
  soonLabel,
}: {
  title: string;
  summary: string;
  href?: "/tools/ship-vs-drive";
  live: boolean;
  liveLabel: string;
  soonLabel: string;
}) {
  const baseClass = live
    ? "bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-5 transition group cursor-pointer block"
    : "bg-white border border-dashed border-gray-300 rounded-2xl p-5 opacity-80 block";

  const content = (
    <>
      <span
        className={`inline-block text-[0.65rem] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mb-3 ${
          live ? "bg-orange-tint text-orange" : "bg-gray-100 text-gray-600"
        }`}
      >
        {live ? liveLabel : soonLabel}
      </span>
      <p
        className={`font-bold text-base leading-snug mb-2 ${
          live
            ? "text-charcoal group-hover:text-orange transition"
            : "text-gray-500"
        }`}
      >
        {title}
      </p>
      <p className="text-gray-700 text-sm leading-relaxed">{summary}</p>
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
