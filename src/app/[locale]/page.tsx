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
        {/* Hero — premium logistics command-center treatment (rebuild May 17 PM).
            Two-line H1 at equal scale (was Option D's inverted hierarchy in
            the morning pass — replaced after a stronger external creative
            direction landed). Adds: badge above headline, 4 proof chips
            below subhead, primary filled + secondary outline CTAs, stats
            row, floating shipment + locked-price proof cards on desktop.
            Heavier gradient overlay so the truck photo breathes more
            (was muted in the previous pass; new direction wants more
            cinematic drama).
            Background image: /public/photography/hero-home.webp — same
            asset, just less opacity-blocked. */}
        <section className="relative bg-neutral-950 text-white overflow-hidden">
          {/* Background image + PINE-TINTED gradient overlays.
              Restored to match green-finalize-operator.html (the demo Eddie
              signed off on) — May 22, 2026. The prior pure-black gradients
              (from-black via-black/75 to-black/35) crushed the dusk-carrier
              photo to near-black on the live build. Pine-tinted rgba(10,30,20)
              at lighter weights keeps text legible on the left while letting
              the lit truck cab reveal on the right. Image unchanged. */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/photography/hero-night.png"
              alt="Auto Line car-hauler truck loaded with vehicles on the open road"
              fill
              priority
              sizes="100vw"
              style={{ objectPosition: "center center" }}
              className="object-cover opacity-80"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to right, rgba(10,30,20,0.92), rgba(10,30,20,0.55) 50%, rgba(10,30,20,0.2))",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(8,20,14,0.6), transparent 60%)",
              }}
            />
          </div>

          <Container className="relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-10 items-start pt-12 pb-28 lg:pt-16 lg:pb-36">
              {/* Left column */}
              <div>
                {/* Badge above headline — compliance signal as first read */}
                <div className="inline-flex items-center gap-2 rounded-full border border-orange/40 bg-black/40 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 14l-4-4 1.41-1.41L11 12.17l5.59-5.59L18 8l-7 7z"/>
                  </svg>
                  {t("home.hero.badge")}
                </div>

                {/* Two-line H1: white "No surprises." over orange
                    "No fake-low quote games." — both at H1 scale */}
                <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-[-0.04em]">
                  <span className="block text-white">{t("home.hero.title")}</span>
                  <span className="block text-brand-accent mt-2">{t("home.hero.titleAccent")}</span>
                </h1>

                {/* Subhead — names the 3 pillars that map to the proof chips below */}
                <p className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed text-white/85 font-medium">
                  {t("home.hero.description")}
                </p>

                {/* 4 proof chips — visual restatement of the brand pillars,
                    each with an iconographic anchor */}
                <div className="mt-7 grid max-w-2xl grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <ProofChip iconKey="lock" label={t("home.hero.proofChips.lockedPrice")} />
                  <ProofChip iconKey="camera" label={t("home.hero.proofChips.photos")} />
                  <ProofChip iconKey="user" label={t("home.hero.proofChips.coordinator")} />
                  <ProofChip iconKey="shield" label={t("home.hero.proofChips.insured")} />
                </div>

                {/* Primary filled + secondary outline CTAs */}
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    href="/quote"
                    className="inline-flex h-13 items-center justify-center rounded-lg bg-brand-accent hover:bg-brand-accent-hover px-7 py-3.5 text-base font-bold text-brand-accent-ink shadow-[0_14px_35px_rgba(132,204,22,0.35)] transition"
                  >
                    {t("home.hero.ctaPrimary")} →
                  </Link>
                  <Link
                    href="/anti-scam"
                    className="inline-flex h-13 items-center justify-center rounded-lg border border-white/35 bg-white/5 px-7 py-3.5 text-base font-bold text-white backdrop-blur-sm hover:bg-white/10 transition"
                  >
                    {t("home.hero.ctaSecondary")}
                  </Link>
                </div>

                {/* Stats row — concrete, non-review trust signals */}
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-white/90">
                  <span className="inline-flex items-center gap-2">
                    <svg className="w-4 h-4 text-orange" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M3 13h18V7H3v6zm0 6h18v-4H3v4zM3 5h18V3H3v2z"/>
                    </svg>
                    {t("home.hero.stats.shipments")}
                  </span>
                  <span aria-hidden="true" className="text-white/40 hidden sm:inline">·</span>
                  <span className="text-white/85">{t("home.hero.stats.coverage")}</span>
                </div>
              </div>

              {/* Right column: Hero Route Finder — unchanged functionally,
                  pulls its own form state and progressive disclosure logic */}
              <div className="lg:mt-2">
                <HeroRouteFinder />
              </div>
            </div>
          </Container>

          {/* Floating proof cards (ShipmentProofCard + LockedPriceMiniCard)
              temporarily removed — May 17, 2026 PM rebuild.
              Reason: the cards landed on the form column at xl breakpoints
              against the new hero-night.png composition (truck cab sits
              more right-aligned than the previous photo). Covering the
              form's Vehicle Type dropdown + truncating the secondary CTA
              made the form unusable. Component definitions kept below for
              tomorrow's reposition pass — likely needs left-[28%] / [34%]
              + narrower widths + bumped to 2xl breakpoint, OR moved into
              the Portal Preview section entirely. JSON keys for shipment
              card + locked-price card preserved (home.hero.shipmentCard.*
              and home.hero.lockedPriceCard.*). */}
        </section>

        {/* Trust strip — white card overlapping hero/next section boundary.
            Restructured to make 45,000+ the DOMINANT proof item:
            asymmetric grid (1.35fr / 1fr / 1fr / 1fr / 1fr) gives the
            volume stat extra width; large orange number; vertical
            dividers separate items on lg+. The 4 compliance items
            sit smaller as a row of supporting credentials. */}
        <div
          aria-label={t("home.trustStrip.ariaLabel")}
          className="relative z-30 -mt-12 lg:-mt-14 px-4 sm:px-6 lg:px-8 mb-2 lg:mb-4"
        >
          <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-[0_18px_60px_rgba(0,0,0,0.18)] ring-1 ring-black/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1fr_1fr] gap-5 lg:gap-0 p-6 lg:p-7">
            {/* Dominant volume item — 45,000+ in large orange */}
            <div className="flex items-center gap-4 lg:border-r lg:border-gray-200 lg:pr-6">
              <span className="flex-shrink-0 w-12 h-12 rounded-lg bg-orange-tint text-orange-dark inline-flex items-center justify-center">
                <HeroIcon iconKey="truck" className="w-6 h-6" />
              </span>
              <div className="min-w-0">
                <div className="text-3xl md:text-4xl font-black tracking-tight text-orange leading-none">
                  {t("home.trustStrip.items.volume.label")}
                </div>
                <div className="text-[11px] md:text-xs text-gray-600 leading-snug mt-1.5">
                  {t("home.trustStrip.items.volume.sub")}
                </div>
              </div>
            </div>

            {/* 4 supporting compliance items — wrapped with border-r dividers */}
            <div className="lg:border-r lg:border-gray-200 lg:px-5">
              <TrustStripItem
                iconKey="shield-check"
                label={t("home.trustStrip.items.dot.label")}
                sub={t("home.trustStrip.items.dot.sub")}
                href={t("home.trustStrip.dotUrl")}
                title={t("home.trustStrip.dotTitle")}
              />
            </div>
            <div className="lg:border-r lg:border-gray-200 lg:px-5">
              <TrustStripItem
                iconKey="shield-check"
                label={t("home.trustStrip.items.mc.label")}
                sub={t("home.trustStrip.items.mc.sub")}
              />
            </div>
            <div className="lg:border-r lg:border-gray-200 lg:px-5">
              <TrustStripItem
                iconKey="shield-check"
                label={t("home.trustStrip.items.bond.label")}
                sub={t("home.trustStrip.items.bond.sub")}
              />
            </div>
            <div className="lg:pl-5">
              <TrustStripItem
                iconKey="users"
                label={t("home.trustStrip.items.fleet.label")}
                sub={t("home.trustStrip.items.fleet.sub")}
              />
            </div>
          </div>
        </div>

        {/* Triple Promise — V5 (May 17 PM, 2nd brief).
            2-column layout: intro (eyebrow + 3-line title + lead + see-how
            link) on left, 3 cards stacked on right at lg+. Cards are
            premium-styled "protection mechanism" cards with bigger icons,
            stronger hierarchy, and a thin orange divider line under the
            title. Each card explicitly names the customer fear it prevents
            (surprise pricing, vehicle condition, getting someone on phone). */}
        <section className="pt-20 pb-20 md:pt-24 md:pb-24 bg-white">
          <Container>
            {/* Intro on top — eyebrow + 3-line title + lead + see-how link */}
            <div className="max-w-3xl">
              <p className="text-orange text-xs font-bold uppercase tracking-[0.12em] mb-4">
                {t("home.triplePromise.eyebrow")}
              </p>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-charcoal leading-[0.95] tracking-tight">
                {t.rich("home.triplePromise.title", {
                  line: (chunks) => <span className="block">{chunks}</span>,
                })}
              </h2>
              <p className="text-gray-700 text-base sm:text-lg leading-7 mt-6 max-w-2xl">
                {t("home.triplePromise.lead")}
              </p>
              <a
                href="#how-it-works"
                className="inline-flex items-center mt-5 text-orange-dark font-black text-sm hover:underline"
              >
                {t("home.triplePromise.seeHowLink")} →
              </a>
            </div>

            {/* 3-card grid below intro — full-width cards, side-by-side header */}
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <SimplePromiseCard
                href="/price-promise"
                num={t("home.triplePromise.simpleCards.lockedPrice.num")}
                title={t("home.triplePromise.simpleCards.lockedPrice.title")}
                description={t("home.triplePromise.simpleCards.lockedPrice.description")}
                link={t("home.triplePromise.simpleCards.lockedPrice.link")}
              />
              <SimplePromiseCard
                href="/damage-promise"
                num={t("home.triplePromise.simpleCards.photoProof.num")}
                title={t("home.triplePromise.simpleCards.photoProof.title")}
                description={t("home.triplePromise.simpleCards.photoProof.description")}
                link={t("home.triplePromise.simpleCards.photoProof.link")}
              />
              <SimplePromiseCard
                href="/people-promise"
                num={t("home.triplePromise.simpleCards.onePerson.num")}
                title={t("home.triplePromise.simpleCards.onePerson.title")}
                description={t("home.triplePromise.simpleCards.onePerson.description")}
                link={t("home.triplePromise.simpleCards.onePerson.link")}
              />
            </div>
          </Container>
        </section>

        {/* Anti-scam buyer protection guide — V3 (May 17 PM, 2nd brief).
            Replaces the D3 teaser AND the charcoal bottom strip that sat
            between Triple Promise and the teaser. Reframed as a practical
            "buyer protection field guide" with a warmer amber background
            container, 2-col layout (intro left + 3 question cards right),
            and a "Why it matters" box on each card. Bottom belief line
            establishes the brand's transparency promise. */}
        <section
          aria-label={t("home.antiScamGuide.ariaLabel")}
          className="bg-orange-50/70 px-4 sm:px-6 lg:px-8 py-14 md:py-16"
        >
          <Container>
            <div className="max-w-7xl mx-auto rounded-3xl bg-[#FFF7E8] p-6 sm:p-8 lg:p-10 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-[0.75fr_1.25fr] gap-10 lg:gap-12">
                {/* Left: intro + CTA */}
                <div>
                  <p className="text-orange-dark text-xs font-bold uppercase tracking-[0.12em] mb-4">
                    {t("home.antiScamGuide.eyebrow")}
                  </p>
                  <h2 className="text-3xl md:text-4xl font-black text-charcoal leading-[1.1] tracking-[-0.02em]">
                    {t("home.antiScamGuide.title")}
                  </h2>
                  <p className="text-gray-700 text-base md:text-lg leading-relaxed mt-5">
                    {t("home.antiScamGuide.lead")}
                  </p>
                  <Link
                    href="/anti-scam"
                    className="inline-flex items-center mt-6 text-orange-dark font-black text-sm md:text-base hover:underline"
                  >
                    {t("home.antiScamGuide.ctaPrimary")} →
                  </Link>
                  <p className="text-xs text-gray-500 mt-2">
                    {t("home.antiScamGuide.reassurance")}
                  </p>
                </div>

                {/* Right: 3 question cards */}
                <div className="space-y-5">
                  <AntiScamQuestionCard
                    num="1"
                    title={t("home.antiScamGuide.questions.1.title")}
                    body={t("home.antiScamGuide.questions.1.body")}
                    whyMattersLabel={t("home.antiScamGuide.whyMattersLabel")}
                    whyMatters={t("home.antiScamGuide.questions.1.whyMatters")}
                  />
                  <AntiScamQuestionCard
                    num="2"
                    title={t("home.antiScamGuide.questions.2.title")}
                    body={t("home.antiScamGuide.questions.2.body")}
                    whyMattersLabel={t("home.antiScamGuide.whyMattersLabel")}
                    whyMatters={t("home.antiScamGuide.questions.2.whyMatters")}
                  />
                  <AntiScamQuestionCard
                    num="3"
                    title={t("home.antiScamGuide.questions.3.title")}
                    body={t("home.antiScamGuide.questions.3.body")}
                    whyMattersLabel={t("home.antiScamGuide.whyMattersLabel")}
                    whyMatters={t("home.antiScamGuide.questions.3.whyMatters")}
                  />
                </div>
              </div>

              {/* Bottom belief line — Auto Line's transparency commitment */}
              <div className="mt-10 lg:mt-12 pt-8 border-t border-orange-200 max-w-2xl">
                <p className="text-base md:text-lg font-black text-charcoal">
                  {t("home.antiScamGuide.belief.title")}
                </p>
                <p className="text-sm md:text-base text-gray-700 leading-relaxed mt-2">
                  {t("home.antiScamGuide.belief.body")}
                </p>
              </div>
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
                className="inline-flex items-center bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold text-base px-7 py-3.5 rounded-xl transition shadow-md shadow-orange/20"
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
                className="inline-block mt-8 bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold text-base px-8 py-4 rounded-full transition shadow-lg shadow-orange/20"
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

// ──────────────────────────────────────────────────────────────────────
// Hero components (May 17 PM rebuild)
// ──────────────────────────────────────────────────────────────────────

/** ProofChip — small icon + label chip beneath the hero subhead.
 *  Each chip names one of the 4 brand pillars (Locked Price · Photos ·
 *  Coordinator · Insured). Translucent backdrop so the truck photo
 *  still bleeds through. Icon set is inline SVG to avoid adding a
 *  dependency for 4 glyphs. */
function ProofChip({
  iconKey,
  label,
}: {
  iconKey: "lock" | "camera" | "user" | "shield";
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-black/30 p-2.5 backdrop-blur-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-orange/45 bg-orange/10 text-orange">
        <HeroIcon iconKey={iconKey} className="w-4 h-4" />
      </span>
      <span className="text-xs md:text-[13px] font-bold leading-tight text-white">
        {label}
      </span>
    </div>
  );
}

/** HeroIcon — inline SVG icon set used by hero proof chips, trust strip,
 *  and simple promise cards. Avoids adding lucide-react / react-icons
 *  just for these 6 glyphs. */
function HeroIcon({
  iconKey,
  className = "w-5 h-5",
}: {
  iconKey: "lock" | "camera" | "user" | "shield" | "shield-check" | "users" | "truck";
  className?: string;
}) {
  switch (iconKey) {
    case "lock":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
        </svg>
      );
    case "camera":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 15.5c1.93 0 3.5-1.57 3.5-3.5S13.93 8.5 12 8.5 8.5 10.07 8.5 12s1.57 3.5 3.5 3.5zM20 4h-3.17l-1.84-2H9.01L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h4.05l1.83-2h4.24l1.83 2H20v12zM12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
        </svg>
      );
    case "user":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      );
    case "shield":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
        </svg>
      );
    case "shield-check":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 14l-4-4 1.41-1.41L11 12.17l5.59-5.59L18 8l-7 7z" />
        </svg>
      );
    case "users":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      );
    case "truck":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        </svg>
      );
    default:
      return null;
  }
}

/** ShipmentProofCard — floating dark card overlay on the hero, desktop only.
 *  Shows a stylized "live shipment" snapshot to make the post-booking
 *  experience visible above the fold. Pulls all labels from JSON (i18n).
 *  Positioned absolutely; hidden on mobile to avoid clutter. */
function ShipmentProofCard({
  status,
  shipmentId,
  pickupCity,
  destCity,
  pickupPhotos,
  deliveryPhotos,
  coordLabel,
  coordName,
  etaLabel,
  etaValue,
}: {
  status: string;
  shipmentId: string;
  pickupCity: string;
  destCity: string;
  pickupPhotos: string;
  deliveryPhotos: string;
  coordLabel: string;
  coordName: string;
  etaLabel: string;
  etaValue: string;
}) {
  return (
    <div className="hidden xl:block absolute left-[42%] top-[44%] z-20 w-72 rounded-2xl border border-white/15 bg-black/75 p-5 text-white shadow-2xl backdrop-blur-md">
      {/* Status pill */}
      <span className="inline-block bg-green-500/20 text-green-300 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded">
        {status}
      </span>
      {/* Shipment ID */}
      <div className="mt-3 font-mono text-sm font-bold text-white">
        {shipmentId}
      </div>
      {/* Route */}
      <div className="mt-1 text-[13px] text-white/85">
        {pickupCity} <span className="text-orange">→</span> {destCity}
      </div>
      {/* Photo lines */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-2 text-[12px] text-white/85">
          <svg className="w-3.5 h-3.5 text-white/60" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 15.5c1.93 0 3.5-1.57 3.5-3.5S13.93 8.5 12 8.5 8.5 10.07 8.5 12s1.57 3.5 3.5 3.5z M20 4h-3.17l-1.84-2H9.01L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" />
          </svg>
          <span className="flex-1">{pickupPhotos}</span>
          <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-white/85">
          <svg className="w-3.5 h-3.5 text-white/60" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 15.5c1.93 0 3.5-1.57 3.5-3.5S13.93 8.5 12 8.5 8.5 10.07 8.5 12s1.57 3.5 3.5 3.5z M20 4h-3.17l-1.84-2H9.01L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" />
          </svg>
          <span className="flex-1">{deliveryPhotos}</span>
          <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
      </div>
      {/* Coordinator */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-orange to-orange-dark flex items-center justify-center text-[11px] font-black text-white">
          {coordName.charAt(0)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">
            {coordLabel}
          </div>
          <div className="text-[12px] font-bold text-white truncate">
            {coordName}
          </div>
        </div>
      </div>
      {/* ETA */}
      <div className="mt-3 text-[11px]">
        <span className="text-white/60 font-semibold uppercase tracking-wider">
          {etaLabel}
        </span>
        <div className="text-[12px] font-bold text-white mt-0.5">
          {etaValue}
        </div>
      </div>
    </div>
  );
}

/** LockedPriceMiniCard — small white card overlay layered below the
 *  ShipmentProofCard. Pairs the brand promise ("locked price") with a
 *  concrete number ($875) as visual rhetoric. Desktop only. */
function LockedPriceMiniCard({
  label,
  price,
  tagline,
}: {
  label: string;
  price: string;
  tagline: string;
}) {
  return (
    <div className="hidden xl:block absolute left-[48%] top-[80%] z-30 w-60 rounded-xl bg-white p-4 text-charcoal shadow-2xl ring-1 ring-black/10">
      <div className="flex items-center justify-between mb-1">
        <div className="inline-flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-charcoal" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
          </svg>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700">
            {label}
          </span>
        </div>
        <span className="text-xl font-extrabold text-orange-dark tracking-tight">
          {price}
        </span>
      </div>
      <p className="text-[11px] text-gray-600 leading-snug mt-1">
        {tagline}
      </p>
    </div>
  );
}

/** TrustStripItem — one row in the white-card trust strip overlapping the
 *  hero/Triple-Promise boundary. Icon + label + sub-label. If `href` is
 *  provided, wraps in an outbound link (used for the USDOT FMCSA lookup). */
function TrustStripItem({
  iconKey,
  label,
  sub,
  href,
  title,
}: {
  iconKey: "shield-check" | "users" | "truck";
  label: string;
  sub: string;
  href?: string;
  title?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3">
      <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-charcoal text-orange flex items-center justify-center">
        <HeroIcon iconKey={iconKey} className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-charcoal leading-tight truncate">
          {label}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5 truncate">{sub}</div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        className="hover:opacity-80 transition"
      >
        {inner}
      </a>
    );
  }
  return inner;
}

/** SimplePromiseCard — V5 layout-correction pass (May 17 PM brief #3).
 *  Drops the icon circle. Number + title share a flex row so the title
 *  gets normal wrapping width instead of breaking every word. Divider
 *  widens to w-20. Wider, less tall cards thanks to p-8 padding + the
 *  stacked section layout (intro on top, 3-card grid full-width below). */
function SimplePromiseCard({
  href,
  num,
  title,
  description,
  link,
}: {
  href: "/price-promise" | "/damage-promise" | "/people-promise";
  num: string;
  title: string;
  description: string;
  link: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white border border-gray-200 rounded-2xl p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:border-orange/40"
    >
      {/* Number + title — side-by-side header so the title reads as
          one unit instead of breaking every word. */}
      <div className="flex items-start gap-4">
        <span className="text-3xl font-black text-orange leading-none flex-shrink-0">
          {num}
        </span>
        <h3 className="text-xl font-black leading-tight text-charcoal">
          {title}
        </h3>
      </div>
      {/* Wider divider rule — protection-mechanism cue */}
      <div className="mt-5 h-px w-20 bg-brand-accent" />
      {/* Body */}
      <p className="mt-5 text-base leading-7 text-gray-700">
        {description}
      </p>
      {/* CTA link */}
      <span className="mt-6 inline-flex items-center text-sm font-black text-orange-dark group-hover:text-orange">
        {link} →
      </span>
    </Link>
  );
}

// ──────────────────────────────────────────────────────────────────────

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
    <div className="relative bg-gradient-to-b from-orange-tint via-white to-white border-2 border-orange rounded-2xl p-7 md:p-8 shadow-[0_12px_32px_rgba(132,204,22,0.08)] flex flex-col gap-4">
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
          className="inline-flex items-center bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink text-sm font-bold px-5 py-2.5 rounded-full transition"
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

// PromiseCard removed (May 17 PM rebuild) — used by the old V3 Triple
// Promise stat-anchor + receipt format. New homepage uses SimplePromiseCard
// (defined near the top of the component section above). The receipt format
// content lives in the JSON under home.triplePromise.cards.* and will move
// into the dedicated promise pages (/price-promise, /damage-promise,
// /people-promise) where there's room for depth.

// FeaturedScamCard + SupportingScamCard removed (May 17 PM, 2nd brief).
// Were used by the D3 anti-scam teaser layout (orange-bordered featured
// + 2 supporting cards). Replaced with the buyer-protection field guide
// pattern — see AntiScamQuestionCard below.

/** AntiScamQuestionCard — a single question card in the anti-scam buyer-
 *  protection field guide section. Shows: numbered orange circle + question
 *  title + body + "Why it matters" callout box with warning icon.
 *  Practical advice tone, not promo. Used 3× in the antiScamGuide section. */
function AntiScamQuestionCard({
  num,
  title,
  body,
  whyMattersLabel,
  whyMatters,
}: {
  num: string;
  title: string;
  body: string;
  whyMattersLabel: string;
  whyMatters: string;
}) {
  return (
    <div className="rounded-2xl border border-orange/30 bg-white p-6 shadow-sm">
      {/* Numbered orange circle + title — side-by-side header so each
          question reads as one unit instead of two stacked elements. */}
      <div className="flex items-start gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange text-sm font-black text-white">
          {num}
        </span>
        <h3 className="text-lg font-black leading-snug text-charcoal">
          {title}
        </h3>
      </div>
      {/* Body */}
      <p className="mt-3 text-sm leading-6 text-gray-700">{body}</p>
      {/* "Why it matters" callout box — tighter spacing, smaller footprint. */}
      <div className="mt-4 rounded-xl border border-orange/30 bg-orange-tint/40 p-4">
        <div className="flex items-center gap-2 text-xs font-black text-charcoal uppercase tracking-wider">
          <svg
            className="w-4 h-4 text-orange-dark"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
          {whyMattersLabel}
        </div>
        <p className="mt-2 text-sm leading-6 text-gray-700">{whyMatters}</p>
      </div>
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
