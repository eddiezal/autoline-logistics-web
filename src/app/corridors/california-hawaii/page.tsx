import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ, type FAQItem } from "@/components/FAQ";
import { SubDestinationGrid } from "@/components/SubDestinationGrid";
import { getCorridor } from "@/lib/corridors";

export const metadata: Metadata = {
  title: "Ship a car California to Hawaii — Port logistics, locked pricing",
  description:
    "Mainland-to-Hawaii vehicle transport via Long Beach or Oakland ports. Door-to-port-to-door coordination, all islands. Locked-price quotes. Trusted by military PCS families and snowbird relocations.",
};

const faqs: FAQItem[] = [
  {
    q: "How long does shipping a car from California to Hawaii take?",
    a: (
      <>
        Plan on <strong>10–18 days door-to-door</strong> in most cases. The
        ocean leg is typically 5–10 days port-to-port (Long Beach or Oakland
        to Honolulu), plus 2–5 days for mainland pickup and inland trucking
        on each end. Outer islands (Maui, Kauai, Big Island) add another 2–4
        days for inter-island barge.
      </>
    ),
  },
  {
    q: "Which port do you use — Long Beach or Oakland?",
    a: (
      <>
        Both are options. Long Beach has more sailings per week and slightly
        lower base rates from Southern California pickups. Oakland is faster
        for Bay Area and Northern California pickups. We pick whichever lands
        a better total cost + timeline for your specific origin. The choice
        is invisible to you in the quote.
      </>
    ),
  },
  {
    q: "Do I have to drop my car at the port myself?",
    a: (
      <>
        No. Standard service is door-to-door: we send a carrier to your
        California pickup address, transport to the port, manage the ocean
        booking and dock paperwork, and receive the vehicle on the Hawaii
        side for final delivery to your address. You can also choose
        port-to-port for a lower price if you want to handle the inland
        legs yourself.
      </>
    ),
  },
  {
    q: "What about my car insurance during the ocean voyage?",
    a: (
      <>
        Carrier cargo coverage stays in effect for the full transit. Our
        Damage Promise (broker bond + $500K contingent cargo) backstops the
        ocean carrier the same way it backstops mainland carriers. You file
        one claim with us — we handle all the carrier-side complexity.
      </>
    ),
  },
  {
    q: "Can I leave personal items in my car for the ocean shipment?",
    a: (
      <>
        Up to 100 lbs of personal items in the trunk is generally fine. NO
        firearms, ammunition, alcohol, hazmat, or live plants (Hawaii
        agricultural restrictions are strict). Items shifting during transit
        aren&apos;t covered for damage — secure anything you do load. When
        in doubt, your coordinator will flag specific items before booking.
      </>
    ),
  },
  {
    q: "Do you ship to all four major islands?",
    a: (
      <>
        Yes — Oahu (Honolulu), Maui (Kahului), Big Island (Hilo or Kona),
        and Kauai (Lihue). Honolulu is the primary mainland-to-Hawaii port,
        with inter-island barge to outer islands as the second leg. Inter-
        island timing is typically 2–4 additional days.
      </>
    ),
  },
  {
    q: "How does pricing work for military PCS shipments?",
    a: (
      <>
        Active-duty military with PCS orders qualify for our military rate
        (typically 5–10% below standard). We work with all branches — Army,
        Navy, Air Force, Marines, Coast Guard. Bring your orders to booking;
        your coordinator applies the discount automatically. POV shipment
        reimbursement processes through your TMO — we provide the
        documentation needed.
      </>
    ),
  },
];

export default function CaliforniaHawaiiCorridor() {
  const corridor = getCorridor("california-hawaii")!;
  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Corridor → California ↔ Hawaii
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Ship a car to Hawaii, the right way.
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              Door-to-door, mainland to all four major islands. Port logistics,
              ocean booking, and inland trucking — coordinated under one
              locked price.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/quote?from=CA&to=HI"
                className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
              >
                Get my CA → HI price
              </Link>
              <Link
                href="#how-it-works"
                className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
              >
                How it works ↓
              </Link>
            </div>
          </Container>
        </section>

        {/* Why this corridor is different */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                What makes Hawaii different
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                It&apos;s not auto transport. It&apos;s logistics.
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  Most mainland auto-transport corridors are one truck, one
                  driver, one straight shot. Hawaii is different. Your
                  vehicle has to clear two truck legs, an ocean voyage, port
                  paperwork at both ends, and (for outer islands) an inter-
                  island barge. Six handoffs. Six chances for something to
                  go sideways if nobody&apos;s coordinating.
                </p>
                <p>
                  Most brokers don&apos;t set up to coordinate ocean
                  shipping. They quote you a price, take a deposit, then
                  hand you a phone number for a port agent who has never
                  heard of you. We don&apos;t.
                </p>
                <p className="font-semibold text-charcoal">
                  Your coordinator owns the entire chain — from California
                  pickup to your driveway in Honolulu, Hilo, Kahului, or
                  Lihue. One phone number, one accountable point of contact.
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              The route
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              Six legs. One coordinator. Locked price.
            </h2>

            <div className="space-y-4">
              <RouteLeg
                num="1"
                title="Mainland pickup"
                detail="Carrier dispatched to your California address. Driver completes 360° walkaround photos and signed BOL. You're CC'd on the dispatch confirmation."
              />
              <RouteLeg
                num="2"
                title="Port transit"
                detail="Vehicle delivered to either Long Beach or Oakland port (whichever optimizes total cost + timeline). We choose; you don't manage."
              />
              <RouteLeg
                num="3"
                title="Port booking + ocean carrier"
                detail="Booking confirmed with the ocean carrier (Matson or Pasha typically). Sail date set. You get the vessel name, sail date, and ETA in your portal."
              />
              <RouteLeg
                num="4"
                title="Ocean voyage"
                detail="5–10 days port-to-port to Honolulu. Vehicle is secured below deck (RoRo) or in containerized service depending on booking type."
              />
              <RouteLeg
                num="5"
                title="Honolulu port retrieval"
                detail="Our island agent receives the vehicle. Inter-island barge booked here if your destination is Maui, Big Island, or Kauai (adds 2–4 days)."
              />
              <RouteLeg
                num="6"
                title="Final delivery"
                detail="Vehicle delivered to your Hawaii address. Walkaround photos at delivery. BOL signed. You and your coordinator both have the documentation."
              />
            </div>
          </Container>
        </section>

        {/* Sub-destinations — all four major Hawaiian islands */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Pick your island
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              All four major islands. Each with its own routing.
            </h2>
            <p className="text-gray-700 max-w-2xl mb-10">
              Honolulu is the primary mainland-Hawaii port — every shipment
              passes through it. Outer-island deliveries add an inter-island
              barge leg with its own timeline.
            </p>
            <SubDestinationGrid
              destinations={corridor.subDestinations ?? []}
              fromCode="CA"
              toCode="HI"
            />
          </Container>
        </section>

        {/* Service tiers — TODO: bring back specific pricing once SD/CD APIs are wired and we can pull live numbers */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Service tiers
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              Three tiers. Same locked-price guarantee on all three.
            </h2>
            <p className="text-gray-700 max-w-2xl mb-8">
              Pick the urgency level that fits your timeline. Live pricing
              comes through the quote tool — pulled from our verified
              carrier network at the moment you book.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <TierTile
                tier="Standby"
                window="Flexible sail date"
                description="Best value. Vehicle catches the next available sailing within ~2 weeks of pickup."
              />
              <TierTile
                tier="Priority"
                window="Booked sail within 7 days"
                description="Most common for PCS and planned relocations. Specific sail booked at quote time."
                highlight
              />
              <TierTile
                tier="Expedited"
                window="Next available sail"
                description="When the timeline is tight. We push to the soonest viable sail and accept the premium."
              />
            </div>

            <p className="text-gray-500 text-sm mt-6 italic">
              Pricing varies by season (peak May–Sept), vehicle type, and
              destination island. Get a quote for your specific shipment.
            </p>
          </Container>
        </section>

        {/* Triple Promise tie-in */}
        <section className="py-16 bg-gray-100">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                The Triple Promise applies the same way
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                Across six legs and an ocean.
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <Link
                  href="/price-promise"
                  className="bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
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
                  className="bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    Damage Promise
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    Coverage on every leg →
                  </p>
                </Link>
                <Link
                  href="/people-promise"
                  className="bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                >
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                    People Promise
                  </p>
                  <p className="font-bold text-charcoal group-hover:text-orange transition">
                    Same coordinator throughout →
                  </p>
                </Link>
              </div>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-white">
          <Container>
            <FAQ items={faqs} title="Frequently asked — California ↔ Hawaii" />
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                See your locked Hawaii price in 60 seconds.
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                Pickup ZIP, destination island, vehicle type. We&apos;ll show
                three tiered prices. Pick one, lock it, and your coordinator
                takes it from there.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/quote?from=CA&to=HI"
                  className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  Get my CA → HI price
                </Link>
                <Link
                  href="/corridors/california-alaska"
                  className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  See California ↔ Alaska →
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

function RouteLeg({
  num,
  title,
  detail,
}: {
  num: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-4 p-5 bg-white rounded-xl border border-gray-200">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-orange text-white font-bold flex-shrink-0">
        {num}
      </span>
      <div>
        <p className="font-semibold text-charcoal">{title}</p>
        <p className="text-gray-700 text-sm mt-1 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

// TODO: Once SD/CD APIs are wired, add a `priceFrom` prop to this component
// and surface live "from $X" data on each tier card. For now, prices live
// only inside the quote tool to avoid showing static numbers we can't
// guarantee match the live carrier network.
function TierTile({
  tier,
  window: tierWindow,
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
      <p className="text-orange font-semibold text-sm mt-1">{tierWindow}</p>
      <p className="text-gray-700 mt-4 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
