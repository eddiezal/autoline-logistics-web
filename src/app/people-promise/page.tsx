import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { FAQ, type FAQItem } from "@/components/FAQ";
import { PromiseFooterNav } from "@/components/PromiseFooterNav";

export const metadata: Metadata = {
  title: "People Promise — Real people, by name",
  description:
    "Family-owned and operated since 2014. Bilingual coverage in English and Spanish. Named coordinator on every shipment. Real names on the company.",
};

const faqs: FAQItem[] = [
  {
    q: "Who is my coordinator and how do I reach them?",
    a: (
      <>
        At booking, you&apos;re assigned a coordinator by name. You&apos;ll
        get their direct number and email. They own your shipment from
        booking through delivery. If they&apos;re unavailable, a backup
        coordinator picks up — never an automated tree, never an offshore
        call center.
      </>
    ),
  },
  {
    q: "Is your team really bilingual?",
    a: (
      <>
        Yes. Native Spanish speakers handle inbound calls and customer-facing
        communications in Spanish from booking through delivery. The Spanish
        layer of the website (launching Phase A) is a full translation, not
        a machine-translated overlay. About one in ten US auto-transport
        customers prefer Spanish — we built for them on day one.
      </>
    ),
  },
  {
    q: "What does “family-owned and operated” actually change?",
    a: (
      <>
        Decision authority sits with the people doing the work. When something
        goes wrong, escalation doesn&apos;t mean climbing a corporate ladder —
        it means walking down the hall. We&apos;ve built the company since
        2014 by treating individual reputation as the company&apos;s
        reputation.
      </>
    ),
  },
  {
    q: "What if my coordinator is on vacation when something goes wrong?",
    a: (
      <>
        Every coordinator has a designated backup, briefed on your shipment
        before any handoff. You don&apos;t restart from scratch. The backup
        knows your origin, destination, vehicle, timeline, and any open
        items. Your point of accountability stays continuous.
      </>
    ),
  },
  {
    q: "Do I get the coordinator's direct phone number?",
    a: (
      <>
        Yes — at booking. Their direct line, their email, and their working
        hours. We don&apos;t hide behind a general 800 number. The whole
        point of the People Promise is that there&apos;s a real person
        accountable to you.
      </>
    ),
  },
  {
    q: "How is this different from other brokers’ “dedicated agent” pitches?",
    a: (
      <>
        Most &ldquo;dedicated agents&rdquo; in this industry are sales reps
        who hand off to dispatch after booking. You never speak to that
        original person again. Our coordinators stay with the shipment
        through delivery — including during transit, at delivery, and for
        any post-delivery questions or claims.
      </>
    ),
  },
];

export default function PeoplePromisePage() {
  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Promise 3 of 3
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              People Promise
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl leading-relaxed">
              You&apos;ll always talk to a real person, by name. Family-owned.
              Bilingual. Accountable.
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
                What faceless brokering actually looks like
              </h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  You call a 1-800 number. You get a sales rep. They book your
                  shipment, take your deposit, then hand you off to dispatch.
                  Dispatch hands off to a driver. The driver doesn&apos;t
                  speak to you. Something goes wrong, you call back, get a
                  different sales rep, who has to read the file from scratch.
                </p>
                <p>
                  By the time you&apos;ve explained your situation three
                  times, your car is somewhere in Texas and nobody on the
                  phone knows where.
                </p>
                <p className="font-semibold text-charcoal">
                  Auto transport got broken when it became faceless.
                  We&apos;re rebuilding the operator-customer relationship the
                  way it should have always worked: one named person, one
                  phone number, one point of accountability.
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Commitments */}
        <section className="py-16 bg-gray-100">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Our commitments
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              Four things we promise. Backed by how we&apos;ve operated since
              2014.
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Commitment
                title="Named coordinator on every shipment"
                description="When you book, you're assigned a coordinator by name. They know your shipment. They pick up the phone. From quote through delivery — same person."
              />
              <Commitment
                title="Bilingual front-line"
                description="Native Spanish and English coverage on the customer-facing team. The whole site is translated end-to-end, not just bolt-on widgets."
              />
              <Commitment
                title="Family-owned and operated since 2014"
                description="Real names on the company. Decision authority sits with the people doing the work. We've built this on individual accountability."
              />
              <Commitment
                title="No script. No transfer maze."
                description="Your coordinator owns the answer. If something goes wrong, the same person calls you back — not a different sales rep starting from zero."
              />
            </div>
          </Container>
        </section>

        {/* Day in the life */}
        <section className="py-16 bg-white">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              How it actually plays out
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal max-w-2xl mb-10">
              A typical shipment, end to end
            </h2>

            <div className="space-y-4">
              <TimelineRow
                time="Day 0 — Booking"
                description="You get a quote. Pick a tier. Book online. Within an hour, your coordinator emails you their direct line and a quick onboarding rundown."
              />
              <TimelineRow
                time="Day 1–3 — Carrier matched"
                description="Your coordinator finds the carrier, validates their FMCSA standing, and confirms pickup details with the driver. You get a notification with the driver's name + truck details."
              />
              <TimelineRow
                time="Pickup day"
                description="Driver arrives. Walks the vehicle with you. Photos go into your portal in real-time. BOL signed. You and your coordinator both have a copy. Truck rolls."
              />
              <TimelineRow
                time="In transit"
                description="GPS tracking and milestone updates surface in your portal. If anything unusual comes up — weather delay, mechanical, route change — your coordinator calls you proactively."
              />
              <TimelineRow
                time="Delivery day"
                description="Driver coordinates window with you. Walks the vehicle on arrival. Photos captured. BOL signed. If there's any damage to flag, you note it on the BOL right there."
              />
              <TimelineRow
                time="Post-delivery"
                description="Same coordinator stays your point of contact for any claim, follow-up, or future bookings. We don't recycle you back into the inbound funnel."
              />
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-gray-100">
          <Container>
            <FAQ items={faqs} title="Questions about how we work" />
          </Container>
        </section>

        {/* Final CTA */}
        <section className="py-16 bg-charcoal text-white">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                One named person. One phone number. One accountable point of contact.
              </h2>
              <p className="text-gray-300 text-lg mt-4">
                Get a locked price in 60 seconds. Then meet your coordinator
                — by name, with their direct line.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/quote"
                  className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  Get my locked price
                </Link>
                <Link
                  href="/about"
                  className="border border-white/30 hover:border-white text-white font-semibold px-6 py-3 rounded-full transition"
                >
                  Meet the team →
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <PromiseFooterNav current="people" />
      <Footer />
    </>
  );
}

function Commitment({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-orange transition">
      <p className="font-bold text-charcoal text-lg mb-2">{title}</p>
      <p className="text-gray-700 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function TimelineRow({
  time,
  description,
}: {
  time: string;
  description: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 p-5 bg-gray-100 rounded-xl">
      <p className="text-orange font-bold text-sm">{time}</p>
      <p className="text-gray-700 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
