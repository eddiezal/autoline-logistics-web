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
