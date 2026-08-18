/**
 * Read ANY bounded Google Ads window, per campaign and per conversion action.
 *
 * Built 2026-08-17 to settle the standing watch from the 8/11 CSP incident:
 *
 *   "Aug 7-11 should settle at Conversions = 12 / All conv = 13 within 24-48h
 *    (by ~Sat 8/15). If it ever reads ~18, the stuck originals restated on top
 *    of the retry — upload RETRACTIONS for the +1s copies, citing case
 *    7-8363000040761."
 *
 * That deadline passed unchecked. The check needs an EXPLICIT past window, and
 * two existing tools cannot give one:
 *   · fetchAdsStats(since) runs `since -> today`. No upper bound.
 *   · the Ads UI date picker defeats AUTOMATION — six failed approaches, see
 *     claude/s2-near-me-diagnosis-2026-08-13.md. A human clicking it is fine;
 *     the point of this script is repeatability at the 8/24 gate and after,
 *     not that the UI cannot answer the question once.
 * So this queries GAQL directly with both bounds. READ ONLY — it issues a
 * single googleAds:search and writes nothing, anywhere.
 *
 * Auth and headers mirror src/lib/googleAds/client.ts. The duplication is
 * deliberate and narrow: that client is TypeScript and cannot be imported from
 * plain node, and a diagnostic that must run in 30 seconds during an open
 * double-count risk is not the place to refactor a production module. It reads
 * the same env vars, so there is one place to fix credentials.
 *
 * Usage:
 *   node scripts/ads-window.mjs --start 2026-08-07 --end 2026-08-11
 *   node scripts/ads-window.mjs --start 2026-08-07 --end 2026-08-11 --expect 12,13
 *   node scripts/ads-window.mjs --start 2026-08-01 --end 2026-08-16 --by-day
 *   node scripts/ads-window.mjs --env .env.vercel --start 2026-08-07 --end 2026-08-11
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";

/* .env.local carries GOOGLE_ADS_DEVELOPER_TOKEN but NOT the three OAuth vars —
   those live only in Vercel. Rather than edit .env.local (which has a fragile
   history: CRON_SECRET was once glued onto a comment line and never loaded, and
   a stray CRONT_SECRET is still in there), pull Vercel's env to a SEPARATE file
   and let it fill the gaps:

     vercel env pull .env.vercel

   Loaded in order, first value wins, so .env.local stays authoritative for
   anything it already defines. --env <file> overrides the search. */
const envArgIdx = process.argv.indexOf("--env");
const envFiles = envArgIdx >= 0
  ? [process.argv[envArgIdx + 1]]
  : [".env.local", ".env.vercel", ".env.development.local", ".env"];
const loaded = [];
for (const f of envFiles) if (f && existsSync(f)) { loadEnv({ path: f }); loaded.push(f); }

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? "v23";
const LOGIN_CUSTOMER_ID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "6871495331").replace(/-/g, "");
const CUSTOMER_ID = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? "8519808841").replace(/-/g, "");

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const START = arg("start"), END = arg("end");
const BY_DAY = argv.includes("--by-day");
const EXPECT = (arg("expect") ?? "").split(",").map(Number).filter(Number.isFinite);

if (!/^\d{4}-\d{2}-\d{2}$/.test(START ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(END ?? "")) {
  console.error("Need --start YYYY-MM-DD --end YYYY-MM-DD (inclusive, Ads account timezone = Pacific)");
  process.exit(1);
}
const missing = ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN"]
  .filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`\nMissing env: ${missing.join(", ")}`);
  console.error(`Loaded from: ${loaded.join(", ") || "(nothing found)"}\n`);
  console.error(`These three live only in Vercel. Either:`);
  console.error(`  1) vercel env pull .env.vercel     # then re-run; .env.local is left untouched`);
  console.error(`  2) node scripts/ads-window.mjs --env .env.vercel ...`);
  console.error(`  3) skip the script — set the date range by hand in the Ads UI. The picker only`);
  console.error(`     defeats AUTOMATION (see the S2 diagnosis); clicking it yourself works fine.\n`);
  process.exit(1);
}
console.log(`env loaded from: ${loaded.join(", ")}`);

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
  if (!res.ok || !d.access_token) throw new Error(`OAuth refresh failed: ${d.error ?? res.status} ${d.error_description ?? ""}`.trim());
  return d.access_token;
}

async function gaql(token, query) {
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}/googleAds:search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      "login-customer-id": LOGIN_CUSTOMER_ID,
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) {
    const detail = data?.error?.details?.[0]?.errors?.[0]?.message;
    throw new Error(`Ads API ${res.status}: ${detail ?? data?.error?.message ?? "unknown"}`);
  }
  return data.results ?? [];
}

const n = (v) => (v == null ? 0 : Number(v)) || 0;
const pad = (s, w) => String(s).padEnd(w);
const rp = (s, w) => String(s).padStart(w);
const money = (v) => "$" + v.toFixed(2);
const W = 86, hr = (c = "=") => console.log(c.repeat(W));

const token = await accessToken();
const window = `segments.date BETWEEN '${START}' AND '${END}'`;
console.log(`\nGoogle Ads · customer ${CUSTOMER_ID} · ${START} → ${END} inclusive (Pacific)\n`);

/* ---- per campaign ---- */
const camp = await gaql(token,
  `SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.clicks,
          metrics.impressions, metrics.conversions, metrics.all_conversions
   FROM campaign WHERE ${window}`);

const byCampaign = new Map();
for (const r of camp) {
  const key = r.campaign?.name ?? "(unnamed)";
  const a = byCampaign.get(key) ?? { cost: 0, clicks: 0, impr: 0, conv: 0, all: 0 };
  a.cost += n(r.metrics?.costMicros) / 1e6;
  a.clicks += n(r.metrics?.clicks);
  a.impr += n(r.metrics?.impressions);
  a.conv += n(r.metrics?.conversions);
  a.all += n(r.metrics?.allConversions);
  byCampaign.set(key, a);
}
hr(); console.log("BY CAMPAIGN"); hr();
console.log("  " + pad("campaign", 26) + rp("impr", 8) + rp("clicks", 8) + rp("cost", 11) + rp("conv", 8) + rp("all conv", 10) + rp("CPC", 9));
console.log("  " + "-".repeat(W - 4));
const T = { cost: 0, clicks: 0, impr: 0, conv: 0, all: 0 };
for (const [k, a] of [...byCampaign.entries()].sort((x, y) => y[1].cost - x[1].cost)) {
  for (const f of Object.keys(T)) T[f] += a[f];
  console.log("  " + pad(k.slice(0, 25), 26) + rp(a.impr, 8) + rp(a.clicks, 8) + rp(money(a.cost), 11) +
    rp(a.conv.toFixed(2), 8) + rp(a.all.toFixed(2), 10) + rp(a.clicks ? money(a.cost / a.clicks) : "—", 9));
}
console.log("  " + "-".repeat(W - 4));
console.log("  " + pad("TOTAL", 26) + rp(T.impr, 8) + rp(T.clicks, 8) + rp(money(T.cost), 11) +
  rp(T.conv.toFixed(2), 8) + rp(T.all.toFixed(2), 10) + rp(T.clicks ? money(T.cost / T.clicks) : "—", 9));

/* ---- per conversion action: this is where a double count shows itself ---- */
const acts = await gaql(token,
  `SELECT segments.conversion_action_name, metrics.all_conversions
   FROM campaign WHERE ${window} AND metrics.all_conversions > 0`);
const byAction = new Map();
for (const r of acts) {
  const k = r.segments?.conversionActionName ?? "(unnamed)";
  byAction.set(k, (byAction.get(k) ?? 0) + n(r.metrics?.allConversions));
}
hr(); console.log("BY CONVERSION ACTION"); hr();
if (!byAction.size) console.log("  none in window");
for (const [k, v] of [...byAction.entries()].sort((a, b) => b[1] - a[1])) {
  const flag = /backfill/i.test(k) ? "   <- the backfilled ones" : "";
  console.log("  " + pad(k.slice(0, 46), 48) + rp(v.toFixed(2), 9) + flag);
}

if (BY_DAY) {
  const days = await gaql(token,
    `SELECT segments.date, metrics.conversions, metrics.all_conversions, metrics.cost_micros
     FROM campaign WHERE ${window}`);
  const byDay = new Map();
  for (const r of days) {
    const k = r.segments?.date ?? "?";
    const a = byDay.get(k) ?? { conv: 0, all: 0, cost: 0 };
    a.conv += n(r.metrics?.conversions); a.all += n(r.metrics?.allConversions);
    a.cost += n(r.metrics?.costMicros) / 1e6;
    byDay.set(k, a);
  }
  hr(); console.log("BY DAY (conversions restate under CLICK date, not upload date)"); hr();
  for (const [k, a] of [...byDay.entries()].sort()) {
    console.log("  " + pad(k, 14) + rp(a.conv.toFixed(2), 9) + rp(a.all.toFixed(2), 10) + rp(money(a.cost), 11));
  }
}

/* ---- the verdict ---- */
hr(); console.log("VERDICT"); hr();
if (EXPECT.length === 2) {
  const [eConv, eAll] = EXPECT;
  const dConv = T.conv - eConv;
  console.log(`  expected  Conversions ${eConv} / all conv ${eAll}`);
  console.log(`  actual    Conversions ${T.conv.toFixed(2)} / all conv ${T.all.toFixed(2)}`);
  if (Math.abs(dConv) < 0.5) {
    console.log(`\n  ✅ MATCHES. The retry restated cleanly and the stuck originals did not.`);
    console.log(`     Close the standing watch. No retraction needed.`);
  } else if (dConv >= 5) {
    console.log(`\n  🔴 DOUBLE COUNT — ${dConv.toFixed(0)} conversions above expected.`);
    console.log(`     The stuck originals restated ON TOP of the +1s retry copies.`);
    console.log(`     ACTION: upload RETRACTIONS for the +1s copies, citing case 7-8363000040761.`);
    console.log(`     Until that is done, every conversion-based judgement in this window is`);
    console.log(`     inflated — including Phase-2 gate progress per campaign. Check the`);
    console.log(`     campaign table above to see WHICH campaigns carry the excess; the 6 at`);
    console.log(`     risk were S5 +4 and S3 +2.`);
  } else if (dConv < 0) {
    console.log(`\n  ⚠ BELOW expected by ${Math.abs(dConv).toFixed(0)}. The retry may not have fully restated.`);
    console.log(`     Do NOT re-upload on this alone — check the by-day view and the uploads page`);
    console.log(`     first. A missing restatement and a pending one look identical here.`);
  } else {
    console.log(`\n  ⚠ OFF by ${dConv.toFixed(0)} — neither a clean match nor the ~18 double-count signature.`);
    console.log(`     Investigate by day and by action before acting.`);
  }
} else {
  console.log(`  Conversions ${T.conv.toFixed(2)} · all conv ${T.all.toFixed(2)} · cost ${money(T.cost)}`);
  console.log(`  Pass --expect <conv>,<allconv> to have this checked against a target.`);
}
console.log(`\n  Caveat: conversions restate under CLICK date and trickle for days, so a window`);
console.log(`  this old should be settled — but the Ads API and UI can disagree for hours.`);
console.log(`  This is READ ONLY. It has changed nothing.\n`);
