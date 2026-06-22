/**
 * GET /api/cron/weekly-digest
 *
 * Friday morning digest of the past 7 days of leads, emailed to Ben at
 * info@autolinelogistics.com. Replaces per-lead BCC to Ben (he prefers
 * Friday cadence per stated email overload).
 *
 * Cron: Friday 8:00 AM PT = 15:00 UTC (Vercel cron expression `0 15 * * 5`)
 * Auth: Vercel sets `Authorization: Bearer <CRON_SECRET>` on cron invocations.
 *
 * Manual trigger for testing:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://autolinelogistics.com/api/cron/weekly-digest
 *
 * Phase 1: simple aggregate (count by tier, top routes, agent split, sample).
 * Phase 2: add CPA + close rate once ProABD sync exists.
 */
import { NextResponse } from "next/server";
import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import { sendLeadEmail } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIGEST_TO = "info@autolinelogistics.com";

interface LeadRecord {
  leadRef: string;
  tier: string;
  origin: { zip: string; state: string };
  destination: { zip: string; state: string };
  vehicle: { year: string; make: string; model: string; type: string };
  customer: { email: string; phone: string };
  assignedAgent?: { firstName?: string };
  estimate?: { price?: number; confidence?: number } | null;
  submittedAt?: { toDate?: () => Date } | Date | string;
}

function submittedDate(r: LeadRecord): Date {
  const s = r.submittedAt;
  if (!s) return new Date(0);
  if (s instanceof Date) return s;
  if (typeof s === "string") return new Date(s);
  if (typeof s === "object" && typeof s.toDate === "function") return s.toDate();
  return new Date(0);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let leads: LeadRecord[] = [];
  try {
    const db = getAdminDb();
    const snap = await db
      .collection("leads")
      .where("submittedAt", ">=", sevenDaysAgo)
      .orderBy("submittedAt", "desc")
      .limit(500)
      .get();
    leads = snap.docs.map((d) => d.data() as LeadRecord);
  } catch (err) {
    console.error("[weekly-digest] Firestore query failed", err);
    return NextResponse.json(
      { ok: false, error: "firestore_query_failed" },
      { status: 500 },
    );
  }

  // Aggregations
  const totalLeads = leads.length;
  const tierCount: Record<string, number> = {};
  const agentCount: Record<string, number> = {};
  const routeCount: Record<string, number> = {};
  let estimateSum = 0;
  let estimateCount = 0;

  for (const l of leads) {
    tierCount[l.tier ?? "unknown"] = (tierCount[l.tier ?? "unknown"] ?? 0) + 1;
    const ag = l.assignedAgent?.firstName ?? "Unassigned";
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
  const sampleLeads = leads.slice(0, 5);

  const weekLabel =
    sevenDaysAgo.toISOString().slice(0, 10) +
    " → " +
    now.toISOString().slice(0, 10);

  const subject =
    totalLeads === 0
      ? "Auto Line weekly digest: 0 web leads (paid campaigns not active yet)"
      : `Auto Line weekly digest: ${totalLeads} web lead${totalLeads === 1 ? "" : "s"} (${weekLabel})`;

  // Plain text
  const textLines: string[] = [];
  textLines.push("Auto Line Logistics — Weekly Lead Digest");
  textLines.push(weekLabel);
  textLines.push("");
  textLines.push(`Total web leads this week: ${totalLeads}`);
  if (avgEstimate != null) {
    textLines.push(`Average estimated quote (with 22.5% markup): $${avgEstimate.toLocaleString()}`);
  }
  textLines.push("");
  if (Object.keys(tierCount).length) {
    textLines.push("By tier:");
    for (const [tier, n] of Object.entries(tierCount).sort((a, b) => b[1] - a[1])) {
      textLines.push(`  ${tier}: ${n}`);
    }
    textLines.push("");
  }
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
    textLines.push("Recent leads (most recent first):");
    for (const l of sampleLeads) {
      const d = submittedDate(l);
      const price =
        typeof l.estimate?.price === "number"
          ? `$${l.estimate.price.toLocaleString()}`
          : "—";
      textLines.push(
        `  ${l.leadRef} · ${l.origin?.state}→${l.destination?.state} · ${l.vehicle?.year} ${l.vehicle?.make} ${l.vehicle?.model} · ${price} · ${d.toISOString().slice(0, 10)}`,
      );
    }
  }
  if (totalLeads === 0) {
    textLines.push("");
    textLines.push("Note: paid campaigns haven't turned on yet. This window is for testing the system end-to-end. Organic web traffic + direct visits drive the count until paid ads launch.");
  }
  const text = textLines.join("\n");

  // HTML — same Pine + soft green palette as lead email
  const PINE = "#052e1a";
  const ACCENT = "#128A3A";
  const SOFT = "#f0faf3";
  const GRAY = "#374151";

  const tierRows = Object.entries(tierCount)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([tier, n]) =>
        `<tr><td style="padding:4px 0;color:${GRAY};font-size:13px;">${tier}</td><td style="padding:4px 0;color:#111;font-size:14px;text-align:right;">${n}</td></tr>`,
    )
    .join("");

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
      const d = submittedDate(l);
      const price =
        typeof l.estimate?.price === "number"
          ? `$${l.estimate.price.toLocaleString()}`
          : "—";
      return `<tr><td style="padding:6px 0;font-size:13px;color:#111;border-bottom:1px solid #e5e7eb;">${l.leadRef}</td><td style="padding:6px 0;font-size:13px;color:#111;border-bottom:1px solid #e5e7eb;">${l.origin?.state ?? "?"}→${l.destination?.state ?? "?"}</td><td style="padding:6px 0;font-size:13px;color:#111;border-bottom:1px solid #e5e7eb;">${l.vehicle?.year ?? ""} ${l.vehicle?.make ?? ""} ${l.vehicle?.model ?? ""}</td><td style="padding:6px 0;font-size:13px;color:#111;border-bottom:1px solid #e5e7eb;text-align:right;">${price}</td><td style="padding:6px 0;font-size:12px;color:${GRAY};border-bottom:1px solid #e5e7eb;text-align:right;">${d.toISOString().slice(0, 10)}</td></tr>`;
    })
    .join("");

  const emptyNote =
    totalLeads === 0
      ? `<div style="background:${SOFT};border-left:3px solid ${ACCENT};padding:14px 16px;border-radius:0 6px 6px 0;margin-top:16px;font-size:13px;color:#052e1a;">Paid campaigns haven't turned on yet. This week's count reflects organic / direct traffic only. Real volume kicks in once paid ads launch.</div>`
      : "";

  const html =
    '<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Roboto,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;"><tr><td align="center">' +
    '<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +
    `<tr><td style="background:${PINE};color:#fff;padding:20px 24px;">` +
    '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.85;">Weekly digest</div>' +
    `<div style="font-size:22px;font-weight:700;margin-top:6px;">${totalLeads} web lead${totalLeads === 1 ? "" : "s"} this week</div>` +
    `<div style="font-size:14px;opacity:0.85;margin-top:4px;">${weekLabel}</div>` +
    "</td></tr><tr><td style=\"padding:24px;\">" +
    (avgEstimate != null
      ? `<div style="background:${SOFT};border-left:3px solid ${ACCENT};padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:18px;"><div style="font-size:11px;color:${ACCENT};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Average estimated quote</div><div style="font-size:24px;font-weight:800;color:${PINE};margin-top:4px;">$${avgEstimate.toLocaleString()}</div><div style="font-size:11px;color:${GRAY};margin-top:2px;">Includes the 22.5% customer-facing markup. Raw SD market would be \\~${Math.round(avgEstimate / 1.225).toLocaleString()}.</div></div>`
      : "") +
    (tierRows
      ? `<h3 style="margin:8px 0;font-size:13px;color:${PINE};text-transform:uppercase;letter-spacing:0.05em;">By tier</h3><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:14px;">${tierRows}</table>`
      : "") +
    (agentRows
      ? `<h3 style="margin:8px 0;font-size:13px;color:${PINE};text-transform:uppercase;letter-spacing:0.05em;">By agent</h3><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:14px;">${agentRows}</table>`
      : "") +
    (routeRows
      ? `<h3 style="margin:8px 0;font-size:13px;color:${PINE};text-transform:uppercase;letter-spacing:0.05em;">Top routes</h3><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:14px;">${routeRows}</table>`
      : "") +
    (sampleRows
      ? `<h3 style="margin:14px 0 6px;font-size:13px;color:${PINE};text-transform:uppercase;letter-spacing:0.05em;">Recent leads</h3><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Ref</th><th style="text-align:left;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Route</th><th style="text-align:left;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Vehicle</th><th style="text-align:right;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Estimate</th><th style="text-align:right;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Date</th></tr></thead><tbody>${sampleRows}</tbody></table>`
      : "") +
    emptyNote +
    `<div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:${GRAY};">Generated ${now.toISOString()} · Auto Line Logistics</div>` +
    "</td></tr></table></td></tr></table></body></html>";

  const sendResult = await sendLeadEmail({
    to: [DIGEST_TO],
    subject,
    text,
    html,
    tags: [
      { name: "kind", value: "weekly-digest" },
      { name: "week", value: weekLabel.split(" ")[0]! },
    ],
  });

  if (!sendResult.ok) {
    return NextResponse.json(
      { ok: false, totalLeads, error: sendResult.error },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    totalLeads,
    sentTo: DIGEST_TO,
    messageId: sendResult.id,
    weekLabel,
  });
}
