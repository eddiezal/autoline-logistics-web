import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";

export const metadata: Metadata = {
  title: "Price Promise — Locked-price auto transport",
  description:
    "Three service tiers. Whichever you pick, the price locks at booking. No post-assignment surcharges. No carrier-cost-overage calls.",
};

export default function PricePromisePage() {
  return (
    <>
      <Header />

      <main className="flex-1">
        <section className="bg-charcoal text-white py-16">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Promise 1 of 3
            </p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Price Promise
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl">
              You pick the speed, we lock the price.
            </p>
          </Container>
        </section>

        <section className="py-16 bg-white">
          <Container>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl">
              Three tiers. Pick what fits your timeline.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              <TierCard
                tier="Standby"
                window="7-day pickup window"
                description="The most flexible tier. Best value if your dates can flex."
              />
              <TierCard
                tier="Priority"
                window="3–5 day pickup window"
                description="Our most popular tier. Tight enough to plan around, flexible enough to stay affordable."
                highlight
              />
              <TierCard
                tier="Expedited"
                window="24–48 hour pickup"
                description="When you need it gone fast. Premium pricing, premium responsiveness."
              />
            </div>

            <div className="mt-12 p-6 bg-orange-tint rounded-2xl border border-orange/20">
              <p className="font-semibold text-charcoal mb-2">
                The promise itself
              </p>
              <p className="text-gray-700 leading-relaxed">
                Whichever tier you select, the price you see at booking is the
                price you pay. No post-assignment surcharges. No "sorry, market
                shifted" calls. No carrier-cost-overage upcharges. The
                quote is the contract.
              </p>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/quote"
                className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
              >
                Get my locked price
              </Link>
              <Link
                href="/damage-promise"
                className="border border-charcoal/20 hover:border-orange text-charcoal hover:text-orange font-semibold px-6 py-3 rounded-full transition"
              >
                Read the Damage Promise →
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}

function TierCard({
  tier,
  window: pickupWindow,
  description,
  highlight = false,
}: {
  tier: string;
  window: string;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-6 border ${
        highlight
          ? "border-orange bg-orange-tint"
          : "border-gray-200 bg-white"
      }`}
    >
      <p className="text-2xl font-bold text-charcoal">{tier}</p>
      <p className="text-orange font-semibold text-sm mt-1">{pickupWindow}</p>
      <p className="text-gray-700 mt-4 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
