import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getShipmentByOrderNumber } from "@/lib/shipments/repository";
import { ShipmentView } from "@/components/portal/ShipmentView";
import { requireSession } from "@/lib/firebase/session";

/**
 * Shipment detail view — `/portal/[orderNumber]`
 *
 * Resolves a shipment from the repository (mock today, Firestore Monday)
 * and renders <ShipmentView>, which dispatches to the right stage
 * component based on shipment.status.
 *
 * Try these in dev:
 * - /portal/ALL-2026-04830 → Sarah Chen, PREP stage (full UI)
 * - /portal/ALL-2026-04831 → Mike Johnson, IN_TRANSIT stage (full UI)
 * - /portal/ALL-XXXX        → not-found placeholder
 *
 * When Firebase Auth + Firestore are wired:
 * - Verify auth.uid matches shipment.customer.id before rendering
 * - Subscribe to Firestore listener for real-time updates (client comp)
 */

type Props = {
  params: Promise<{ orderNumber: string; locale: string }>;
};

export default async function ShipmentPage({ params }: Props) {
  const { orderNumber, locale } = await params;
  // Layer 2: real session verification (Node). Redirects to login if invalid.
  // TODO(#38/#39): also assert session.uid === shipment.customer.id (ownership)
  // once shipments resolve from Firestore.
  await requireSession(locale);
  const shipment = await getShipmentByOrderNumber(orderNumber);

  if (!shipment) {
    return <ShipmentNotFound orderNumber={orderNumber} />;
  }

  return (
    <div className="space-y-4">
      <Link
        href="/portal"
        className="text-sm hover:underline"
        style={{ color: "var(--color-text-muted)" }}
      >
        ← Dashboard
      </Link>
      <ShipmentView shipment={shipment} />
    </div>
  );
}

function ShipmentNotFound({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("portal.shipment");

  return (
    <div className="space-y-6">
      <Link
        href="/portal"
        className="text-sm hover:underline"
        style={{ color: "var(--color-text-muted)" }}
      >
        ← Dashboard
      </Link>
      <header>
        <h1
          className="text-3xl md:text-4xl font-bold mt-2"
          style={{
            color: "var(--color-text-default)",
            fontFamily: "var(--font-brand-display)",
            letterSpacing: "var(--letter-spacing-display)",
          }}
        >
          Order #{orderNumber}
        </h1>
      </header>

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
          {t("notFound")}
        </h2>
        <p
          className="mt-2 max-w-md mx-auto"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("notFoundDescription")}
        </p>
        <p
          className="mt-6 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          (Available test shipments: <code>ALL-2026-04830</code> ·{" "}
          <code>ALL-2026-04831</code>. Real shipments resolve from Firestore
          once Ben provisions GCP.)
        </p>
      </section>
    </div>
  );
}
