/**
 * First-party behavioral event collector (2026-07-22).
 *
 * Receives beacons from src/lib/analytics/behavior.ts and writes them to
 * the `site_events` collection. Anonymous by design: a random visitor ID
 * and a path — no names, no emails, no IPs stored.
 *
 * Retention decision (Eddie, 2026-07-22): keep raw events indefinitely —
 * at current volume (<2K events/day) storage rounds to ~$0.50/month by
 * year two and the full history feeds cohort analysis. Revisit with a
 * TTL policy + nightly rollups if traffic grows ~10x.
 *
 * Bot handling: UA regex + the fact that beacons only fire from executed
 * JS (excludes most crawlers). Payload strictly validated + clamped.
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const EVENT_TYPES = new Set(["page_view", "form_started", "estimate_shown", "tool_result"]);

const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|python-requests|curl\/|wget\//i;

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") ?? "";
    if (BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });

    // Rate limit (2026-07-22 review): generous for real browsing, fatal
    // for curl loops. Beacons are fire-and-forget, so over-limit traffic
    // is silently dropped rather than 429'd.
    const rl = await checkRateLimit({ key: "events:" + getClientIp(req), limit: 60, windowMs: 60_000 });
    if (!rl.success) return new NextResponse(null, { status: 204 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new NextResponse(null, { status: 204 });
    }
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const b = body as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const type = str(b.type, 30);
    if (!type || !EVENT_TYPES.has(type)) return new NextResponse(null, { status: 204 });

    const vid = str(b.vid, 60);
    const path = str(b.path, 300);
    if (!vid || !path) return new NextResponse(null, { status: 204 });

    // Referrer → host only (no query strings, no full URLs stored).
    let referrerHost: string | null = null;
    const ref = str(b.ref, 300);
    if (ref) {
      try {
        const host = new URL(ref).hostname.replace(/^www\./, "");
        // Internal navigation isn't a referrer worth storing.
        referrerHost = host.includes("autolinelogistics") ? null : host;
      } catch {
        referrerHost = null;
      }
    }

    // Meta: allow a small numeric price + short string fields only.
    let meta: Record<string, string | number> | null = null;
    if (b.meta && typeof b.meta === "object") {
      meta = {};
      const price = Number(b.meta.price);
      if (Number.isFinite(price) && price > 0 && price < 100000) meta.price = Math.round(price);
      const tool = str(b.meta.tool, 40);
      if (tool) meta.tool = tool;
      // Ship-vs-drive verdict + signed dollar delta (tool_result events).
      const verdict = str(b.meta.verdict, 20);
      if (verdict) meta.verdict = verdict;
      const delta = Number(b.meta.delta);
      if (Number.isFinite(delta) && Math.abs(delta) < 100000) meta.delta = Math.round(delta);
      if (Object.keys(meta).length === 0) meta = null;
    }

    const now = new Date();
    await getAdminDb()
      .collection("site_events")
      .add({
        vid,
        sid: str(b.sid, 60),
        type,
        path,
        locale: b.locale === "es" ? "es" : "en",
        referrerHost,
        meta,
        // PT calendar day for cheap daily grouping without tz math on read.
        day: now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }),
        ts: FieldValue.serverTimestamp(),
      });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[/api/events] write failed", err);
    return new NextResponse(null, { status: 204 }); // collector never errors to clients
  }
}
