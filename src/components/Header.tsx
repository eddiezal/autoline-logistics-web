import Image from "next/image";
import Link from "next/link";
import { Container } from "./Container";

/**
 * Site header — utility bar (orange) + main nav (white).
 * Mirrors the live site pattern at autolinelogistics.com.
 *
 * Logo: /public/brand/wordmark-dark.png — transparent PNG, dark text + orange "LINE" accent.
 * Source: brand-assets/transparent/wordmark-dark-transparent.png (1672x941 native).
 *
 * TODO:
 * - Wire phone number from a config/env (currently hardcoded placeholder)
 * - Add EN/ES toggle once next-intl is wired up
 */
export function Header() {
  return (
    <header>
      {/* Top utility bar — brand orange */}
      <div className="bg-orange text-white text-sm">
        <Container className="flex items-center justify-between py-2 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <a href="tel:7146607558" className="font-semibold hover:opacity-80">
              714-660-7558
            </a>
            <a
              href="mailto:info@autolinelogistics.com"
              className="hidden sm:inline hover:opacity-80"
            >
              info@autolinelogistics.com
            </a>
          </div>
          <span className="hidden md:inline opacity-90">
            Trusted Vehicle Shipping for Cars, Trucks & Motorcycles — Nationwide
          </span>
          <Link
            href="/quote"
            className="bg-white text-charcoal px-4 py-1.5 rounded-full font-semibold text-xs hover:bg-gray-100 transition"
          >
            Get Your Instant Quote
          </Link>
        </Container>
      </div>

      {/* Main nav — white background, charcoal text, orange accent */}
      <div className="bg-white border-b border-gray-200">
        <Container className="flex items-center justify-between py-5">
          <Link href="/" className="flex items-center" aria-label="Auto Line Logistics — home">
            <Image
              src="/brand/wordmark-dark.png"
              alt="Auto Line Logistics"
              width={1513}
              height={418}
              priority
              className="h-16 md:h-20 w-auto"
            />
          </Link>

          <nav className="flex items-center gap-6 text-sm font-medium text-gray-700">
            <Link href="/" className="hover:text-orange transition">
              Home
            </Link>
            <Link href="/about" className="hover:text-orange transition">
              About
            </Link>
            <Link href="/services" className="hover:text-orange transition">
              Services
            </Link>
            <Link href="/price-promise" className="hover:text-orange transition">
              Promises
            </Link>
            <Link href="/contact" className="hover:text-orange transition">
              Contact
            </Link>
          </nav>
        </Container>
      </div>
    </header>
  );
}
