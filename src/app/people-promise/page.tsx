import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";

export const metadata: Metadata = {
  title: "People Promise — Real people, by name",
  description:
    "Family-owned and operated. Bilingual front-line in English and Spanish. Named coordinator on every shipment. The opposite of a faceless broker.",
};

export default function PeoplePromisePage() {
  return (
    <>
      <Header />

      <main className="flex-1">
        <section className="bg-charcoal text-white py-16">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Promise 3 of 3
            </p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              People Promise
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl">
              You'll always talk to a real person, by name.
            </p>
          </Container>
        </section>

        <section className="py-16 bg-white">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromiseCommitment
                title="Named coordinator on every shipment"
                description="When you book, you're assigned a coordinator by name. They know your shipment. They pick up the phone."
              />
              <PromiseCommitment
                title="Bilingual front-line"
                description="Native Spanish and English coverage on the customer service team. No interpreter games."
              />
              <PromiseCommitment
                title="Family-owned and operated since 2014"
                description="Real names on the company. We started Auto Line Logistics because the industry needed someone willing to operate this way."
              />
              <PromiseCommitment
                title="No script, no transfer maze"
                description="Your coordinator owns the answer. If something goes wrong, the same person calls you back."
              />
            </div>

            <div className="mt-12 p-6 bg-orange-tint rounded-2xl border border-orange/20">
              <p className="font-semibold text-charcoal mb-2">
                The promise itself
              </p>
              <p className="text-gray-700 leading-relaxed">
                Auto transport got broken when it became faceless. We're
                rebuilding the operator-customer relationship the way it should
                have always worked: one named person, one phone number, one
                point of accountability — from quote to delivery.
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
                href="/about"
                className="border border-charcoal/20 hover:border-orange text-charcoal hover:text-orange font-semibold px-6 py-3 rounded-full transition"
              >
                Meet the team →
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}

function PromiseCommitment({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border border-gray-200 rounded-2xl p-6 hover:border-orange transition">
      <p className="font-bold text-charcoal text-lg mb-2">{title}</p>
      <p className="text-gray-700 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
