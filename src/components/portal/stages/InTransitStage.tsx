"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  Shipment,
  MilestoneType,
  Milestone,
  Photo,
  Location,
  ETAEstimate,
  Address,
  Coordinator,
} from "@/lib/types/shipment";
import {
  Card,
  CardHead,
  TrustPillar,
  PickupTeamCard,
  LockedPriceCard,
  ShipmentDetailsCard,
  HelpfulResourcesCard,
  IconLock,
  IconUser,
  IconHeadset,
  IconCamera,
  IconMapPin,
  IconClock,
  IconTruck,
  IconFlag,
  IconCheck,
  formatUSD,
  tzShortName,
  timeAgo,
} from "../_shared";

/**
 * <InTransitStage> — visibility-focused cousin of PrepStage (May 27, 2026).
 *
 * Different emotional frame from PrepStage. There, the customer's job was
 * "do these things before pickup." Here, the customer has nothing to do —
 * the answer to "what do I need to do?" is "watch us deliver your car."
 * So this stage is visibility-led, not action-led:
 *
 *   1. TransitSummary       — soft green hero: "{driver} is on the way to {city}"
 *                             + ETA + confidence + trust strip (same 4 pillars)
 *   2. LiveLocationCard     — vertical journey rail: origin → current → destination
 *   3. MilestoneTimeline    — events that have happened + the next expected one
 *   4. PhotoTabsCard        — Pickup / Transit / Delivery tabs (Delivery locked)
 *   5. Sidebar              — same shared cards as PrepStage so the two stages
 *                             feel like one continuous product
 *
 * No CTA in the hero — the brand statement is "you can relax, we've got it."
 *
 * Client component because PhotoTabsCard uses useState for tab switching.
 *
 * EN/ES localized via next-intl (`portal.transit.*`). Strings live in
 * `src/messages/{en,es}.json`. Date/time formatting follows useLocale().
 */

type Props = { shipment: Shipment };

/* ============================================================
 * Main composition
 * ============================================================ */

export function InTransitStage({ shipment }: Props) {
  const t = useTranslations("portal.transit");
  const {
    driver,
    coordinator,
    currentLocation,
    eta,
    milestones,
    origin,
    destination,
    priceLockedCents,
    pickupPhotos,
    transitPhotos,
    deliveryPhotos,
  } = shipment;

  const firstName = coordinator?.name.split(" ")[0] ?? t("team.fallbackFirstName");

  return (
    <div className="space-y-6">
      <TransitSummary
        driverName={driver?.name}
        destination={destination}
        currentLocation={currentLocation}
        eta={eta}
        priceLockedCents={priceLockedCents}
        coordinator={coordinator}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* MAIN COLUMN */}
        <main className="space-y-6 min-w-0">
          {currentLocation && (
            <LiveLocationCard
              origin={origin}
              destination={destination}
              currentLocation={currentLocation}
            />
          )}
          <MilestoneTimeline
            milestones={milestones}
            eta={eta}
            destination={destination}
          />
          <PhotoTabsCard
            pickup={pickupPhotos ?? []}
            transit={transitPhotos ?? []}
            delivery={deliveryPhotos ?? []}
          />
        </main>

        {/* SIDEBAR */}
        <aside className="space-y-5">
          {(driver || coordinator) && (
            <PickupTeamCard
              driver={driver}
              coordinator={coordinator}
              title={t("team.title")}
              helpLineText={t("team.helpLine", { firstName })}
            />
          )}
          <LockedPriceCard amountCents={priceLockedCents} />
          <ShipmentDetailsCard shipment={shipment} />
          <HelpfulResourcesCard />
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
 * TransitSummary — visibility hero (cousin of ReadinessSummary)
 * ============================================================ */

function TransitSummary({
  driverName,
  destination,
  currentLocation,
  eta,
  priceLockedCents,
  coordinator,
}: {
  driverName?: string;
  destination: Address;
  currentLocation?: Location;
  eta?: ETAEstimate;
  priceLockedCents: number;
  coordinator?: Coordinator;
}) {
  const t = useTranslations("portal.transit");
  const locale = useLocale();
  const confidencePct = eta ? Math.round(eta.confidenceScore * 100) : null;
  // NB: in production the ETA timezone should come from destination — using
  // America/Denver here as a heuristic; refactor when SD feeds a proper tz.
  const etaText = eta ? formatETA(eta.at, "America/Denver", locale, t) : null;

  return (
    <section
      className="rounded-2xl border overflow-hidden"
      style={{
        background:
          "color-mix(in oklab, var(--color-brand-primary) 6%, white)",
        borderColor:
          "color-mix(in oklab, var(--color-brand-primary) 22%, white)",
      }}
    >
      <div className="px-6 py-6 md:px-8 md:py-7">
        <h2
          className="text-2xl md:text-[26px] font-extrabold leading-tight"
          style={{
            color: "var(--color-brand-ink)",
            fontFamily: "var(--font-brand-display)",
            letterSpacing: "var(--letter-spacing-display)",
          }}
        >
          {driverName
            ? `${t("summary.titleWithDriver", { driverName })} `
            : `${t("summary.titleNoDriver")} `}
          <span style={{ color: "var(--color-brand-primary)" }}>
            {destination.city}
          </span>
        </h2>
        <p
          className="mt-2 text-sm md:text-[15px] leading-relaxed max-w-xl"
          style={{ color: "var(--color-text-default)" }}
        >
          {currentLocation ? (
            <>
              {t("summary.currentlyNear")}{" "}
              <strong style={{ color: "var(--color-brand-ink)" }}>
                {currentLocation.label}
              </strong>
              .{" "}
            </>
          ) : null}
          {etaText ? (
            <>
              {t("summary.expectedToDeliver")}{" "}
              <strong style={{ color: "var(--color-brand-ink)" }}>
                {etaText}
              </strong>
              .
            </>
          ) : (
            t("summary.etaUpdating")
          )}
        </p>

        {confidencePct !== null && (
          <div className="mt-3 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-bold"
              style={{
                background: "var(--color-brand-accent)",
                color: "var(--color-brand-accent-ink)",
              }}
            >
              <IconClock color="currentColor" size={12} />
              {t("summary.confidenceChip", { pct: confidencePct })}
            </span>
            <span
              className="text-[12px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              {confidencePct >= 80
                ? t("summary.confidenceHigh")
                : confidencePct >= 60
                  ? t("summary.confidenceMid")
                  : t("summary.confidenceLow")}
            </span>
          </div>
        )}
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-4 border-t"
        style={{
          borderColor:
            "color-mix(in oklab, var(--color-brand-primary) 22%, white)",
        }}
      >
        <TrustPillar
          icon={<IconLock />}
          label={t("trust.priceLocked")}
          detail={t("trust.priceLockedDetail", {
            amount: formatUSD(priceLockedCents),
          })}
        />
        <TrustPillar
          icon={<IconUser />}
          label={t("trust.namedDriver")}
          detail={driverName ?? t("trust.driverPending")}
        />
        <TrustPillar
          icon={<IconHeadset />}
          label={t("trust.coordinator")}
          detail={
            coordinator
              ? `${coordinator.name} · ${coordinator.languages
                  .map((l) => l.toUpperCase())
                  .join("/")}`
              : t("trust.coordinatorFallback")
          }
        />
        <TrustPillar
          icon={<IconCamera />}
          label={t("trust.photosProtect")}
          detail={t("trust.photosProtectDetail")}
        />
      </div>
    </section>
  );
}

/* ============================================================
 * LiveLocationCard — vertical journey rail (origin → current → destination)
 * ============================================================ */

function LiveLocationCard({
  origin,
  destination,
  currentLocation,
}: {
  origin: Address;
  destination: Address;
  currentLocation: Location;
}) {
  const t = useTranslations("portal.transit.liveLocation");
  return (
    <Card>
      {/* Note: "Last reported X ago" sits on the current-position marker
          below; omitted here to avoid the duplication Eddie flagged. */}
      <CardHead title={t("title")} />
      <div className="px-5 md:px-6 py-5">
        <ol className="relative space-y-5">
          <JourneyStop
            icon={<IconMapPin color="var(--color-brand-primary)" size={16} />}
            label={`${origin.city}, ${origin.state}`}
            sub={t("originLabel")}
            tone="done"
            showConnector
          />
          <JourneyStop
            icon={<IconTruck color="var(--color-brand-accent-ink)" size={16} />}
            label={currentLocation.label}
            sub={t("lastReported", { ago: timeAgo(currentLocation.lastUpdatedAt) })}
            tone="current"
            showConnector
          />
          <JourneyStop
            icon={<IconFlag color="var(--color-text-muted)" size={16} />}
            label={`${destination.city}, ${destination.state}`}
            sub={t("destinationLabel")}
            tone="upcoming"
            showConnector={false}
          />
        </ol>
      </div>
    </Card>
  );
}

function JourneyStop({
  icon,
  label,
  sub,
  tone,
  showConnector,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  tone: "done" | "current" | "upcoming";
  showConnector: boolean;
}) {
  const isCurrent = tone === "current";
  const isUpcoming = tone === "upcoming";

  const dotBg = isCurrent
    ? "var(--color-brand-accent)"
    : isUpcoming
      ? "var(--color-surface-elevated)"
      : "color-mix(in oklab, var(--color-brand-primary) 12%, white)";
  const dotBorder = isCurrent
    ? "var(--color-brand-accent)"
    : isUpcoming
      ? "var(--color-gray-300)"
      : "color-mix(in oklab, var(--color-brand-primary) 40%, white)";
  const labelColor = isUpcoming
    ? "var(--color-text-muted)"
    : "var(--color-text-default)";

  return (
    <li className="relative flex items-start gap-4">
      {/* Connector line (vertical) */}
      {showConnector && (
        <span
          aria-hidden
          className="absolute"
          style={{
            left: 17,
            top: 36,
            width: 2,
            height: 28,
            background: isCurrent
              ? "color-mix(in oklab, var(--color-brand-primary) 30%, white)"
              : "var(--color-gray-200)",
          }}
        />
      )}
      {/* Marker dot */}
      <span
        className="relative flex-shrink-0 grid place-items-center rounded-full border-2"
        style={{
          width: 36,
          height: 36,
          background: dotBg,
          borderColor: dotBorder,
          boxShadow: isCurrent
            ? "0 0 0 6px color-mix(in oklab, var(--color-brand-accent) 18%, transparent)"
            : "none",
        }}
      >
        {icon}
      </span>
      {/* Label */}
      <div className="min-w-0 pt-1">
        <div
          className="text-[14.5px] font-extrabold leading-tight"
          style={{ color: labelColor }}
        >
          {label}
        </div>
        <div
          className="text-[12px] mt-0.5"
          style={{
            color: isCurrent
              ? "var(--color-brand-primary)"
              : "var(--color-text-muted)",
          }}
        >
          {sub}
        </div>
      </div>
    </li>
  );
}

/* ============================================================
 * MilestoneTimeline — events that have happened + expected delivery
 * ============================================================ */

function MilestoneTimeline({
  milestones,
  eta,
  destination,
}: {
  milestones: Milestone[];
  eta?: ETAEstimate;
  destination: Address;
}) {
  const t = useTranslations("portal.transit.timeline");
  const sorted = [...milestones].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  const subKey = eta ? "subWithExpected" : "sub";

  return (
    <Card>
      <CardHead
        title={t("title")}
        sub={t(subKey, { count: sorted.length })}
      />
      <div className="px-5 md:px-6 py-5">
        <ol className="relative space-y-4">
          {sorted.map((m, idx) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              isLast={idx === sorted.length - 1 && !eta}
            />
          ))}
          {eta && (
            <ExpectedDeliveryRow
              eta={eta}
              destination={destination}
              isLast
            />
          )}
        </ol>
      </div>
    </Card>
  );
}

function MilestoneRow({
  milestone,
  isLast,
}: {
  milestone: Milestone;
  isLast: boolean;
}) {
  const t = useTranslations("portal.transit");
  const locale = useLocale();
  const Icon = milestoneIcon(milestone.type);
  return (
    <li className="relative flex items-start gap-4">
      {!isLast && (
        <span
          aria-hidden
          className="absolute"
          style={{
            left: 13,
            top: 28,
            width: 2,
            height: 32,
            background: "var(--color-gray-200)",
          }}
        />
      )}
      <span
        className="flex-shrink-0 grid place-items-center rounded-full"
        style={{
          width: 28,
          height: 28,
          background: "color-mix(in oklab, var(--color-brand-primary) 12%, white)",
          color: "var(--color-brand-primary)",
        }}
      >
        <Icon color="currentColor" size={14} />
      </span>
      <div className="min-w-0 pt-0.5">
        <div
          className="text-[14px] font-bold leading-tight"
          style={{ color: "var(--color-text-default)" }}
        >
          {t(`milestones.${milestone.type}`)}
        </div>
        <div
          className="text-[12px] mt-0.5"
          style={{ color: "var(--color-text-muted)" }}
        >
          {formatMilestoneTime(milestone.at, locale)}
          {milestone.location?.label ? ` · ${milestone.location.label}` : ""}
        </div>
        {milestone.notes && (
          <div
            className="text-[12px] italic mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {milestone.notes}
          </div>
        )}
      </div>
    </li>
  );
}

function ExpectedDeliveryRow({
  eta,
  destination,
  isLast,
}: {
  eta: ETAEstimate;
  destination: Address;
  isLast: boolean;
}) {
  const t = useTranslations("portal.transit");
  const locale = useLocale();
  return (
    <li className="relative flex items-start gap-4">
      {!isLast && (
        <span
          aria-hidden
          className="absolute"
          style={{
            left: 13,
            top: 28,
            width: 2,
            height: 32,
            background: "var(--color-gray-200)",
          }}
        />
      )}
      <span
        className="flex-shrink-0 grid place-items-center rounded-full border-2"
        style={{
          width: 28,
          height: 28,
          background: "var(--color-surface-elevated)",
          borderColor: "var(--color-gray-300)",
          color: "var(--color-text-muted)",
          borderStyle: "dashed",
        }}
      >
        <IconFlag color="currentColor" size={14} />
      </span>
      <div className="min-w-0 pt-0.5">
        <div
          className="text-[14px] font-bold leading-tight"
          style={{ color: "var(--color-text-default)" }}
        >
          {t("timeline.expectedDelivery")}
        </div>
        <div
          className="text-[12px] mt-0.5"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("timeline.expectedDeliveryDetail", {
            eta: formatETA(eta.at, "America/Denver", locale, t),
            city: destination.city,
            state: destination.state,
          })}
        </div>
      </div>
    </li>
  );
}

function milestoneIcon(type: MilestoneType): typeof IconCheck {
  switch (type) {
    case "pickedUp":
      return IconTruck;
    case "atWaypoint":
      return IconMapPin;
    case "atDestinationRegion":
    case "delivered":
      return IconFlag;
    case "driverAssigned":
      return IconUser;
    case "booked":
    case "prepStarted":
    case "documentsComplete":
    default:
      return IconCheck;
  }
}

/* ============================================================
 * PhotoTabsCard — Pickup / Transit / Delivery (client-side tabs)
 * ============================================================ */

type TabKey = "pickup" | "transit" | "delivery";

function PhotoTabsCard({
  pickup,
  transit,
  delivery,
}: {
  pickup: Photo[];
  transit: Photo[];
  delivery: Photo[];
}) {
  const t = useTranslations("portal.transit.photos");
  const [active, setActive] = useState<TabKey>(
    transit.length > 0 ? "transit" : "pickup",
  );

  const tabs: Array<{
    key: TabKey;
    label: string;
    count: number;
    locked: boolean;
  }> = [
    { key: "pickup", label: t("tabPickup"), count: pickup.length, locked: false },
    { key: "transit", label: t("tabTransit"), count: transit.length, locked: false },
    {
      key: "delivery",
      label: t("tabDelivery"),
      count: delivery.length,
      locked: delivery.length === 0,
    },
  ];

  return (
    <Card>
      <CardHead
        title={t("title")}
        sub={t("sub")}
      />
      <div className="px-5 md:px-6 pt-4">
        <div
          className="flex gap-1.5 p-1 rounded-xl"
          style={{ background: "var(--color-surface-elevated)" }}
        >
          {tabs.map((tab) => {
            const isActive = tab.key === active;
            return (
              <button
                key={tab.key}
                type="button"
                disabled={tab.locked}
                onClick={() => !tab.locked && setActive(tab.key)}
                className="flex-1 rounded-lg px-3 py-2 text-[13px] font-bold transition-colors"
                style={{
                  background: isActive
                    ? "var(--color-surface)"
                    : "transparent",
                  color: tab.locked
                    ? "var(--color-text-muted)"
                    : isActive
                      ? "var(--color-brand-ink)"
                      : "var(--color-text-muted)",
                  cursor: tab.locked ? "not-allowed" : "pointer",
                  opacity: tab.locked ? 0.5 : 1,
                  boxShadow: isActive
                    ? "0 1px 3px rgba(10,30,20,0.08)"
                    : "none",
                }}
              >
                {tab.label}{" "}
                <span
                  className="ml-1 text-[11.5px] font-bold"
                  style={{
                    color: isActive
                      ? "var(--color-brand-primary)"
                      : "var(--color-text-muted)",
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-5 md:px-6 pt-4 pb-6">
        <TabPanel
          tab={active}
          pickup={pickup}
          transit={transit}
          delivery={delivery}
        />
      </div>
    </Card>
  );
}

function TabPanel({
  tab,
  pickup,
  transit,
  delivery,
}: {
  tab: TabKey;
  pickup: Photo[];
  transit: Photo[];
  delivery: Photo[];
}) {
  const t = useTranslations("portal.transit.photos");

  if (tab === "delivery" && delivery.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed py-10 text-center"
        style={{
          borderColor: "var(--color-gray-300)",
          background: "var(--color-surface-elevated)",
        }}
      >
        <div
          className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-3"
          style={{
            background: "var(--color-gray-200)",
            color: "var(--color-text-muted)",
          }}
        >
          <IconFlag color="currentColor" size={18} />
        </div>
        <div
          className="text-[14px] font-bold"
          style={{ color: "var(--color-text-default)" }}
        >
          {t("deliveryLockedTitle")}
        </div>
        <p
          className="text-[12.5px] mt-1 max-w-md mx-auto"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("deliveryLockedBody")}
        </p>
      </div>
    );
  }

  const photos =
    tab === "pickup" ? pickup : tab === "transit" ? transit : delivery;

  if (photos.length === 0) {
    return (
      <p
        className="text-[13px] italic"
        style={{ color: "var(--color-text-muted)" }}
      >
        {t("noPhotosYet")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {photos.map((p) => (
        <PhotoThumb key={p.id} photo={p} />
      ))}
    </div>
  );
}

function PhotoThumb({ photo }: { photo: Photo }) {
  return (
    <div
      className="rounded-lg overflow-hidden border relative"
      style={{
        background:
          "color-mix(in oklab, var(--color-brand-primary) 6%, white)",
        borderColor: "var(--color-gray-200)",
        aspectRatio: "1 / 1",
      }}
    >
      {/* Placeholder — real <img> wires in when Firebase Storage lands. */}
      <div
        className="absolute inset-0 grid place-items-center"
        style={{ color: "var(--color-brand-primary)" }}
      >
        <IconCamera />
      </div>
      {photo.caption && (
        <div
          className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[10.5px] font-bold truncate"
          style={{
            background:
              "linear-gradient(to top, rgba(10,30,20,0.85), transparent)",
            color: "white",
          }}
        >
          {photo.caption}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * IN_TRANSIT-specific helpers
 * ============================================================ */

function formatMilestoneTime(iso: string, locale: string): string {
  const fmt = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return fmt.format(new Date(iso));
}

/**
 * Formats an ETA as "{today|tomorrow|date} at {time} {tz}", localized via
 * portal.transit.eta.*. Date itself rendered via Intl.DateTimeFormat(locale, ...)
 * so weekday/month names come out in the active locale.
 */
function formatETA(
  iso: string,
  tz: string,
  locale: string,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const d = new Date(iso);
  const now = new Date();
  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  const isToday = isSameLocalDay(d, now, tz);
  const isTomorrow = isSameLocalDay(
    d,
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    tz,
  );
  const prefix = isToday
    ? t("eta.today")
    : isTomorrow
      ? t("eta.tomorrow")
      : dateFmt.format(d);
  return t("eta.atTime", {
    prefix,
    time: timeFmt.format(d),
    tz: tzShortName(tz),
  });
}

function isSameLocalDay(a: Date, b: Date, tz: string): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  });
  return fmt.format(a) === fmt.format(b);
}
