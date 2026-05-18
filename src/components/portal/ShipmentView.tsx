import { assertNever } from "@/lib/types/shipment";
import type { Shipment, ShipmentStatus } from "@/lib/types/shipment";
import { PrepStage } from "./stages/PrepStage";
import { InTransitStage } from "./stages/InTransitStage";

/**
 * <ShipmentView> — the top-level portal component for rendering a
 * single shipment. Reads `shipment.status` and dispatches to the right
 * stage component.
 *
 * Stages we've built so far:
 * - prep      → <PrepStage>
 * - inTransit → <InTransitStage>
 *
 * Stages still as inline stubs (build out as we need them):
 * - booked, pickedUp, atDelivery, delivered, completed, claimed
 *
 * Cross-stage components (Promise Card, Payment Portal) will live
 * here once we build them — they render regardless of stage.
 *
 * NOTE: The mockup shows a persistent coordinator-contact bar at the
 * bottom and the Promise Card / Payment Portal sections above the
 * stage view. Those are deferred to the polished-UI session.
 */

type Props = {
  shipment: Shipment;
};

export function ShipmentView({ shipment }: Props) {
  return (
    <div className="space-y-6">
      <ShipmentHeader shipment={shipment} />
      <StageView shipment={shipment} />
    </div>
  );
}

/* ============================================================
 * Header — order number + route + status badge
 * Always rendered above whatever stage view is active.
 * ============================================================ */

function ShipmentHeader({ shipment }: { shipment: Shipment }) {
  return (
    <header>
      <div
        className="text-sm font-semibold uppercase tracking-wider mb-2"
        style={{ color: "var(--color-text-muted)" }}
      >
        Order #{shipment.orderNumber} · <StatusBadge status={shipment.status} />
      </div>
      <h1
        className="text-2xl md:text-3xl font-bold"
        style={{
          color: "var(--color-text-default)",
          fontFamily: "var(--font-brand-display)",
          letterSpacing: "var(--letter-spacing-display)",
        }}
      >
        {shipment.vehicle.year} {shipment.vehicle.make} {shipment.vehicle.model}
      </h1>
      <p
        className="text-base mt-1"
        style={{ color: "var(--color-text-muted)" }}
      >
        {shipment.origin.city}, {shipment.origin.state} →{" "}
        {shipment.destination.city}, {shipment.destination.state}
      </p>
    </header>
  );
}

function StatusBadge({ status }: { status: ShipmentStatus }) {
  const labels: Record<ShipmentStatus, string> = {
    booked: "Booked",
    prep: "Prep stage",
    pickedUp: "Picked up",
    inTransit: "In transit",
    atDelivery: "At delivery",
    delivered: "Delivered",
    completed: "Completed",
    claimed: "Claim filed",
  };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
      style={{
        background: "color-mix(in oklab, var(--color-brand-primary) 12%, white)",
        color: "var(--color-brand-primary-hover)",
      }}
    >
      {labels[status]}
    </span>
  );
}

/* ============================================================
 * Stage dispatch — the actual status switch
 * ============================================================ */

function StageView({ shipment }: { shipment: Shipment }) {
  switch (shipment.status) {
    case "prep":
      return <PrepStage shipment={shipment} />;
    case "inTransit":
      return <InTransitStage shipment={shipment} />;

    // Stages we'll build as we need them — inline stubs for now.
    case "booked":
    case "pickedUp":
    case "atDelivery":
    case "delivered":
    case "completed":
    case "claimed":
      return <StageStub status={shipment.status} shipment={shipment} />;

    default:
      // Compile-time exhaustiveness check — TypeScript errors here
      // if a new ShipmentStatus is added without a matching case.
      return assertNever(shipment.status);
  }
}

/* ============================================================
 * Inline stub for unbuilt stages
 * Replace each case with a real stage component as they get built.
 * ============================================================ */

function StageStub({
  status,
  shipment,
}: {
  status: Exclude<ShipmentStatus, "prep" | "inTransit">;
  shipment: Shipment;
}) {
  const stubCopy: Record<typeof status, { title: string; body: string }> = {
    booked: {
      title: "Booking confirmed",
      body: "Your shipment is booked. Driver assignment + prep checklist activates ~3 days before pickup.",
    },
    pickedUp: {
      title: "Vehicle picked up",
      body: "Your vehicle is loaded. Transit view will activate once the driver pings their first GPS waypoint.",
    },
    atDelivery: {
      title: "Driver arriving today",
      body: "Your vehicle is within the delivery window. Track final approach + schedule your handoff window.",
    },
    delivered: {
      title: "Delivered",
      body: "Vehicle delivered. Inspect, sign the BOL, and complete your review. Damage-claim window open for 24 hours.",
    },
    completed: {
      title: "Shipment complete",
      body: "Thanks for shipping with us. Refer a friend for $50 credit each.",
    },
    claimed: {
      title: "Claim filed",
      body: "Your claim is being investigated. We'll update you within 24 hours.",
    },
  };

  const copy = stubCopy[status];

  return (
    <section
      className="rounded-2xl border-2 border-dashed p-8 md:p-12"
      style={{
        borderColor: "var(--color-gray-200)",
        background: "var(--color-surface-elevated)",
      }}
    >
      <h2
        className="text-xl md:text-2xl font-semibold"
        style={{ color: "var(--color-text-default)" }}
      >
        {copy.title}
      </h2>
      <p
        className="mt-2 max-w-2xl"
        style={{ color: "var(--color-text-muted)" }}
      >
        {copy.body}
      </p>
      <p
        className="mt-6 text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        (UI stub — full {status} stage builds out as we ship through each
        lifecycle phase. Data layer is already wired: this shipment has{" "}
        {shipment.milestones.length} milestone(s), {shipment.payments.length}{" "}
        payment(s), and is tier &ldquo;{shipment.tier}&rdquo;.)
      </p>
    </section>
  );
}
