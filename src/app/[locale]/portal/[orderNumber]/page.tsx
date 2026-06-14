import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getShipmentByOrderNumber } from "@/lib/shipments/repository";
import { ShipmentView } from "@/components/portal/ShipmentView";
import { requireSession } from "@/lib/firebase/session";

/**
 * Shipment detail view at /portal/[orderNumber].
 *
 * Resolves a shipment from the repository (mock or Firestore depending
 * on SHIPMENTS_SOURCE) and renders <ShipmentView>, which dispatches to
 * the right stage component based on shipment.status.
 *
 * Auth model:
 *   Layer 1 (Edge proxy): __session cookie must be present.
 *   Layer 2 (Node):       cryptographically verify the session cookie
 *                         (this page calls requireSession).
 *   Layer 3 (Ownership):  the signed-in user's email must match the
 *                         shipment's customer email. Mismatch renders
 *                         NotFound (NOT Forbidden) so signed-in
 *                         attackers cannot enumerate valid order numbers.
 */

type Props = {
  params: Promise<{ orderNumber: string; locale: string }>;
};

export default async function ShipmentPage({ params }: Props) {
  const { orderNumber, locale } = await params;

  // Layer 2: real session verification. Redirects to login if invalid.
  const session = await requireSession(locale);

  const shipment = await getShipmentByOrderNumber(orderNumber);
  if (!shipment) {
    return <ShipmentNotFound orderNumber={orderNumber} />;
  }

  // Layer 3: ownership check. Mirror repository normalization (lowercase + trim).
  const sessionEmail = session.email?.trim().toLowerCase() ?? "";
  const ownerEmail = shipment.customer.email.trim().toLowerCase();
  if (sessionEmail !== ownerEmail) {
    return <ShipmentNotFound orderNumber={orderNumber} />;
  }

  return (
    <div className="space-y-2">
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
