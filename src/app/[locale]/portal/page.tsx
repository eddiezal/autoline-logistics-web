import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/firebase/session";
import { listShipmentsForCustomerByEmail } from "@/lib/shipments/repository";
import type { Shipment, ShipmentStatus } from "@/lib/types/shipment";

/**
 * Portal dashboard — `/portal`
 *
 * Authenticated landing. Verifies the session (Node-side), then lists the
 * signed-in customer's shipments, queried by their email (the stable key for
 * magic-link auth). Renders the empty state when there are none.
 *
 * Data source is mock or Firestore depending on SHIPMENTS_SOURCE — the
 * repository hides that from this component.
 */

const STATUS_LABEL: Record<ShipmentStatus, string> = {
  booked: "Booked",
  prep: "Preparing for pickup",
  pickedUp: "Picked up",
  inTransit: "In transit",
  atDelivery: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  claimed: "Claim open",
};

export default async function PortalDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireSession(locale);
  const t = await getTranslations("portal.dashboard");

  const shipments = user.email
    ? await listShipmentsForCustomerByEmail(user.email)
    : [];

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
        <p className="text-base mt-1" style={{ color: "var(--color-text-muted)" }}>
          {t("subtitle")}
        </p>
      </header>

      {shipments.length === 0 ? (
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
      ) : (
        <ul className="space-y-4">
          {shipments.map((s) => (
            <li key={s.orderNumber}>
              <ShipmentCard shipment={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const { orderNumber, status, vehicle, origin, destination } = shipment;
  return (
    <Link
      href={`/portal/${orderNumber}`}
      className="block rounded-2xl border p-5 md:p-6 transition-shadow hover:shadow-md"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-gray-200)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="text-lg font-semibold"
            style={{ color: "var(--color-text-default)" }}
          >
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {origin.city}, {origin.state} → {destination.city}, {destination.state}
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
            Order #{orderNumber}
          </p>
        </div>
        <span
          className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full"
          style={{
            background: "var(--color-brand-accent)",
            color: "var(--color-brand-accent-ink)",
          }}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>
    </Link>
  );
}
