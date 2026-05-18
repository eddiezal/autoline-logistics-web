import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Portal dashboard — `/portal`
 *
 * MVP UI: list of customer's active + recent shipments. For now, this
 * is a stub showing the empty state.
 *
 * When auth + Firestore are wired:
 * - Resolve currently-authenticated customer from Firebase Auth
 * - Query Firestore: shipments where customerId == auth.uid
 * - Render single-active-shipment card OR list of shipments
 * - Redirect to /portal/[orderNumber] if only one active
 */

export default function PortalDashboard() {
  const t = useTranslations("portal.dashboard");

  return (
    <div className="space-y-6">
      <header>
        <h1
          className="text-3xl md:text-4xl font-bold"
          style={{
            color: "var(--color-text-default)",
            fontFamily: "var(--font-brand-display)",
            letterSpacing: "var(--letter-spacing-display)",
          }}
        >
          {t("title")}
        </h1>
        <p
          className="text-base mt-1"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("subtitle")}
        </p>
      </header>

      {/* Empty state — no shipments yet */}
      <section
        className="rounded-2xl border-2 border-dashed p-8 md:p-12 text-center"
        style={{
          borderColor: "var(--color-gray-200)",
          background: "var(--color-surface-elevated)",
        }}
      >
        <h2
          className="text-xl md:text-2xl font-semibold"
          style={{ color: "var(--color-text-default)" }}
        >
          {t("emptyTitle")}
        </h2>
        <p
          className="mt-2 max-w-md mx-auto"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("emptyDescription")}
        </p>
        <Link
          href="/quote"
          className="inline-block mt-6 px-6 py-3 rounded-full font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "var(--color-brand-primary)",
            color: "var(--color-brand-paper)",
          }}
        >
          {t("emptyAction")}
        </Link>
      </section>
    </div>
  );
}
