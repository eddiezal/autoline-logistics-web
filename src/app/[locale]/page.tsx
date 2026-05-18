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
            {/* Hero layout — text left, Route Finder right at lg+; stacks
                vertically below lg. The 1.1fr / 1fr split gives the text
                slightly more room since headline + description is the more
                variable-length content. items-start keeps both columns
                anchored to the top so the card aligns with the title. */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 lg:gap-10 items-start">
              {/* Left column: inverted-hierarchy title + description + secondary CTA.
                  Promise-Forward layout (Option D, picked May 17, 2026): the orange
                  accent ("Sin sorpresas." / "No surprises.") leads at display scale;
                  the category descriptor ("Transporte de autos con precio fijo." /
                  "Locked-price auto transport.") sits beneath at sub-headline scale.
                  Eyebrow is dropped intentionally — the lead accent IS the brand
                  anchor. Single <h1> with block-level spans preserves SEO + a11y;
                  screen readers will read the accent first, then the descriptor. */}
              <div>
                <h1 className="leading-tight">
                  <span className="block text-orange text-6xl md:text-7xl lg:text-[84px] font-black leading-[0.95] tracking-[-0.035em] mb-4">
                    {t("home.hero.titleAccent")}
                  </span>
                  <span className="block text-2xl md:text-3xl font-bold leading-tight tracking-tight text-white">
                    {t.rich("home.hero.title", {
                      nobreak: (chunks) => <span className="whitespace-nowrap">{chunks}</span>,
                    })}
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-white mt-6 max-w-2xl">
                  {t("home.hero.description")}
                </p>
                <div className="flex flex-wrap gap-3 mt-8">
                  {/* Secondary CTA — outline by design. The Route Finder
                      card on the right carries the primary action; this
                      button is the education off-ramp for visitors who
                      aren't ready to enter ZIPs yet. Anchors to the
                      #how-it-works section on the same page (browser-native
                      smooth scroll via scroll-mt-16 on the target). Plain
                      <a> instead of next-intl Link because this is in-page
                      hash navigation, not route navigation. */}
                  <a
                    href="#how-it-works"
                    className="border-2 border-white hover:bg-white hover:text-charcoal text-white font-semibold px-7 py-3.5 rounded-full transition"
                  >
                    {t("home.hero.ctaSecondary")}
                  </a>
                </div>
              </div>

              {/* Right column: Hero Route Finder card. Type ZIPs + vehicle,
                  see route context, forward to /quote with everything
                  pre-filled. Primary conversion path. */}
              <div>
                <HeroRouteFinder />
              </div>
            </div>
          </Container>
        </section>

        {/* Trust Strip — thin compliance band between the dark hero and the
            white Triple Promise. Surfaces USDOT / MC / Bond + family-operated
            proof above the fold so first-time visitors see verifiable
            credibility BEFORE they hit our absolute trust claims. USDOT links
            to FMCSA SAFER so skeptics can verify in one click — that single
            outbound link does more for trust than 10 marketing claims would.
            Light gray (gray-100) bridges the dark→white visual transition
            without competing with either side. */}
        <section
          aria-label={t("home.trustStrip.ariaLabel")}
          className="bg-gray-100 border-y border-gray-200 py-3"
        >
          <Container>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12px] md:text-[13px] text-gray-700 font-medium">
              <a
                href={t("home.trustStrip.dotUrl")}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-orange-dark hover:underline transition"
                title={t("home.trustStrip.dotTitle")}
              >
                {t("home.trustStrip.items.dot")}
              </a>
              <span aria-hidden="true" className="text-gray-400">·</span>
              <span>{t("home.trustStrip.items.mc")}</span>
              <span aria-hidden="true" className="text-gray-400">·</span>
              <span>{t("home.trustStrip.items.bond")}</span>
              <span aria-hidden="true" className="text-gray-400">·</span>
              <span>{t("home.trustStrip.items.fleet")}</span>
            </div>
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
              {t.rich("home.triplePromise.title", {
                nobreak: (chunks) => (
                  <span className="whitespace-nowrap">{chunks}</span>
                ),
              })}
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
                clarifier={t("home.triplePromise.cards.price.clarifier")}
                cta={t("home.triplePromise.cards.price.cta")}
              />
              <PromiseCard
                href="/damage-promise"
                stat={t("home.triplePromise.cards.damage.stat")}
                statLabel={t("home.triplePromise.cards.damage.statLabel")}
                eyebrow={t("home.triplePromise.cards.damage.eyebrow")}
                headline={t.rich("home.triplePromise.cards.damage.headline", {
                  nobreak: (chunks) => (
                    <span className="whitespace-nowrap">{chunks}</span>
                  ),
                })}
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

        {/* Anti-Scam Teaser — small compact preview module that surfaces
            the brand's "honest guide" positioning above the fold-equivalent.
            Reviewer flagged the full anti-scam section as appearing too
            late in the page (~page 8 of the PDF). Rather than move the
            full section (which would push services + how-it-works down),
            we tease the 3 questions here and anchor down to the full
            section for the honest answers. Single source of truth — only
            the questions repeat, and that repetition is intentional (the
            teaser is the trailer, the full section is the payoff).
            Amber background signals "warning / things to watch out for"
            and breaks the white→gray rhythm between Triple Promise + Services. */}
        <section
          aria-label={t("home.antiScamTeaser.eyebrow")}
          className="py-14 bg-amber-50 border-y border-amber-200"
        >
          <Container>
            <div className="max-w-4xl mx-auto text-center">
              <span className="inline-flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider bg-amber-100 px-3 py-1.5 rounded-full mb-4">
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                </svg>
                {t("home.antiScamTeaser.eyebrow")}
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal leading-tight">
                {t("home.antiScamTeaser.title")}
              </h2>
              <p className="text-gray-700 text-base md:text-lg mt-3 leading-relaxed">
                {t("home.antiScamTeaser.lead")}
              </p>

              {/* D3 layout — Featured + 2 Supporting (asymmetric).
                  Question 1 is the most common scam (Lead-Gen Bait), so
                  it gets the bigger orange-bordered card with more scam
                  context. Questions 2 + 3 stack as supporting cards on
                  the right with the basics. Visual hierarchy signals
                  "if you read nothing else, read this one."
                  Mobile (< md): stacks vertically, featured first. */}
              <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-3.5 mt-7 text-left">
                <FeaturedScamCard
                  tag={t("home.antiScamTeaser.featuredTag")}
                  question={t("home.antiScamTeaser.questions.1.text")}
                  scamText={t("home.antiScamTeaser.questions.1.scamText")}
                />
                <div className="flex flex-col gap-3.5">
                  <SupportingScamCard
                    question={t("home.antiScamTeaser.questions.2.text")}
                    scamText={t("home.antiScamTeaser.questions.2.scamText")}
                  />
                  <SupportingScamCard
                    question={t("home.antiScamTeaser.questions.3.text")}
                    scamText={t("home.antiScamTeaser.questions.3.scamText")}
                  />
                </div>
              </div>

              {/* Button-styled link to the dedicated /anti-scam page where
                  the honest answers live. The full anti-scam section was
                  removed from the homepage (May 17, 2026) after recognizing
                  the question content was repeated across the site. One
                  source of homepage truth (this teaser); depth lives on
                  the dedicated page. Button styling (vs prior text link)
                  is part of the B3 typography refactor — the CTA earns
                  the orange-filled treatment because it's the actual
                  action, not whispery decoration. */}
              <Link
                href="/anti-scam"
                className="inline-flex items-center bg-orange hover:bg-orange-dark text-white font-bold text-sm md:text-base px-6 py-3 rounded-lg transition mt-7 shadow-md shadow-orange/20"
              >
                {t("home.antiScamTeaser.ctaText")}
              </Link>
            </div>
          </Container>
        </section>

        {/* Portal Preview — "After you book" section.
            Placement: directly between Anti-scam teaser and Services so that
            the Black Hole question in the teaser ("what if I don't hear from
            anyone for 3 days during transit?") gets its visual answer right
            below ("you're never in the dark — here's the portal you'll see
            after booking").
            White background breaks the amber→gray rhythm between teaser
            and services. Frame: anxiety relief, not feature list.
            Mockup is currently stylized inline HTML/CSS — when the actual
            portal UI is production-polished, swap to a real screenshot. */}
        <section className="bg-white py-16 md:py-20">
          <Container>
            <div className="max-w-3xl mx-auto text-center mb-12">
              <p className="text-orange text-xs font-bold uppercase tracking-[0.12em] mb-3">
                {t("home.portalPreview.eyebrow")}
              </p>
              <h2 className="text-3xl md:text-4xl lg:text-[42px] font-extrabold text-charcoal leading-[1.1] tracking-tight mb-3">
                {t("home.portalPreview.title")}
              </h2>
              <p className="text-base md:text-lg text-gray-700 leading-relaxed">
                {t("home.portalPreview.lead")}
              </p>
            </div>

            {/* 2-col grid: laptop mockup left, 3 callouts right. Stacks at lg- */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-10 lg:gap-14 items-center">
              <LaptopPortalMockup
                brand={t("home.portalPreview.mockup.brand")}
                shipmentId={t("home.portalPreview.mockup.shipmentId")}
                status={t("home.portalPreview.mockup.status")}
                pickupLabel={t("home.portalPreview.mockup.pickupLabel")}
                destLabel={t("home.portalPreview.mockup.destLabel")}
                etaLabel={t("home.portalPreview.mockup.etaLabel")}
                etaTime={t("home.portalPreview.mockup.etaTime")}
                etaSub={t("home.portalPreview.mockup.etaSub")}
                confidence={t("home.portalPreview.mockup.confidence")}
                photosLabel={t("home.portalPreview.mockup.photosLabel")}
                photosCount={t("home.portalPreview.mockup.photosCount")}
                coordName={t("home.portalPreview.mockup.coordName")}
                coordRole={t("home.portalPreview.mockup.coordRole")}
                messageBtn={t("home.portalPreview.mockup.messageBtn")}
              />

              <div className="flex flex-col gap-7">
                <PortalCallout
                  num={1}
                  title={t("home.portalPreview.callouts.1.title")}
                  text={t("home.portalPreview.callouts.1.text")}
                />
                <PortalCallout
                  num={2}
                  title={t("home.portalPreview.callouts.2.title")}
                  text={t("home.portalPreview.callouts.2.text")}
                />
                <PortalCallout
                  num={3}
                  title={t("home.portalPreview.callouts.3.title")}
                  text={t("home.portalPreview.callouts.3.text")}
                />
              </div>
            </div>

            {/* Bottom CTA — sends visitor BACK into the quote flow.
                Logic: they just saw what they get after booking → naturally
                primed to start booking. Different intent from the anti-scam
                teaser CTA above (which leads outward to /anti-scam). */}
            <div className="text-center mt-12">
              <Link
                href="/quote"
                className="inline-flex items-center bg-orange hover:bg-orange-dark text-white font-bold text-base px-7 py-3.5 rounded-xl transition shadow-md shadow-orange/20"
              >
                {t("home.portalPreview.cta")} →
              </Link>
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
            gray→white→gray→orange).
            id="how-it-works" is the anchor target for the hero "See how it
            works" secondary CTA — keeps the button's label honest. */}
        <section id="how-it-works" className="py-20 bg-white scroll-mt-16">
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

      </main>

      <Footer />
    </>
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
  statSize = "default",
  eyebrow,
  headline,
  conditionLine,
  consequenceLine,
  clarifier,
  cta,
}: {
  href: string;
  stat: string;
  statLabel: string;
  /** "large" bumps the stat font size — use for single-character stats
   *  like "1" so they don't visually disappear next to "$0" or "$500K". */
  statSize?: "default" | "large";
  eyebrow: string;
  /** Accepts ReactNode so callers can pass t.rich() output with nowrap
   *  spans for headline phrases that should not wrap mid-compound. */
  headline: React.ReactNode;
  conditionLine: string;
  consequenceLine: string;
  /** Optional small-print boundary line below the receipt. Names the
   *  conditions under which the promise applies, so skeptical consumers
   *  see the boundary BEFORE they leave the page and assume we're hiding
   *  it. First used on Price Promise (May 17, 2026) — Damage + People
   *  pending operational confirmation from Ben. */
  clarifier?: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-gray-200 rounded-2xl p-6 md:p-7 flex flex-col transition hover:border-orange hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Stat anchor: huge number + label, divided from the rest.
          statSize="large" bumps single-char stats so they visually
          match the weight of multi-char dollar stats. */}
      <div className="flex items-end gap-3.5 pb-4 mb-4 border-b border-gray-200">
        <span
          className={`font-extrabold text-orange-dark leading-none tracking-tight ${
            statSize === "large"
              ? "text-7xl md:text-8xl"
              : "text-4xl md:text-5xl"
          }`}
        >
          {stat}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 pb-1 flex-1">
          {statLabel}
        </span>
      </div>

      {/* Promise name + headline. Eyebrow is gray (not orange) so the
          orange stat above carries the color signal alone — reduces the
          per-card orange touchpoint count from 6 to 4. */}
      <p className="text-gray-500 text-[11px] font-bold uppercase tracking-wider mb-1.5">
        {eyebrow}
      </p>
      <h3 className="text-lg font-bold text-charcoal mb-3 leading-snug">
        {headline}
      </h3>

      {/* The receipt: If X… → Then Y.
          Condition is plain (not italic) — italic was reading as "footnote"
          when it should read as a setup beat. Consequence text is dark
          (charcoal); only the arrow stays orange, so the color carries
          the signal without flooding the card.
          md:min-h-[140px] keeps the three receipts visually aligned on
          desktop even when the condition copy is much shorter (e.g.,
          People card's "When you call..."). On mobile the cards stack
          so the min-height is unnecessary — only kicks in at md+. */}
      <div className="border border-orange-tint rounded-xl p-3.5 mb-4 md:min-h-[140px]">
        <p className="text-sm text-gray-700 mb-1.5 leading-snug">
          {conditionLine}
        </p>
        <p className="text-sm font-semibold text-charcoal bg-orange-tint border-l-[3px] border-orange rounded px-3 py-1.5 leading-snug">
          <span className="text-orange font-black mr-1">→</span>
          {consequenceLine}
        </p>
      </div>

      {/* Boundary clarifier — small italic gray line beneath the receipt.
          Names the conditions under which the promise actually applies.
          Italic intentionally signals "small print" — the only place on
          the card where we want that signal. Only renders if a clarifier
          is provided (Price has one; Damage + People pending Ben sign-off). */}
      {clarifier && (
        <p className="text-[11px] text-gray-500 italic leading-snug -mt-1 mb-3">
          {clarifier}
        </p>
      )}

      {/* CTA link */}
      <span className="text-sm text-orange-dark font-semibold mt-auto">
        {cta}
      </span>
    </Link>
  );
}

/** FeaturedScamCard — the big anchor card in the D3 teaser layout. Orange
 *  border + "Most common scam" tag draw the eye first. Question + scam
 *  description live as two stacked sections inside the card, separated by
 *  a thin amber rule (not a callout box, not a label) — type weight does
 *  the differentiation work.
 *
 *  Typography discipline (May 17, 2026 refactor — B3 in the variations):
 *   - "Ask this" / "The scam it exposes" labels DROPPED. The card already
 *     visually shows what each block is — labeling was redundant.
 *   - Question goes from italic+extrabold to italic+medium. Single
 *     emphasis tool (italic) reads as "spoken question" without doubling
 *     up with bold weight.
 *   - Amber callout box around scam REPLACED with a thin horizontal rule
 *     (border-t amber-200 + pt-3.5). Structure stays; decoration drops. */
function FeaturedScamCard({
  tag,
  question,
  scamText,
}: {
  tag: string;
  question: string;
  scamText: string;
}) {
  return (
    <div className="relative bg-white border-2 border-orange rounded-xl p-5 md:p-6 flex flex-col gap-3.5">
      {/* Orange tag floating above the top-left corner */}
      <span className="absolute -top-2.5 left-5 bg-orange text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded">
        {tag}
      </span>
      <p className="text-lg font-medium text-charcoal italic leading-snug">
        {question}
      </p>
      <p className="text-sm text-gray-700 leading-relaxed pt-3.5 border-t border-amber-200">
        {scamText}
      </p>
    </div>
  );
}

/** SupportingScamCard — smaller card for the secondary anti-scam questions
 *  in the D3 teaser layout. Same typography discipline as FeaturedScamCard:
 *  no "Also ask" label (redundant), italic-medium question (not bold),
 *  scam description separated by a thin amber rule (not stacked without
 *  structure). Two of these stack on the right of the FeaturedScamCard. */
function SupportingScamCard({
  question,
  scamText,
}: {
  question: string;
  scamText: string;
}) {
  return (
    <div className="bg-white border border-amber-200 rounded-lg p-4 flex-1">
      <p className="text-base font-medium text-charcoal italic leading-snug">
        {question}
      </p>
      <p className="text-xs text-gray-700 leading-relaxed pt-2.5 mt-2.5 border-t border-amber-200">
        {scamText}
      </p>
    </div>
  );
}

/** PortalCallout — numbered callout used in the Portal Preview section.
 *  Orange-tint number circle + bold title + supporting text. Numbered so
 *  the eye can map each callout to the device elements visible in the
 *  laptop mockup beside it. */
function PortalCallout({
  num,
  title,
  text,
}: {
  num: number;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="flex-shrink-0 w-9 h-9 bg-orange-tint text-orange-dark font-black text-sm rounded-full inline-flex items-center justify-center">
        {num}
      </span>
      <div>
        <p className="text-base md:text-lg font-extrabold text-charcoal mb-1 tracking-tight">
          {title}
        </p>
        <p className="text-sm md:text-base text-gray-700 leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}

/** LaptopPortalMockup — stylized "browser-in-laptop" mockup of the
 *  in-transit customer portal. Renders a static representation of:
 *    - Header (Auto Line brand · shipment ID · status pill)
 *    - Map area with pickup pin, animated truck location, destination pin
 *    - ETA card with confidence badge
 *    - Photo evidence grid (6 thumbnails — pickup + transit)
 *    - Coordinator card with avatar + Message action
 *  All labels driven by i18n props for full EN/ES coverage. The shipment
 *  ID, city names, date strings, and coordinator name are illustrative
 *  (translated minimally — names + IDs stay constant across locales).
 *  Production note: replace with a real portal screenshot once the
 *  in-transit UI is polished. */
function LaptopPortalMockup({
  brand,
  shipmentId,
  status,
  pickupLabel,
  destLabel,
  etaLabel,
  etaTime,
  etaSub,
  confidence,
  photosLabel,
  photosCount,
  coordName,
  coordRole,
  messageBtn,
}: {
  brand: string;
  shipmentId: string;
  status: string;
  pickupLabel: string;
  destLabel: string;
  etaLabel: string;
  etaTime: string;
  etaSub: string;
  confidence: string;
  photosLabel: string;
  photosCount: string;
  coordName: string;
  coordRole: string;
  messageBtn: string;
}) {
  return (
    <div className="relative">
      {/* Laptop frame — dark slab with portal mockup inside */}
      <div className="bg-[#1a1a1a] rounded-t-2xl rounded-b-sm p-2.5 shadow-2xl shadow-black/15">
        <div className="bg-[#fafafa] rounded-lg overflow-hidden">
          {/* Portal header */}
          <div className="bg-white border-b border-gray-200 px-3.5 py-2.5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-orange tracking-wider">
                {brand}
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-[10px] text-gray-700 font-mono">
                {shipmentId}
              </span>
            </div>
            <span className="bg-[#d1fae5] text-[#065f46] text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              ● {status}
            </span>
          </div>

          {/* Map area with pins + truck */}
          <div className="relative h-[130px] overflow-hidden"
               style={{
                 background:
                   "radial-gradient(ellipse at 30% 70%, rgba(180,220,200,0.5) 0%, transparent 50%), linear-gradient(135deg, #c8e6f0 0%, #a7c8d8 60%, #8eb1c2 100%)",
               }}>
            {/* Road */}
            <div
              className="absolute top-1/2 -left-[5%] -right-[5%] h-[5px] -translate-y-1/2"
              style={{
                background:
                  "repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0 14px, transparent 14px 22px)",
                transform: "rotate(-6deg) translateY(-2px)",
                boxShadow: "0 0 0 3px rgba(255,255,255,0.15)",
              }}
            />
            {/* Pickup pin */}
            <div className="absolute top-[68%] left-[14%] w-2.5 h-2.5 rounded-full bg-white border-[2.5px] border-orange shadow-sm" />
            <span className="absolute top-[calc(68%+14px)] left-2 bg-white text-charcoal text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-10">
              {pickupLabel}
            </span>
            {/* Truck */}
            <div className="absolute top-[38%] left-[55%] w-7 h-[18px] bg-orange rounded shadow-lg shadow-orange/45 z-[2]">
              <div className="absolute top-[3px] right-[3px] w-2 h-3 bg-white/40 rounded-sm" />
            </div>
            {/* Destination pin */}
            <div className="absolute top-[32%] right-[10%] w-2.5 h-2.5 rounded-full bg-white border-[2.5px] border-orange shadow-sm" />
            <span className="absolute top-[calc(32%-22px)] right-2 bg-white text-charcoal text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap z-10">
              {destLabel}
            </span>
          </div>

          {/* ETA section */}
          <div className="bg-white px-3.5 py-3 border-b border-gray-200 flex justify-between items-center">
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                {etaLabel}
              </p>
              <p className="text-[17px] font-extrabold text-charcoal leading-tight my-0.5 tracking-tight">
                {etaTime}
              </p>
              <p className="text-[10px] text-gray-500">{etaSub}</p>
            </div>
            <span className="bg-orange-tint text-orange-dark text-[10px] font-black px-2.5 py-1 rounded-md">
              {confidence}
            </span>
          </div>

          {/* Photo grid */}
          <div className="bg-white px-3.5 py-3 border-b border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-bold text-charcoal">
                {photosLabel}
              </span>
              <span className="text-[10px] text-gray-500">{photosCount}</span>
            </div>
            <div className="grid grid-cols-6 gap-[5px]">
              <div className="aspect-square rounded" style={{ background: "linear-gradient(135deg, #b8b8b8, #707070)" }} />
              <div className="aspect-square rounded" style={{ background: "linear-gradient(135deg, #404040, #1f1f1f)" }} />
              <div className="aspect-square rounded" style={{ background: "linear-gradient(135deg, #b8b8b8, #707070)" }} />
              <div className="aspect-square rounded" style={{ background: "linear-gradient(135deg, #8b6f47, #5a4830)" }} />
              <div className="aspect-square rounded" style={{ background: "linear-gradient(135deg, #8b6f47, #5a4830)" }} />
              <div className="aspect-square rounded" style={{ background: "linear-gradient(135deg, #8b6f47, #5a4830)" }} />
            </div>
          </div>

          {/* Coordinator card */}
          <div className="bg-white px-3.5 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange to-orange-dark text-white flex items-center justify-center text-sm font-black flex-shrink-0">
              D
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-charcoal">{coordName}</p>
              <p className="text-[10px] text-gray-500">{coordRole}</p>
            </div>
            <span className="text-[10px] font-bold text-orange-dark uppercase tracking-wider bg-orange-tint px-2.5 py-1.5 rounded-md">
              {messageBtn}
            </span>
          </div>
        </div>
      </div>
      {/* Laptop base — subtle dark slab below the screen for "laptop" silhouette */}
      <div
        className="h-2.5 -mx-6 mt-1.5 bg-gradient-to-b from-[#2d2d2d] to-[#1a1a1a]"
        style={{ borderRadius: "0 0 50% 50% / 0 0 100% 100%", transform: "scaleX(1.05)" }}
      />
    </div>
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
