import type { Shipment, ChecklistKey } from "@/lib/types/shipment";

/**
 * <PrepStage> — basic functional UI proving the data flows.
 *
 * Scope: render the customer's prep-stage data in a readable layout.
 * NOT in scope this session: matching the mockup's polish (rich
 * checklist UI with timestamps, photo grid with upload affordances,
 * "what to expect on pickup day" timeline, brand-styled cards).
 * That's a separate UI-build session — data layer must be sound first.
 */

type Props = { shipment: Shipment };

const CHECKLIST_LABELS: Record<ChecklistKey, string> = {
  removePersonalItems: "Remove all personal items",
  removeAccessories: "Remove or secure loose accessories",
  reduceFuel: "Reduce fuel to ¼ tank",
  disableAlarm: "Disable aftermarket alarm",
  noteExistingDamage: "Note any existing damage",
  batteryAndTires: "Battery charged & tires inflated",
  wash: "Wash your vehicle",
  leaveKeys: "Leave one set of keys",
};

const REQUIRED_PHOTO_ANGLES = [
  "front",
  "rear",
  "driverSide",
  "passengerSide",
  "dashboard",
  "damage",
] as const;

export function PrepStage({ shipment }: Props) {
  const { driver, coordinator, scheduledPickup, prepChecklist, customerPrepPhotos } =
    shipment;

  const checklistDone =
    prepChecklist?.filter((c) => c.completedAt).length ?? 0;
  const checklistTotal = prepChecklist?.length ?? 0;
  const checklistPct =
    checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const photosDone = customerPrepPhotos?.length ?? 0;
  const photosTotal = REQUIRED_PHOTO_ANGLES.length;

  return (
    <div className="space-y-6">
      {/* Days-to-go banner */}
      {scheduledPickup && (
        <DaysToGoBanner pickup={scheduledPickup} driverName={driver?.name} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: checklist + photo doc */}
        <div className="lg:col-span-2 space-y-6">
          <Card title={`Vehicle prep checklist — ${checklistDone}/${checklistTotal}`}>
            <ProgressBar pct={checklistPct} />
            <ul className="mt-4 space-y-2 text-sm">
              {prepChecklist?.map((item) => (
                <li
                  key={item.key}
                  className="flex items-start gap-3"
                  style={{ color: "var(--color-text-default)" }}
                >
                  <span
                    className="inline-block w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{
                      background: item.completedAt
                        ? "var(--color-success)"
                        : "var(--color-gray-200)",
                      color: item.completedAt
                        ? "var(--color-brand-paper)"
                        : "var(--color-text-muted)",
                    }}
                  >
                    {item.completedAt ? "✓" : ""}
                  </span>
                  <span
                    className={item.completedAt ? "" : "opacity-60"}
                  >
                    {CHECKLIST_LABELS[item.key]}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={`Photo documentation — ${photosDone}/${photosTotal}`}>
            <ProgressBar pct={Math.round((photosDone / photosTotal) * 100)} />
            <p
              className="mt-3 text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              Photos must be uploaded before pickup. They document the
              vehicle&rsquo;s pre-transport condition for damage-claim purposes.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {REQUIRED_PHOTO_ANGLES.map((angle) => {
                const uploaded = customerPrepPhotos?.find(
                  (p) => p.angle === angle,
                );
                return (
                  <div
                    key={angle}
                    className="aspect-square rounded-lg border flex items-center justify-center text-xs text-center px-2"
                    style={{
                      borderColor: uploaded
                        ? "var(--color-success)"
                        : "var(--color-gray-300)",
                      background: uploaded
                        ? "color-mix(in oklab, var(--color-success) 8%, white)"
                        : "var(--color-surface-elevated)",
                      color: uploaded
                        ? "var(--color-success)"
                        : "var(--color-text-muted)",
                    }}
                  >
                    {uploaded ? `✓ ${angleLabel(angle)}` : `+ ${angleLabel(angle)}`}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right column: shipment summary + driver + coordinator */}
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
                {coordinator.name}{" "}
                <span
                  className="text-xs font-normal ml-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  ({coordinator.languages.map((l) => l.toUpperCase()).join(" · ")})
                </span>
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

function DaysToGoBanner({
  pickup,
  driverName,
}: {
  pickup: { start: string; end: string; timezone: string };
  driverName?: string;
}) {
  const daysUntil = daysFromNow(pickup.start);
  return (
    <section
      className="rounded-2xl border p-6"
      style={{
        background: "color-mix(in oklab, var(--color-warning) 10%, white)",
        borderColor: "color-mix(in oklab, var(--color-warning) 35%, white)",
      }}
    >
      <h2
        className="text-lg font-bold"
        style={{ color: "var(--color-text-default)" }}
      >
        Get ready for pickup —{" "}
        <span
          style={{
            color:
              "color-mix(in oklab, var(--color-warning) 80%, black)",
          }}
        >
          {daysUntil <= 0
            ? "today"
            : daysUntil === 1
              ? "1 day to go"
              : `${daysUntil} days to go`}
        </span>
      </h2>
      <p
        className="mt-2 text-sm"
        style={{ color: "var(--color-text-default)" }}
      >
        {driverName ? `${driverName} is scheduled to arrive ` : "Pickup window: "}
        <strong>{formatPickupWindow(pickup)}</strong>. Finish your prep
        checklist and upload pickup photos so everything&rsquo;s ready.
      </p>
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

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      className="h-2 rounded-full overflow-hidden"
      style={{ background: "var(--color-gray-200)" }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          background: "var(--color-brand-primary)",
        }}
      />
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

function daysFromNow(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function angleLabel(angle: string): string {
  const labels: Record<string, string> = {
    front: "Front",
    rear: "Rear",
    driverSide: "Driver side",
    passengerSide: "Passenger side",
    dashboard: "Dashboard",
    damage: "Damage",
  };
  return labels[angle] ?? angle;
}

function tzShortName(tz: string): string {
  // Quick mapping for the timezones we use; full Intl.DateTimeFormat
  // resolution lands when we have more locales.
  const map: Record<string, string> = {
    "America/Los_Angeles": "PT",
    "America/Phoenix": "MT",
    "America/Chicago": "CT",
    "America/New_York": "ET",
  };
  return map[tz] ?? tz;
}

function formatPickupWindow(pickup: {
  start: string;
  end: string;
  timezone: string;
}): string {
  const start = new Date(pickup.start);
  const end = new Date(pickup.end);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: pickup.timezone,
  };
  const fmt = new Intl.DateTimeFormat("en-US", opts);
  // Pull just the time piece for `end`.
  const endTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: pickup.timezone,
  }).format(end);
  return `${fmt.format(start)}–${endTime} ${tzShortName(pickup.timezone)}`;
}
