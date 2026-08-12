/**
 * Daily GBP rating fetch → Firestore cache (2026-08-12).
 *
 * Pulls the live Google Business Profile aggregate rating for
 * Auto Line Logistics, Inc via Places API (New) and caches it in
 * Firestore at system/gbpRating. The <GbpRatingBadge /> component
 * reads that doc server-side — no client-side Google calls, no CSP
 * changes, no per-pageview API cost.
 *
 * Schedule: vercel.json cron, daily 15:30 UTC (~8:30 AM PT).
 * Auth: Bearer CRON_SECRET (same pattern as /api/cron/lag-vs-loss).
 *
 * Env:
 *   GOOGLE_PLACES_API_KEY  — required. API key restricted to
 *                            "Places API (New)" in the
 *                            auto-line-logistics GCP project.
 *   GBP_PLACE_ID           — optional. When unset, the route
 *                            bootstraps via places:searchText and
 *                            stores the resolved place id in the
 *                            Firestore doc; copy it into Vercel env
 *                            afterwards so future runs do a direct
 *                            (cheaper, unambiguous) lookup.
 *
 * ENTITY GUARD — important: there is a sister CARRIER named
 * "Auto Line Express, Inc" (3.6★) that Maps search happily returns
 * for "auto line" queries. We refuse to store any result whose
 * displayName does not contain "Logistics". Wrong-entity data is
 * worse than no data.
 *
 * Failure behavior: keep the previous cached values, stamp
 * lastError/lastErrorAt. The badge component has its own freshness
 * gate (7 days) and simply disappears if this route stays broken —
 * a stale-but-recent rating is fine, a missing badge is fine, a
 * wrong rating is not.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

const PLACES_BASE = "https://places.googleapis.com/v1";
const FIELD_MASK = "id,displayName,rating,userRatingCount";
// Entity guard: must appear in displayName or we refuse the result.
const REQUIRED_NAME_TOKEN = "logistics";
const SEARCH_QUERY = "Auto Line Logistics Inc vehicle shipping Anaheim";

interface PlaceResult {
  id: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
}

async function fetchPlaceById(apiKey: string, placeId: string): Promise<PlaceResult> {
  const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`places get HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as PlaceResult;
}

async function searchPlace(apiKey: string): Promise<PlaceResult> {
  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({ textQuery: SEARCH_QUERY }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`places searchText HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const body = (await res.json()) as { places?: PlaceResult[] };
  const places = body.places ?? [];
  // Take the first result that passes the entity guard, not just [0] —
  // the Express carrier can outrank us on generic queries.
  const match = places.find((p) =>
    (p.displayName?.text ?? "").toLowerCase().includes(REQUIRED_NAME_TOKEN),
  );
  if (!match) {
    throw new Error(
      `searchText returned ${places.length} places, none matching "${REQUIRED_NAME_TOKEN}": ` +
        places.map((p) => p.displayName?.text ?? "?").join(" | "),
    );
  }
  return match;
}

export async function GET(req: NextRequest) {
  // Same auth pattern as lag-vs-loss: Vercel cron sends
  // Authorization: Bearer ${CRON_SECRET}.
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not set" },
      { status: 500 },
    );
  }

  const db = getAdminDb();
  const ref = db.doc("system/gbpRating");

  try {
    // Prefer the pinned place id (env, else the one a previous run
    // resolved and stored); bootstrap via text search only when neither
    // exists yet.
    let placeId = process.env.GBP_PLACE_ID;
    if (!placeId) {
      const prev = await ref.get();
      placeId = (prev.data()?.placeId as string | undefined) ?? undefined;
    }

    const place = placeId
      ? await fetchPlaceById(apiKey, placeId)
      : await searchPlace(apiKey);

    const name = place.displayName?.text ?? "";
    // ENTITY GUARD (see file header): never store Auto Line Express data.
    if (!name.toLowerCase().includes(REQUIRED_NAME_TOKEN)) {
      throw new Error(`entity guard: displayName "${name}" lacks "${REQUIRED_NAME_TOKEN}"`);
    }
    if (typeof place.rating !== "number" || typeof place.userRatingCount !== "number") {
      throw new Error(`place ${place.id} returned no rating/userRatingCount (0 reviews or field missing)`);
    }

    await ref.set(
      {
        ok: true,
        rating: place.rating,
        count: place.userRatingCount,
        placeId: place.id,
        displayName: name,
        fetchedAt: FieldValue.serverTimestamp(),
        lastError: FieldValue.delete(),
        lastErrorAt: FieldValue.delete(),
      },
      { merge: true },
    );

    console.log(
      `[gbp-rating] ok: ${name} ${place.rating} (${place.userRatingCount} reviews), place ${place.id}`,
    );
    return NextResponse.json({
      ok: true,
      rating: place.rating,
      count: place.userRatingCount,
      placeId: place.id,
      displayName: name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gbp-rating] failed:", msg);
    // Keep previous values; the badge's 7-day freshness gate handles decay.
    await ref
      .set(
        { lastError: msg, lastErrorAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
      .catch(() => {});
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
