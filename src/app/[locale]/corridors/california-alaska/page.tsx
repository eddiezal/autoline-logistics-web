import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ, type FAQItem } from "@/components/FAQ";
import { SubDestinationGrid } from "@/components/SubDestinationGrid";
import { getCorridor } from "@/lib/corridors";

export const metadata: Metadata = {
  title: "Ship a car California to Alaska — PCS, oil/gas, retiree relocations",
  description:
    "California-to-Alaska vehicle transport via overland (Alaska Highway) or ocean (Tacoma to Anchorage). Locked-price quotes. Trusted by military PCS to JBER, Eielson, and Fort Wainwright.",
};

const faqs: FAQItem[] = [
  {
    q: "How long does shipping a car from California to Alaska take?",
    a: (
      <>
        Two route options. <strong>Ocean route</strong> (Tacoma → Anchorage)
        runs about 8–14 days door-to-door including the inland legs.{" "}
        <strong>Overland route</strong> via the Alaska Highway runs 7–12
        days door-to-door. Winter delays are real (especially Nov–Mar) and
        we pad timelines accordingly. Your coordinator will recommend the
        right route based on season + final destination.
      </>
    ),
  },
  {
    q: "Ocean vs. overland — which should I pick?",
    a: (
      <>
        <strong>Ocean</strong> is the default for Anchorage and Mat-Su Valley
        destinations. Predictable timing, no weather closures, lower carrier
        wear-and-tear on the vehicle.{" "}
        <strong>Overland</strong> can be faster in summer for Fairbanks and
        interior destinations, but the Alaska Highway has weather sensitivity
        (snowstorms, road closures, frost heaves). For most customers most
        of the year, ocean is the better choice. We&apos;ll quote both and
        recommend based on your specific situation.
      </>
    ),
  },
  {
    q: "Do you ship to military bases — JBER, Eielson, Fort Wainwright?",
    a: (
      <>
        Yes. Military bases are a primary use case for this corridor. Joint
        Base Elmendorf-Richardson (JBER) in Anchorage, Eielson AFB and Fort
        Wainwright near Fairbanks, Coast Guard Base Kodiak — we ship to all
        of them regularly. Bring your PCS orders to booking and your
        coordinator applies the military rate (typically 5–10% below
        standard).
      </>
    ),
  },
  {
    q: "What about winter? Is the road closed?",
    a: (
      <>
        The Alaska Highway is technically open year-round, but winter
        conditions (Oct–Apr) make trucking risky and slow. We strongly
        recommend ocean shipping for any winter shipment to avoid weather
        delays, frost heaves, and the occasional avalanche closure. Ocean
        carriers run reliably year-round from Tacoma. Pricing is similar
        either way — winter premium is small.
      </>
    ),
  },
  {
    q: "Can I leave personal items in the vehicle?",
    a: (
      <>
        Up to 100 lbs in the trunk is generally fine. Same restrictions as
        most corridors: no firearms, ammunition, alcohol, or hazmat. Cold-
        weather note: liquids that can freeze (water bottles, washer fluid,
        canned beverages) can rupture in unheated transit. Drain or remove
        before pickup.
      </>
    ),
  },
  {
    q: "What about my car insurance during overland or ocean transit?",
    a: (
      <>
        Carrier cargo coverage stays in effect for the full transit either
        route. Our Damage Promise (broker bond + $500K contingent cargo)
        backstops the carrier&apos;s coverage gap. Single claim filed with
        us — we coordinate the carrier-side resolution.
      </>
    ),
  },
  {
    q: "Do you handle oversized or lifted vehicles?",
    a: (
      <>
        Yes — common in Alaska due to the truck-heavy customer base. Lifted
        trucks, oversized SUVs, and trucks with rooftop accessories ship
        regularly. Pricing premium scales with size: lifted vehicles add
        $150–$400 over standard, oversized may require enclosed trailer
        upgrade. Your coordinator confirms exact pricing at quote time.
      </>
    ),
  },
];

export default function CaliforniaAlaskaCorridor() {
  const corridor = getCorridor("california-alaska")!;
  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Corridor → California ↔ Alaska
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Ship a car to Alaska. Two routes. One coordinator.
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              Overland via the Alaska Highway or ocean via Tacoma. Optimized
              for season, destination, and timeline. Locked price either way.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/quote?from=CA&to=AK"
                className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
              >
                Get my CA → AK price
              </Link>
              <Link
                href="#how-it-works"
                className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
              >
                Compare routes ↓
              </Link>
            </div>
          </Container>
        </section>

        {/* Why Alaska is different */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                Why this corridor is different
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                Alaska is two corridors pretending to be one.
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  Most California-to-Alaska shipping is for one of three
                  customers: <strong>military PCS families</strong> heading
                  to JBER, Eielson, or Fort Wainwright; <strong>oil and gas
                  workers</strong> rotating through the North Slope;{" "}
                  <strong>retirees</strong> moving permanently. Each group
                  has different timeline tolerance, route preferences, and
                  vehicle types — and the right answer for one isn&apos;t
                  always the right answer for another.
                </p>
                <p>
                  Then there&apos;s the seasonality. Winter on the Alaska
                  Highway means weather closures, frost heaves, and trucking
                  premiums. Ocean from Tacoma stays reliable year-round.
                  Summer flips the math — overland gets faster and cheaper
                  for interior destinations.
                </p>
                <p className="font-semibold text-charcoal">
                  Your coordinator picks the route based on your specific
                  origin, destination, season, and timeline. You see one
                  locked price for whichever route they recommend.
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Two routes comparison */}
        <section id="how-it-works" className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              The two routes
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              Ocean vs. overland — same coordinator, different logistics.
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <RouteCard
                title="🚢 Ocean (Tacoma → Anchorage)"
                bestFor="Anchorage, Mat-Su Valley, year-round reliability"
                points={[
                  "8–14 days door-to-door including inland legs",
                  "Predictable timing, no weather closures",
                  "Lower vehicle wear (no 3,500-mile road)",
                  "Default recommendation for most shipments",
                  "Year-round service from Tacoma",
                ]}
              />
              <RouteCard
                title="🛣️ Overland (Alaska Highway)"
                bestFor="Fairbanks, interior, summer-only practical"
                points={[
                  "7–12 days door-to-door (summer)",
                  "Faster for interior destinations in summer",
                  "Weather-sensitive — Oct–Apr risky",
                  "Higher mileage on the vehicle",
                  "Often paired with cross-Canada permits",
                ]}
              />
            </div>
          </Container>
        </section>

        {/* Sub-destinations — major Alaska delivery areas */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Where in Alaska?
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              Four destination regions. Different routing for each.
            </h2>
            <p className="text-gray-700 max-w-2xl mb-10">
              Anchorage and Mat-Su use ocean shipping by default. Fairbanks
              can shift between routes seasonally. Southeast Alaska routes
              through the Marine Highway System with longer timelines.
            </p>
            <SubDestinationGrid
              destinations={corridor.subDestinations ?? []}
              fromCode="CA"
              toCode="AK"
            />
          </Container>
        </section>

        {/* Specialty vehicles — Alaska-specific guidance */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Specialty vehicles
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-3">
              Alaska customers ship different vehicles than mainland customers.
            </h2>
            <p className="text-gray-700 max-w-2xl mb-10">
              Lifted trucks, oversized SUVs, ATVs paired with the main
              vehicle — common asks here, not so much elsewhere.
              Here&apos;s what we navigate for the situations that come up.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <SpecialtyCard
                title="Lifted trucks"
                summary="Yes — common for AK customers. Surcharge scales with height."
                detail="Lifts under ~6&quot; typically fit standard carriers. Lifts of 6–10&quot; require specialized carriers and a height surcharge. Lifts over 10&quot; or with oversized tires may need flatbed transport. Confirmed at quote time based on actual specs."
              />
              <SpecialtyCard
                title="Oversized SUVs / dual-axle"
                summary="Standard for the AK customer base. Premium scales with dimensions."
                detail="Excursions, Suburbans, dually trucks all routine. Vehicles exceeding standard carrier slot (length, weight, or height) shift into the oversized pricing tier. Dimensions confirmed at booking; price stays locked once confirmed."
              />
              <SpecialtyCard
                title="ATVs / snowmobiles paired"
                summary="Pair with main vehicle on the same dispatch — saves a full second booking."
                detail="Common for AK customers shipping their primary vehicle plus an ATV or snowmobile. Both can ride on the same carrier with the snowmobile/ATV typically secured in a trailer or strapped to a flatbed alongside the main vehicle. Saves ~30–40% vs separate dispatches."
              />
              <SpecialtyCard
                title="RVs / motorhomes"
                summary="Specialized carrier network. Quote requires VIN + class + dimensions."
                detail="Class A, B, and C motorhomes ship through a separate carrier pool from passenger vehicles. Tow-behind RVs (5th wheels, travel trailers) ship more like cars. Either way, your coordinator confirms route + carrier match before quoting."
              />
              <SpecialtyCard
                title="Vehicles with rooftop accessories"
                summary="Disclose at booking. Some affect carrier slot height."
                detail="Cargo boxes, ski racks, light bars, and roof tents add height. A few inches usually fits standard slots; aggressive setups may require specialized carriers. Always disclose at quote — we'd rather adjust pricing up front than surprise you at pickup."
              />
              <SpecialtyCard
                title="Cold-weather prep"
                summary="Required for any winter transit. Sent at booking."
                detail="Drain or add antifreeze to washer fluid (it ruptures when frozen). Fuel below 1/2 tank (carrier requirement). Battery in good charge state — cold storage can drain weak batteries. Tire pressure adjusted for the destination climate. We send a checklist at booking."
              />
            </div>

            <p className="text-gray-500 text-sm mt-8 italic max-w-2xl">
              Don&apos;t see your situation? Mention it in the quote-request
              notes field. Your coordinator will confirm handling and any
              additional cost before booking.
            </p>
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
                window="Flexible dispatch"
                description="Best value. Catches the next available carrier or sailing within ~10 days of pickup."
              />
              <TierTile
                tier="Priority"
                window="Booked dispatch within 5 days"
                description="Most common for PCS and planned relocations. Specific dispatch scheduled at quote time."
                highlight
              />
              <TierTile
                tier="Expedited"
                window="Next available dispatch"
                description="When timing trumps price. We get on the soonest viable carrier or sailing."
              />
            </div>

            <p className="text-gray-500 text-sm mt-6 italic">
              Pricing varies by season (winter ocean preferred), vehicle
              size, and destination. Active-duty military PCS rates apply
              automatically with orders.
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
                Across 3,500 miles or an ocean voyage.
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
            <FAQ items={faqs} title="Frequently asked — California ↔ Alaska" />
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                See your locked Alaska price in 60 seconds.
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                Pickup ZIP, destination, vehicle type. We&apos;ll quote both
                routes and recommend the right one. Pick a tier, lock the
                price, and your coordinator takes it from there.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/quote?from=CA&to=AK"
                  className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  Get my CA → AK price
                </Link>
                <Link
                  href="/corridors/california-hawaii"
                  className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  See California ↔ Hawaii →
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

function SpecialtyCard({
  title,
  summary,
  detail,
}: {
  title: string;
  summary: string;
  detail: string;
}) {
  return (
    <details className="group bg-white border border-gray-200 rounded-2xl hover:border-orange transition">
      <summary className="cursor-pointer p-5 flex items-start justify-between gap-4 list-none">
        <div className="flex-1">
          <p className="font-bold text-charcoal">{title}</p>
          <p className="text-orange font-semibold text-sm mt-1">{summary}</p>
        </div>
        <span
          aria-hidden
          className="text-orange text-2xl leading-none flex-shrink-0 transition group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <p className="px-5 pb-5 text-gray-700 text-sm leading-relaxed">{detail}</p>
    </details>
  );
}

function RouteCard({
  title,
  bestFor,
  points,
}: {
  title: string;
  bestFor: string;
  points: string[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <p className="text-xl font-bold text-charcoal">{title}</p>
      <p className="text-orange font-semibold text-sm mt-2">Best for: {bestFor}</p>
      <ul className="mt-4 space-y-2">
        {points.map((p, i) => (
          <li key={i} className="text-gray-700 text-sm flex items-start gap-2">
            <span className="text-orange flex-shrink-0">•</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
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
