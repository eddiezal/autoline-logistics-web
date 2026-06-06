"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  Shipment,
  ChecklistItem,
  Photo,
  PhotoAngle,
  Coordinator,
  PickupWindow,
} from "@/lib/types/shipment";
import {
  Card,
  CardHead,
  ProgressBar,
  TrustPillar,
  PickupTeamCard,
  LockedPriceCard,
  ShipmentDetailsCard,
  HelpfulResourcesCard,
  IconLock,
  IconUser,
  IconHeadset,
  IconCamera,
  IconCheck,
  IconPlus,
  formatUSD,
  tzShortName,
} from "../_shared";

/**
 * <PrepStage> — Variation A+ redesign (May 27, 2026).
 *
 * Action-led, not status-led. The customer should land here and know
 * instantly: "I'm almost ready. My driver is named. My price is locked.
 * Here's exactly what I still need to do."
 *
 * Layout
 * ------
 *   1. ReadinessSummary    — soft green-tint hero + trust strip + lime CTA
 *   2. Main column (left): PickupPhotos → StillNeeded → CompletedPrep
 *      Photos lead because they're the highest-stakes customer action
 *      (damage-claim defense).
 *   3. Sidebar (right):    PickupTeam (driver + coordinator unified)
 *                          LockedPrice (Pine card, brand promise)
 *                          ShipmentDetails (quiet reference)
 *
 * All primitives + sidebar cards live in ../_shared so InTransitStage
 * uses the identical visual system.
 *
 * Mockup reference: brand-explorations/portal-prep-variation-a-plus.html
 *
 * EN/ES localized via next-intl (`portal.prep.*`). Strings live in
 * `src/messages/{en,es}.json`; date/time formatting follows useLocale().
 */

type Props = { shipment: Shipment };

const REQUIRED_PHOTO_ANGLES: readonly PhotoAngle[] = [
  "front",
  "rear",
  "driverSide",
  "passengerSide",
  "dashboard",
  "damage",
] as const;

/* ============================================================
 * Main composition
 * ============================================================ */

export function PrepStage({ shipment }: Props) {
  const t = useTranslations("portal.prep");
  const {
    driver,
    coordinator,
    scheduledPickup,
    prepChecklist,
    customerPrepPhotos,
    priceLockedCents,
  } = shipment;

  const checklist = prepChecklist ?? [];
  const incomplete = checklist.filter((c) => !c.completedAt);
  const completed = checklist.filter((c) => c.completedAt);
  const requiredChecklistLeft = incomplete.filter((c) => c.required);
  const recommendedChecklistLeft = incomplete.filter((c) => !c.required);

  const photosUploaded = customerPrepPhotos ?? [];
  const photosLeft = REQUIRED_PHOTO_ANGLES.length - photosUploaded.length;

  // Photos count as required — they're the damage-claim defense.
  const requiredLeft = requiredChecklistLeft.length + photosLeft;
  const recommendedLeft = recommendedChecklistLeft.length;
  const itemsLeft = requiredLeft + recommendedLeft;

  // Photo upload affordance: clicking an empty tile opens a "coming at launch"
  // modal naming the specific angle. Real upload pipeline ships post-launch
  // (Phase B) — see Notion punchlist for Option A vs B context.
  const [uploadAngle, setUploadAngle] = useState<PhotoAngle | null>(null);

  return (
    <div className="space-y-6">
      <ReadinessSummary
        driverName={driver?.name}
        pickup={scheduledPickup}
        itemsLeft={itemsLeft}
        requiredLeft={requiredLeft}
        recommendedLeft={recommendedLeft}
        priceLockedCents={priceLockedCents}
        coordinator={coordinator}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* MAIN COLUMN */}
        <main className="space-y-6 min-w-0">
          <PickupPhotosCard
            photos={photosUploaded}
            onUploadClick={(angle) => setUploadAngle(angle)}
          />
          {incomplete.length > 0 && (
            <StillNeededCard
              required={requiredChecklistLeft}
              recommended={recommendedChecklistLeft}
            />
          )}
          {completed.length > 0 && <CompletedPrepCard items={completed} />}
        </main>

        {/* SIDEBAR */}
        <aside className="space-y-5">
          {(driver || coordinator) && (
            <PickupTeamCard driver={driver} coordinator={coordinator} />
          )}
          <LockedPriceCard amountCents={priceLockedCents} />
          <ShipmentDetailsCard shipment={shipment} />
          <HelpfulResourcesCard />
        </aside>
      </div>

      {uploadAngle && (
        <PhotoUploadModal
          angleLabel={t(`photos.angles.${uploadAngle}`)}
          onClose={() => setUploadAngle(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
 * ReadinessSummary — soft green hero + trust strip + CTA
 * ============================================================ */

function ReadinessSummary({
  driverName,
  pickup,
  itemsLeft,
  requiredLeft,
  recommendedLeft,
  priceLockedCents,
  coordinator,
}: {
  driverName?: string;
  pickup?: PickupWindow;
  itemsLeft: number;
  requiredLeft: number;
  recommendedLeft: number;
  priceLockedCents: number;
  coordinator?: Coordinator;
}) {
  const t = useTranslations("portal.prep");
  const locale = useLocale();
  const allDone = itemsLeft === 0;

  const windowText = pickup ? formatPickupWindow(pickup, locale, t) : t("ready.windowSoon");

  return (
    <section
      className="rounded-2xl border overflow-hidden"
      style={{
        background: "color-mix(in oklab, var(--color-brand-primary) 6%, white)",
        borderColor:
          "color-mix(in oklab, var(--color-brand-primary) 22%, white)",
      }}
    >
      <div className="px-6 py-6 md:px-8 md:py-7">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          <div className="min-w-0">
            <h2
              className="text-2xl md:text-[26px] font-extrabold leading-tight"
              style={{
                color: "var(--color-brand-ink)",
                fontFamily: "var(--font-brand-display)",
                letterSpacing: "var(--letter-spacing-display)",
              }}
            >
              {allDone ? t("ready.titleReady") : t("ready.titleNotReady")}
            </h2>
            <p
              className="mt-2 text-sm md:text-[15px] leading-relaxed max-w-xl"
              style={{ color: "var(--color-text-default)" }}
            >
              {driverName
                ? `${t("ready.withDriver", { driverName })} `
                : `${t("ready.noDriver")} `}
              <strong style={{ color: "var(--color-brand-ink)" }}>
                {windowText}
              </strong>
              {allDone ? t("ready.complete") : t("ready.remaining")}
            </p>
            {!allDone && (
              <p
                className="mt-3 text-[13px] font-semibold"
                style={{ color: "var(--color-brand-primary)" }}
              >
                {t("ready.itemsLeft", { count: itemsLeft })} —{" "}
                <span style={{ color: "#365314" }}>
                  {t("ready.requiredCount", { count: requiredLeft })}
                </span>
                {recommendedLeft > 0
                  ? `, ${t("ready.recommendedCount", { count: recommendedLeft })}`
                  : ""}
              </p>
            )}
          </div>

          {!allDone && (
            <button
              type="button"
              className="flex-shrink-0 rounded-xl font-bold text-[14px] px-5 py-3 transition-opacity hover:opacity-90"
              style={{
                background: "var(--color-brand-accent)",
                color: "var(--color-brand-accent-ink)",
                boxShadow:
                  "0 10px 22px color-mix(in oklab, var(--color-brand-accent) 30%, transparent)",
              }}
            >
              {t("ready.cta")}
            </button>
          )}
        </div>
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
 * PickupPhotosCard — named-angle grid with done/empty states
 * ============================================================ */

function PickupPhotosCard({
  photos,
  onUploadClick,
}: {
  photos: Photo[];
  onUploadClick: (angle: PhotoAngle) => void;
}) {
  const t = useTranslations("portal.prep.photos");
  const total = REQUIRED_PHOTO_ANGLES.length;
  const done = REQUIRED_PHOTO_ANGLES.filter((a) =>
    photos.some((p) => p.angle === a),
  ).length;
  const pct = Math.round((done / total) * 100);
  const left = total - done;

  return (
    <Card>
      <CardHead
        title={t("title", { done, total })}
        sub={t("sub")}
        rightChip={left > 0 ? t("leftChip", { count: left }) : t("allDoneChip")}
        chipTone={left > 0 ? "lime" : "muted"}
      />
      <div className="px-5 md:px-6 pb-5 md:pb-6">
        <ProgressBar pct={pct} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          {REQUIRED_PHOTO_ANGLES.map((angle) => {
            const uploaded = photos.find((p) => p.angle === angle);
            return (
              <PhotoTile
                key={angle}
                label={t(`angles.${angle}`)}
                uploaded={Boolean(uploaded)}
                onClick={() => onUploadClick(angle)}
              />
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function PhotoTile({
  label,
  uploaded,
  onClick,
}: {
  label: string;
  uploaded: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("portal.prep.photos");
  if (uploaded) {
    return (
      <div
        className="rounded-xl flex flex-col items-center justify-center gap-1.5 text-center px-3 py-4 border"
        style={{
          background:
            "color-mix(in oklab, var(--color-brand-primary) 10%, white)",
          borderColor:
            "color-mix(in oklab, var(--color-brand-primary) 35%, white)",
          aspectRatio: "1.2 / 1",
        }}
      >
        <IconCheck color="var(--color-brand-primary)" />
        <div
          className="text-[13px] font-bold"
          style={{
            color: "color-mix(in oklab, var(--color-brand-primary) 80%, black)",
          }}
        >
          {label}
        </div>
        <div
          className="text-[11px] font-semibold"
          style={{ color: "var(--color-brand-primary)" }}
        >
          {t("uploaded")}
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl flex flex-col items-center justify-center gap-1.5 text-center px-3 py-4 transition-all hover:-translate-y-px cursor-pointer"
      style={{
        background: "var(--color-brand-paper)",
        border: "1.5px dashed var(--color-gray-300)",
        aspectRatio: "1.2 / 1",
      }}
    >
      <IconPlus color="var(--color-text-muted)" />
      <div
        className="text-[13px] font-bold"
        style={{ color: "var(--color-text-default)" }}
      >
        {label}
      </div>
      <div
        className="text-[11px] font-semibold"
        style={{ color: "var(--color-text-muted)" }}
      >
        {t("tapToUpload")}
      </div>
    </button>
  );
}

/* ============================================================
 * StillNeededCard — required (lime family) + recommended (neutral)
 * ============================================================ */

function StillNeededCard({
  required,
  recommended,
}: {
  required: ChecklistItem[];
  recommended: ChecklistItem[];
}) {
  const t = useTranslations("portal.prep.stillNeeded");
  const total = required.length + recommended.length;
  return (
    <Card>
      <CardHead
        title={t("title")}
        sub={t("sub")}
        rightChip={t("leftChip", { count: total })}
        chipTone="lime"
      />
      <div className="px-5 md:px-6 pb-5 md:pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {required.length > 0 && (
            <NeedBlock
              tone="required"
              tag={t("requiredTag")}
              items={required}
            />
          )}
          {recommended.length > 0 && (
            <NeedBlock
              tone="recommended"
              tag={t("recommendedTag")}
              items={recommended}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

function NeedBlock({
  tone,
  tag,
  items,
}: {
  tone: "required" | "recommended";
  tag: string;
  items: ChecklistItem[];
}) {
  const t = useTranslations("portal.prep.checklist");
  const isRequired = tone === "required";
  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        background: isRequired
          ? "color-mix(in oklab, var(--color-brand-accent) 10%, white)"
          : "var(--color-surface-elevated)",
        borderColor: isRequired
          ? "color-mix(in oklab, var(--color-brand-accent) 30%, white)"
          : "var(--color-gray-200)",
      }}
    >
      <div
        className="text-[10.5px] font-extrabold uppercase tracking-wider mb-2.5"
        style={{
          color: isRequired ? "#365314" : "var(--color-text-muted)",
        }}
      >
        {tag}
      </div>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2.5">
            <span
              className="flex-shrink-0 mt-2 rounded-full"
              style={{
                width: 8,
                height: 8,
                background: isRequired
                  ? "var(--color-brand-accent)"
                  : "var(--color-gray-300)",
              }}
            />
            <div className="min-w-0">
              <div
                className="text-[14px] font-bold leading-snug"
                style={{ color: "var(--color-text-default)" }}
              >
                {t(`labels.${item.key}`)}
              </div>
              <div
                className="text-[12.5px] mt-0.5 leading-snug"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t(`descriptions.${item.key}`)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
 * CompletedPrepCard — muted, secondary
 * ============================================================ */

function CompletedPrepCard({ items }: { items: ChecklistItem[] }) {
  const t = useTranslations("portal.prep");
  return (
    <Card>
      <div
        className="px-5 md:px-6 py-4 flex items-center justify-between"
        style={{
          background: "var(--color-surface-elevated)",
          borderBottom: "1px solid var(--color-gray-200)",
        }}
      >
        <h3
          className="text-[14px] font-bold"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("completed.title", { count: items.length })}
        </h3>
      </div>
      <ul
        className="px-5 md:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-5"
        style={{ background: "var(--color-surface-elevated)" }}
      >
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-2 text-[13px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            <IconCheck color="var(--color-brand-primary)" size={14} />
            {t(`checklist.labels.${item.key}`)}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ============================================================
 * PhotoUploadModal — "coming at launch" affordance (Option B)
 *
 * Real upload pipeline (Option A: Firebase Storage + per-customer rules) is
 * deferred to Phase B. This modal explains the temporary state without
 * faking a broken upload flow — the customer trusts the portal more if we
 * say "not yet" honestly than if we present a button that does nothing.
 *
 * Esc closes; click on the backdrop closes. Brand-styled.
 * ============================================================ */

function PhotoUploadModal({
  angleLabel,
  onClose,
}: {
  angleLabel: string;
  onClose: () => void;
}) {
  const t = useTranslations("portal.prep.photoUploadModal");
  const dismissBtnRef = useRef<HTMLButtonElement>(null);
  // Ref-pinned onClose so the window keydown listener always calls the latest
  // closure even though we attach it only once. Avoids stale-closure issues
  // without re-attaching the listener on every parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // Window keydown for Esc — catches the key regardless of focus.
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    }
    window.addEventListener("keydown", handleKey, { capture: true });
    // Lock body scroll while open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Auto-focus the dismiss button so Enter also closes.
    dismissBtnRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", handleKey, { capture: true });
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        background: "color-mix(in oklab, var(--color-brand-ink) 60%, transparent)",
      }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
        style={{
          background: "var(--color-brand-paper)",
          borderTop: "4px solid var(--color-brand-accent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-6 md:px-7 md:py-7">
          <div
            className="inline-flex items-center justify-center rounded-full mb-4"
            style={{
              width: 44,
              height: 44,
              background:
                "color-mix(in oklab, var(--color-brand-accent) 22%, white)",
            }}
          >
            <IconCamera color="#365314" />
          </div>
          <h2
            id="photo-upload-modal-title"
            className="text-xl md:text-[22px] font-extrabold leading-tight"
            style={{
              color: "var(--color-brand-ink)",
              fontFamily: "var(--font-brand-display)",
              letterSpacing: "var(--letter-spacing-display)",
            }}
          >
            {t("title")}
          </h2>
          <p
            className="mt-3 text-[14px] leading-relaxed"
            style={{ color: "var(--color-text-default)" }}
          >
            {t("body", { angle: angleLabel.toLowerCase() })}
          </p>
          <button
            ref={dismissBtnRef}
            type="button"
            onClick={onClose}
            onKeyDown={(e) => {
              if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                onClose();
              }
            }}
            className="mt-6 w-full rounded-xl font-bold text-[14px] px-5 py-3 transition-opacity hover:opacity-90"
            style={{
              background: "var(--color-brand-accent)",
              color: "var(--color-brand-accent-ink)",
            }}
          >
            {t("dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * PREP-specific helpers
 * ============================================================ */

/**
 * Formats the scheduled pickup window in the active locale. The date itself
 * is rendered by `Intl.DateTimeFormat(locale, ...)` so weekday + month names
 * naturally come out localized; the wrapper words ("today" / "between … and …")
 * are translated via portal.prep.pickupWindow.*.
 */
function formatPickupWindow(
  pickup: PickupWindow,
  locale: string,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const start = new Date(pickup.start);
  const end = new Date(pickup.end);
  const today = isSameLocalDay(start, new Date(), pickup.timezone);
  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: pickup.timezone,
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: pickup.timezone,
  });
  const prefix = today ? t("pickupWindow.today") : dateFmt.format(start);
  const between = t("pickupWindow.between", {
    start: timeFmt.format(start),
    end: timeFmt.format(end),
    tz: tzShortName(pickup.timezone),
  });
  return `${prefix} ${between}`;
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
