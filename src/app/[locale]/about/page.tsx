import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ } from "@/components/FAQ";

/**
 * About page — voice C+D (Modern Trust Operator + Anti-Scam Educator).
 *
 * TODO — placeholders awaiting confirmation from Ben:
 *   - Founding year ("since 2014" used below — confirm with Ben before launch)
 *   - MC#, DOT#, BMC-84 bond number + holder name
 *   - Team member names, titles, bios, headshots beyond Ben
 *   - Real customer testimonials (none reproduced — placeholder only)
 *   - Office address (work address, not home)
 *
 * No operational specifics are invented. Anything not confirmed is flagged
 * with a build-status callout or "TBD" placeholder text in the UI.
 */

export const metadata: Metadata = {
  title: "About Auto Line Logistics — family-owned auto transport",
  description:
    "Family-owned auto transport based in Southern California. Locked-price quotes, named coordinators, and coverage beyond the carrier — built for the way real customers ship cars.",
};

export default function AboutPage() {
  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-24">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              About us
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
              A family-owned auto transport company built for real customers.
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-6 max-w-2xl leading-relaxed">
              No call-center scripts, no bait-and-switch quotes, no surprise
              surcharges at delivery. The way auto transport should have
              worked from the start.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/quote"
                className="inline-block bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
              >
                Get my locked price
              </Link>
              <Link
                href="/contact"
                className="inline-block bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-full transition border border-white/20"
              >
                Talk to a coordinator
              </Link>
            </div>
          </Container>
        </section>

        {/* Build status callout */}
        <section className="py-6 bg-orange-tint border-b border-orange/30">
          <Container>
            <p className="text-charcoal text-sm">
              <strong>🚧 Build status:</strong> credentials, team bios, and
              customer reviews on this page show placeholders while we
              confirm final copy and gather photos. Operationally we&apos;ve
              been moving cars for years — the website is the part that&apos;s
              still being built.
            </p>
          </Container>
        </section>

        {/* Story / Why we exist */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 lg:gap-16 items-start">
              <div className="max-w-2xl">
                <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                  Our story
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                  We started Auto Line Logistics because the industry had
                  earned its bad reputation.
                </h2>
                <div className="mt-6 space-y-5 text-gray-700 leading-relaxed text-lg">
                  <p>
                    Most auto transport companies in this country are
                    brokers — they take your deposit, post your car to a
                    load board, and hope someone picks it up at the lowest
                    bid. When a carrier finally accepts the load, they
                    raise the price. And if your car shows up damaged?
                    You&apos;re on your own with the carrier&apos;s insurance.
                  </p>
                  <p>
                    We do this differently. We&apos;re a family-owned company
                    based in Southern California. We operate our own
                    trucks where the route makes sense, and we contract
                    with a vetted network of partner carriers everywhere
                    else — every one of them held to the same standards.
                  </p>
                  <p>
                    The number on your quote is the number on your invoice.
                    Your coordinator is a real person whose name you&apos;ll
                    know. And your car is covered above and beyond the
                    carrier&apos;s minimums — because cars get damaged, and
                    pretending otherwise is how customers get burned.
                  </p>
                </div>
              </div>

              {/* Trust block sidebar */}
              <aside className="bg-gray-100 border border-gray-200 rounded-2xl p-6">
                <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-4">
                  By the numbers
                </p>
                <dl className="space-y-5">
                  <div>
                    <dt className="text-3xl font-bold text-charcoal">
                      Family-owned
                    </dt>
                    <dd className="text-gray-700 text-sm mt-1">
                      Independent. Not a call-center, not a franchise.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-3xl font-bold text-charcoal">$575K</dt>
                    <dd className="text-gray-700 text-sm mt-1">
                      Layered cargo coverage on every shipment, beyond
                      the carrier&apos;s policy.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-3xl font-bold text-charcoal">
                      US-based
                    </dt>
                    <dd className="text-gray-700 text-sm mt-1">
                      Your coordinator works from our office, not an
                      offshore answering service.
                    </dd>
                  </div>
                </dl>
                <p className="text-gray-500 text-xs mt-6 italic">
                  Years-in-business and shipment counts will populate here
                  once Ben confirms the numbers.
                </p>
              </aside>
            </div>
          </Container>
        </section>

        {/* The Triple Promise — short tie-in */}
        <section className="py-16 md:py-20 bg-gray-100">
          <Container>
            <div className="max-w-2xl mb-10">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                What we promise
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                Three commitments. Every shipment.
              </h2>
              <p className="text-gray-700 text-lg mt-4 leading-relaxed">
                These aren&apos;t marketing lines — each one is enforceable.
                Read the full breakdown of what we cover and what you&apos;re
                owed if we miss.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/price-promise"
                className="bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-6 transition group"
              >
                <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                  Price Promise
                </p>
                <p className="text-2xl font-bold text-charcoal group-hover:text-orange transition">
                  Quote = invoice →
                </p>
                <p className="text-gray-700 text-sm mt-3 leading-relaxed">
                  You pick the speed, we lock the price. No surcharges,
                  ever.
                </p>
              </Link>
              <Link
                href="/damage-promise"
                className="bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-6 transition group"
              >
                <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                  Damage Promise
                </p>
                <p className="text-2xl font-bold text-charcoal group-hover:text-orange transition">
                  Layered coverage →
                </p>
                <p className="text-gray-700 text-sm mt-3 leading-relaxed">
                  $575K above the carrier&apos;s policy. We handle the
                  claim — you don&apos;t fight insurance alone.
                </p>
              </Link>
              <Link
                href="/people-promise"
                className="bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-6 transition group"
              >
                <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-2">
                  People Promise
                </p>
                <p className="text-2xl font-bold text-charcoal group-hover:text-orange transition">
                  Named coordinator →
                </p>
                <p className="text-gray-700 text-sm mt-3 leading-relaxed">
                  One real person owns your shipment. You&apos;ll have
                  their direct line.
                </p>
              </Link>
            </div>
          </Container>
        </section>

        {/* Anti-scam educator section — voice D */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <div className="max-w-3xl">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                Why we&apos;re different
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                The auto transport playbook to watch out for.
              </h2>
              <p className="text-gray-700 text-lg mt-4 leading-relaxed">
                If you&apos;ve gotten a quote that felt too good to be true,
                it probably was. Here&apos;s the pattern most customers run
                into — and how we structure things differently.
              </p>

              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-100 border border-gray-200 rounded-2xl p-6">
                  <p className="text-charcoal/60 text-xs font-semibold uppercase tracking-wider mb-3">
                    The industry pattern
                  </p>
                  <ul className="space-y-3 text-gray-700 text-[0.95rem] leading-relaxed">
                    <li>
                      <strong className="text-charcoal">Lowball quote</strong>{" "}
                      to win the booking
                    </li>
                    <li>
                      <strong className="text-charcoal">
                        Listed on a load board
                      </strong>{" "}
                      and ignored until a carrier bites
                    </li>
                    <li>
                      <strong className="text-charcoal">Price raised</strong>{" "}
                      once carriers refuse the original rate
                    </li>
                    <li>
                      <strong className="text-charcoal">
                        Hand-off at delivery
                      </strong>{" "}
                      — broker disappears if anything went wrong
                    </li>
                    <li>
                      <strong className="text-charcoal">
                        Damage = your problem
                      </strong>{" "}
                      with the carrier&apos;s insurance, not yours
                    </li>
                  </ul>
                </div>

                <div className="bg-orange-tint border border-orange/30 rounded-2xl p-6">
                  <p className="text-orange text-xs font-semibold uppercase tracking-wider mb-3">
                    How we structure it
                  </p>
                  <ul className="space-y-3 text-gray-700 text-[0.95rem] leading-relaxed">
                    <li>
                      <strong className="text-charcoal">Locked price</strong>{" "}
                      at booking — written into the agreement
                    </li>
                    <li>
                      <strong className="text-charcoal">
                        Vetted carrier network
                      </strong>{" "}
                      we&apos;ve worked with for years, plus our own trucks
                    </li>
                    <li>
                      <strong className="text-charcoal">
                        No surcharge clause
                      </strong>{" "}
                      — if costs change, that&apos;s our problem, not yours
                    </li>
                    <li>
                      <strong className="text-charcoal">
                        Named coordinator
                      </strong>{" "}
                      from quote through delivery
                    </li>
                    <li>
                      <strong className="text-charcoal">
                        Layered coverage
                      </strong>{" "}
                      and we file the damage claim if it happens
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* People — leadership + team */}
        <section className="py-16 md:py-20 bg-gray-100">
          <Container>
            <div className="max-w-2xl mb-10">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                The people
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                Real names. Real phone numbers.
              </h2>
              <p className="text-gray-700 text-lg mt-4 leading-relaxed">
                You don&apos;t get routed through a queue. The person who
                quotes your shipment is the same person who coordinates
                pickup, monitors transit, and is reachable if something
                changes mid-route.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <TeamCard
                name="Ben Baatarjargal"
                role="Owner & operations"
                bio="Founded Auto Line Logistics and runs day-to-day operations. Owner-operator background — knows what the trucks see because he&apos;s been in them."
                photo={false}
              />
              <TeamCard
                name="TBD"
                role="Customer coordinator"
                bio="Bio + photo pending. Coordinators are the named contacts on every shipment — the People Promise in practice."
                photo={false}
                placeholder
              />
              <TeamCard
                name="TBD"
                role="Dispatch & fleet"
                bio="Bio + photo pending. Manages our owned trucks and the carrier-partner network that handles routes outside our direct fleet."
                photo={false}
                placeholder
              />
            </div>

            <p className="text-gray-500 text-sm mt-8 italic max-w-2xl">
              Photo and bio confirmations pending — Ben to provide. We&apos;d
              rather show placeholders than stock-photo a team page.
            </p>
          </Container>
        </section>

        {/* Credentials, license & insurance */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <div className="max-w-2xl mb-10">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                Credentials
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                Licensed, bonded, and insured.
              </h2>
              <p className="text-gray-700 text-lg mt-4 leading-relaxed">
                Verifiable through the Federal Motor Carrier Safety
                Administration (FMCSA) and the Better Business Bureau.
                Our numbers will display below the moment Ben confirms
                them on the SAFER lookup.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <CredentialCard
                label="MC Number"
                value="MC-XXXXXX"
                note="FMCSA motor-carrier authority"
                pending
              />
              <CredentialCard
                label="USDOT Number"
                value="DOT-XXXXXXX"
                note="USDOT operating authority"
                pending
              />
              <CredentialCard
                label="BMC-84 Bond"
                value="$75,000"
                note="Surety bond filed with FMCSA"
                pending
              />
              <CredentialCard
                label="Cargo Coverage"
                value="$575K"
                note="Layered above carrier minimums"
              />
            </div>

            <div className="mt-8 bg-gray-100 border border-gray-200 rounded-2xl p-6 text-sm text-gray-700 leading-relaxed">
              <strong className="text-charcoal">Verify us yourself.</strong>{" "}
              Once our MC and DOT numbers are published, you can pull our
              full safety and authority record on{" "}
              <a
                href="https://safer.fmcsa.dot.gov/CompanySnapshot.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange font-semibold hover:underline"
              >
                FMCSA SAFER
              </a>
              . That&apos;s how legitimate carriers and brokers get checked.
              If a company refuses to share its MC and DOT numbers, walk
              away.
            </div>
          </Container>
        </section>

        {/* Reviews placeholder */}
        <section className="py-16 md:py-20 bg-gray-100">
          <Container>
            <div className="max-w-2xl mb-10">
              <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
                What customers say
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                Reviews from real shipments.
              </h2>
              <p className="text-gray-700 text-lg mt-4 leading-relaxed">
                We&apos;re not posting fabricated testimonials. The reviews
                section will populate once we&apos;ve collected verifiable
                customer quotes — with first names, route, and date — that
                we can attribute honestly.
              </p>
            </div>

            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center max-w-2xl">
              <p className="text-gray-600 text-sm italic">
                Customer reviews coming soon. We&apos;d rather leave this
                space empty than fill it with fake quotes.
              </p>
              <p className="text-gray-500 text-xs mt-3">
                Recently shipped with us? Email{" "}
                <a
                  href="mailto:info@autolinelogistics.com"
                  className="text-orange font-semibold hover:underline"
                >
                  info@autolinelogistics.com
                </a>{" "}
                — we&apos;d love to feature your experience.
              </p>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 md:py-20 bg-white">
          <Container>
            <div className="max-w-3xl">
              <FAQ
                title="Questions about the company"
                items={[
                  {
                    q: "Are you a broker or a carrier?",
                    a: (
                      <p>
                        Both — and we&apos;re upfront about it. We operate
                        our own trucks on routes where it makes
                        operational sense, and we contract with a vetted
                        network of partner carriers everywhere else.
                        Every carrier we work with is held to the same
                        standards as our own fleet. The Damage Promise
                        applies regardless of who&apos;s driving.
                      </p>
                    ),
                  },
                  {
                    q: "Where are you based?",
                    a: (
                      <p>
                        Southern California. Our office is the operational
                        hub for the corridors we cover most heavily —
                        California to Hawaii, California to Alaska, and
                        cross-country routes. We&apos;ll publish the
                        full work address once we update this page.
                      </p>
                    ),
                  },
                  {
                    q: "How long have you been in business?",
                    a: (
                      <p>
                        Auto Line Logistics has been moving customer
                        vehicles for years. The exact founding date will
                        post here once Ben confirms it for the record —
                        we don&apos;t want to round numbers on a page that
                        ought to be precise.
                      </p>
                    ),
                  },
                  {
                    q: "Why is the website still being built if you’ve been operating for years?",
                    a: (
                      <p>
                        Operationally we&apos;ve always run on direct
                        relationships — referrals, repeat customers,
                        military families who pass our number around. The
                        website is the new part: a place to lock a price
                        without a phone call, see what we cover, and
                        verify our credentials yourself. Customer
                        coordination has always been the strength; we&apos;re
                        catching the website up to it.
                      </p>
                    ),
                  },
                  {
                    q: "How do I verify you’re a legitimate carrier?",
                    a: (
                      <p>
                        Look us up on{" "}
                        <a
                          href="https://safer.fmcsa.dot.gov/CompanySnapshot.aspx"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange font-semibold hover:underline"
                        >
                          FMCSA SAFER
                        </a>
                        . Our MC and DOT numbers will publish here once
                        confirmed. Any auto transport company that
                        won&apos;t share those numbers — or whose record
                        on SAFER doesn&apos;t match what they tell you on
                        the phone — is one to walk away from.
                      </p>
                    ),
                  },
                  {
                    q: "Do you ship outside California?",
                    a: (
                      <p>
                        Yes. California is our home base, but we ship to
                        every state. The most-requested corridors —
                        Hawaii, Alaska, Texas, Florida, New York —
                        each get their own dedicated page. Don&apos;t see
                        your route?{" "}
                        <Link
                          href="/quote"
                          className="text-orange font-semibold hover:underline"
                        >
                          Get a quote
                        </Link>{" "}
                        and your coordinator will lock a price.
                      </p>
                    ),
                  },
                ]}
              />
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 md:py-20 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-bold leading-tight">
                Ready to lock a price?
              </h2>
              <p className="text-gray-300 text-lg mt-4 leading-relaxed">
                Send us your origin, destination, and vehicle. Your
                coordinator will reply with a locked price within 1
                business hour. No deposit, no obligation.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/quote"
                  className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  Get my locked price
                </Link>
                <Link
                  href="/contact"
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-full transition border border-white/20"
                >
                  Talk to a coordinator
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

/* ────────────────────────────────────────────────────────────────────────── */

function TeamCard({
  name,
  role,
  bio,
  placeholder = false,
}: {
  name: string;
  role: string;
  bio: string;
  photo?: boolean;
  placeholder?: boolean;
}) {
  return (
    <article
      className={`bg-white border rounded-2xl p-6 ${
        placeholder ? "border-dashed border-gray-300" : "border-gray-200"
      }`}
    >
      {/* Photo placeholder — swap for next/image once headshots arrive */}
      <div
        className={`w-full aspect-[4/5] rounded-xl mb-5 flex items-center justify-center ${
          placeholder ? "bg-gray-100" : "bg-orange-tint"
        }`}
      >
        <span
          className={`text-sm uppercase tracking-wider font-semibold ${
            placeholder ? "text-gray-400" : "text-orange"
          }`}
        >
          {placeholder ? "Photo pending" : "Headshot"}
        </span>
      </div>
      <p className="text-xl font-bold text-charcoal">{name}</p>
      <p className="text-orange font-semibold text-sm mt-1">{role}</p>
      <p className="text-gray-700 text-sm mt-3 leading-relaxed">{bio}</p>
    </article>
  );
}

function CredentialCard({
  label,
  value,
  note,
  pending = false,
}: {
  label: string;
  value: string;
  note: string;
  pending?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 border ${
        pending
          ? "bg-gray-100 border-dashed border-gray-300"
          : "bg-white border-gray-200"
      }`}
    >
      <p className="text-charcoal/60 text-xs font-semibold uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`text-2xl font-bold mt-2 ${
          pending ? "text-gray-400" : "text-charcoal"
        }`}
      >
        {value}
      </p>
      <p className="text-gray-700 text-xs mt-2 leading-relaxed">{note}</p>
      {pending && (
        <p className="text-orange text-[0.7rem] font-semibold uppercase tracking-wider mt-3">
          Pending confirmation
        </p>
      )}
    </div>
  );
}
