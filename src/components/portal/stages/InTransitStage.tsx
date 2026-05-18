import type { Shipment, MilestoneType } from "@/lib/types/shipment";

/**
 * <InTransitStage> — basic functional UI proving the data flows.
 *
 * Scope: render current-location, ETA, milestone timeline, and the
 * pickup/transit photo counts. Mockup-quality polish (live map, photo
 * gallery with click-to-expand, ETA confidence-fill visual) is a
 * separate session.
 *
 * Live map specifically is deferred until SD GPS data flows in real
 * time — we have one Location snapshot, not a live feed yet.
 */

type Props = { shipment: Shipment };

const MILESTONE_LABELS: Record<MilestoneType, string> = {
  booked: "Order booked",
  prepStarted: "Prep started",
  driverAssigned: "Driver assigned",
  pickedUp: "Picked up",
  atWaypoint: "Waypoint check-in",
  atDestinationRegion: "Arrived in destination region",
  delivered: "Delivered",
  documentsComplete: "Documents complete",
};

export function InTransitStage({ shipment }: Props) {
  const { currentLocation, eta, milestones, driver, coordinator } = shipment;
  const pickupPhotos = shipment.pickupPhotos ?? [];
  const transitPhotos = shipment.transitPhotos ?? [];

  return (
    <div className="space-y-6">
      {/* Current status banner */}
      {currentLocation && eta && (
        <CurrentStatusBanner location={currentLocation} eta={eta} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: timeline + photos */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Trip timeline">
            <ol
              className="space-y-3"
              style={{ color: "var(--color-text-default)" }}
            >
              {milestones
                .slice()
                .sort(
                  (a, b) =>
                    new Date(a.at).getTime() - new Date(b.at).getTime(),
                )
                .map((m) => (
                  <li key={m.id} className="flex items-start gap-3">
                    <span
                      className="inline-block w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: "var(--color-brand-primary)" }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">
                        {MILESTONE_LABELS[m.type]}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {formatDateTime(m.at)}
                        {m.location ? ` · ${m.location.label}` : ""}
                      </p>
                      {m.notes && (
                        <p
                          className="text-xs italic mt-1"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {m.notes}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
            </ol>
          </Card>

          <Card title="Inspection photos">
            <div className="flex gap-4 text-sm">
              <PhotoTab label="Pickup" count={pickupPhotos.length} />
              <PhotoTab label="Transit" count={transitPhotos.length} />
              <PhotoTab label="Delivery" count={0} locked />
            </div>
            <p
              className="mt-4 text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {pickupPhotos.length} pickup photos captured by the driver at
              load.{" "}
              {transitPhotos.length > 0
                ? `${transitPhotos.length} transit waypoint photo${transitPhotos.length === 1 ? "" : "s"} captured en route.`
                : "Waypoint photos populate as the driver makes stops."}{" "}
              Delivery photos appear once the vehicle arrives.
            </p>
          </Card>
        </div>

        {/* Right column: shipment + driver + coordinator */}
        <div className="space-y-6">
          <Card title="Shipment">
            <DataRow label="Order" value={shipment.orderNumber} />
            <DataRow
              label="Vehicle"
              value={`${shipment.vehicle.year} ${shipment.vehicle.make} ${shipment.vehicle.model}`}
            />
            <DataRow
              label="Route"
              value={`${shipment.origin.city}, ${shipment.origin.state} → ${shipment.destination.city}, ${shipment.destination.state}`}
            />
            <DataRow
              label="Tier"
              value={
                shipment.tier.charAt(0).toUpperCase() + shipment.tier.slice(1)
              }
            />
            <DataRow
              label="Locked price"
              value={formatUSD(shipment.priceLockedCents)}
            />
          </Card>

          {driver && (
            <Card title="Your driver">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold"
                  style={{
                    background: "var(--color-brand-primary)",
                    color: "var(--color-brand-paper)",
                  }}
                >
                  {driver.initials}
                </div>
                <div>
                  <p
                    className="font-semibold"
                    style={{ color: "var(--color-text-default)" }}
                  >
                    {driver.name}
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {driver.carrierName} · {driver.rating}★ ·{" "}
                    {driver.yearsExperience} yrs
                  </p>
                </div>
              </div>
            </Card>
          )}

          {coordinator && (
            <Card title="Your coordinator">
              <p
                className="font-semibold"
                style={{ color: "var(--color-text-default)" }}
              >
                {coordinator.name}
              </p>
              <p
                className="text-sm mt-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                {coordinator.hours.start}–{coordinator.hours.end}{" "}
                {tzShortName(coordinator.hours.timezone)}
              </p>
              <a
                href={`mailto:${coordinator.email}`}
                className="text-sm font-semibold hover:underline block mt-2"
                style={{ color: "var(--color-brand-primary)" }}
              >
                {coordinator.email}
              </a>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Sub-components
 * ============================================================ */

function CurrentStatusBanner({
  location,
  eta,
}: {
  location: { label: string; lastUpdatedAt: string };
  eta: { at: string; confidenceScore: number };
}) {
  const confidencePct = Math.round(eta.confidenceScore * 100);
  return (
    <section
      className="rounded-2xl p-6"
      style={{
        background:
          "linear-gradient(135deg, var(--color-brand-ink), color-mix(in oklab, var(--color-brand-ink) 80%, var(--color-brand-primary)))",
        color: "var(--color-brand-paper)",
      }}
    >
      <p
        className="text-xs uppercase tracking-wider opacity-75"
        style={{ fontFamily: "var(--font-brand-body)" }}
      >
        Current location
      </p>
      <h2
        className="text-2xl md:text-3xl font-bold mt-1"
        style={{
          fontFamily: "var(--font-brand-display)",
          letterSpacing: "var(--letter-spacing-display)",
        }}
      >
        {location.label}
      </h2>
      <p className="text-sm mt-1 opacity-90">
        Last updated {timeAgo(location.lastUpdatedAt)}
      </p>
      <div
        className="mt-4 pt-4 border-t flex items-baseline justify-between gap-4"
        style={{ borderColor: "rgba(255,255,255,0.15)" }}
      >
        <div>
          <p className="text-xs uppercase tracking-wider opacity-75">
            Estimated arrival
          </p>
          <p
            className="text-xl font-bold mt-1"
            style={{
              fontFamily: "var(--font-brand-display)",
              letterSpacing: "var(--letter-spacing-display)",
            }}
          >
            {formatDateTime(eta.at)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider opacity-75">
            Confidence
          </p>
          <p className="text-xl font-bold mt-1">{confidencePct}%</p>
        </div>
      </div>
    </section>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-5 md:p-6"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-gray-200)",
      }}
    >
      <h3
        className="text-sm font-bold uppercase tracking-wider mb-3"
        style={{ color: "var(--color-text-muted)" }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span
        className="font-semibold text-right"
        style={{ color: "var(--color-text-default)" }}
      >
        {value}
      </span>
    </div>
  );
}

function PhotoTab({
  label,
  count,
  locked,
}: {
  label: string;
  count: number;
  locked?: boolean;
}) {
  return (
    <div
      className="flex-1 rounded-lg border px-3 py-2 text-center"
      style={{
        borderColor: locked ? "var(--color-gray-200)" : "var(--color-gray-300)",
        background: locked
          ? "var(--color-surface-elevated)"
          : "var(--color-surface)",
        opacity: locked ? 0.5 : 1,
      }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </div>
      <div
        className="text-lg font-bold mt-0.5"
        style={{ color: "var(--color-text-default)" }}
      >
        {count}
      </div>
    </div>
  );
}

/* ============================================================
 * Helpers
 * ============================================================ */

function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const d = Math.floor(hr / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function tzShortName(tz: string): string {
  const map: Record<string, string> = {
    "America/Los_Angeles": "PT",
    "America/Phoenix": "MT",
    "America/Chicago": "CT",
    "America/New_York": "ET",
  };
  return map[tz] ?? tz;
}
