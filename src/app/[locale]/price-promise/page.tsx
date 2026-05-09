import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ, type FAQItem } from "@/components/FAQ";
import { PromiseFooterNav } from "@/components/PromiseFooterNav";

export const metadata: Metadata = {
  title: "Price Promise — Locked-price auto transport",
  description:
    "Three service tiers. Whichever you pick, the price locks at booking. No post-assignment surcharges. No carrier-cost-overage calls. The quote is the contract.",
};

const faqs: FAQItem[] = [
  {
    q: "What if a carrier wants more money to take my car?",
    a: (
      <>
        That&apos;s our problem, not yours. The price you booked is the price
        you pay. If a carrier wants to charge more, we either find a different
        carrier or absorb the difference. Your invoice does not change after
        booking.
      </>
    ),
  },
  {
    q: "What does the locked price include?",
    a: (
      <>
        Door-to-door transport from your origin to destination, standard
        loading and unloading, basic carrier insurance coverage during transit,
        real-time tracking access, photo evidence at pickup and delivery, and
        a named coordinator from quote through delivery. Taxes, where
        applicable, are included.
      </>
    ),
  },
  {
    q: "What's NOT included in the price?",
    a: (
      <>
        Inoperable vehicle surcharges (winching/heavy equipment), oversized
        vehicle premiums (lifted trucks, dual axles), enclosed-trailer upgrades,
        and additional insurance beyond standard cargo coverage. We always
        flag any add-on cost <em>before</em> you book — never after.
      </>
    ),
  },
  {
    q: "What if I need to cancel or reschedule?",
    a: (
      <>
        Free cancellation up until carrier assignment. After assignment,
        cancellation may incur a small dispatch fee, which we&apos;ll always
        disclose before applying. Rescheduling within your service tier&apos;s
        window is always free.
      </>
    ),
  },
  {
    q: "How is your price determined?",
    a: (
      <>
        Three factors: distance, vehicle type, and tier urgency (Standby,
        Priority, or Expedited). We pull live carrier rates from our
        verified network and add a transparent operations margin. No
        surge pricing. No bid-against-yourself markups.
      </>
    ),
  },
  {
    q: "Why don't other brokers do this?",
    a: (
      <>
        Most brokers operate on a bid model: they post your shipment to a
        carrier marketplace and accept whichever bid wins. The original quote
        is just a guess — when actual costs come in higher, you eat the
        difference or your shipment gets stuck. We pre-negotiate carrier rates
        and absorb price variance ourselves. It&apos;s a different business
        model, not a different industry.
      </>
    ),
  },
];

export default function PricePromisePage() {
  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Promise 1 of 3
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Price Promise
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              You pick the speed. We lock the price. The quote is the contract.
            </p>
          </Container>
        </section>

        {/* Anti-pattern callout — Anti-Scam Educator voice */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                Why this matters
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                The dirty open secret of auto transport pricing
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  Most brokers will quote you a price, take your deposit, then
                  call you back two weeks later with a higher number when they
                  actually go to find a carrier. The industry has a name for
                  this: &ldquo;the bid-and-bump.&rdquo;
                </p>
                <p>
                  It&apos;s the reason auto transport reviews online are full of
                  customers feeling burned. The original quote was bait. The
                  real number was always going to be higher — the broker just
                  needed your deposit first.
                </p>
                <p className="font-semibold text-charcoal">
                  We don&apos;t do that. The price you book is the price you
                  pay. Period.
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Tier selection */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Pick your speed
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              Three tiers. Same price-lock guarantee on all three.
            </h2>
            <p className="text-gray-700 max-w-2xl">
              Pricing scales with urgency. Whichever tier you pick, the
              guarantee is identical: the booking price is the final price.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              <TierCard
                tier="Standby"
                window="7-day pickup window"
                description="Most flexible. Best value when your timeline can flex."
                bestFor="Snowbirds, college moves, planned relocations"
              />
              <TierCard
                tier="Priority"
                window="3–5 day pickup window"
                description="Tight enough to plan around, flexible enough to stay affordable."
                bestFor="Most direct-to-consumer shipments"
                highlight
              />
              <TierCard
                tier="Expedited"
                window="24–48 hour pickup"
                description="When timing matters more than price. We get on it immediately."
                bestFor="Sudden relocations, urgent buyer pickups"
              />
            </div>
          </Container>
        </section>

        {/* The promise — explicit commitment */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl mx-auto p-8 bg-orange-tint rounded-2xl border border-orange/30">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                The promise itself
              </p>
              <p className="text-charcoal text-xl md:text-2xl font-semibold leading-snug mb-4">
                The number on your booking confirmation is the number on your
                final invoice.
              </p>
              <ul className="space-y-2 text-gray-700">
                <li>✓ No post-assignment surcharges</li>
                <li>✓ No &ldquo;the market shifted&rdquo; calls</li>
                <li>✓ No carrier-cost-overage upcharges</li>
                <li>✓ No fuel-surcharge add-ons</li>
                <li>✓ Any ancillary fee disclosed before you book</li>
              </ul>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-gray-100">
          <Container>
            <FAQ items={faqs} title="Questions about pricing" />
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                See your locked price in 60 seconds.
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                Enter your origin, destination, and vehicle. We&apos;ll show
                three tiered prices instantly. Pick one, lock it, done.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/quote"
                  className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  Get my locked price
                </Link>
                <Link
                  href="/people-promise"
                  className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  See how the People Promise works →
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <PromiseFooterNav current="price" />
      <Footer />
    </>
  );
}

function TierCard({
  tier,
  window: pickupWindow,
  description,
  bestFor,
  highlight = false,
}: {
  tier: string;
  window: string;
  description: string;
  bestFor: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-6 border ${
        highlight
          ? "border-orange bg-orange-tint shadow-md"
          : "border-gray-200 bg-white"
      }`}
    >
      {highlight && (
        <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
          Most popular
        </p>
      )}
      <p className="text-2xl font-bold text-charcoal">{tier}</p>
      <p className="text-orange font-semibold text-sm mt-1">{pickupWindow}</p>
      <p className="text-gray-700 mt-4 text-sm leading-relaxed">{description}</p>
      <p className="text-gray-500 mt-3 text-xs italic border-t border-gray-200 pt-3">
        Best for: {bestFor}
      </p>
    </div>
  );
}
