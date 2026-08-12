/**
 * Live Google Business Profile rating badge (2026-08-12).
 *
 * Async server component. Reads the cached aggregate rating that
 * /api/cron/gbp-rating writes to Firestore (system/gbpRating) once a
 * day, and renders "★ 5.0 · 9 Google reviews" linking to the real GBP
 * listing. Third-party proof, visually separate from our own claims
 * (see claude/gbp-setup-and-reviews-spec.md §7).
 *
 * PREDETERMINED DISPLAY RULE — do not change without updating the spec:
 * render if and only if
 *   1. the cached doc exists and ok === true,
 *   2. fetchedAt is within the last 7 days (stale data disappears
 *      rather than lying), and
 *   3. count >= 5 (below that, an aggregate number reads as noise).
 * The rule must NEVER condition on the rating VALUE. Hiding the badge
 * when the number dips is outcome-dependent display — the same
 * dishonesty as review gating, just downstream. If the rating drops,
 * the badge shows the drop.
 *
 * No schema.org Review/AggregateRating markup here, on purpose:
 * Google-sourced reviews on your own site are "self-serving" per
 * Google's structured-data guidelines and can draw a manual action.
 * Visible text only.
 */

import { getTranslations } from "next-intl/server";
import { getAdminDb } from "@/lib/firebase/admin";

const MAX_AGE_DAYS = 7;
const MIN_COUNT = 5;

/**
 * Link target. The generic `maps/place/?q=place_id:` format lands on a
 * random map area for this profile because it's a hidden-address
 * service-area business (no pin to center on) — confirmed live 8/12.
 * The CID link is Maps' native identifier for the listing and always
 * opens the profile panel. CID 2626016846281494172 = 0x24717c6890ccce9c,
 * the second half of the listing's FTID (see the gbp spec doc).
 */
const PROFILE_URL = "https://maps.google.com/?cid=2626016846281494172";

interface GbpRatingDoc {
  ok?: boolean;
  rating?: number;
  count?: number;
  placeId?: string;
  fetchedAt?: { toDate?: () => Date };
}

async function readRating(): Promise<{
  rating: number;
  count: number;
  placeId: string;
} | null> {
  try {
    const snap = await getAdminDb().doc("system/gbpRating").get();
    if (!snap.exists) return null;
    const d = snap.data() as GbpRatingDoc;
    const fetchedAt = d.fetchedAt?.toDate?.();
    if (
      !d.ok ||
      typeof d.rating !== "number" ||
      typeof d.count !== "number" ||
      typeof d.placeId !== "string" ||
      !fetchedAt
    ) {
      return null;
    }
    // Display rule (see header): fresh + enough reviews. Never the value.
    const ageMs = Date.now() - fetchedAt.getTime();
    if (ageMs > MAX_AGE_DAYS * 24 * 3600_000) return null;
    if (d.count < MIN_COUNT) return null;
    return { rating: d.rating, count: d.count, placeId: d.placeId };
  } catch (err) {
    // Badge is decorative proof, never load-bearing: fail to nothing.
    console.error("[GbpRatingBadge] read failed:", err);
    return null;
  }
}

export async function GbpRatingBadge({
  variant = "light",
}: {
  /** "dark" for charcoal sections (homepage finalCta), "light" elsewhere. */
  variant?: "dark" | "light";
}) {
  const data = await readRating();
  if (!data) return null;

  const t = await getTranslations("gbpBadge");
  const dark = variant === "dark";

  return (
    <a
      href={PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("ariaLabel", {
        rating: data.rating.toFixed(1),
        count: data.count,
      })}
      className={
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors " +
        (dark
          ? "border-white/20 bg-white/5 text-gray-200 hover:bg-white/10"
          : "border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50")
      }
    >
      <span aria-hidden="true" className="text-amber-400">
        ★
      </span>
      <span className="font-semibold">{data.rating.toFixed(1)}</span>
      <span aria-hidden="true" className={dark ? "text-gray-500" : "text-gray-300"}>
        ·
      </span>
      {/* Source attribution: this is Google's number, say so. */}
      <span>{t("reviewsOnGoogle", { count: data.count })}</span>
    </a>
  );
}
