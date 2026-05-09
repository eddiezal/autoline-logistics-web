import Link from "next/link";
import { Container } from "./Container";

/**
 * Site footer — charcoal background, neutral text.
 *
 * TODO before launch:
 * - Replace MC# / DOT# / BMC-84 placeholders with real numbers from Ben (open Action Item)
 * - Add review badges if available (Google Reviews, BBB)
 * - Add Spanish footer text once next-intl is wired
 */
export function Footer() {
  return (
    <footer className="bg-charcoal text-gray-300 mt-auto">
      <Container className="py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <p className="text-white font-bold text-lg mb-3">Auto Line Logistics</p>
            <p className="text-sm leading-relaxed">
              Locked-price auto transport for individual customers. Built on real
              tracking, named coordinators, and a damage protection promise.
            </p>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
              Services
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/services/standby" className="hover:text-orange">
                  Standby (7-day)
                </Link>
              </li>
              <li>
                <Link href="/services/priority" className="hover:text-orange">
                  Priority (3–5 day)
                </Link>
              </li>
              <li>
                <Link href="/services/expedited" className="hover:text-orange">
                  Expedited (24–48 hour)
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
              Promises
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/price-promise" className="hover:text-orange">
                  Price Promise
                </Link>
              </li>
              <li>
                <Link href="/damage-promise" className="hover:text-orange">
                  Damage Promise
                </Link>
              </li>
              <li>
                <Link href="/people-promise" className="hover:text-orange">
                  People Promise
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
              Contact
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="tel:7146607558" className="hover:text-orange">
                  714-660-7558
                </a>
              </li>
              <li>
                <a href="mailto:info@autolinelogistics.com" className="hover:text-orange">
                  info@autolinelogistics.com
                </a>
              </li>
              <li>10073 Valley View St, Ste 120</li>
              <li>Cypress, CA 90630</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-12 pt-6 flex flex-col md:flex-row justify-between gap-3 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} Auto Line Logistics, LLC. All rights reserved.</span>
          <span>
            MC# {process.env.NEXT_PUBLIC_MC_NUMBER ?? "[pending]"} · DOT#{" "}
            {process.env.NEXT_PUBLIC_DOT_NUMBER ?? "[pending]"} · BMC-84 Bond on file
          </span>
        </div>
      </Container>
    </footer>
  );
}
