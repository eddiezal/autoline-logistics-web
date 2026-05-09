import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "./Container";
import { LocaleSwitcher } from "./LocaleSwitcher";

/**
 * Site header — utility bar (orange) + main nav (white).
 * Mirrors the live site pattern at autolinelogistics.com.
 *
 * Logo: /public/brand/wordmark-dark.png — transparent PNG, dark text + orange "LINE" accent.
 * Source: brand-assets/transparent/wordmark-dark-transparent.png (1672x941 native).
 *
 * TODO:
 * - Wire phone number from a config/env (currently hardcoded placeholder)
 */
export function Header() {
  const t = useTranslations();
  const phone = t("common.phone");
  const email = t("common.email");

  return (
    <header>
      {/* Top utility bar — brand orange */}
      <div className="bg-orange text-white text-sm">
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
              {t("header.nav.home")}
            </Link>
            <Link href="/about" className="hover:text-orange transition">
              {t("header.nav.about")}
            </Link>
            <Link href="/services" className="hover:text-orange transition">
              {t("header.nav.services")}
            </Link>
            <Link href="/price-promise" className="hover:text-orange transition">
              {t("header.nav.promises")}
            </Link>
            <Link href="/contact" className="hover:text-orange transition">
              {t("header.nav.contact")}
            </Link>
          </nav>
        </Container>
      </div>
    </header>
  );
}
