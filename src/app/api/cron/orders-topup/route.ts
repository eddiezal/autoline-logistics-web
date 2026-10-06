/**
 * GET /api/cron/orders-topup
 *
 * Daily webhook → `orders` top-up (src/lib/orders/topup.ts) — the automated
 * replacement for the manual export/import/check flow that fed the /admin
 * "Orders import N days old" banner every few days. Proposed 2026-10-01 in
 * claude/orders-refresh-workflow.md; built 2026-10-05.
 *
 * Auth: same convention as the other crons — Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`; manual calls must pass the same
 * header. Optional `?days=N` widens the window (default 7, max 95) for
 * manual backfills.
 *
 * vercel.json entry:
 *   { "path": "/api/cron/orders-topup", "schedule": "0 14 * * *" }
 * (14:00 UTC = 6/7 AM PT — book numbers are fresh before the work day.)
 */
import { NextResponse } from "next/server";
import { runOrdersTopup } from "@/lib/orders/topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const daysParam = Number(new URL(req.url).searchParams.get("days"));
  try {
    const result = await runOrdersTopup(
      Number.isFinite(daysParam) && daysParam > 0 ? { sinceDays: daysParam } : {},
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/orders-topup]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
