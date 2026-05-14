import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { HeroRouteFinder } from "@/components/HeroRouteFinder";

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
        <section className="relative bg-charcoal text-white py-16 md:py-20 pb-12 md:pb-16 overflow-hidden">
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
                href="/price-promise"
                className="border border-white/60 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
              >
                {t("home.hero.ctaSecondary")}
              </Link>
            </div>

            {/* Hero Route Finder — type ZIPs + vehicle, see route context,
                then forward to /quote with everything pre-filled. This is
                now the hero's primary CTA path (the "Get my locked price"
                button used to live up here as a button; it now lives in
                the result panel inside this card, so the user sees route
                context BEFORE clicking through). */}
            <HeroRouteFinder />
          </Container>
        </section>

        {/* Triple Promise — V3d redesign with stat anchors + receipt panels.
            TODO (before production cutover): verify stat claims with Ben:
              - "$0 surprise upcharges, ever" — strongest claim, needs the strongest defense
              - "$500K cargo coverage" — confirmed by Ben May 13 (bond dropped, cargo only)
              - "1 named coordinator" — confirm operational reality */}
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
                stat={t("home.triplePromise.cards.price.stat")}
                statLabel={t("home.triplePromise.cards.price.statLabel")}
                eyebrow={t("home.triplePromise.cards.price.eyebrow")}
                headline={t("home.triplePromise.cards.price.headline")}
                conditionLine={t("home.triplePromise.cards.price.conditionLine")}
                consequenceLine={t("home.triplePromise.cards.price.consequenceLine")}
                cta={t("home.triplePromise.cards.price.cta")}
              />
              <PromiseCard
                href="/damage-promise"
                stat={t("home.triplePromise.cards.damage.stat")}
                statLabel={t("home.triplePromise.cards.damage.statLabel")}
                eyebrow={t("home.triplePromise.cards.damage.eyebrow")}
                headline={t("home.triplePromise.cards.damage.headline")}
                conditionLine={t("home.triplePromise.cards.damage.conditionLine")}
                consequenceLine={t("home.triplePromise.cards.damage.consequenceLine")}
                cta={t("home.triplePromise.cards.damage.cta")}
              />
              <PromiseCard
                href="/people-promise"
                stat={t("home.triplePromise.cards.people.stat")}
                statLabel={t("home.triplePromise.cards.people.statLabel")}
                eyebrow={t("home.triplePromise.cards.people.eyebrow")}
                headline={t("home.triplePromise.cards.people.headline")}
                conditionLine={t("home.triplePromise.cards.people.conditionLine")}
                consequenceLine={t("home.triplePromise.cards.people.consequenceLine")}
                cta={t("home.triplePromise.cards.people.cta")}
              />
            </div>
          </Container>
        </section>

                        {/* Services — V1A (orange-tinted featured + 2 supporting). Answers
            "will you ship MY car?" between Triple Promise (what we promise)
            and How It Works (the process). Mirror page at /services with
            more depth. Featured = Open Transport, supporting = Enclosed +
            Ocean Routes (HI/AK). Gray bg to break the white→white that
            would happen otherwise. */}
        <section className="py-20 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("home.services.eyebrow")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal max-w-2xl">
              {t("home.services.title")}
            </h2>
            <p className="text-gray-700 text-lg mt-4 max-w-2xl leading-relaxed">
              {t("home.services.lead")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-5 mt-12">
              {/* Featured: Open Transport */}
              <ServiceFeaturedCard
                badge={t("services.tiers.open.badge")}
                name={t("services.tiers.open.name")}
                headline={t("services.tiers.open.headline")}
                description={t("services.tiers.open.description")}
                features={[
                  t("services.tiers.open.feature1"),
                  t("services.tiers.open.feature2"),
                  t("services.tiers.open.feature3"),
                  t("services.tiers.open.feature4"),
                  t("services.tiers.open.feature5"),
                ]}
                ctaButton={t("services.tiers.open.ctaButton")}
                helper={t("services.tiers.open.helper")}
                ctaHref="/quote"
              />
              {/* Side stack: Enclosed + Ocean */}
              <div className="grid grid-rows-2 gap-5">
                <ServiceSideCard
                  iconKind="enclosed"
                  name={t("services.tiers.enclosed.name")}
                  description={t("services.tiers.enclosed.description")}
                  ctaButton={t("services.tiers.enclosed.ctaButton")}
                  ctaHref="/quote"
                />
                <ServiceSideCard
                  iconKind="ocean"
                  name={t("services.tiers.ocean.name")}
                  description={t("services.tiers.ocean.description")}
                  ctaButton={t("services.tiers.ocean.ctaButton")}
                  ctaHref="/corridors"
                />
              </div>
            </div>

            <div className="text-center mt-10">
              <Link
                href="/services"
                className="text-orange-dark font-semibold hover:underline"
              >
                {t("home.services.seeAllLink")}
              </Link>
            </div>
          </Container>
        </section>

        {/* How It Works — 3-step explainer. Now on WHITE bg after the Services
            section insertion cascade-flipped the rhythm (white→gray→white→
            gray→white→gray→orange). */}
        <section className="py-20 bg-white">
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
        <section className="py-20 bg-gray-100">
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

                {/* Behind the Promise — operational proof. Stat-led cards, each
            wholly clickable, linked to the relevant Promise page.
            TODO (before production cutover): verify stat claims with Ben:
              - "35-truck family fleet" — confirm number + add vetted-partner caveat
              - "45,000 vehicles in 2025" — confirm number
              - "$500K cargo coverage" — duplicate of Triple Promise, must match
              - "Native bilingual" — confirm + decide whether to name Renee */}
        <section className="py-20 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("home.behindThePromise.eyebrow")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal max-w-2xl">
              {t("home.behindThePromise.title")}
            </h2>
            <p className="text-gray-700 text-lg mt-4 max-w-2xl leading-relaxed">
              {t("home.behindThePromise.lead")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mt-12">
              <BehindCard
                tag={t("home.behindThePromise.stats.fleet.tag")}
                stat={t("home.behindThePromise.stats.fleet.stat")}
                title={t("home.behindThePromise.stats.fleet.title")}
                description={t("home.behindThePromise.stats.fleet.description")}
                linkText={t("home.behindThePromise.stats.fleet.linkText")}
                href="/people-promise"
              />
              <BehindCard
                tag={t("home.behindThePromise.stats.volume.tag")}
                stat={t("home.behindThePromise.stats.volume.stat")}
                title={t("home.behindThePromise.stats.volume.title")}
                description={t("home.behindThePromise.stats.volume.description")}
                linkText={t("home.behindThePromise.stats.volume.linkText")}
                href="/about"
              />
              <BehindCard
                tag={t("home.behindThePromise.stats.coverage.tag")}
                stat={t("home.behindThePromise.stats.coverage.stat")}
                title={t("home.behindThePromise.stats.coverage.title")}
                description={t("home.behindThePromise.stats.coverage.description")}
                linkText={t("home.behindThePromise.stats.coverage.linkText")}
                href="/damage-promise"
              />
              <BehindCard
                tag={t("home.behindThePromise.stats.bilingual.tag")}
                stat={t("home.behindThePromise.stats.bilingual.stat")}
                title={t("home.behindThePromise.stats.bilingual.title")}
                description={t("home.behindThePromise.stats.bilingual.description")}
                linkText={t("home.behindThePromise.stats.bilingual.linkText")}
                href="/people-promise"
              />
            </div>
          </Container>
        </section>

                {/* Anti-Scam Educator — V1b question-led. Each card is a question
            the consumer should ask any broker, plus the "Why ask it"
            (the scam this exposes) and "Honest answer sounds like" (what
            we'd say). Voice D / anti-scam. */}
        <section className="py-20 bg-gray-100">
          <Container>
            <span className="inline-flex items-center gap-2 text-amber-700 text-xs font-bold uppercase tracking-wider bg-amber-100 px-3 py-1.5 rounded-full mb-3">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              {t("home.antiScam.eyebrow")}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight max-w-3xl mt-2">
              {t("home.antiScam.title")}{" "}
              <span className="text-orange-dark">
                {t("home.antiScam.titleAccent")}
              </span>
            </h2>
            <p className="text-gray-700 text-lg mt-4 max-w-2xl leading-relaxed">
              {t("home.antiScam.lead")}
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
                question={t("home.antiScam.questions.reviews.question")}
                whyAskLabel={t("home.antiScam.whyAskLabel")}
                whyAsk={t("home.antiScam.questions.reviews.whyAsk")}
                honestAnswerLabel={t("home.antiScam.honestAnswerLabel")}
                honestAnswer={t("home.antiScam.questions.reviews.honestAnswer")}
              />
              <AntiScamCard
                num={3}
                question={t("home.antiScam.questions.deposit.question")}
                whyAskLabel={t("home.antiScam.whyAskLabel")}
                whyAsk={t("home.antiScam.questions.deposit.whyAsk")}
                honestAnswerLabel={t("home.antiScam.honestAnswerLabel")}
                honestAnswer={t("home.antiScam.questions.deposit.honestAnswer")}
              />
            </div>

            {/* Link to the full hub */}
            <div className="text-center mt-10">
              <Link
                href="/anti-scam"
                className="text-orange-dark font-semibold hover:underline"
              >
                {t("home.antiScam.hubLink")}
              </Link>
            </div>
          </Container>
        </section>

                {/* Final CTA — closes the page with a strong "Ready to lock a price?"
            beat. Charcoal hero card centered in a white section. The closer
            between Anti-Scam Educator (gray) and the Build banner (orange-tint).
            This fixes the "page ends with a construction notice and no closing
            pitch" issue identified in the homepage flow audit. */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <div className="bg-charcoal text-white rounded-3xl p-8 md:p-14 text-center">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                {t("home.finalCta.eyebrow")}
              </p>
              <h2 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl mx-auto">
                {t("home.finalCta.title")}
              </h2>
              <p className="text-lg text-gray-100 mt-5 max-w-2xl mx-auto leading-relaxed">
                {t("home.finalCta.lead")}
              </p>
              <Link
                href="/quote"
                className="inline-block mt-8 bg-orange hover:bg-orange-dark text-white font-bold text-base px-8 py-4 rounded-full transition shadow-lg shadow-orange/20"
              >
                {t("home.finalCta.button")} →
              </Link>
              <p className="text-sm text-gray-400 mt-6">
                {t("home.finalCta.trustLine")}
              </p>
            </div>
          </Container>
        </section>

        {/* Build status banner — REMOVE once homepage is fleshed out and we go live on autolinelogistics.com */}
        <section className="py-12 bg-orange-tint border-t border-orange/20">
          <Container>
            <p className="text-charcoal font-semibold mb-1">
              🚧 Build status — Phase A bootstrap (updated May 12, 2026)
            </p>
            <p className="text-gray-700 text-sm">
              Live: Triple Promise (V3d redesign with receipt panels), How It
              Works, Behind the Promise, Helpful Tools, Ship vs Drive Calculator
              (Phase A scope), California ↔ Hawaii and California ↔ Alaska
              corridors. Next up: Super Dispatch + Authorize.Net integrations,
              Anti-Scam Educator section, Tracking demo, remaining page
              wire-ups for ES.
            </p>
            <p className="text-gray-700 text-sm mt-2">
              <span className="font-semibold text-orange-dark">⚠ Pending owner verification before launch:</span>{" "}
              Triple Promise stats ($0 surprise upcharges · $500K cargo
              coverage · 1 named coordinator); Behind the Promise stats
              (35-truck fleet · 45,000 vehicles in 2025 · native bilingual).
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

function AntiScamCard({
  num,
  question,
  whyAskLabel,
  whyAsk,
  honestAnswerLabel,
  honestAnswer,
}: {
  num: 1 | 2 | 3;
  question: string;
  whyAskLabel: string;
  whyAsk: string;
  honestAnswerLabel: string;
  honestAnswer: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col">
      <div className="w-8 h-8 rounded-full bg-orange text-white text-sm font-bold flex items-center justify-center mb-4">
        {num}
      </div>
      <p className="text-charcoal font-bold text-base md:text-lg leading-snug mb-4">
        {question}
      </p>
      <div className="border-t border-dashed border-gray-300 my-1" />
      <div className="mt-3 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          {whyAskLabel}
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          {whyAsk}
        </p>
      </div>
      <div className="bg-emerald-50 border-l-[3px] border-emerald-700 rounded-r-lg px-3 py-2.5 mt-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
          {honestAnswerLabel}
        </p>
        <p className="text-sm text-charcoal font-semibold leading-relaxed">
          {honestAnswer}
        </p>
      </div>
    </div>
  );
}

function BehindCard({
  tag,
  stat,
  title,
  description,
  linkText,
  href,
}: {
  tag: string;
  stat: string;
  title: string;
  description: string;
  linkText: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-gray-200 border-l-4 border-l-gray-300 rounded-2xl p-6 md:p-7 flex flex-col gap-2 transition hover:border-l-orange hover:shadow-lg hover:-translate-y-0.5"
    >
      <span className="text-[11px] font-bold uppercase tracking-wider text-orange-dark">
        {tag}
      </span>
      <div className="text-3xl md:text-4xl font-extrabold text-charcoal leading-none tracking-tight my-1">
        {stat}
      </div>
      <h4 className="text-lg font-bold text-charcoal leading-snug">
        {title}
      </h4>
      <p className="text-gray-700 text-sm leading-relaxed flex-1">
        {description}
      </p>
      <div className="flex items-center justify-between mt-3">
        <span className="text-sm text-orange-dark font-semibold">
          {linkText}
        </span>
        <span className="w-7 h-7 rounded-full bg-gray-100 group-hover:bg-orange flex items-center justify-center text-gray-500 group-hover:text-white text-sm font-bold transition-all group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
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

function ServiceFeaturedCard({
  badge,
  name,
  headline,
  description,
  features,
  ctaButton,
  helper,
  ctaHref,
}: {
  badge: string;
  name: string;
  headline: string;
  description: string;
  features: string[];
  ctaButton: string;
  helper: string;
  ctaHref: string;
}) {
  return (
    <div className="relative bg-gradient-to-b from-orange-tint via-white to-white border-2 border-orange rounded-2xl p-7 md:p-8 shadow-[0_12px_32px_rgba(255,102,0,0.08)] flex flex-col gap-4">
      <span className="absolute -top-3 left-7 inline-block bg-orange text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
        {badge}
      </span>
      <div className="flex items-center gap-3 mt-1">
        <div className="w-12 h-12 rounded-xl bg-orange text-white flex items-center justify-center flex-shrink-0">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 17h2v-1h12v1h2v-7l-2.5-5.5h-11L3 10v7zm14-9h-1.5L17 11h-3v-3h2.5L18 5.5h-3V3H5.5L4 6.5V8h3v3H4v6h1v-1h14v1h.5z" />
          </svg>
        </div>
        <h3 className="text-2xl md:text-3xl font-bold text-charcoal leading-tight">
          {name}
        </h3>
      </div>
      <p className="text-charcoal font-semibold text-base md:text-lg leading-snug">
        {headline}
      </p>
      <p className="text-gray-700 text-sm md:text-base leading-relaxed">
        {description}
      </p>
      <ul className="flex flex-col gap-2 mt-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-charcoal">
            <span className="inline-flex items-center justify-center w-[18px] h-[18px] bg-orange text-white rounded-full text-[10px] font-bold flex-shrink-0 mt-0.5">
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
        <Link
          href={ctaHref}
          className="inline-flex items-center bg-orange hover:bg-orange-dark text-white text-sm font-bold px-5 py-2.5 rounded-full transition"
        >
          {ctaButton} →
        </Link>
        <span className="text-sm text-gray-500 italic">{helper}</span>
      </div>
    </div>
  );
}

function ServiceSideCard({
  iconKind,
  name,
  description,
  ctaButton,
  ctaHref,
}: {
  iconKind: "enclosed" | "ocean";
  name: string;
  description: string;
  ctaButton: string;
  ctaHref: string;
}) {
  const icon =
    iconKind === "enclosed" ? (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20 8h-3V4H3v13h2v-2h2v2h12V8z" />
      </svg>
    ) : (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20 21c-1.4 0-2.7-.7-3.5-1.7C15.7 20.3 14.4 21 13 21s-2.7-.7-3.5-1.7C8.7 20.3 7.4 21 6 21H2v-2h4c1.4 0 2.7-.6 3.5-1.5C10.3 18.4 11.6 19 13 19s2.7-.6 3.5-1.5C17.3 18.4 18.6 19 20 19h2v2h-2z" />
      </svg>
    );

  return (
    <Link
      href={ctaHref}
      className="group bg-white border border-gray-200 rounded-2xl p-5 md:p-6 flex flex-col gap-2.5 transition hover:border-orange hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-orange-tint text-orange-dark flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <h4 className="text-base md:text-lg font-bold text-charcoal leading-snug">
          {name}
        </h4>
      </div>
      <p className="text-gray-700 text-sm leading-relaxed flex-1">
        {description}
      </p>
      <span className="text-sm text-orange-dark font-semibold mt-1">
        {ctaButton} →
      </span>
    </Link>
  );
}

function PromiseCard({
  href,
  stat,
  statLabel,
  eyebrow,
  headline,
  conditionLine,
  consequenceLine,
  cta,
}: {
  href: string;
  stat: string;
  statLabel: string;
  eyebrow: string;
  headline: string;
  conditionLine: string;
  consequenceLine: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-gray-200 rounded-2xl p-6 md:p-7 flex flex-col transition hover:border-orange hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Stat anchor: huge number + label, divided from the rest */}
      <div className="flex items-end gap-3.5 pb-4 mb-4 border-b border-gray-200">
        <span className="text-4xl md:text-5xl font-extrabold text-orange-dark leading-none tracking-tight">
          {stat}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 pb-1 flex-1">
          {statLabel}
        </span>
      </div>

      {/* Promise name + headline */}
      <p className="text-orange text-[11px] font-bold uppercase tracking-wider mb-1.5">
        {eyebrow}
      </p>
      <h3 className="text-lg font-bold text-charcoal mb-3 leading-snug">
        {headline}
      </h3>

      {/* The receipt: If X… → Then Y */}
      <div className="border border-orange-tint rounded-xl p-3.5 mb-4">
        <p className="text-sm text-gray-700 italic mb-1.5 leading-snug">
          {conditionLine}
        </p>
        <p className="text-sm font-semibold text-orange-dark bg-orange-tint border-l-[3px] border-orange rounded px-3 py-1.5 leading-snug">
          → {consequenceLine}
        </p>
      </div>

      {/* CTA link */}
      <span className="text-sm text-orange-dark font-semibold mt-auto">
        {cta}
      </span>
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
