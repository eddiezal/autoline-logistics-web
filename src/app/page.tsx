import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";

export default function Home() {
  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-20 md:py-28">
          <Container>
            <p className="text-orange-light text-sm font-semibold uppercase tracking-wider mb-4">
              Auto Line Logistics, LLC
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
              Locked-price auto transport.{" "}
              <span className="text-orange">No surprises.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mt-6 max-w-2xl">
              Real-time tracking. Photo evidence at every step. A damage
              protection promise. Built for individual customers who deserve more
              than a quote and a hope.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/quote"
                className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
              >
                Get my locked price
              </Link>
              <Link
                href="/price-promise"
                className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
              >
                See how it works
              </Link>
            </div>
          </Container>
        </section>

        {/* Triple Promise teaser */}
        <section className="py-20 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Our triple promise
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal max-w-2xl">
              Three commitments. Built into every shipment.
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <PromiseCard
                href="/price-promise"
                eyebrow="Price Promise"
                headline="You pick the speed, we lock the price."
                cta="See pricing →"
              />
              <PromiseCard
                href="/damage-promise"
                eyebrow="Damage Promise"
                headline="Your car is covered beyond the carrier's insurance."
                cta="See coverage →"
              />
              <PromiseCard
                href="/people-promise"
                eyebrow="People Promise"
                headline="You'll always talk to a real person, by name."
                cta="Meet the team →"
              />
            </div>
          </Container>
        </section>

        {/* Build status banner — REMOVE once homepage is fleshed out and we go live on autolinelogistics.com */}
        <section className="py-12 bg-orange-tint border-t border-orange/20">
          <Container>
            <p className="text-charcoal font-semibold mb-1">
              🚧 Build status — Phase A bootstrap (updated May 8, 2026)
            </p>
            <p className="text-gray-700 text-sm">
              Live: Triple Promise pages, California ↔ Hawaii corridor,
              California ↔ Alaska corridor, corridor index, About page,
              quote intake form. Next up: Super Dispatch + Authorize.Net
              integrations, server hardening (Sentry, hCaptcha), Spanish
              translation pass. Production cutover to{" "}
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
