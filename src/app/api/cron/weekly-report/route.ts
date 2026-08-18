/**
 * GET /api/cron/weekly-report
 *
 * MONDAY MORNING weekly report — the v2 design, generated with live figures and
 * emailed **to Eddie as a draft**, not to Ben.
 *
 * Cron: `0 13 * * 1` = Monday 06:00 PDT / 05:00 PST. Vercel crons are UTC-only;
 * the hour shift across DST does not matter for an internal draft.
 *
 * ---------------------------------------------------------------------------
 * THIS ROUTE IS DELIBERATELY THIN. Every figure and every byte of HTML comes
 * from src/lib/reports/weeklyReport.mjs, which is pure and is imported by BOTH
 * this route and scripts/weekly-report-preview.mjs. One implementation, two
 * callers — so a local preview cannot disagree with the email that ships.
 * That separation exists because this project spent a day paying for six
 * scripts holding six opinions about what a ProABD timestamp meant.
 *
 * WHY IT DRAFTS RATHER THAN SENDS
 * Roughly 60% of the v2 design is written judgement: which campaigns get
 * trimmed and why, what a budget increase bought, whether anything needs Ben's
 * approval. None of it is derivable from data. /api/cron/weekly-digest carries
 * an explicit rule from the 2026-08-07 false-zero incident — "A digest reports;
 * it does not diagnose." Generating that narrative from rules would reintroduce
 * exactly that failure inside a far more authoritative-looking email.
 *
 * WHY MONDAY
 * The reporting week is complete. The old digest fired Friday 19:00 PT while
 * documenting itself as a Friday-morning job, and reported a week that still
 * had Friday in it.
 * ---------------------------------------------------------------------------
 */
import { NextResponse } from "next/server";
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { sendLeadEmail } from "@/lib/email/resend";
import { fetchAdsCostByDay } from "@/lib/googleAds/client";
// @ts-ignore — plain-JS module shared with scripts/; it ships no type
// declarations by design (it must stay importable from plain node). ts-ignore,
// not ts-expect-error: whether TS flags an untyped .mjs import varies by
// Next/TS version, and an unused expect-error fails the build (learned
// 2026-08-18, first deploy).
import { computeFigures, renderWeeklyReport, ymd } from "@/lib/reports/weeklyReport.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The draft goes to us. Ben's address is deliberately absent from this file. */
const DRAFT_TO = process.env.WEEKLY_REPORT_DRAFT_TO ?? "";
const MONTHLY_CEILING = Number(process.env.ADS_MONTHLY_CEILING ?? 7000);

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const now = new Date();

  /* ---- Leads: 40 days back covers the four reporting weeks with headroom ---- */
  let leads: Array<{ at: Date; lead: Record<string, unknown> }> = [];
  try {
    const db = getAdminDb();
    const snap = await db
      .collection("leads")
      .where("createdAt", ">=", new Date(now.getTime() - 40 * 864e5)) // Timestamp field, Timestamp operand
      .orderBy("createdAt", "desc")
      .limit(2000)
      .get();
    leads = snap.docs
      .map((d) => {
        const x = d.data() as Record<string, unknown> & { createdAt?: { toDate?: () => Date } };
        return { at: x.createdAt?.toDate?.() ?? null, lead: x };
      })
      .filter((x): x is { at: Date; lead: Record<string, unknown> } => !!x.at);
  } catch (err) {
    console.error("[weekly-report] firestore query failed", err);
    return NextResponse.json({ ok: false, error: "firestore_query_failed" }, { status: 500 });
  }

  /* ---- Ads spend. Never throws; a failure degrades to em dashes, never $0,
          because $0 reads as a real number. ---- */
  const monthStart = new Date(`${ymd(now).slice(0, 8)}01T00:00:00-07:00`);
  const since = new Date(Math.min(now.getTime() - 40 * 864e5, monthStart.getTime()));
  const cost = await fetchAdsCostByDay(since);
  const byDay: Map<string, number> = cost.state === "ok" ? cost.byDay : new Map();
  const adsNote =
    cost.state === "ok" ? ""
      : cost.state === "unconfigured" ? `Ads API unconfigured (${cost.missing.join(", ")})`
        : `Ads API error: ${cost.message}`;

  const f = computeFigures({ leads, byDay, now, ceiling: MONTHLY_CEILING });
  const { subject, html, text } = renderWeeklyReport(f, { adsNote, mode: "draft" });

  if (dryRun) {
    return NextResponse.json({
      ok: true, dryRun: true, subject, adsNote,
      suspiciousZero: f.suspiciousZero,
      week: { start: ymd(f.weekStart), end: ymd(f.weekEnd) },
      weeks: f.weeks.map((w: { start: Date; total: number; web: number; calls: number; attributed: number; spend: number }) => ({
        start: ymd(w.start), total: w.total, web: w.web, calls: w.calls,
        attributed: w.attributed, spend: Math.round(w.spend),
      })),
      mtd: Math.round(f.mtd), projected: Math.round(f.projected),
      adDaysElapsed: f.adDaysElapsed, adDaysTotal: f.adDaysTotal,
    });
  }

  if (!DRAFT_TO) {
    console.error("[weekly-report] WEEKLY_REPORT_DRAFT_TO unset — nothing sent");
    return NextResponse.json({ ok: false, error: "no_draft_recipient" }, { status: 500 });
  }

  const res = await sendLeadEmail({
    to: [DRAFT_TO],
    subject: `[DRAFT] ${subject}${f.suspiciousZero ? " — ZERO LEADS, CHECK QUERY" : ""}`,
    text,
    html,
    tags: [{ name: "kind", value: "weekly-report-draft" }],
  });

  return NextResponse.json({ ok: true, sent: res, suspiciousZero: f.suspiciousZero, adsNote });
}
