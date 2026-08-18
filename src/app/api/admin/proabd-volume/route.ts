/**
 * GET /api/admin/proabd-volume
 *
 * Returns hourly ProABD webhook event volume for a lookback window (default 48h).
 * Diagnostic endpoint for lead-delivery disruption investigations.
 *
 * If our webhook stream has gaps matching times when agents didn't receive
 * leads, the disruption was pipeline-wide (Superflo backend or Ben's Referrer
 * routing). If our stream was steady, routing was diverted on Ben's account
 * without affecting the actual event feed.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.autolinelogistics.com/api/admin/proabd-volume"
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://www.autolinelogistics.com/api/admin/proabd-volume?hours=72"
 *
 * Added 2026-07-09 for lead delivery disruption incident (Nelson + Ginger
 * report from same day).
 *
 * 2026-08-16: fixed a counting bug — `taylor` only matched referrer 503 and
 * dropped referrer 18 (the shared feed) into `other`. Taylor volume was
 * under-reported by roughly two thirds. The two ids are now counted together
 * AND reported separately, because they are different products.
 */

import { NextResponse } from "next/server";
import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FirestoreTimestampLike {
  toDate: () => Date;
}

function isTimestampLike(v: unknown): v is FirestoreTimestampLike {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { toDate?: unknown }).toDate === "function"
  );
}

/**
 * Tony Taylor sells TWO different products under TWO referrer ids:
 *   503 — premium / exclusive feed
 *    18 — cheaper feed, resold to competing brokers
 * They are priced and sold differently and must never be averaged into one
 * number. Splitting them here so `taylor` is the honest total and the two
 * products stay separable.
 *
 * BUG FIXED 2026-08-16: this endpoint counted ONLY 503 as Taylor and silently
 * dropped 18 into `other`, under-reporting Taylor volume by roughly two thirds
 * (346 records vs 176 in the Jul 8 - Aug 2 cohort). Found while building
 * scripts/source-comparison.mjs.
 */
const TAYLOR_PREMIUM_ID = "503";
const TAYLOR_SHARED_ID = "18";

interface HourBucket {
  total: number;
  taylor: number;          // both products — the corrected total
  taylorPremium: number;   // 503, exclusive
  taylorShared: number;    // 18, resold to other brokers
  other: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const hoursParam = url.searchParams.get("hours");
  const hours = Math.min(Math.max(parseInt(hoursParam ?? "48", 10) || 48, 1), 168);

  const now = new Date();
  const windowStart = new Date(now.getTime() - hours * 60 * 60 * 1000);

  const db = getAdminDb();
  const snapshot = await db
    .collection("proabd_webhook_events")
    .where("received_at", ">=", windowStart)
    .orderBy("received_at", "asc")
    .get();

  const hourly = new Map<string, HourBucket>();
  const timestamps: Date[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!isTimestampLike(data.received_at)) continue;
    const receivedAt = data.received_at.toDate();
    timestamps.push(receivedAt);

    const raw = (data.raw_item ?? {}) as Record<string, unknown>;
    const referrerId = typeof raw.Referrer_Id === "string" ? raw.Referrer_Id : "unknown";
    const referrer = typeof raw.Referrer === "string" ? raw.Referrer : "unknown";
    const itemType = typeof raw.Item_Type === "string" ? raw.Item_Type : "unknown";

    // Hour key in Pacific Time (Ben's operating window)
    const hourKey = receivedAt.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    });

    if (!hourly.has(hourKey)) {
      hourly.set(hourKey, {
        total: 0, taylor: 0, taylorPremium: 0, taylorShared: 0, other: 0,
        byType: {}, bySource: {},
      });
    }
    const b = hourly.get(hourKey)!;
    b.total++;
    if (referrerId === TAYLOR_PREMIUM_ID) { b.taylor++; b.taylorPremium++; }
    else if (referrerId === TAYLOR_SHARED_ID) { b.taylor++; b.taylorShared++; }
    else b.other++;
    b.byType[itemType] = (b.byType[itemType] ?? 0) + 1;
    b.bySource[referrer] = (b.bySource[referrer] ?? 0) + 1;
  }

  // Gap detection (60+ minute silences)
  const gaps: Array<{ start: string; end: string; minutes: number }> = [];
  for (let i = 1; i < timestamps.length; i++) {
    const gapMinutes = (timestamps[i].getTime() - timestamps[i - 1].getTime()) / 60000;
    if (gapMinutes >= 60) {
      gaps.push({
        start: timestamps[i - 1].toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
        end: timestamps[i].toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
        minutes: Math.round(gapMinutes),
      });
    }
  }

  // Sort hourly buckets chronologically
  const sortedHourly = [...hourly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, bucket]) => ({ hour, ...bucket }));

  return NextResponse.json({
    window_start: windowStart.toISOString(),
    window_end: now.toISOString(),
    hours,
    total_events: snapshot.size,
    hourly: sortedHourly,
    gaps_60min_or_more: gaps,
  });
}
