import type { Driver, Coordinator, Shipment } from "@/lib/types/shipment";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/**
 * Shared portal primitives + sidebar cards + helpers.
 *
 * Used by every stage component (PrepStage, InTransitStage, ...) so the
 * portal "feels like one product" across lifecycle stages — same trust
 * cards in the sidebar, same icon system, same brand-token tints.
 *
 * Brand discipline: every color goes through CSS variables defined in
 * globals.css. No hardcoded hex except #365314 (Tailwind lime-900 derived
 * from --color-brand-accent for required-signal text on lime tints).
 */

/* ============================================================
 * Primitives
 * ============================================================ */

export function Card({ children }: { children: ReactNode }) {
  return (
    <section
      className="rounded-2xl border overflow-hidden"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-gray-200)",
      }}
    >
      {children}
    </section>
  );
}

export function CardHead({
  title,
  sub,
  rightChip,
  chipTone,
}: {
  title: string;
  sub?: string;
  rightChip?: string;
  chipTone?: "lime" | "muted";
}) {
  return (
    <div
      className="px-5 md:px-6 py-4 border-b"
      style={{ borderColor: "var(--color-gray-200)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3
            className="text-[15px] md:text-base font-extrabold leading-tight"
            style={{ color: "var(--color-text-default)" }}
          >
            {title}
          </h3>
          {sub && (
            <p
              className="text-[13px] mt-1 leading-snug"
              style={{ color: "var(--color-text-muted)" }}
            >
              {sub}
            </p>
          )}
        </div>
        {rightChip && (
          <span
            className="flex-shrink-0 text-[10.5px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={
              chipTone === "lime"
                ? {
                    background: "var(--color-brand-accent)",
                    color: "var(--color-brand-accent-ink)",
                  }
                : {
                    background: "var(--color-surface-elevated)",
                    color: "var(--color-text-muted)",
                    border: "1px solid var(--color-gray-200)",
                  }
            }
          >
            {rightChip}
          </span>
        )}
      </div>
    </div>
  );
}

export function ProgressBar({
  pct,
  tone = "primary",
}: {
  pct: number;
  tone?: "primary" | "accent";
}) {
  return (
    <div
      className="h-1.5 rounded-full overflow-hidden"
      style={{ background: "var(--color-gray-200)" }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: `${pct}%`,
          background:
            tone === "accent"
              ? "var(--color-brand-accent)"
              : "var(--color-brand-primary)",
        }}
      />
    </div>
  );
}

export function TrustPillar({
  icon,
  label,
  detail,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 border-r last:border-r-0 even:border-r-0 md:even:border-r md:last:border-r-0"
      style={{
        borderColor: "color-mix(in oklab, var(--color-brand-primary) 22%, white)",
      }}
    >
      <span
        className="flex-shrink-0"
        style={{ color: "var(--color-brand-primary)" }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div
          className="text-[12.5px] font-bold leading-tight truncate"
          style={{ color: "var(--color-brand-ink)" }}
        >
          {label}
        </div>
        <div
          className="text-[11.5px] mt-0.5 truncate"
          style={{ color: "var(--color-text-muted)" }}
        >
          {detail}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Sidebar cards (shared across all stages)
 * ============================================================ */

export function PickupTeamCard({
  driver,
  coordinator,
  title = "Your pickup team",
  helpLineText,
}: {
  driver?: Driver;
  coordinator?: Coordinator;
  /** Card title — defaults to "Your pickup team" for PREP; pass "Your team" for IN_TRANSIT etc. */
  title?: string;
  /** Override the soft-green help-line text at the bottom. */
  helpLineText?: string;
}) {
  const firstName = coordinator?.name.split(" ")[0] ?? "your coordinator";
  const helpText =
    helpLineText ?? `Questions before pickup? Contact ${firstName}.`;
  return (
    <Card>
      <CardHead title={title} />
      {driver && (
        <div className="px-5 py-4 flex items-start gap-3">
          <div
            className="flex-shrink-0 w-11 h-11 rounded-full grid place-items-center font-extrabold text-sm"
            style={{
              background: "var(--color-brand-primary)",
              color: "var(--color-brand-paper)",
            }}
          >
            {driver.initials}
          </div>
          <div className="min-w-0">
            <div
              className="text-[11.5px] font-bold uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              Driver
            </div>
            <div
              className="font-extrabold text-[15px] leading-tight"
              style={{ color: "var(--color-text-default)" }}
            >
              {driver.name}
            </div>
            <div
              className="text-[12.5px] mt-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              <strong
                style={{
                  color: "var(--color-text-default)",
                  fontWeight: 600,
                }}
              >
                {driver.carrierName}
              </strong>{" "}
              · {driver.rating}★ · {driver.yearsExperience} yrs
            </div>
          </div>
        </div>
      )}

      {coordinator && (
        <div
          className="px-5 py-4 flex items-start gap-3 border-t"
          style={{ borderColor: "var(--color-gray-200)" }}
        >
          <div
            className="flex-shrink-0 w-11 h-11 rounded-full grid place-items-center font-extrabold text-sm"
            style={{
              background: "var(--color-brand-primary)",
              color: "var(--color-brand-paper)",
            }}
          >
            {initialsFromName(coordinator.name)}
          </div>
          <div className="min-w-0">
            <div
              className="text-[11.5px] font-bold uppercase tracking-wider"
              style={{ color: "var(--color-text-muted)" }}
            >
              Coordinator
            </div>
            <div
              className="font-extrabold text-[15px] leading-tight"
              style={{ color: "var(--color-text-default)" }}
            >
              {coordinator.name}
            </div>
            <div
              className="text-[12.5px] mt-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              {coordinator.languages.map((l) => l.toUpperCase()).join(" · ")} ·{" "}
              M–F {coordinator.hours.start}–{coordinator.hours.end}{" "}
              {tzShortName(coordinator.hours.timezone)}
            </div>
            <a
              href={`mailto:${coordinator.email}`}
              className="text-[12.5px] font-bold hover:underline block mt-1"
              style={{ color: "var(--color-brand-primary)" }}
            >
              {coordinator.email}
            </a>
          </div>
        </div>
      )}

      {coordinator && (
        <div
          className="px-5 py-3 flex items-center gap-2 text-[12.5px] font-semibold border-t"
          style={{
            background: "color-mix(in oklab, var(--color-brand-primary) 6%, white)",
            borderColor:
              "color-mix(in oklab, var(--color-brand-primary) 22%, white)",
            color: "var(--color-brand-ink)",
          }}
        >
          <IconChat color="var(--color-brand-primary)" size={14} />
          {helpText}
        </div>
      )}
    </Card>
  );
}

export function LockedPriceCard({ amountCents }: { amountCents: number }) {
  return (
    <div
      className="relative rounded-2xl px-5 py-5 overflow-hidden"
      style={{
        background: "var(--color-brand-ink)",
        color: "var(--color-brand-paper)",
      }}
    >
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          right: -30,
          top: -30,
          width: 140,
          height: 140,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--color-brand-accent) 28%, transparent), transparent 60%)",
        }}
      />
      <div className="relative">
        <div
          className="text-[11px] font-extrabold uppercase tracking-[0.08em]"
          style={{
            color:
              "color-mix(in oklab, var(--color-brand-accent) 70%, white)",
          }}
        >
          The price promise
        </div>
        <h3 className="text-[13px] font-bold mt-1">Your price is locked</h3>
        <div className="text-[38px] font-black leading-none mt-1.5 tracking-tight">
          $
          <span style={{ color: "var(--color-brand-accent)" }}>
            {formatUSDNumber(amountCents)}
          </span>
        </div>
        <p
          className="text-[12.5px] mt-1.5 leading-snug"
          style={{
            color:
              "color-mix(in oklab, var(--color-brand-paper) 75%, var(--color-brand-ink))",
          }}
        >
          No surprise changes before pickup. Locked at booking.
        </p>
      </div>
    </div>
  );
}

/**
 * <HelpfulResourcesCard> — shared sidebar card linking the authenticated
 * customer back to the marketing-site reference content most relevant to
 * an active shipment (Triple Promise pages, anti-scam guide, full
 * resources index). Same component rendered on PREP + IN_TRANSIT so the
 * sidebar reads consistently across stages.
 *
 * Long-term: add stage-specific portal articles (pickup-day timeline,
 * damage-claim process, transit-delay handling). For now this routes to
 * existing marketing content so it ships fast and gives the sidebar a
 * "we've thought about everything you might need" finish.
 */
export function HelpfulResourcesCard() {
  return (
    <Card>
      <CardHead title="Helpful resources" />
      <div className="px-5 py-4 space-y-3">
        <ResourceLink
          href="/price-promise"
          icon={<IconLock />}
          title="Price Promise"
          sub="What the locked price means"
        />
        <ResourceLink
          href="/damage-promise"
          icon={<IconShield />}
          title="Damage Promise"
          sub="$500K cargo coverage explained"
        />
        <ResourceLink
          href="/people-promise"
          icon={<IconHeadset />}
          title="People Promise"
          sub="Why we name your coordinator"
        />
        <ResourceLink
          href="/anti-scam"
          icon={<IconAlert />}
          title="Spot the scams"
          sub="What separates real brokers from the noise"
        />
      </div>
      <div
        className="px-5 py-3 border-t flex items-center justify-between"
        style={{
          background: "var(--color-surface-elevated)",
          borderColor: "var(--color-gray-200)",
        }}
      >
        <Link
          href="/resources"
          className="text-[12.5px] font-bold inline-flex items-center gap-1.5 hover:gap-2 transition-all"
          style={{ color: "var(--color-brand-primary)" }}
        >
          <IconBook color="currentColor" size={14} />
          Browse all resources →
        </Link>
      </div>
    </Card>
  );
}

function ResourceLink({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 py-1 rounded-lg group transition-colors"
    >
      <span
        className="flex-shrink-0 mt-0.5"
        style={{ color: "var(--color-brand-primary)" }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div
          className="text-[13.5px] font-bold leading-tight transition-colors"
          style={{ color: "var(--color-text-default)" }}
        >
          {title}
        </div>
        <div
          className="text-[12px] mt-0.5 leading-snug"
          style={{ color: "var(--color-text-muted)" }}
        >
          {sub}
        </div>
      </div>
    </Link>
  );
}

export function ShipmentDetailsCard({ shipment }: { shipment: Shipment }) {
  const rows: { k: string; v: string }[] = [
    { k: "Order", v: shipment.orderNumber },
    {
      k: "Vehicle",
      v: `${shipment.vehicle.year} ${shipment.vehicle.make} ${shipment.vehicle.model}`,
    },
    {
      k: "Route",
      v: `${shipment.origin.city} → ${shipment.destination.city}`,
    },
    {
      k: "Tier",
      v: shipment.tier.charAt(0).toUpperCase() + shipment.tier.slice(1),
    },
  ];
  return (
    <Card>
      <div className="px-5 py-4">
        <h3
          className="text-[11.5px] font-extrabold uppercase tracking-wider mb-2.5"
          style={{ color: "var(--color-text-muted)" }}
        >
          Shipment details
        </h3>
        <div className="divide-y" style={{ color: "var(--color-text-default)" }}>
          {rows.map((r) => (
            <div
              key={r.k}
              className="flex items-center justify-between py-2 text-[13px]"
              style={{ borderColor: "var(--color-gray-200)" }}
            >
              <span style={{ color: "var(--color-text-muted)" }}>{r.k}</span>
              <span className="font-bold">{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ============================================================
 * Icons (small, brand-tinted via currentColor)
 * ============================================================ */

export function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
export function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
    </svg>
  );
}
export function IconHeadset() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3v4ZM3 19a2 2 0 0 0 2 2h1v-6H3v4Z" />
    </svg>
  );
}
export function IconCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
export function IconCheck({
  color = "currentColor",
  size = 16,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
export function IconPlus({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
export function IconChat({
  color = "currentColor",
  size = 14,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
    </svg>
  );
}
export function IconMapPin({
  color = "currentColor",
  size = 16,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
export function IconClock({
  color = "currentColor",
  size = 16,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
export function IconTruck({
  color = "currentColor",
  size = 16,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="6" width="14" height="11" rx="1" />
      <path d="M15 9h4l3 4v4h-7" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}
export function IconFlag({
  color = "currentColor",
  size = 16,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 21V4a1 1 0 0 1 1-1h14l-3 5 3 5H5" />
    </svg>
  );
}
export function IconShield({
  color = "currentColor",
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
export function IconAlert({
  color = "currentColor",
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
export function IconBook({
  color = "currentColor",
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

/* ============================================================
 * Helpers
 * ============================================================ */

export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatUSDNumber(cents: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function tzShortName(tz: string): string {
  const map: Record<string, string> = {
    "America/Los_Angeles": "PT",
    "America/Phoenix": "MT",
    "America/Chicago": "CT",
    "America/New_York": "ET",
    "America/Denver": "MT",
  };
  return map[tz] ?? tz;
}

/** Human-readable "X min ago" / "X hr ago" / "X days ago" from an ISO timestamp. */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const d = Math.floor(hr / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
