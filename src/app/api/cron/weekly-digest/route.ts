/**
 * GET /api/cron/weekly-digest
 *
 * Friday morning digest of the past 7 days of leads, emailed to Ben at
 * info@autolineexpress.com. Replaces per-lead BCC to Ben (he prefers
 * Friday cadence per stated email overload).
 *
 * Cron: Friday 8:00 AM PT = 15:00 UTC (Vercel cron expression `0 15 * * 5`)
 * Auth: Vercel sets `Authorization: Bearer <CRON_SECRET>` on cron invocations.
 *
 * ---------------------------------------------------------------------------
 * 2026-08-08 POST-INCIDENT REWRITE. The 2026-08-07 digest told the client
 * "0 web leads (paid campaigns not active yet)" during a week with 44 lead
 * records and ~$321/day of live spend. Three defects, all fixed here:
 *
 *  1. WRONG FIELD + TYPE BRACKET. It queried
 *       .where("submittedAt", ">=", <JS Date>)
 *     `submittedAt` is written as `new Date().toISOString()` (a STRING);
 *     `createdAt` is written as `FieldValue.serverTimestamp()` (a Timestamp).
 *     Firestore inequality filters are TYPE-BRACKETED: a range comparison only
 *     matches documents whose field is the same type as the comparison value.
 *     String field vs Timestamp operand => 0 results, always, every run since
 *     this route shipped. Verified 2026-08-08 (scripts/digest-diag.mjs):
 *     submittedAt>=Date -> 0 docs; createdAt>=Date -> 44 docs, same window.
 *     Every other read path in the repo already keys off `createdAt`. Do not
 *     range-query `submittedAt`. It is a display string, not a clock.
 *
 *  2. HARDCODED CAUSAL CLAIM. The subject line and body asserted "paid
 *     campaigns haven't turned on yet" purely because the count was 0. This
 *     route cannot observe Google Ads and must never explain a number it did
 *     not measure. All such copy is deleted. A digest reports; it does not
 *     diagnose.
 *
 *  3. ZERO IS NOW TREATED AS A DEFECT, NOT A FACT. At current volume a true
 *     zero week would itself be an incident, and a zero is far more likely to
 *     mean the query broke again. A 0-count digest is therefore NOT sent to
 *     the client; it is routed to DIGEST_ALERT_TO for a human to verify first.
 *     This is the structural guard: a broken digest can no longer speak to Ben.
 *
 * Also corrected while in here: agent attribution reads `proabdAssignedAgent`
 * first (post-2026-07-20 cutover; the old `assignedAgent` round-robin field is
 * absent on new leads, so "By agent" was reporting everything as Unassigned),
 * contact email lives at `contact.email` not `customer.email`, and inbound
 * CallRail leads (doc id `call_*`, `source: "call"`) are counted separately
 * from web form submissions instead of being silently blended in.
 * ---------------------------------------------------------------------------
 */
import { NextResponse } from "next/server";
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { sendLeadEmail } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIGEST_TO = "info@autolineexpress.com";

/**
 * Silent copy of every client-facing digest, so we see exactly what Ben saw,
 * verbatim, at the same moment he sees it. The 2026-08-07 false zero went
 * undetected until the client forwarded it back to us; nobody on our side was
 * on the distribution. BCC rather than TO so his copy stays clean.
 *
 * Comma-separated. Set DIGEST_BCC in Vercel.
 */
const DIGEST_BCC = (process.env.DIGEST_BCC ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Where a suspicious (0-count) digest goes instead of to the client.
 * Falls back to the first DIGEST_BCC address so one env var can cover both
 * paths. If neither is set, a 0-count digest sends nowhere and logs loudly —
 * silence is strictly better than a false report.
 */
const ALERT_TO = process.env.DIGEST_ALERT_TO ?? DIGEST_BCC[0] ?? "";

/**
 * Internal submissions we exclude from the client-facing count so the number
 * survives comparison against ProABD. Deliberately narrow: known internal
 * addresses only. We report how many we removed rather than hiding it.
 */
const INTERNAL_MARKERS = [
  /eddiezal28@gmail\.com/i,
  /@zaldivarlabs\.com/i,
  /@superflosystems\.com/i,
  /\btest(ing)?\b/i,
];

interface LeadRecord {
  leadRef?: string;
  source?: string;
  tier?: string;
  origin?: { zip?: string; state?: string };
  destination?: { zip?: string; state?: string };
  vehicle?: { year?: string; make?: string; model?: string; type?: string };
  contact?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    notes?: string;
  };
  assignedAgent?: { firstName?: string };
  proabdAssignedAgent?: { userName?: string };
  estimate?: { price?: number; confidence?: number } | null;
  createdAt?: { toDate?: () => Date };
  submittedAt?: string;
}

/** createdAt is the only trustworthy clock on a lead doc. */
function leadDate(r: LeadRecord): Date {
  const d = r.createdAt?.toDate?.();
  if (d) return d;
  if (typeof r.submittedAt === "string") return new Date(r.submittedAt);
  return new Date(0);
}

function agentName(r: LeadRecord): string {
  return (
    r.proabdAssignedAgent?.userName?.split(" ")[0] ??
    r.assignedAgent?.firstName ??
    "Unassigned"
  );
}

function isInternal(r: LeadRecord): boolean {
  // Same surface leads-today.mjs checks: our own test submissions are usually
  // marked in the name or notes, not the email (e.g. AL-260806-FK1K7Z).
  const hay = [
    r.contact?.email,
    `${r.contact?.firstName ?? ""} ${r.contact?.lastName ?? ""}`,
    r.contact?.notes,
  ]
    .filter(Boolean)
    .join(" | ");
  return INTERNAL_MARKERS.some((re) => re.test(hay));
}

function isCall(r: LeadRecord): boolean {
  return r.source === "call" || (r.leadRef ?? "").startsWith("CALL-");
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ?dryRun=1 computes everything and returns the numbers WITHOUT sending.
  // Without this, the only way to test the route in production is to mail the
  // client, which is how you end up sending Ben two digests in one day.
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let raw: LeadRecord[] = [];
  try {
    const db = getAdminDb();
    const snap = await db
      .collection("leads")
      .where("createdAt", ">=", sevenDaysAgo) // Timestamp field, Timestamp operand
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();
    raw = snap.docs.map((d) => d.data() as LeadRecord);
  } catch (err) {
    console.error("[weekly-digest] Firestore query failed", err);
    return NextResponse.json(
      { ok: false, error: "firestore_query_failed" },
      { status: 500 },
    );
  }

  const internalCount = raw.filter(isInternal).length;
  const leads = raw.filter((l) => !isInternal(l));
  const webLeads = leads.filter((l) => !isCall(l));
  const callLeads = leads.filter(isCall);

  const totalLeads = leads.length;
  const webCount = webLeads.length;
  const callCount = callLeads.length;

  const weekLabel =
    sevenDaysAgo.toISOString().slice(0, 10) +
    " → " +
    now.toISOString().slice(0, 10);

  // ---- Zero guard -----------------------------------------------------
  // A zero at current volume means the query broke, not that the business
  // stopped. Never let that reach the client. See header note (3).
  const suspiciousZero = totalLeads === 0;
  const recipient = suspiciousZero ? ALERT_TO : DIGEST_TO;

  if (suspiciousZero && !recipient) {
    console.error(
      "[weekly-digest] 0 leads in window and no DIGEST_ALERT_TO set — suppressing send",
      { weekLabel },
    );
    return NextResponse.json({
      ok: false,
      suppressed: true,
      reason: "zero_count_no_alert_recipient",
      weekLabel,
    });
  }

  // ---- Aggregations (web form leads only; calls are counted, not sliced) --
  const agentCount: Record<string, number> = {};
  const routeCount: Record<string, number> = {};
  let estimateSum = 0;
  let estimateCount = 0;

  for (const l of webLeads) {
    const ag = agentName(l);
    agentCount[ag] = (agentCount[ag] ?? 0) + 1;
    const route = `${l.origin?.state ?? "?"} → ${l.destination?.state ?? "?"}`;
    routeCount[route] = (routeCount[route] ?? 0) + 1;
    if (typeof l.estimate?.price === "number") {
      estimateSum += l.estimate.price;
      estimateCount++;
    }
  }

  const avgEstimate = estimateCount
    ? Math.round(estimateSum / estimateCount)
    : null;
  const topRoutes = Object.entries(routeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const sampleLeads = webLeads.slice(0, 8);

  const headline =
    `${webCount} web lead${webCount === 1 ? "" : "s"}` +
    (callCount ? ` + ${callCount} tracked call${callCount === 1 ? "" : "s"}` : "");

  const subject = suspiciousZero
    ? `[CHECK] Auto Line weekly digest returned 0 leads (${weekLabel})`
    : `Auto Line weekly digest: ${headline} (${weekLabel})`;

  // ---- Plain text ------------------------------------------------------
  const textLines: string[] = [];
  textLines.push("Auto Line Logistics — Weekly Lead Digest");
  textLines.push(weekLabel);
  textLines.push("");
  textLines.push(`Web form leads: ${webCount}`);
  textLines.push(`Tracked inbound calls: ${callCount}`);
  if (avgEstimate != null) {
    textLines.push(`Average estimated quote: $${avgEstimate.toLocaleString()}`);
  }
  if (internalCount) {
    textLines.push(`(${internalCount} internal test submission${internalCount === 1 ? "" : "s"} excluded)`);
  }
  textLines.push("");
  if (Object.keys(agentCount).length) {
    textLines.push("By agent:");
    for (const [ag, n] of Object.entries(agentCount).sort((a, b) => b[1] - a[1])) {
      textLines.push(`  ${ag}: ${n}`);
    }
    textLines.push("");
  }
  if (topRoutes.length) {
    textLines.push("Top routes:");
    for (const [route, n] of topRoutes) {
      textLines.push(`  ${route}: ${n}`);
    }
    textLines.push("");
  }
  if (sampleLeads.length) {
    textLines.push("Recent web leads (most recent first):");
    for (const l of sampleLeads) {
      const d = leadDate(l);
      const price =
        typeof l.estimate?.price === "number"
          ? `$${l.estimate.price.toLocaleString()}`
          : "-";
      textLines.push(
        `  ${l.leadRef} · ${l.origin?.state}→${l.destination?.state} · ${l.vehicle?.year ?? ""} ${l.vehicle?.make ?? ""} ${l.vehicle?.model ?? ""} · ${price} · ${d.toISOString().slice(0, 10)}`,
      );
    }
  }
  if (suspiciousZero) {
    textLines.push("");
    textLines.push("INTERNAL ALERT: the digest query returned zero leads for this window.");
    textLines.push("This was NOT sent to the client. Verify with scripts/digest-diag.mjs before");
    textLines.push("concluding anything about volume. History: the 2026-08-07 digest reported 0");
    textLines.push("for a 44-lead week because it range-queried a string field.");
  }
  const text = textLines.join("\n");

  // ---- HTML — Pine + soft green palette, same as the lead email ---------
  const PINE = "#052e1a";
  const ACCENT = "#128A3A";
  const SOFT = "#f0faf3";
  const GRAY = "#374151";

  const agentRows = Object.entries(agentCount)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([ag, n]) =>
        `<tr><td style="padding:4px 0;color:${GRAY};font-size:13px;">${ag}</td><td style="padding:4px 0;color:#111;font-size:14px;text-align:right;">${n}</td></tr>`,
    )
    .join("");

  const routeRows = topRoutes
    .map(
      ([route, n]) =>
        `<tr><td style="padding:4px 0;color:${GRAY};font-size:13px;">${route}</td><td style="padding:4px 0;color:#111;font-size:14px;text-align:right;">${n}</td></tr>`,
    )
    .join("");

  const sampleRows = sampleLeads
    .map((l) => {
      const d = leadDate(l);
      const price =
        typeof l.estimate?.price === "number"
          ? `$${l.estimate.price.toLocaleString()}`
          : "-";
      return `<tr><td style="padding:6px 0;font-size:13px;color:#111;border-bottom:1px solid #e5e7eb;">${l.leadRef}</td><td style="padding:6px 0;font-size:13px;color:#111;border-bottom:1px solid #e5e7eb;">${l.origin?.state ?? "?"}→${l.destination?.state ?? "?"}</td><td style="padding:6px 0;font-size:13px;color:#111;border-bottom:1px solid #e5e7eb;">${l.vehicle?.year ?? ""} ${l.vehicle?.make ?? ""} ${l.vehicle?.model ?? ""}</td><td style="padding:6px 0;font-size:13px;color:#111;border-bottom:1px solid #e5e7eb;text-align:right;">${price}</td><td style="padding:6px 0;font-size:12px;color:${GRAY};border-bottom:1px solid #e5e7eb;text-align:right;">${d.toISOString().slice(0, 10)}</td></tr>`;
    })
    .join("");

  const alertBanner = suspiciousZero
    ? `<div style="background:#fef2f2;border-left:3px solid #b91c1c;padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:18px;font-size:13px;color:#7f1d1d;"><strong>Internal alert, not sent to the client.</strong> The digest query returned zero leads for this window. At current volume that almost certainly means the query is broken again, not that volume stopped. Run <code>scripts/digest-diag.mjs</code> before drawing any conclusion.</div>`
    : "";

  const callLine = callCount
    ? `<div style="font-size:14px;opacity:0.85;margin-top:2px;">plus ${callCount} tracked inbound call${callCount === 1 ? "" : "s"}</div>`
    : "";

  const internalLine = internalCount
    ? `<div style="font-size:11px;color:${GRAY};margin-top:10px;">${internalCount} internal test submission${internalCount === 1 ? "" : "s"} excluded from the count.</div>`
    : "";

  const html =
    '<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Roboto,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;"><tr><td align="center">' +
    '<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +
    `<tr><td style="background:${PINE};color:#fff;padding:20px 24px;">` +
    '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.85;">Weekly digest</div>' +
    `<div style="font-size:22px;font-weight:700;margin-top:6px;">${webCount} web lead${webCount === 1 ? "" : "s"} this week</div>` +
    callLine +
    `<div style="font-size:14px;opacity:0.85;margin-top:4px;">${weekLabel}</div>` +
    '</td></tr><tr><td style="padding:24px;">' +
    alertBanner +
    (avgEstimate != null
      ? `<div style="background:${SOFT};border-left:3px solid ${ACCENT};padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:18px;"><div style="font-size:11px;color:${ACCENT};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Average estimated quote</div><div style="font-size:24px;font-weight:800;color:${PINE};margin-top:4px;">$${avgEstimate.toLocaleString()}</div></div>`
      : "") +
    (agentRows
      ? `<h3 style="margin:8px 0;font-size:13px;color:${PINE};text-transform:uppercase;letter-spacing:0.05em;">By agent</h3><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:14px;">${agentRows}</table>`
      : "") +
    (routeRows
      ? `<h3 style="margin:8px 0;font-size:13px;color:${PINE};text-transform:uppercase;letter-spacing:0.05em;">Top routes</h3><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:14px;">${routeRows}</table>`
      : "") +
    (sampleRows
      ? `<h3 style="margin:14px 0 6px;font-size:13px;color:${PINE};text-transform:uppercase;letter-spacing:0.05em;">Recent web leads</h3><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Ref</th><th style="text-align:left;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Route</th><th style="text-align:left;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Vehicle</th><th style="text-align:right;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Estimate</th><th style="text-align:right;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Date</th></tr></thead><tbody>${sampleRows}</tbody></table>`
      : "") +
    internalLine +
    `<div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:${GRAY};">Generated ${now.toISOString()} · Auto Line Logistics</div>` +
    "</td></tr></table></td></tr></table></body></html>";

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      subject,
      webCount,
      callCount,
      internalExcluded: internalCount,
      suspiciousZero,
      wouldSendTo: recipient,
      wouldBcc: !suspiciousZero ? DIGEST_BCC : [],
      weekLabel,
      sampleRefs: sampleLeads.map((l) => l.leadRef),
    });
  }

  const sendResult = await sendLeadEmail({
    to: [recipient],
    // On the alert path the mail is already coming to us, so no BCC.
    bcc: !suspiciousZero && DIGEST_BCC.length ? DIGEST_BCC : undefined,
    subject,
    text,
    html,
    tags: [
      { name: "kind", value: suspiciousZero ? "weekly-digest-alert" : "weekly-digest" },
      { name: "week", value: weekLabel.split(" ")[0]! },
    ],
  });

  if (!sendResult.ok) {
    return NextResponse.json(
      { ok: false, webCount, callCount, error: sendResult.error },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    webCount,
    callCount,
    internalExcluded: internalCount,
    suspiciousZero,
    sentTo: recipient,
    bcc: !suspiciousZero ? DIGEST_BCC : [],
    messageId: sendResult.id,
    weekLabel,
  });
}
