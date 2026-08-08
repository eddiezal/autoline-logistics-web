/**
 * Rebuild a past weekly digest with corrected numbers.
 *
 * Built 2026-08-08 to re-issue the 2026-08-07 digest, which reported 0 leads
 * for a 44-lead week (see claude/incident-2026-08-07-weekly-digest-false-zero.md).
 * Uses the same corrected logic as src/app/api/cron/weekly-digest/route.ts:
 * counts off `createdAt` (a real Timestamp), never `submittedAt` (a string).
 *
 * PREVIEW (default, sends nothing):
 *   node scripts/rebuild-digest.mjs
 *   -> writes digest-preview.html, open it in a browser, prints the counts
 *
 * SEND (only after you have read the preview):
 *   node scripts/rebuild-digest.mjs --send --to info@autolineexpress.com
 *
 * Custom window:
 *   node scripts/rebuild-digest.mjs --from 2026-07-31T15:01:11.329Z --to-date 2026-08-07T15:01:11.329Z
 *
 * Requires FIREBASE_PROJECT_ID + gcloud ADC. --send also requires RESEND_API_KEY
 * and LEADS_FROM_EMAIL in .env.local.
 */
import { writeFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });

// ---- args ----------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name) => argv.includes(`--${name}`);

// The window of the digest we are correcting.
const FROM = new Date(flag("from") ?? "2026-07-31T15:01:11.329Z");
const TO = new Date(flag("to-date") ?? "2026-08-07T15:01:11.329Z");
const SEND = has("send");
const RECIPIENT = flag("to") ?? "";

if (SEND && !RECIPIENT) {
  console.error("--send requires --to <email>");
  process.exit(1);
}

// ---- firestore -----------------------------------------------------------
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) { console.error("Missing FIREBASE_PROJECT_ID"); process.exit(1); }
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const snap = await db
  .collection("leads")
  .where("createdAt", ">=", FROM)
  .where("createdAt", "<=", TO)
  .orderBy("createdAt", "desc")
  .limit(500)
  .get();

const all = snap.docs.map((d) => d.data());

// ---- classification ------------------------------------------------------
const INTERNAL = [/eddiezal28@gmail\.com/i, /@zaldivarlabs\.com/i, /@superflosystems\.com/i, /\btest(ing)?\b/i];
const isInternal = (d) => {
  const hay = [d.contact?.email, `${d.contact?.firstName ?? ""} ${d.contact?.lastName ?? ""}`, d.contact?.notes]
    .filter(Boolean).join(" | ");
  return INTERNAL.some((re) => re.test(hay));
};
const isCall = (d) => d.source === "call" || String(d.leadRef ?? "").startsWith("CALL-");
const agentOf = (d) =>
  d.proabdAssignedAgent?.userName?.split(" ")[0] ?? d.assignedAgent?.firstName ?? "Unassigned";
const dateOf = (d) => d.createdAt?.toDate?.() ?? new Date(d.submittedAt ?? 0);

const calls = all.filter(isCall);
const webAll = all.filter((d) => !isCall(d));
const internal = webAll.filter(isInternal);
const web = webAll.filter((d) => !isInternal(d));

// Our own test submissions are EXCLUDED from the client-facing count and the
// count of exclusions is disclosed. After a false report, a number padded with
// our own tests is the last thing this account needs.
const internalCount = internal.length;
const webCount = web.length;
const callCount = calls.length;

const agentCount = {}, routeCount = {};
let estSum = 0, estN = 0;
for (const d of web) {
  const a = agentOf(d); agentCount[a] = (agentCount[a] ?? 0) + 1;
  const r = `${d.origin?.state ?? "?"} → ${d.destination?.state ?? "?"}`;
  routeCount[r] = (routeCount[r] ?? 0) + 1;
  if (typeof d.estimate?.price === "number") { estSum += d.estimate.price; estN++; }
}
const avgEstimate = estN ? Math.round(estSum / estN) : null;
const topRoutes = Object.entries(routeCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

const weekLabel = FROM.toISOString().slice(0, 10) + " → " + TO.toISOString().slice(0, 10);

// ---- console summary -----------------------------------------------------
console.log(`\nWindow: ${weekLabel}`);
console.log(`Real web form leads:   ${webCount}`);
console.log(`Tracked inbound calls: ${callCount}`);
console.log(`Client-facing total:   ${webCount + callCount}`);
console.log(`Excluded as internal:  ${internalCount}`);
console.log(`Raw records in window: ${all.length}`);
console.log(`Avg estimate:          ${avgEstimate != null ? "$" + avgEstimate.toLocaleString() : "n/a"}`);

// VERIFY THESE BY EYE. The /test/i marker matches on name and notes too, so a
// real customer who wrote "test drive" in the notes would be wrongly dropped.
// Anything here that is not obviously ours is a real lead being hidden from Ben.
if (internalCount) {
  console.log(`\nExcluded as internal (confirm each one is actually ours):`);
  for (const d of internal) {
    const who = `${d.contact?.firstName ?? ""} ${d.contact?.lastName ?? ""}`.trim();
    console.log(
      `  ${String(d.leadRef).padEnd(18)} ${String(d.contact?.email ?? "").padEnd(34)} ${who.padEnd(22)} ${JSON.stringify(d.contact?.notes ?? "").slice(0, 60)}`,
    );
  }
}

// Blank origin/destination states show up as "PA → " in the route table.
const blankGeo = web.filter((d) => !d.origin?.state || !d.destination?.state);
if (blankGeo.length) {
  console.log(`\n${blankGeo.length} lead(s) missing an origin or destination state:`);
  for (const d of blankGeo) {
    console.log(`  ${String(d.leadRef).padEnd(18)} origin=${JSON.stringify(d.origin ?? null)} dest=${JSON.stringify(d.destination ?? null)}`);
  }
}
console.log("\nBy agent:");
for (const [a, n] of Object.entries(agentCount).sort((x, y) => y[1] - x[1])) console.log(`  ${a}: ${n}`);
console.log("\nTop routes:");
for (const [r, n] of topRoutes) console.log(`  ${r}: ${n}`);

// ---- html ----------------------------------------------------------------
const PINE = "#052e1a", ACCENT = "#128A3A", SOFT = "#f0faf3", GRAY = "#374151";

const rows = (pairs) => pairs.map(([k, n]) =>
  `<tr><td style="padding:4px 0;color:${GRAY};font-size:13px;">${k}</td><td style="padding:4px 0;color:#111;font-size:14px;text-align:right;">${n}</td></tr>`).join("");

const leadRows = web.map((d) => {
  const t = "";
  const price = typeof d.estimate?.price === "number" ? `$${d.estimate.price.toLocaleString()}` : "-";
  return `<tr><td style="padding:6px 0;font-size:13px;color:#111;border-bottom:1px solid #e5e7eb;">${d.leadRef}${t}</td><td style="padding:6px 0;font-size:13px;color:#111;border-bottom:1px solid #e5e7eb;">${d.origin?.state ?? "?"}→${d.destination?.state ?? "?"}</td><td style="padding:6px 0;font-size:13px;color:#111;border-bottom:1px solid #e5e7eb;">${d.vehicle?.year ?? ""} ${d.vehicle?.make ?? ""} ${d.vehicle?.model ?? ""}</td><td style="padding:6px 0;font-size:13px;color:#111;border-bottom:1px solid #e5e7eb;text-align:right;">${price}</td><td style="padding:6px 0;font-size:12px;color:${GRAY};border-bottom:1px solid #e5e7eb;text-align:right;">${dateOf(d).toISOString().slice(0, 10)}</td></tr>`;
}).join("");

const subject = `Auto Line weekly digest, corrected: ${webCount} web leads + ${callCount} tracked calls (${weekLabel})`;

const html =
  '<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Roboto,sans-serif;">' +
  '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;"><tr><td align="center">' +
  '<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +
  `<tr><td style="background:${PINE};color:#fff;padding:20px 24px;">` +
  '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.85;">Weekly digest, corrected</div>' +
  `<div style="font-size:22px;font-weight:700;margin-top:6px;">${webCount} web leads this week</div>` +
  `<div style="font-size:14px;opacity:0.85;margin-top:2px;">plus ${callCount} tracked inbound calls</div>` +
  `<div style="font-size:14px;opacity:0.85;margin-top:4px;">${weekLabel}</div>` +
  '</td></tr><tr><td style="padding:24px;">' +
  `<div style="background:#fffbeb;border-left:3px solid #d97706;padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:18px;font-size:13px;color:#78350f;">This replaces the digest sent Friday morning, which reported zero. That was a fault in the report itself, not in the campaigns or the website. The figures below are the correct ones.</div>` +
  (avgEstimate != null
    ? `<div style="background:${SOFT};border-left:3px solid ${ACCENT};padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:18px;"><div style="font-size:11px;color:${ACCENT};font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Average estimated quote</div><div style="font-size:24px;font-weight:800;color:${PINE};margin-top:4px;">$${avgEstimate.toLocaleString()}</div></div>`
    : "") +
  (Object.keys(agentCount).length
    ? `<h3 style="margin:8px 0;font-size:13px;color:${PINE};text-transform:uppercase;letter-spacing:0.05em;">By agent</h3><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:14px;">${rows(Object.entries(agentCount).sort((a, b) => b[1] - a[1]))}</table>`
    : "") +
  (topRoutes.length
    ? `<h3 style="margin:8px 0;font-size:13px;color:${PINE};text-transform:uppercase;letter-spacing:0.05em;">Top routes</h3><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:14px;">${rows(topRoutes)}</table>`
    : "") +
  (leadRows
    ? `<h3 style="margin:14px 0 6px;font-size:13px;color:${PINE};text-transform:uppercase;letter-spacing:0.05em;">Web leads this week</h3><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Ref</th><th style="text-align:left;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Route</th><th style="text-align:left;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Vehicle</th><th style="text-align:right;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Estimate</th><th style="text-align:right;padding:6px 0;font-size:11px;color:${GRAY};text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Date</th></tr></thead><tbody>${leadRows}</tbody></table>`
    : "") +
  `<div style="font-size:11px;color:${GRAY};margin-top:10px;">Inbound calls are tracked separately and are not listed individually.${internalCount ? ` ${internalCount} internal test submission${internalCount === 1 ? "" : "s"} from our own checks are excluded from these figures.` : ""}</div>` +
  `<div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:${GRAY};">Auto Line Logistics</div>` +
  "</td></tr></table></td></tr></table></body></html>";

const text = [
  "Auto Line Logistics — Weekly Lead Digest (corrected)",
  weekLabel,
  "",
  "This replaces the digest sent Friday morning, which reported zero.",
  "That was a fault in the report itself, not in the campaigns or the website.",
  "",
  `Web form leads: ${webCount}`,
  `Tracked inbound calls: ${callCount}`,
  avgEstimate != null ? `Average estimated quote: $${avgEstimate.toLocaleString()}` : "",
  "",
  "By agent:",
  ...Object.entries(agentCount).sort((a, b) => b[1] - a[1]).map(([a, n]) => `  ${a}: ${n}`),
  "",
  "Top routes:",
  ...topRoutes.map(([r, n]) => `  ${r}: ${n}`),
].filter(Boolean).join("\n");

writeFileSync("digest-preview.html", html, "utf8");
console.log(`\nSubject: ${subject}`);
console.log("Preview written to digest-preview.html — open it before sending.\n");

// ---- optional send -------------------------------------------------------
if (!SEND) {
  console.log("Nothing sent. Re-run with --send --to <email> once the preview looks right.\n");
  process.exit(0);
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) { console.error("Missing RESEND_API_KEY in .env.local"); process.exit(1); }
const from = process.env.LEADS_FROM_EMAIL ?? "Auto Line Logistics <onboarding@resend.dev>";

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ from, to: [RECIPIENT], subject, html, text }),
});
const body = await res.json();
if (!res.ok) { console.error("Send failed:", res.status, body); process.exit(1); }
console.log(`Sent to ${RECIPIENT}. Resend id: ${body.id}\n`);
process.exit(0);
