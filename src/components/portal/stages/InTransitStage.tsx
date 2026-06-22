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
  PickupTeamCard,
  LockedPriceCard,
  ShipmentDetailsCard,
  HelpfulResourcesCard,
  IconUser,
  IconCamera,
  IconMapPin,
  IconClock,
  IconTruck,
  IconFlag,
  IconCheck,
  tzShortName,
} from "../_shared";
import { TransitMap } from "../_map";

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
    <div className="space-y-[18px]">
      {/* TrackingMapModule — unified status header + map + route summary.
          Replaces the old separate TransitSummary hero and InlineMapBlock
          per the Option B spec (2026-06-09). The dark-green header band
          flows visually into the dark map, making this read as ONE live
          tracking experience instead of three stacked cards. */}
      <TrackingMapModule
        driverName={driver?.name}
        origin={origin}
        destination={destination}
        currentLocation={currentLocation}
        eta={eta}
      />

      {/* Trust strip removed 2026-06-09 — Driver/Coordinator/Photos are
          already richer-rendered by PickupTeamCard + PhotoTabsCard
          downstream. Eddie's read: the strip was acting as a preview of
          content that appears again. */}

      {/* Two-column grid on desktop, single-column stack on mobile.
          Mobile order (priority-sorted per Eddie 2026-06-09):
            1. Team       — "who has my car, who do I call" is the most
                            important reassurance after the live map
            2. Timeline   — what happened / what's next
            3. Photos     — proof of condition
            4. Price      — locked promise
            5. Details    — order metadata
            6. Resources  — help links
          Desktop preserves the original visual split (main + sidebar)
          using explicit grid-column / grid-row placement on each block. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-x-6 gap-y-[22px] lg:gap-y-6">
        {(driver || coordinator) && (
          <div className="lg:col-start-2 lg:row-start-1">
            <PickupTeamCard
              driver={driver}
              coordinator={coordinator}
              title={t("team.title")}
              helpLineText={t("team.helpLine", { firstName })}
            />
          </div>
        )}

        <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2 space-y-[22px] min-w-0">
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
        </div>

        <div className="lg:col-start-2 lg:row-start-2 space-y-5">
          <LockedPriceCard amountCents={priceLockedCents} />
          <ShipmentDetailsCard shipment={shipment} />
          <HelpfulResourcesCard
            variant="inTransit"
            orderNumber={shipment.orderNumber}
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * TrackingMapModule — unified status header + map + route summary
 *
 * Spec 2026-06-09 (Option B): the whole module reads as a single
 * connected live-tracking experience rather than three stacked cards.
 * Dark green gradient header band on top flows visually into the dark
 * map; route summary row sits below the map as a continuous strip with
 * vertical dividers between origin / current / destination.
 * ============================================================ */

function TrackingMapModule({
  driverName,
  origin,
  destination,
  currentLocation,
  eta,
}: {
  driverName?: string;
  origin: Address;
  destination: Address;
  currentLocation?: Location;
  eta?: ETAEstimate;
}) {
  return (
    <section
      className="overflow-hidden"
      style={{
        background: "#ffffff",
        border: "1px solid #dbe5dd",
        borderRadius: 18,
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <TrackingStatusHeader
        driverName={driverName}
        destination={destination}
        currentLocation={currentLocation}
        eta={eta}
      />

      {currentLocation && (
        <TransitMap
          origin={origin}
          destination={destination}
          currentLocation={currentLocation}
          // 330px — was 360 (Eddie 2026-06-09: map dominated, timeline
          // started too far down the fold). Shaving 30px lifts the
          // milestone timeline closer to the user without losing
          // tracking-module presence.
          heightPx={330}
        />
      )}

      <div
        className="grid grid-cols-1 sm:grid-cols-3"
        style={{ borderTop: "1px solid #e2e8f0" }}
      >
        <RouteEndItem
          label="ORIGIN"
          city={`${origin.city}, ${origin.state}`}
          tone="origin"
          showDivider
        />
        <RouteEndItem
          label="CURRENT"
          city={currentLocation ? `Near ${currentLocation.label}` : "Tracking soon"}
          tone="current"
          showDivider
        />
        <RouteEndItem
          label="DESTINATION"
          city={`${destination.city}, ${destination.state}`}
          tone="destination"
        />
      </div>
    </section>
  );
}

function TrackingStatusHeader({
  driverName,
  destination,
  currentLocation,
  eta,
}: {
  driverName?: string;
  destination: Address;
  currentLocation?: Location;
  eta?: ETAEstimate;
}) {
  const t = useTranslations("portal.transit");
  const locale = useLocale();
  const firstName = driverName?.split(" ")[0];
  const confidencePct = eta ? Math.round(eta.confidenceScore * 100) : null;
  // NB: in production the ETA timezone should come from destination — using
  // America/Denver here as a heuristic; refactor when SD feeds a proper tz.
  const etaText = eta ? formatETA(eta.at, "America/Denver", locale, t) : null;
  const confidenceLabel =
    confidencePct === null
      ? null
      : confidencePct >= 80
        ? t("summary.confidenceHigh")
        : confidencePct >= 60
          ? t("summary.confidenceMid")
          : t("summary.confidenceLow");

  return (
    // Mobile: 14px 16px padding, items-start (no vertical centering).
    // Desktop (md+): 20px 24px padding (Eddie 2026-06-09 — slightly more
    // horizontal breathing room so the inline status line doesn't crowd
    // the edges if copy grows), items-center for the icon/text balance.
    <div
      className="flex items-start md:items-center gap-3 md:gap-4 px-4 py-3.5 md:px-6 md:py-5"
      style={{
        background: "linear-gradient(90deg, #052e1a 0%, #0b3b24 100%)",
        color: "#ffffff",
      }}
    >
      {/* Truck icon bubble — 36px on mobile, 44px desktop. */}
      <div
        className="grid place-items-center flex-shrink-0 w-9 h-9 md:w-11 md:h-11"
        style={{
          borderRadius: 999,
          background: "#16a34a",
          color: "#ffffff",
        }}
      >
        <IconTruck color="currentColor" size={20} />
      </div>

      <div className="flex-1 min-w-0">
        <h2
          className="leading-tight"
          style={{
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#ffffff",
            fontFamily: "var(--font-brand-display)",
            textAlign: "left",
            // Cap the headline width so it wraps predictably and any
            // overflow ("Denver" on a second line on narrow mobile) sits
            // tight-left under "Marcus is on the way to", instead of
            // looking visually centered against trailing whitespace.
            maxWidth: "22ch",
            // text-wrap: balance distributes the wrap across both lines
            // ("Marcus is on the way" / "to Denver") rather than orphaning
            // a single short word — reads as a status, not a hero ad.
            textWrap: "balance",
          }}
        >
          {firstName
            ? `${t("summary.titleWithDriver", { driverName: firstName })} `
            : `${t("summary.titleNoDriver")} `}
          <span style={{ color: "#86efac" }}>{destination.city}</span>
        </h2>

        {/* Status meta — grid stack on mobile, inline flow on desktop.
            Each line gets a small lime-tinted leading icon (check / clock /
            pin) instead of relying on dot separators. The icons act as the
            visual rhythm AND give a left-edge alignment anchor across all
            three lines. Dot separators kept on desktop only for the inline
            flow; hidden by default on mobile via DarkSep's own class. */}
        <div
          className="grid gap-y-1 md:flex md:flex-row md:flex-wrap md:items-center md:gap-x-3 md:gap-y-1"
          style={{
            marginTop: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#d1fae5",
            lineHeight: 1.35,
          }}
        >
          {confidenceLabel && (
            <MetaLine icon={<IconCheck color="currentColor" size={13} />}>
              {confidenceLabel}
            </MetaLine>
          )}
          {etaText && (
            <>
              <DarkSep />
              <MetaLine icon={<IconClock color="currentColor" size={13} />}>
                {t.rich("summary.statusETA", {
                  eta: etaText,
                  strong: (chunks) => (
                    <strong style={{ color: "#ffffff" }}>{chunks}</strong>
                  ),
                })}
              </MetaLine>
            </>
          )}
          {!etaText && (
            <MetaLine icon={<IconClock color="currentColor" size={13} />}>
              {t("summary.etaUpdating")}
            </MetaLine>
          )}
          {currentLocation && (
            <>
              <DarkSep />
              <MetaLine icon={<IconMapPin color="currentColor" size={13} />}>
                {t("summary.statusLastReported", { location: currentLocation.label })}
              </MetaLine>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Single status meta line — small leading icon + text, aligned baseline.
 *  Used inside the dark green TrackingStatusHeader. Icons are 13px and
 *  inherit the lime-tinted (#d1fae5) parent color. */
function MetaLine({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="inline-flex flex-shrink-0" style={{ opacity: 0.85 }}>
        {icon}
      </span>
      <span>{children}</span>
    </span>
  );
}

/** Lime-tinted dot separator for the dark status header.
 *  Hidden on mobile (the meta stacks vertically with leading icons instead).
 *  Defaults to display:none + md:inline-block to avoid the Tailwind class-
 *  order specificity gotcha that was causing dots to leak through on mobile
 *  even when callers passed `hidden md:inline-block` explicitly. */
function DarkSep() {
  return (
    <span
      aria-hidden
      className="hidden md:inline-block rounded-full"
      style={{
        width: 3,
        height: 3,
        background: "rgba(209, 250, 229, 0.5)",
      }}
    />
  );
}

/* ============================================================
 * RouteEndItem — Origin / Current / Destination summary row
 *
 * Sits as the bottom row of TrackingMapModule with vertical dividers
 * between columns. Per spec: NO redundant label-below-the-city. The
 * uppercase ORIGIN/CURRENT/DESTINATION label IS the label.
 * ============================================================ */

function RouteEndItem({
  label,
  city,
  tone,
  showDivider = false,
}: {
  label: string;
  city: string;
  tone: "origin" | "current" | "destination";
  showDivider?: boolean;
}) {
  const dotBg =
    tone === "origin"
      ? "#16a34a"
      : tone === "current"
        ? "#6FCB8A"
        : "#0f172a";
  const dotShadow = tone === "current" ? "0 0 0 4px #dcfce7" : "none";

  return (
    <div
      className="flex items-start gap-2.5"
      style={{
        padding: "16px 22px",
        borderRight: showDivider ? "1px solid #e2e8f0" : "none",
      }}
    >
      <span
        className="flex-shrink-0 rounded-full"
        style={{
          width: 10,
          height: 10,
          marginTop: 5,
          background: dotBg,
          boxShadow: dotShadow,
        }}
      />
      <div className="min-w-0">
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#64748b",
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1.3,
            color: "#020617",
          }}
        >
          {city}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * (TransitTrustStrip + TrustStripItem removed 2026-06-09 — see main
 *  composition comment. Below: MilestoneTimeline, MilestoneRow,
 *  ExpectedDeliveryRow, photo components.)
 * ============================================================ */

// Stash the deprecated unused stub here, hoisted to keep diff small.
// Will sweep in the next janitorial pass.
function _JourneyStopUnusedShim({
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
      {/* Tightened from py-5 / space-y-4 (20px body, 16px gap) to py-4 /
          space-y-3 (16px body, 12px gap) 2026-06-09 — Eddie's read: the
          timeline was visually heavier than the Team / Price cards next
          to it for content that's mostly historical. Trim makes it sit
          alongside the other cards instead of dominating. */}
      <div className="px-5 md:px-6 py-4">
        <ol className="relative space-y-3">
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
                className="flex-1 rounded-lg px-3 py-2 text-[13px] transition-colors inline-flex items-center justify-center gap-2"
                style={{
                  // Active: hard white card with a real shadow that lifts
                  // off the elevated gray rail. Inactive: transparent.
                  background: isActive ? "#ffffff" : "transparent",
                  color: tab.locked
                    ? "#94a3b8" // slate-400 — clearly disabled
                    : isActive
                      ? "#020617" // ink — bold and present
                      : "#64748b", // slate-500 — quiet but readable
                  cursor: tab.locked ? "not-allowed" : "pointer",
                  opacity: tab.locked ? 0.7 : 1,
                  // Active gets a layered shadow so it lifts more
                  // obviously off the gray rail. Inactive: no shadow.
                  boxShadow: isActive
                    ? "0 1px 3px rgba(15,23,42,0.12), 0 1px 2px rgba(15,23,42,0.06)"
                    : "none",
                  fontWeight: isActive ? 700 : 600,
                }}
              >
                <span>{tab.label}</span>
                {/* Count is a real pill badge — quieter when inactive,
                    brand-tinted when active, neutral when disabled. */}
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: "1px 7px",
                    borderRadius: 999,
                    minWidth: 18,
                    textAlign: "center",
                    background: tab.locked
                      ? "#f1f5f9" // slate-100
                      : isActive
                        ? "#dcfce7" // green-100 — brand tint on active
                        : "#e2e8f0", // slate-200 — neutral resting badge
                    color: tab.locked
                      ? "#94a3b8" // slate-400
                      : isActive
                        ? "#047857" // green-700 — bold against tint
                        : "#64748b", // slate-500
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
