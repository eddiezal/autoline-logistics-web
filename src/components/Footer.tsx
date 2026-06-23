import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "./Container";

/**
 * Site footer — charcoal background, neutral text.
 *
 * TODO before launch:
 * - Replace MC# / DOT# / BMC-84 placeholders with real numbers from Ben (open Action Item)
 * - Add review badges if available (Google Reviews, BBB)
 */
export function Footer() {
  const t = useTranslations();
  const phone = t("common.phone");
  const email = t("common.email");
  const street = t("common.address.street");
  const city = t("common.address.city");
  const year = new Date().getFullYear();
  const mc = process.env.NEXT_PUBLIC_MC_NUMBER ?? t("footer.credentials");

  return (
    <footer className="bg-charcoal text-gray-300 mt-auto">
      <Container className="py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <p className="text-white font-bold text-lg mb-3">
              {t("footer.brandLine")}
            </p>
            <p className="text-sm leading-relaxed">{t("footer.description")}</p>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
              {t("footer.sectionTitles.services")}
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/services/standby" className="hover:text-orange">
                  {t("footer.services.standby")}
                </Link>
              </li>
              <li>
                <Link href="/services/priority" className="hover:text-orange">
                  {t("footer.services.priority")}
                </Link>
              </li>
              <li>
                <Link href="/services/expedited" className="hover:text-orange">
                  {t("footer.services.expedited")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
              {t("footer.sectionTitles.promises")}
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/price-promise" className="hover:text-orange">
                  {t("footer.promises.price")}
                </Link>
              </li>
              <li>
                <Link href="/damage-promise" className="hover:text-orange">
                  {t("footer.promises.damage")}
                </Link>
              </li>
              <li>
                <Link href="/people-promise" className="hover:text-orange">
                  {t("footer.promises.people")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
              {t("footer.sectionTitles.contact")}
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
                  className="hover:text-orange cr-trackable"
                >
                  {phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${email}`} className="hover:text-orange">
                  {email}
                </a>
              </li>
              <li>{street}</li>
              <li>{city}</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-12 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-gray-500">
          <span>
            © {year} Auto Line Logistics, Inc. {t("footer.rights")}
          </span>
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Legal">
            <Link href="/terms-conditions" className="hover:text-orange">
              {t("footer.legal.terms")}
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/privacy-policy" className="hover:text-orange">
              {t("footer.legal.privacy")}
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/accessibility" className="hover:text-orange">
              {t("footer.legal.accessibility")}
            </Link>
          </nav>
          <span>{t("footer.credentials")}</span>
        </div>
      </Container>
    </footer>
  );
}
