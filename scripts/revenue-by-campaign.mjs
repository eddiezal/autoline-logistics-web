/**
 * Revenue by campaign — CLI wrapper (2026-08-19).
 *
 * ALL computation lives in src/lib/admin/revenueByCampaign.mjs, shared with
 * the Acquisition view (revenueLive.ts → RevenueSection). One implementation,
 * two callers — a local run can never disagree with the dashboard.
 *
 * READ ONLY. Prints counts, dollars, campaign ids — never customer data.
 *
 * Usage:
 *   node scripts/revenue-by-campaign.mjs
 *   node scripts/revenue-by-campaign.mjs --since 2026-07-20 --env .env.vercel
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  REVENUE_COHORT_START, MATURITY_DAYS, COLOR_UNLOCK_BOOKINGS,
  reduceWebhookState, bucketLead, computeRevenue, rowLabel,
} from "../src/lib/admin/revenueByCampaign.mjs";

/* ---- env: Firebase from .env.local/ADC only; .env.vercel supplies Ads vars
   (the Vercel-pulled FIREBASE_PRIVATE_KEY doesn't round-trip parseably). ---- */
const envArgIdx = process.argv.indexOf("--env");
const envFiles = envArgIdx >= 0
  ? [process.argv[envArgIdx + 1]]
  : [".env.local", ".env.vercel", ".env.development.local", ".env"];
if (existsSync(".env.local")) loadEnv({ path: ".env.local" });
const fbSnapshot = {
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
};
for (const f of envFiles) if (f && existsSync(f)) loadEnv({ path: f });
for (const [k, v] of Object.entries(fbSnapshot)) {
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const SINCE = new Date(`${arg("since") ?? REVENUE_COHORT_START}T00:00:00-07:00`);
const NOW = new Date();
const MATURE_CUTOFF = new Date(NOW.getTime() - MATURITY_DAYS * 864e5);
const ptDay = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const money = (v) => "$" + v.toFixed(0);
const pct = (k, n) => (n ? ((100 * k) / n).toFixed(1) + "%" : "—");

console.log(`Revenue by campaign · cohort ${ptDay(SINCE)} → today · mature = created ≤ ${ptDay(MATURE_CUTOFF)}`);

/* ---- leads ---- */
const isTest = (email) => /test|zaldivar|example\.com/i.test(email ?? "");
const leadSnap = await db.collection("leads")
  .where("createdAt", ">=", SINCE).orderBy("createdAt", "asc").limit(5000).get();
let testN = 0;
const leads = [];
for (const doc of leadSnap.docs) {
  const d = doc.data();
  const at = d.createdAt?.toDate?.();
  if (!at) continue;
  if (isTest(d.contact?.email)) { testN++; continue; }
  const { bucket, campaignId } = bucketLead(d.attribution ?? {});
  leads.push({
    at, bucket, campaignId,
    abdId: d.proabdAbdId ? String(d.proabdAbdId) : null,
    leadRef: d.leadRef ? String(d.leadRef) : null,
  });
}
console.log(`${leadSnap.size} lead docs → ${testN} test excluded → ${leads.length} used · ${leads.filter((l) => l.at <= MATURE_CUTOFF).length} mature`);

/* ---- webhook latest state ---- */
const evSnap = await db.collection("proabd_webhook_events")
  .where("received_at", ">=", SINCE).orderBy("received_at", "asc")
  .select("entity_id", "raw_item.ABD_Id", "raw_item.Custom_Id", "raw_item.Status_Id",
          "raw_item.Item_Type", "raw_item.Booked_Date", "raw_item.Transport.Deposit")
  .get();
const { state, byCustomId } = reduceWebhookState(evSnap.docs.map((doc) => {
  const d = doc.data();
  const item = d.raw_item ?? {};
  return {
    abdId: item.ABD_Id ?? d.entity_id, customId: item.Custom_Id,
    statusId: item.Status_Id, itemType: item.Item_Type,
    bookedDate: item.Booked_Date, deposit: item.Transport?.Deposit,
  };
}));
console.log(`${evSnap.size} webhook events → latest state for ${state.size} records`);

const { rows, totalsPaid } = computeRevenue({ leads, state, byCustomId, matureCutoff: MATURE_CUTOFF });

/* ---- spend + names over the mature create-date range ---- */
let spendByCampaign = null, campaignNames = new Map(), adsNote = "";
try {
  const missing = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN"]
    .filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`unconfigured: ${missing.join(", ")}`);
  const tokRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const tok = await tokRes.json();
  if (!tok.access_token) throw new Error(tok.error_description ?? tok.error ?? "oauth failed");
  const API_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? "v23";
  const CUSTOMER_ID = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "8519808841").replace(/-/g, "");
  const LOGIN_CUSTOMER_ID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "6871495331").replace(/-/g, "");
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}/googleAds:search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tok.access_token}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      "login-customer-id": LOGIN_CUSTOMER_ID,
    },
    body: JSON.stringify({
      query: `SELECT campaign.id, campaign.name, metrics.cost_micros FROM campaign
              WHERE segments.date BETWEEN '${ptDay(SINCE)}' AND '${ptDay(MATURE_CUTOFF)}'`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  spendByCampaign = new Map();
  for (const r of data.results ?? []) {
    const id = String(r.campaign.id);
    campaignNames.set(id, r.campaign.name);
    spendByCampaign.set(id, (spendByCampaign.get(id) ?? 0) + Number(r.metrics.costMicros ?? 0) / 1e6);
  }
} catch (err) {
  adsNote = `Ads spend unavailable (${err.message}) — fee columns still valid, spend shows —`;
}

/* ---- report ---- */
const hr = () => console.log("=".repeat(112));
hr();
console.log(`MATURE COHORT — created ${ptDay(SINCE)} → ${ptDay(MATURE_CUTOFF)} (every lead ≥${MATURITY_DAYS}d; rates are real here)`);
if (adsNote) console.log(`⚠ ${adsNote}`);
hr();
console.log(
  "source".padEnd(38) + "leads".padStart(6) + "linked".padStart(8) + "booked".padStart(8) +
  "rate".padStart(7) + "cxl".padStart(5) + "fees gross".padStart(12) + "fees net".padStart(10) +
  "spend".padStart(9) + "net/$100".padStart(10),
);
let tSpend = 0;
for (const r of rows) {
  if (!r.matureLeads) continue;
  const spend = r.key.startsWith("ads:") && spendByCampaign ? spendByCampaign.get(r.key.slice(4)) ?? null : null;
  if (spend) tSpend += spend;
  const lock = r.matureBooked < COLOR_UNLOCK_BOOKINGS && spend ? " *" : "";
  console.log(
    rowLabel(r.key, campaignNames).slice(0, 37).padEnd(38) + String(r.matureLeads).padStart(6) +
    pct(r.matureLinked, r.matureLeads).padStart(8) + String(r.matureBooked).padStart(8) +
    pct(r.matureBooked, r.matureLeads).padStart(7) + String(r.matureCanceled).padStart(5) +
    money(r.matureFeeGross).padStart(12) + money(r.matureFeeNet).padStart(10) +
    (spend != null ? money(spend) : "—").padStart(9) +
    ((spend ? money((r.matureFeeNet / spend) * 100) : "—") + lock).padStart(10),
  );
}
hr();
console.log(
  "TOTAL PAID".padEnd(38) + String(totalsPaid.matureLeads).padStart(6) + "".padStart(8) +
  String(totalsPaid.matureBooked).padStart(8) + pct(totalsPaid.matureBooked, totalsPaid.matureLeads).padStart(7) +
  String(totalsPaid.matureCanceled).padStart(5) + money(totalsPaid.matureFeeGross).padStart(12) +
  money(totalsPaid.matureFeeNet).padStart(10) + money(tSpend).padStart(9) +
  (tSpend ? money((totalsPaid.matureFeeNet / tSpend) * 100) : "—").padStart(10),
);
console.log(`\n* = fewer than ${COLOR_UNLOCK_BOOKINGS} bookings — net/$100 is position, not verdict (renders gray on the dashboard).`);

console.log(`\nGREEN COHORT — created after ${ptDay(MATURE_CUTOFF)} (counts only; NO rates):`);
for (const r of rows) {
  if (!r.greenLeads) continue;
  console.log(`  ${rowLabel(r.key, campaignNames).slice(0, 40).padEnd(42)} ${String(r.greenLeads).padStart(4)} leads · ${r.greenBooked} booked so far · ${money(r.greenFeeGross)} fees so far`);
}

console.log(`\nCaveats: fees are booking deposits before card fees/refunds · net excludes currently-`);
console.log(`canceled records (official treatment = P8 rule) · linked% <90% undercounts that row ·`);
console.log(`phone bookings aren't click-attributable — every paid figure is a FLOOR.`);
