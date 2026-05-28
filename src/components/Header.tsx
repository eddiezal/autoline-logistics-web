"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "./Container";
import { LocaleSwitcher } from "./LocaleSwitcher";

/**
 * Site header — utility bar (orange) + main nav (white) + responsive
 * mobile menu drawer.
 *
 * Layout:
 *   - Top utility bar: phone, email, tagline, locale, Get Quote CTA
 *     (each element has its own visibility breakpoint, mostly responsive
 *      already; phone + locale + CTA always show, email hides <sm,
 *      tagline hides <md)
 *
 *   - Main nav row: logo (always shown, flex-shrink-0 to never squish)
 *     + desktop nav (visible md+) + hamburger button (visible <md)
 *
 *   - Mobile drawer: slides down below the header when hamburger tapped,
 *     contains the 5 nav links stacked + a prominent Get Quote button
 *     at the bottom (reinforces primary action). Each nav tap closes
 *     the drawer.
 *
 * Logo: /public/brand/wordmark-dark.png — transparent PNG, dark text
 * + orange "LINE" accent. flex-shrink-0 prevents the historical bug
 * where the flex container was squishing it to vertical streaks on
 * narrow viewports.
 *
 * Client component required for the useState toggle on the mobile
 * menu. The orange utility bar is fully presentational and could stay
 * server-rendered if we ever split, but inline simplicity wins.
 */
export function Header() {
  const t = useTranslations();
  const phone = t("common.phone");
  const email = t("common.email");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header>
      {/* Top utility bar — Pine (#0a1e14), matches the hero ink so the
          header reads as one system with the hero instead of a competing
          mid-green strip. Locked May 22, 2026 (Option A). */}
      <div className="bg-brand-ink text-white text-sm">
        <Container className="flex items-center justify-between py-2 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <a
              href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
              className="font-semibold hover:opacity-80"
            >
              {phone}
            </a>
            <a
              href={`mailto:${email}`}
              className="hidden sm:inline hover:opacity-80"
            >
              {email}
            </a>
          </div>
          <span className="hidden md:inline opacity-90">
            {t("header.tagline")}
          </span>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <Link
              href="/quote"
              className="bg-white text-charcoal px-4 py-1.5 rounded-full font-semibold text-xs hover:bg-gray-100 transition"
            >
              {t("header.ctaQuote")}
            </Link>
          </div>
        </Container>
      </div>

      {/* Main nav — white background, charcoal text, orange accent.
          Position: relative so the absolutely-positioned mobile drawer
          can anchor to it. */}
      <div className="bg-white border-b border-gray-200 relative">
        <Container className="flex items-center justify-between py-5">
          {/* Logo — flex-shrink-0 prevents the squish bug at narrow widths */}
          <Link
            href="/"
            className="flex items-center flex-shrink-0"
            aria-label="Auto Line Logistics — home"
            onClick={closeMenu}
          >
            <Image
              src="/brand/wordmark-dark.png"
              alt="Auto Line Logistics"
              width={1513}
              height={418}
              priority
              className="h-16 md:h-20 w-auto"
            />
          </Link>

          {/* Desktop nav — hidden below md. Same 5-link order as the
              mobile drawer below to keep the mental model consistent. */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
            <Link href="/" className="hover:text-orange transition">
              {t("header.nav.home")}
            </Link>
            <Link href="/services" className="hover:text-orange transition">
              {t("header.nav.services")}
            </Link>
            <Link href="/price-promise" className="hover:text-orange transition">
              {t("header.nav.promises")}
            </Link>
            <Link href="/resources" className="hover:text-orange transition">
              {t("header.nav.resources")}
            </Link>
            <Link href="/about" className="hover:text-orange transition">
              {t("header.nav.about")}
            </Link>
          </nav>

          {/* Hamburger button — visible only below md. Toggles the
              mobile drawer. Icon swaps between hamburger (closed) and
              X (open). aria-expanded + aria-controls expose the toggle
              state to assistive tech. */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-gray-300 text-charcoal hover:border-orange hover:text-orange transition"
            aria-label={
              isMenuOpen ? t("header.menu.close") : t("header.menu.open")
            }
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu-drawer"
          >
            {isMenuOpen ? (
              // X icon
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            ) : (
              // Hamburger icon
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </Container>

        {/* Mobile drawer — slides down below the nav row. Conditional
            render keeps the DOM clean when closed (no transition flicker
            on first render). md:hidden so it never appears on desktop
            even if state somehow lingered. z-50 so it sits above any
            absolutely-positioned hero content below. */}
        {isMenuOpen && (
          <div
            id="mobile-menu-drawer"
            className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50"
          >
            <Container className="py-2">
              <nav className="flex flex-col">
                <Link
                  href="/"
                  onClick={closeMenu}
                  className="text-base font-semibold text-charcoal hover:text-orange transition py-3 border-b border-gray-100"
                >
                  {t("header.nav.home")}
                </Link>
                <Link
                  href="/services"
                  onClick={closeMenu}
                  className="text-base font-semibold text-charcoal hover:text-orange transition py-3 border-b border-gray-100"
                >
                  {t("header.nav.services")}
                </Link>
                <Link
                  href="/price-promise"
                  onClick={closeMenu}
                  className="text-base font-semibold text-charcoal hover:text-orange transition py-3 border-b border-gray-100"
                >
                  {t("header.nav.promises")}
                </Link>
                <Link
                  href="/resources"
                  onClick={closeMenu}
                  className="text-base font-semibold text-charcoal hover:text-orange transition py-3 border-b border-gray-100"
                >
                  {t("header.nav.resources")}
                </Link>
                <Link
                  href="/about"
                  onClick={closeMenu}
                  className="text-base font-semibold text-charcoal hover:text-orange transition py-3"
                >
                  {t("header.nav.about")}
                </Link>
              </nav>
              {/* Primary CTA at the bottom of the drawer — reinforces
                  the booking action for mobile users who already opened
                  the menu (they're past the eyebrow-scan stage). */}
              <Link
                href="/quote"
                onClick={closeMenu}
                className="block w-full mt-3 mb-3 bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold text-center text-sm px-5 py-3 rounded-lg transition shadow-md shadow-orange/20"
              >
                {t("header.ctaQuote")} →
              </Link>
            </Container>
          </div>
        )}
      </div>
    </header>
  );
}
