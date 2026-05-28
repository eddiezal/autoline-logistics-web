import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

/**
 * Portal layout — wraps all /portal/* routes.
 *
 * Different from the marketing layout: no main nav, no marketing footer,
 * minimal chrome. The portal is a focused authenticated experience.
 *
 * Notes:
 * - Auth-gating happens in `middleware.ts` (to be added). For now, all
 *   portal routes render their stub UI without enforcing auth.
 * - All colors and fonts read from brand tokens (var(--color-brand-*),
 *   var(--font-brand-*)) so the entire portal reskins automatically
 *   when Ben locks a brand direction.
 * - Build banner is intentionally loud — until Firebase is provisioned
 *   and SD/CD APIs are wired, customers should know data is placeholder.
 */

export const metadata: Metadata = {
  title: "Customer Portal — Auto Line Logistics",
  description:
    "Track your shipment, view inspection photos, and message your coordinator.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("portal.common");

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--color-surface)" }}
    >
      {/* Top bar — wordmark + locale + account */}
      <header
        className="px-4 py-3 md:px-6 flex items-center justify-between gap-4"
        style={{
          background: "var(--color-brand-ink)",
          color: "var(--color-brand-paper)",
        }}
      >
        <Link
          href="/portal"
          className="font-bold text-base md:text-lg tracking-tight"
          style={{
            fontFamily: "var(--font-brand-display)",
            letterSpacing: "var(--letter-spacing-display)",
          }}
        >
          {t("wordmark")}
        </Link>
        <div className="flex items-center gap-3 md:gap-4">
          <LocaleSwitcher />
          <Link
            href="/portal/account"
            className="text-sm hover:underline opacity-90 hover:opacity-100"
          >
            {t("account")}
          </Link>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 px-4 py-6 md:px-8 md:py-10 max-w-6xl mx-auto w-full">
        {children}
      </main>

      {/* Minimal footer — credentials + help link only */}
      <footer
        className="border-t px-6 py-4 text-center text-xs"
        style={{
          background: "var(--color-surface-elevated)",
          borderColor: "var(--color-gray-200)",
          color: "var(--color-text-muted)",
        }}
      >
        <p>Auto Line Logistics, Inc. · USDOT 3961864 · MC 1477788</p>
        <p className="mt-1">{t("needHelp")}</p>
      </footer>
    </div>
  );
}
