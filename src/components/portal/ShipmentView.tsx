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
    // 20px gap between header (route line) and tracking module per
    // Option B spec 2026-06-09. The tracking module now carries its own
    // dark green status header which connects visually to the map; this
    // outer gap lets the page header breathe without disconnecting them.
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
        className="flex items-center gap-2 flex-wrap"
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "#64748b",
          marginBottom: 8,
        }}
      >
        <span>Order #{shipment.orderNumber}</span>
        <StatusBadge status={shipment.status} />
      </div>
      <h1
        style={{
          fontSize: "clamp(28px, 4.5vw, 34px)",
          lineHeight: 1.05,
          fontWeight: 800,
          letterSpacing: "-0.035em",
          color: "#020617",
          marginBottom: 6,
          fontFamily: "var(--font-brand-display)",
        }}
      >
        {shipment.vehicle.year} {shipment.vehicle.make} {shipment.vehicle.model}
      </h1>
      <p
        style={{
          fontSize: "clamp(15px, 1.6vw, 17px)",
          lineHeight: 1.4,
          fontWeight: 500,
          color: "#475569",
          marginBottom: 0,
        }}
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
  // Soft green pill per the Option B spec (2026-06-09). The hero card
  // ABOVE the map is dark green now (TrackingStatusHeader), so this
  // light green chip no longer competes — they read as part of the
  // same green visual system. Different shade, same brand language.
  return (
    <span
      className="inline-block"
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "#047857",
        background: "#dcfce7",
        border: "1px solid #bbf7d0",
        borderRadius: 999,
        padding: "3px 8px",
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
