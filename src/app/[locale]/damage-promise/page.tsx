import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ, type FAQItem } from "@/components/FAQ";
import { PromiseFooterNav } from "@/components/PromiseFooterNav";

export const metadata: Metadata = {
  title: "Damage Promise — Coverage beyond the carrier",
  description:
    "$75K bond. $500K contingent cargo liability. 24-hour claim acknowledgment. 14-day resolution target. We handle the carrier so you don't have to.",
};

const faqs: FAQItem[] = [
  {
    q: "What if my car is damaged in transit?",
    a: (
      <>
        File a claim with us within 24 hours of delivery. We acknowledge
        within 24 hours and target full resolution within 14 days. We handle
        the carrier directly — you don&apos;t chase, you don&apos;t mediate.
        Required: photos at pickup (we provide), photos at delivery, and the
        BOL signed at delivery noting the damage.
      </>
    ),
  },
  {
    q: "Who pays for the damage — you or the carrier?",
    a: (
      <>
        Carriers carry mandatory cargo insurance (typically $100K–$250K). For
        most damage events, the carrier&apos;s insurance covers the claim. If
        their coverage falls short, our $500,000 contingent cargo liability
        and $75,000 broker bond kick in. The customer never sees that
        complexity — we handle it on the back end.
      </>
    ),
  },
  {
    q: "What's NOT covered?",
    a: (
      <>
        Acts of God (hail, wind, flooding), road debris damage on open
        carriers, pre-existing damage documented at pickup, personal items
        left in the vehicle, and damage caused by customer-provided faulty
        loading instructions. For high-value or weather-sensitive vehicles,
        we recommend our enclosed-trailer upgrade.
      </>
    ),
  },
  {
    q: "What if the carrier refuses to pay?",
    a: (
      <>
        That&apos;s where our broker bond and contingent cargo coverage
        engage. We pursue the carrier on your behalf, but you don&apos;t
        wait for the recovery. Once the claim is approved by us (within 14
        days), payout to you happens regardless of carrier-side resolution
        timing.
      </>
    ),
  },
  {
    q: "Do you require enclosed shipping for damage protection?",
    a: (
      <>
        No. Both open and enclosed shipping are covered under the same
        Damage Promise. Open carriers carry slightly higher exposure to
        weather and road debris, which is why we strongly recommend enclosed
        for vehicles over $75,000, classics/collectibles, low-clearance
        sports cars, and vehicles with custom paint or wraps.
      </>
    ),
  },
  {
    q: "What documentation do you provide?",
    a: (
      <>
        At pickup: a 360° walkaround photo set timestamped and geotagged,
        plus the Bill of Lading (BOL) signed by the driver. At delivery: a
        matching 360° walkaround set + delivery BOL. Both surface in your
        customer portal as soon as the driver app captures them. This
        evidence is the foundation of any claim.
      </>
    ),
  },
];

export default function DamagePromisePage() {
  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Promise 2 of 3
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Damage Promise
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              Your car is covered beyond the carrier&apos;s insurance.
              We handle the claim. You don&apos;t chase.
            </p>
          </Container>
        </section>

        {/* Anti-pattern callout */}
        <section className="py-16 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                Why this matters
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">
                What happens to most people when their car arrives damaged
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  Customer files a claim. The broker says &ldquo;contact the
                  carrier directly — they&apos;re the responsible party.&rdquo;
                  Customer calls the carrier. Carrier says &ldquo;file with
                  our insurance.&rdquo; Insurance asks for photos the customer
                  doesn&apos;t have. Customer gets bounced for weeks. Most
                  give up. The few who don&apos;t spend three months on hold.
                </p>
                <p>
                  This pattern happens because most brokers don&apos;t want
                  damage claims to be their problem. Legally, the carrier is
                  the responsible party. So the broker steps back.
                </p>
                <p className="font-semibold text-charcoal">
                  We don&apos;t step back. We own the claim from the moment
                  you file it. Your only job: send us the photos and tell us
                  what happened.
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Coverage stats */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              What our coverage looks like
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              Layered protection. Carrier coverage + our backstop.
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <CoverageStat
                amount="$75,000"
                label="Broker bond on file"
                description="FMCSA-required protection. Backstops carrier coverage gaps."
              />
              <CoverageStat
                amount="$500,000"
                label="Contingent cargo liability"
                description="Our policy. Kicks in when carrier insurance falls short."
              />
              <CoverageStat
                amount="24 hours"
                label="Claim acknowledgment SLA"
                description="From the moment you file, our coordinator confirms receipt and starts the process."
              />
              <CoverageStat
                amount="14 days"
                label="Resolution target"
                description="Most claims resolve faster. 14 days is our outer commitment, not our average."
              />
            </div>
          </Container>
        </section>

        {/* Common scenarios */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Common scenarios
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              What &ldquo;covered&rdquo; actually means in practice
            </h2>

            <div className="space-y-6">
              <Scenario
                title="Door ding during loading"
                covered
                detail="Minor body damage during pickup or drop-off. Carrier insurance handles it; we expedite the paperwork."
              />
              <Scenario
                title="Theft from carrier in transit"
                covered
                detail="Whether items inside the vehicle (within reason) or the vehicle itself. Police report required."
              />
              <Scenario
                title="Tire/wheel damage from road debris"
                covered={false}
                detail="Open carriers expose vehicles to highway debris. Not covered — though enclosed transport eliminates the risk."
              />
              <Scenario
                title="Hail or weather damage"
                covered={false}
                detail="Acts of God are excluded across the industry. Enclosed transport is the recommended hedge for weather-sensitive vehicles."
              />
              <Scenario
                title="Mechanical issue mid-route"
                covered
                detail="If the carrier's handling caused the damage (e.g., dropped during loading). Not covered if the vehicle had pre-existing issues documented at pickup."
              />
            </div>
          </Container>
        </section>

        {/* Claim process */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Filing a claim
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              Three steps. We do the rest.
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Step
                number="1"
                title="Note damage at delivery"
                detail="Have the driver write the damage on the BOL before they leave. Photo the delivery walkaround."
              />
              <Step
                number="2"
                title="Submit through portal"
                detail="In your customer portal: click 'File a claim,' upload photos and the BOL. Takes ~3 minutes."
              />
              <Step
                number="3"
                title="We take over"
                detail="Within 24 hours, your coordinator confirms. Within 14 days, claim is resolved. You don't talk to carriers."
              />
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-white">
          <Container>
            <FAQ items={faqs} title="Questions about coverage" />
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                Ship with the broker that owns the claim.
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                Locked price. $575K of layered protection. A 14-day claim
                resolution target. Real coordinators. Get a quote in 60 seconds.
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
                  Read the People Promise →
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <PromiseFooterNav current="damage" />
      <Footer />
    </>
  );
}

function CoverageStat({
  amount,
  label,
  description,
}: {
  amount: string;
  label: string;
  description: string;
}) {
  return (
    <div className="bg-white border-l-4 border-orange p-6 rounded-r-xl">
      <p className="text-3xl md:text-4xl font-bold text-charcoal">{amount}</p>
      <p className="text-charcoal font-semibold text-sm mt-2">{label}</p>
      <p className="text-gray-700 text-sm mt-2 leading-relaxed">{description}</p>
    </div>
  );
}

function Scenario({
  title,
  detail,
  covered,
}: {
  title: string;
  detail: string;
  covered: boolean;
}) {
  return (
    <div className="flex items-start gap-4 p-5 bg-gray-100 rounded-xl">
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold flex-shrink-0 mt-0.5 ${
          covered ? "bg-success text-white" : "bg-gray-300 text-charcoal"
        }`}
        aria-label={covered ? "Covered" : "Not covered"}
      >
        {covered ? "✓" : "—"}
      </span>
      <div>
        <p className="font-semibold text-charcoal">{title}</p>
        <p className="text-gray-700 text-sm mt-1 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200">
      <p className="text-orange text-3xl font-bold">{number}</p>
      <p className="text-charcoal font-bold text-lg mt-2">{title}</p>
      <p className="text-gray-700 text-sm mt-2 leading-relaxed">{detail}</p>
    </div>
  );
}
