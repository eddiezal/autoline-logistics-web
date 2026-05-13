import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { ShipVsDriveCalculator } from "@/components/ShipVsDriveCalculator";

export const metadata: Metadata = {
  title: "Ship vs Drive Calculator — Auto Line Logistics",
  description:
    "Compare the real cost of shipping your car vs driving it yourself. Fuel, hotels, food, vehicle wear, and your time — side by side.",
};

/**
 * /tools/ship-vs-drive — §1 named deliverable.
 *
 * Math-only v1. Server-rendered hero + final CTA; the calculator itself
 * is a client component because it needs interactive state for the inputs.
 */
export default function ShipVsDrivePage() {
  const t = useTranslations();

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-charcoal text-white py-16 md:py-20">
          <Container>
            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {t("shipVsDrive.hero.eyebrow")}
            </p>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
              {t("shipVsDrive.hero.title")}
            </h1>
            <p className="text-xl md:text-2xl text-gray-100 mt-4 max-w-2xl leading-relaxed">
              {t("shipVsDrive.hero.description")}
            </p>
          </Container>
        </section>

        {/* Calculator */}
        <section className="py-16 bg-white">
          <Container>
            <ShipVsDriveCalculator />
          </Container>
        </section>
      </main>

      <Footer />
    </>
  );
}
