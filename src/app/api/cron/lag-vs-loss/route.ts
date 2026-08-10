/**
 * GET /api/cron/lag-vs-loss
 *
 * Daily tracking-integrity monitor. Compares our FIRST-PARTY event counts
 * (site_events — the collector that kept working through the 2026-08-06
 * sGTM outage) against GA4's counts for the same days, and real Firestore
 * lead counts against GA4's lead_form_submit. Divergence = the analytics
 * pipe that feeds Google Ads is lying again; alert a human the same day.
 *
 * Origin: the 8/6 incident. GA4 events silently died (intermittent sGTM
 * 503s), Ads showed 1 conversion on a ~dozen-conversion day, and the only
 * detector was Eddie's gut. Rules learned there and encoded here:
 *   - server 200s don't prove fleet health; compare COUNTS, not statuses
 *   - same-day data is never evidence: D-1 is reported as informational
 *     only; alerts fire on D-2, when both pipes have settled
 *   - low volume makes ratios noisy: no alert unless the first-party side
 *     cleared a minimum count
 *
 * Auth: Vercel cron Bearer CRON_SECRET (same as weekly-digest).
 * Manual:  curl -H "Authorization: Bearer $CRON_SECRET" \
 *            "https://www.autolinelogistics.com/api/cron/lag-vs-loss?dryRun=1"
 * dryRun=1 computes and returns JSON without sending any alert email.
 *
 * GA4 access: reuses the Firebase service account (FIREBASE_CLIENT_EMAIL /
 * FIREBASE_PRIVATE_KEY in Vercel; ADC locally). ONE-TIME SETUP:
 *   1. GA4 Admin → Property access management → add the service-account
 *      email as Viewer.
 *   2. Set GA4_PROPERTY_ID in Vercel (numeric id, GA4 Admin → Property
 *      settings — NOT the G-XXXX measurement id).
 * Cron schedule lives in vercel.json: daily 16:00 UTC (~9 AM PT), so D-2
 * is fully settled and D-1 is ~complete.
 *
 * Results are also stored to `monitor_daily/{date}` so /admin can chart
 * pipeline health later without re-querying GA4.
 */
import { NextResponse } from "next/server";
import "server-only";
import { GoogleAuth } from "google-auth-library";

import { getAdminDb } from "@/lib/firebase/admin";
import { sendLeadEmail } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Alert recipient: MONITOR_ALERT_TO, else first DIGEST_BCC entry. */
const ALERT_TO =
  process.env.MONITOR_ALERT_TO ??
  (process.env.DIGEST_BCC ?? "").split(",").map((s) => s.trim()).filter(Boolean)[0] ??
  "";

// Thresholds. Ratios are GA4 / first-party. The 8/6 outage would have read
// ~0.2–0.4 here; normal ad-blocker attrition keeps healthy days around
// 0.75–1.1 (GA4 loses blocked browsers that our first-party collector keeps).
const PV_RATIO_FLOOR = 0.65; // page_view: GA4 below 65% of first-party
const FS_RATIO_FLOOR = 0.5;  // form starts (GA4 quote_started vs fp form_started)
const LEAD_RATIO_FLOOR = 0.5; // GA4 lead_form_submit vs real Firestore leads
const MIN_PV = 50;  // don't alert on quiet days
const MIN_FS = 5;
const MIN_LEADS = 3;

/** A Pacific-time calendar day with UTC boundary Dates for range queries. */
function ptDay(offsetDays: number): { date: string; start: Date; end: Date } {
  const nowPT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const utcOffsetMs = Date.now() - nowPT.getTime();
  const d = new Date(nowPT);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  const start = new Date(d.getTime() + utcOffsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const date =
    d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
  return { date, start, end };
}

interface DayCounts {
  date: string;
  fp: { pageViews: number; formStarts: number; estimatesShown: number; leads: number };
  ga: { pageViews: number; formStarts: number; leadSubmits: number };
  ratios: { pageViews: number | null; formStarts: number | null; leads: number | null };
  breaches: string[];
}

const INTERNAL = [/eddiezal28@gmail\.com/i, /@zaldivarlabs\.com/i, /@superflosystems\.com/i, /\btest(ing)?\b/i];

async function firstPartyCounts(day: { date: string; start: Date; end: Date }) {
  const db = getAdminDb();
  const evSnap = await db.collection("site_events")
    .where("ts", ">=", day.start).where("ts", "<", day.end).limit(10000).get();
  let pageViews = 0, formStarts = 0, estimatesShown = 0;
  for (const doc of evSnap.docs) {
    const t = (doc.data() as { type?: string }).type;
    if (t === "page_view") pageViews++;
    else if (t === "form_started") formStarts++;
    else if (t === "estimate_shown") estimatesShown++;
  }
  const leadSnap = await db.collection("leads")
    .where("createdAt", ">=", day.start).where("createdAt", "<", day.end).limit(500).get();
  let leads = 0;
  for (const doc of leadSnap.docs) {
    const d = doc.data() as {
      leadRef?: string; source?: string;
      contact?: { email?: string; firstName?: string; lastName?: string; notes?: string };
    };
    if (d.source === "call" || String(d.leadRef ?? "").startsWith("CALL-")) continue;
    const hay = [d.contact?.email, `${d.contact?.firstName ?? ""} ${d.contact?.lastName ?? ""}`, d.contact?.notes]
      .filter(Boolean).join(" | ");
    if (INTERNAL.some((re) => re.test(hay))) continue;
    leads++;
  }
  return { pageViews, formStarts, estimatesShown, leads };
}

async function ga4Counts(dates: string[]): Promise<Map<string, { pageViews: number; formStarts: number; leadSubmits: number }>> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) throw new Error("GA4_PROPERTY_ID not set");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    ...(clientEmail && privateKey
      ? { credentials: { client_email: clientEmail, private_key: privateKey } }
      : {}), // falls back to ADC for local runs
  });
  const token = await (await auth.getClient()).getAccessToken();
  const sorted = [...dates].sort();
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: sorted[0], endDate: sorted[sorted.length - 1] }],
        dimensions: [{ name: "date" }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        limit: 500,
      }),
    },
  );
  if (!res.ok) throw new Error(`GA4 Data API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as {
    rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
  };
  const out = new Map<string, { pageViews: number; formStarts: number; leadSubmits: number }>();
  for (const d of dates) out.set(d, { pageViews: 0, formStarts: 0, leadSubmits: 0 });
  for (const row of body.rows ?? []) {
    const raw = row.dimensionValues[0]?.value ?? ""; // YYYYMMDD
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    const name = row.dimensionValues[1]?.value;
    const n = Number(row.metricValues[0]?.value ?? 0);
    const slot = out.get(date);
    if (!slot) continue;
    if (name === "page_view") slot.pageViews += n;
    else if (name === "quote_started") slot.formStarts += n;
    else if (name === "lead_form_submit") slot.leadSubmits += n;
  }
  return out;
}

function assess(date: string, fp: DayCounts["fp"], ga: DayCounts["ga"], alerting: boolean): DayCounts {
  const ratio = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) / 100 : null);
  const ratios = {
    pageViews: ratio(ga.pageViews, fp.pageViews),
    formStarts: ratio(ga.formStarts, fp.formStarts),
    leads: ratio(ga.leadSubmits, fp.leads),
  };
  const breaches: string[] = [];
  if (alerting) {
    if (fp.pageViews >= MIN_PV && ratios.pageViews !== null && ratios.pageViews < PV_RATIO_FLOOR)
      breaches.push(`page_view ratio ${ratios.pageViews} < ${PV_RATIO_FLOOR} (GA4 ${ga.pageViews} vs first-party ${fp.pageViews})`);
    if (fp.formStarts >= MIN_FS && ratios.formStarts !== null && ratios.formStarts < FS_RATIO_FLOOR)
      breaches.push(`form-start ratio ${ratios.formStarts} < ${FS_RATIO_FLOOR} (GA4 quote_started ${ga.formStarts} vs first-party form_started ${fp.formStarts}) — the "events die after page_view" signature`);
    if (fp.leads >= MIN_LEADS && ratios.leads !== null && ratios.leads < LEAD_RATIO_FLOOR)
      breaches.push(`lead ratio ${ratios.leads} < ${LEAD_RATIO_FLOOR} (GA4 lead_form_submit ${ga.leadSubmits} vs ${fp.leads} real leads) — Ads is starving`);
  }
  return { date, fp, ga, ratios, breaches };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  const d1 = ptDay(1); // informational only — data may not be settled
  const d2 = ptDay(2); // alert basis

  let results: DayCounts[];
  try {
    const [fp1, fp2, ga] = await Promise.all([
      firstPartyCounts(d1),
      firstPartyCounts(d2),
      ga4Counts([d1.date, d2.date]),
    ]);
    results = [
      assess(d2.date, fp2, ga.get(d2.date)!, true),
      assess(d1.date, fp1, ga.get(d1.date)!, false),
    ];
  } catch (err) {
    // The monitor failing IS a monitoring event — say so instead of dying quietly.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[lag-vs-loss] monitor failed", message);
    if (!dryRun && ALERT_TO) {
      await sendLeadEmail({
        to: [ALERT_TO],
        subject: "[MONITOR] lag-vs-loss could not run",
        text: `The daily GA4-vs-first-party check failed to execute:\n\n${message}\n\nUntil this runs green, tracking divergence would go undetected — same blind spot as before 8/10.`,
        html: `<p>The daily GA4-vs-first-party check failed to execute:</p><pre>${message.replace(/</g, "&lt;")}</pre><p>Until this runs green, tracking divergence would go undetected — same blind spot as before 8/10.</p>`,
        tags: [{ name: "kind", value: "monitor-error" }],
      }).catch(() => undefined);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  // Persist for history / future admin chart.
  try {
    const db = getAdminDb();
    for (const r of results) {
      await db.collection("monitor_daily").doc(r.date).set(
        { ...r, checkedAt: new Date().toISOString() },
        { merge: true },
      );
    }
  } catch (err) {
    console.warn("[lag-vs-loss] failed to persist results (non-fatal)", err);
  }

  const settled = results[0]!;
  const breached = settled.breaches.length > 0;

  if (breached && !dryRun && ALERT_TO) {
    const lines = [
      `Tracking divergence on ${settled.date} (settled data, alert thresholds):`,
      ...settled.breaches.map((b) => `  - ${b}`),
      "",
      `Yesterday (${results[1]!.date}, informational — may not be settled):`,
      `  page_view GA4/${results[1]!.fp.pageViews} fp ratio=${results[1]!.ratios.pageViews}`,
      "",
      "Runbook (from the 8/6 incident):",
      "  1. GA4 Realtime + a live test: do gtag events 503/fail while the site works?",
      "  2. Check bounce rate for the day — collapsed 90%+ bounce = events dying after page_view.",
      "  3. Same-day Ads conversion columns are NEVER evidence either way.",
      "  4. First-party (site_events) is ground truth; GA4 is the patient.",
    ];
    await sendLeadEmail({
      to: [ALERT_TO],
      subject: `[MONITOR] GA4 undercounting on ${settled.date} — ${settled.breaches.length} threshold(s) breached`,
      text: lines.join("\n"),
      html: `<pre style="font-family:ui-monospace,monospace;font-size:13px;">${lines.join("\n").replace(/</g, "&lt;")}</pre>`,
      tags: [{ name: "kind", value: "monitor-alert" }],
    });
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    alerted: breached && !dryRun && Boolean(ALERT_TO),
    alertTo: ALERT_TO || "(none configured)",
    days: results,
  });
}
