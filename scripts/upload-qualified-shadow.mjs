/**
 * QUALIFIED-LEAD SHADOW UPLOAD — architecture A, shadow mode (2026-08-27).
 *
 * Gate 4 (scripts/funnel-volume-audit.mjs, run 8/27) selected Q1 "priced"
 * as the qualified stage: ~79 website records/30d (5x the ≥15 bar,
 * sustained), median lead→priced delay 0.0d, 100% ≤7d. This script uploads
 * that event daily to Google Ads as a SECONDARY conversion action —
 * observation-only. Secondary actions NEVER feed bidding, so this is safe
 * to run during the budget sprint and the S5 Max Conversions transition.
 * Its purpose is to bank diagnostics history and the 1-2 clean cycles the
 * readiness checklist (spec Gate 6) requires before value bidding.
 *
 * EVENT: first webhook event carrying a Transport price for a WEBSITE
 * record (referrer 8/18493), tests excluded. Conversion time = that event's
 * received_at (mirror clock — minutes-to-hours off the true quote time,
 * fine at this granularity and always AFTER the ad click).
 *
 * VALUE (PROVISIONAL until the Gate 1 fee/cancellation freeze — shadow
 * mode makes this observational, not load-bearing):
 *   1. Transport.Deposit at the priced event if present (deposit ≈ broker
 *      fee per the metric contract's booked-fee basis), else
 *   2. min($400, $150 + 9% × price)  (three-layer model's recommended-fee
 *      shape), rounded to whole dollars.
 * The point is DIFFERENTIATED values (no flat $239s) — exact calibration
 * comes later, validated against settled fees (architecture C).
 *
 * GCLID: from the linked lead doc (leads.proabdAbdId → attribution.gclid).
 * Only paid clicks upload — organic/direct website leads have no click to
 * credit. [0] prints the coverage numbers (the spec's ≥95% check is on
 * ELIGIBLE leads = those Google Ads actually drove; leads with utmMedium
 * cpc but no gclid are the true gap and are printed).
 *
 * DEDUP / IDEMPOTENCY: counting ONE_PER_CLICK + a rolling window means
 * re-runs and overlaps are deduped by Google by design (proven by the Aug
 * 13 backfill retries — all no-ops). Default window 3 days; run daily.
 *
 * SAFETY RAILS:
 *   · The action is created SECONDARY and every run verifies it is STILL
 *     secondary — if someone promotes it to primary, the run ABORTS rather
 *     than feed an unfrozen definition to the bidder.
 *   · Dry run by default; --apply to execute. First --apply gets a ledger
 *     entry (measurement-layer addition, prospective).
 *   · Console prints ABD ids, dates, dollars, truncated GCLIDs. No names,
 *     emails, phones. Nothing written to disk.
 *   · Open OCI ticket 3-2641000040864: uploads can be ACCEPTED but not
 *     COUNTED. Record per-run job ids; if shadow counts don't land in
 *     reporting, that is MORE evidence for the ticket, not a reason to stop.
 *
 * Usage (from autoline-logistics-web; needs FIREBASE_* + GOOGLE_ADS_* env):
 *   node scripts/upload-qualified-shadow.mjs                 # dry run, last 3d
 *   node scripts/upload-qualified-shadow.mjs --days 7        # wider window
 *   node scripts/upload-qualified-shadow.mjs --setup         # plan action creation
 *   node scripts/upload-qualified-shadow.mjs --setup --apply # create the action
 *   node scripts/upload-qualified-shadow.mjs --csv           # ← THE WORKING PATH:
 *       writes ../qualified-shadow-YYYYMMDD.csv for UI upload (Data manager).
 *   node scripts/upload-qualified-shadow.mjs --apply         # direct API upload —
 *       BLOCKED for this account since 2026-06-15 (Ads-API OCI cutover to the
 *       Data Manager API; see the --csv block below). Kept for when a Data
 *       Manager API integration lands or legacy access is granted.
 */

import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { parseProabdDate } from "./lib/proabd-time.mjs";

const argv = process.argv.slice(2);
const envArgIdx = argv.indexOf("--env");
const envFiles = envArgIdx >= 0 ? [argv[envArgIdx + 1]] : [".env.local", ".env.vercel", ".env.development.local", ".env"];
const loaded = [];
for (const f of envFiles) if (f && existsSync(f)) { loadEnv({ path: f }); loaded.push(f); }

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) { console.error("Missing FIREBASE_PROJECT_ID"); process.exit(1); }
if (!getApps().length) {
  // Multi-file env loading (needed for GOOGLE_ADS_*) can surface a
  // FIREBASE_PRIVATE_KEY from .env.vercel/.env that dotenv mangles
  // (multiline PEM without escaped \n). cert() then throws
  // "DECODER routines::unsupported" — seen 8/27. Try cert, fall back to ADC
  // (the same credentials the read-only scripts run on).
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  let inited = false;
  if (clientEmail && privateKey) {
    try {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
      inited = true;
    } catch (e) {
      console.warn(`(FIREBASE_PRIVATE_KEY present but unparseable — ${e.errorInfo?.code ?? e.message}; falling back to gcloud ADC)`);
    }
  }
  if (!inited) initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? "v23";
const LOGIN_CUSTOMER_ID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "6871495331").replace(/-/g, "");
const CUSTOMER_ID = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "8519808841").replace(/-/g, "");
const APPLY = argv.includes("--apply");
const SETUP = argv.includes("--setup");
const CSV = argv.includes("--csv");
const dIdx = argv.indexOf("--days");
const WINDOW_DAYS = dIdx >= 0 ? Number(argv[dIdx + 1]) || 3 : 3;

const ACTION_NAME = "Qualified lead (priced)";     // shadow action — SECONDARY, always
const DAY = 864e5;
const now = new Date();
const WINDOW_START = new Date(now.getTime() - WINDOW_DAYS * DAY);

// Vocabulary — identical to funnel-volume-audit.mjs / source-comparison.mjs.
const WEBSITE = new Set(["8", "18493"]);
const KNOWN_TEST_ABD = new Set(["37256124", "37257079", "37257179", "37257192", "37287629", "37287650", "37362879"]);
const TEST_RE = /test|zaldivar|example\.com|\bfake\b|\bdummy\b/i;
const PRICE_PATHS = ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price", "Total_Tariff", "Tariff"];
const DEPOSIT_PATHS = ["Transport.Deposit", "Deposit"];

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const dig = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
function pickNum(raw, paths) {
  for (const p of paths) {
    const v = dig(raw, p);
    const n = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
const ptDay = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
/** Google conversionDateTime: "yyyy-mm-dd hh:mm:ss±hh:mm" in account (PT) time. */
function gAdsTime(d) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZoneName: "longOffset",
  }).formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
  const off = (parts.timeZoneName ?? "GMT-07:00").replace("GMT", "") || "-07:00";
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}${off}`;
}
const shadowValue = (deposit, price) =>
  deposit != null ? Math.round(deposit) : Math.round(Math.min(400, 150 + 0.09 * (price ?? 0)));

/* ---------------- Google Ads API plumbing (same pattern as set-conversion-goals.mjs) ---------------- */
const missing = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN"]
  .filter((k) => !process.env[k]);
if (missing.length) { console.error(`Missing env: ${missing.join(", ")} (loaded: ${loaded.join(", ")})`); process.exit(1); }

async function accessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const d = await res.json();
  if (!res.ok || !d.access_token) throw new Error(`OAuth refresh failed: ${d.error ?? res.status}`);
  return d.access_token;
}
const headers = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
  "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  "login-customer-id": LOGIN_CUSTOMER_ID,
});
async function gaql(token, query) {
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}/googleAds:search`, {
    method: "POST", headers: headers(token), body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Ads API ${res.status}: ${data?.error?.details?.[0]?.errors?.[0]?.message ?? data?.error?.message}`);
  return data.results ?? [];
}

async function findAction(token) {
  const rows = await gaql(token, `
    SELECT conversion_action.resource_name, conversion_action.name, conversion_action.status,
           conversion_action.primary_for_goal, conversion_action.counting_type, conversion_action.type
    FROM conversion_action WHERE conversion_action.status != 'REMOVED'`);
  return rows.map((r) => r.conversionAction).find((a) => a.name === ACTION_NAME) ?? null;
}

async function createAction(token) {
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}/conversionActions:mutate`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      operations: [{
        create: {
          name: ACTION_NAME,
          type: "UPLOAD_CLICKS",
          category: "QUALIFIED_LEAD",
          status: "ENABLED",
          primaryForGoal: false,                 // SHADOW — never feeds bidding
          countingType: "ONE_PER_CLICK",         // retries/overlaps dedup by design
          clickThroughLookbackWindowDays: 90,
          valueSettings: { defaultValue: 0, defaultCurrencyCode: "USD", alwaysUseDefaultValue: false },
        },
      }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`create failed: ${JSON.stringify(data?.error ?? data)}`);
  return data.results?.[0]?.resourceName;
}

/* ---------------- [0] Gather Q1 events + GCLID coverage ---------------- */
console.log(`\nQUALIFIED-LEAD SHADOW UPLOAD · window last ${WINDOW_DAYS}d · ${APPLY ? "APPLY" : "DRY RUN"} · env: ${loaded.join(", ")}`);

// Read enough mirror history to know each record's FIRST priced event (a
// record priced before the window must not re-upload with a window timestamp).
const EVENTS_START = new Date(now.getTime() - (WINDOW_DAYS + 45) * DAY);
const snap = await db.collection("proabd_webhook_events").where("received_at", ">=", EVENTS_START).get();
const rec = new Map();
const docs = snap.docs
  .map((doc) => doc.data())
  .sort((a, b) => (a.received_at?.toMillis?.() ?? 0) - (b.received_at?.toMillis?.() ?? 0));
for (const d of docs) {
  const raw = d.raw_item ?? {};
  const abd = str(d.entity_id) || str(raw.ABD_Id);
  if (!abd || KNOWN_TEST_ABD.has(abd)) continue;
  let r = rec.get(abd);
  if (!r) { r = { abd, ref: "", created: null, pricedAt: null, price: null, deposit: null }; rec.set(abd, r); }
  const rid = str(raw.Referrer_Id);
  if (!r.ref && rid) r.ref = rid;
  const created = parseProabdDate(raw.Create_Date);
  if (created && (!r.created || created < r.created)) r.created = created;
  const at = d.received_at?.toDate?.() ?? null;
  const px = pickNum(raw, PRICE_PATHS);
  if (!r.pricedAt && px != null && at) { r.pricedAt = at; r.price = px; r.deposit = pickNum(raw, DEPOSIT_PATHS); }
}

const qualified = [...rec.values()].filter((r) =>
  WEBSITE.has(r.ref) && r.pricedAt && r.pricedAt >= WINDOW_START);

// Lead-doc join for GCLIDs.
const leadSnap = await db.collection("leads").get();
const byAbd = new Map();
let cpcNoGclid = 0;
for (const doc of leadSnap.docs) {
  const d = doc.data();
  const abd = str(d.proabdAbdId);
  if (TEST_RE.test(str(d.email)) || TEST_RE.test(str(d.attribution?.utmSource ?? ""))) continue;
  const gclid = str(d.attribution?.gclid ?? d.gclid);
  if (abd) byAbd.set(abd, { gclid, cpc: d.attribution?.utmMedium === "cpc" });
  if (d.attribution?.utmMedium === "cpc" && !gclid) cpcNoGclid++;
}

let linked = 0, withGclid = 0, organic = 0, unlinked = 0;
const plan = [];
for (const r of qualified) {
  const lead = byAbd.get(r.abd);
  if (!lead) { unlinked++; continue; }
  linked++;
  if (!lead.gclid) { organic++; continue; }
  withGclid++;
  plan.push({
    abd: r.abd, at: r.pricedAt, gclid: lead.gclid,
    value: shadowValue(r.deposit, r.price),
  });
}

console.log(`\n[0] WINDOW CENSUS (website records first-priced in the last ${WINDOW_DAYS}d):`);
console.log(`  qualified (Q1 priced):        ${qualified.length}`);
console.log(`  linked to a lead doc:         ${linked}   (unlinked — pre-integration or handoff gap: ${unlinked})`);
console.log(`  with GCLID (uploadable):      ${withGclid}`);
console.log(`  organic/direct (no click):    ${organic}   ← not a gap; nothing to credit`);
console.log(`  ⚠ cpc-but-no-gclid, ALL leads: ${cpcNoGclid}   ← the true coverage gap for the spec's ≥95% check`);

console.log(`\n[1] UPLOAD PLAN — action "${ACTION_NAME}" (SECONDARY / shadow):`);
if (!plan.length) console.log("  (nothing to upload in this window)");
for (const p of plan.sort((a, b) => a.at - b.at)) {
  console.log(`  ABD ${p.abd}  ${gAdsTime(p.at)}  $${p.value}  gclid ${p.gclid.slice(0, 10)}…`);
}

/* ---------------- --csv: the WORKING upload path (2026-08-27 finding) ----------------
 * Google BLOCKED offline conversion uploads via the Google Ads API on
 * 2026-06-15 (migrated to the Data Manager API; only dev tokens already
 * doing API OCI Jan–Jun 2026 kept legacy access — ours was not, so
 * uploadClickConversions returns CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE).
 * The UI file-upload flow (Data manager) still works and is the proven path
 * in this account (Aug 11-13 backfills). Until a Data Manager API
 * integration is built, --csv writes the daily file and Eddie uploads it
 * through the same UI flow as the backfills.
 * Ref: support.google.com/google-ads/answer/14274408 */
if (CSV) {
  if (!plan.length) { console.log(`\n--csv: nothing to write.`); process.exit(0); }
  const { writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  // July-backfill format: TimeZone parameter header, PT timestamps WITHOUT offsets.
  const gTimeNoOffset = (d) => gAdsTime(d).replace(/[+-]\d\d:\d\d$/, "");
  const esc = (s) => (/[",]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s);
  const header = ["Google Click ID", "Conversion Name", "Conversion Time", "Conversion Value", "Conversion Currency"];
  const rows = plan.sort((a, b) => a.at - b.at)
    .map((p) => [p.gclid, ACTION_NAME, gTimeNoOffset(p.at), String(p.value), "USD"]);
  const csv = ["Parameters:TimeZone=America/Los_Angeles", header.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n") + "\r\n";
  const stamp = ptDay(now).replace(/-/g, "");
  const out = join("..", `qualified-shadow-${stamp}.csv`);
  writeFileSync(out, csv);
  console.log(`\n--csv: wrote ${rows.length} row(s) → ${out}  (AutoExpress root, OUTSIDE the repo — do not commit)`);
  console.log(`Upload via the SAME UI flow as the July/Aug backfills (Google Ads > Data manager / conversion
upload), conversion action "${ACTION_NAME}". ONE_PER_CLICK dedup makes overlapping files safe.
Record the execution id after upload; check reporting in 24-48h (ticket 3-2641000040864 context).`);
  process.exit(0);
}

/* ---------------- Action existence + safety rail ---------------- */
const token = await accessToken();
let action = await findAction(token);
if (SETUP) {
  if (action) {
    console.log(`\n[setup] Action already exists: ${action.resourceName} (primary_for_goal=${action.primaryForGoal})`);
  } else if (!APPLY) {
    console.log(`\n[setup] DRY RUN — would create "${ACTION_NAME}": UPLOAD_CLICKS · QUALIFIED_LEAD · SECONDARY · ONE_PER_CLICK · 90d lookback. Re-run with --setup --apply.`);
    process.exit(0);
  } else {
    const rn = await createAction(token);
    console.log(`\n[setup] Created ${rn}`);
    action = await findAction(token);
  }
}
if (!action) {
  console.log(`\nAction "${ACTION_NAME}" does not exist yet — run with --setup --apply first. Stopping.`);
  process.exit(plan.length ? 1 : 0);
}
if (action.primaryForGoal !== false) {
  console.error(`\n⛔ SAFETY RAIL: "${ACTION_NAME}" is PRIMARY (primary_for_goal=${action.primaryForGoal}).`);
  console.error(`Shadow uploads feed bidding only if the action is primary — and the qualified definition`);
  console.error(`is NOT frozen (Gate 1/5 pending). Demote it to secondary before uploading. ABORTING.`);
  process.exit(1);
}

if (!APPLY) { console.log(`\nDry run only. Re-run with --apply to upload ${plan.length} conversion(s).`); process.exit(0); }
if (!plan.length) { console.log(`\nNothing to upload.`); process.exit(0); }

/* ---------------- Upload ---------------- */
const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}:uploadClickConversions`, {
  method: "POST",
  headers: headers(token),
  body: JSON.stringify({
    partialFailure: true,
    conversions: plan.map((p) => ({
      gclid: p.gclid,
      conversionAction: action.resourceName,
      conversionDateTime: gAdsTime(p.at),
      conversionValue: p.value,
      currencyCode: "USD",
    })),
  }),
});
const data = await res.json();
if (!res.ok) { console.error(`Upload failed: ${JSON.stringify(data?.error ?? data)}`); process.exit(1); }
if (JSON.stringify(data.partialFailureError ?? "").includes("CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE")) {
  console.error(`\n⛔ NOT ALLOWLISTED: Google blocked Ads-API offline conversion uploads on 2026-06-15
(migrated to the Data Manager API; this dev token has no legacy access). This is a platform
cutover, not an account problem. Use --csv and upload through the UI Data manager flow
(the proven path), until a Data Manager API integration is built.`);
  process.exit(1);
}

const results = data.results ?? [];
const okRows = results.filter((r) => r && r.gclid).length;
console.log(`\nUPLOAD RESULT: ${okRows}/${plan.length} accepted.`);
if (data.partialFailureError) {
  console.log(`Partial failures (duplicates from window overlap are EXPECTED and fine):`);
  const errs = data.partialFailureError.details?.flatMap((d2) => d2.errors ?? []) ?? [];
  for (const e of errs.slice(0, 20)) {
    console.log(`  · row ${e.location?.fieldPathElements?.find((f) => f.fieldName === "conversions")?.index ?? "?"}: ${e.errorCode ? Object.entries(e.errorCode).map(([k, v]) => `${k}=${v}`).join(" ") : e.message}`);
  }
  if (errs.length > 20) console.log(`  … ${errs.length - 20} more`);
}
console.log(`
NEXT: check acceptance vs REPORTING in ~24-48h (scripts/check-oci-status.mjs — the open
ticket 3-2641000040864 is exactly about accepted-but-unreported rows; shadow data feeds
that evidence). Run daily (window overlap is safe). First real run gets a ledger entry:
measurement-layer addition, prospective, no bidding effect (action is SECONDARY).`);
