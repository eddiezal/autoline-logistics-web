import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";

export const metadata: Metadata = {
  title: "Damage Promise — Coverage beyond the carrier",
  description:
    "$75K bond. $500K contingent cargo liability. 24-hour claim acknowledgment. 14-day resolution target. We handle the carrier so you don't have to.",
};

export default function DamagePromisePage() {
  return (
    <>
      <Header />

      <main className="flex-1">
        <section className="bg-charcoal text-white py-16">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              Promise 2 of 3
            </p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Damage Promise
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mt-4 max-w-2xl">
              Your car is covered beyond the carrier's insurance.
            </p>
          </Container>
        </section>

        <section className="py-16 bg-white">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <CoverageStat amount="$75,000" label="Carrier bond" />
              <CoverageStat
                amount="$500,000"
                label="Contingent cargo liability"
              />
              <CoverageStat amount="24 hours" label="Claim acknowledgment SLA" />
              <CoverageStat amount="14 days" label="Resolution target" />
            </div>

            <div className="mt-12 p-6 bg-orange-tint rounded-2xl border border-orange/20">
              <p className="font-semibold text-charcoal mb-2">
                The promise itself
              </p>
              <p className="text-gray-700 leading-relaxed">
                If something happens during transport, our coverage kicks in
                where the carrier's stops. We handle the carrier directly — you
                don't chase. We acknowledge claims within 24 hours and target
                14-day resolution.
              </p>
              <p className="text-gray-600 text-sm mt-3 italic">
                Note: Acts of God and road debris are not covered. Enclosed
                shipping is recommended for high-value or weather-sensitive
                vehicles.
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
                href="/people-promise"
                className="border border-charcoal/20 hover:border-orange text-charcoal hover:text-orange font-semibold px-6 py-3 rounded-full transition"
              >
                Read the People Promise →
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}

function CoverageStat({ amount, label }: { amount: string; label: string }) {
  return (
    <div className="border-l-4 border-orange pl-4 py-2">
      <p className="text-3xl md:text-4xl font-bold text-charcoal">{amount}</p>
      <p className="text-gray-700 text-sm mt-1">{label}</p>
    </div>
  );
}
