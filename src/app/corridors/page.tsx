import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import {
  CORRIDORS,
  getLiveCorridors,
  getComingSoonCorridors,
  type Corridor,
} from "@/lib/corridors";

export const metadata: Metadata = {
  title: "All corridors — Auto Line Logistics",
  description:
    "Locked-price auto transport on every major US corridor. California to Hawaii, Alaska, Texas, Florida, New York, and more. Door-to-door, named coordinator, no surprises.",
};

export default function CorridorsIndex() {
  const live = getLiveCorridors();
  const comingSoon = getComingSoonCorridors();

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Corridors
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Every major US corridor. Same locked-price guarantee.
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              Whether your shipment crosses an ocean or three time zones, the
              promise is the same: the quote is the contract.
            </p>
            <div className="mt-8">
              <Link
                href="/quote"
                className="inline-block bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
              >
                Don&apos;t see your route? Get a quote anyway →
              </Link>
            </div>
          </Container>
        </section>

        {/* Live corridors */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Available now
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {live.length} corridors with dedicated pages.
            </h2>
            <p className="text-gray-700 max-w-2xl mb-10">
              Detailed routing, sub-destinations, and corridor-specific FAQ
              for each. Click through for the full breakdown.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {live.map((c) => (
                <CorridorCard key={c.slug} corridor={c} live />
              ))}
            </div>
          </Container>
        </section>

        {/* Coming soon corridors */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Coming soon
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              {comingSoon.length} more corridors with dedicated pages this
              build cycle.
            </h2>
            <p className="text-gray-700 max-w-2xl mb-10">
              Already serving these corridors operationally — dedicated
              corridor pages launching as we build them out. Ship today by
              getting a quote; the corridor page just makes the process
              visible.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comingSoon.map((c) => (
                <CorridorCard key={c.slug} corridor={c} live={false} />
              ))}
            </div>
          </Container>
        </section>

        {/* The promise */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                Same promise, every corridor
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                Whatever route, whatever distance.
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  href="/price-promise"
                  className="bg-gray-100 border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    Price Promise
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    Quote = final invoice →
                  </p>
                </Link>
                <Link
                  href="/damage-promise"
                  className="bg-gray-100 border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    Damage Promise
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    $575K layered coverage →
                  </p>
                </Link>
                <Link
                  href="/people-promise"
                  className="bg-gray-100 border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    People Promise
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    Named coordinator →
                  </p>
                </Link>
              </div>
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                Find your corridor.
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                {CORRIDORS.length} corridors mapped. Hundreds more shippable
                on request. Your origin ZIP and destination ZIP are all we
                need to lock a price.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/quote"
                  className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  Get my locked price
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

function CorridorCard({ corridor, live }: { corridor: Corridor; live: boolean }) {
  const className = live
    ? "bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-6 transition group"
    : "bg-white border border-gray-200 rounded-2xl p-6 opacity-75 hover:opacity-100 transition group";

  const content = (
    <>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-2xl font-bold text-charcoal group-hover:text-orange transition">
          {corridor.fromName} ↔ {corridor.toName}
        </p>
        {!live && (
          <span className="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-gray-200 text-gray-700 flex-shrink-0">
            Soon
          </span>
        )}
      </div>
      <p className="text-orange font-semibold text-sm mb-3">
        {corridor.fromState} ↔ {corridor.toState}
      </p>
      <p className="text-gray-700 text-sm leading-relaxed">
        {corridor.shortDesc}
      </p>
      {live && (
        <p className="text-orange font-semibold text-sm mt-4 group-hover:text-orange-dark">
          See the corridor page →
        </p>
      )}
      {!live && (
        <Link
          href={`/quote?from=${corridor.fromState}&to=${corridor.toState}`}
          className="inline-block text-orange font-semibold text-sm mt-4 hover:text-orange-dark"
        >
          Get a quote →
        </Link>
      )}
    </>
  );

  if (live) {
    return (
      <Link href={`/corridors/${corridor.slug}`} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
