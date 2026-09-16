/**
 * LaneLock tool-quote backtest, ALL lead sources.
 *
 * Joins `pricingQuotes` (the point-in-time SD estimate the card produced for a
 * ProABD record, written by src/lib/pricing/quote-ledger.ts) to the record's
 * settled Carrier_Pay from `proabd_webhook_events` (order stage, latest event).
 *
 * Residual = settled carrier pay - SD carrier estimate.  POSITIVE = SD too LOW.
 * Margin   = card recommended price - settled carrier pay (floor $150).
 * Also: agent price vs tool price at the moment of pricing (did the agent quote
 * above or below the card?), by source.
 *
 * Read only. Usage: node scripts/backtest-tool-quotes.mjs [--since 2026-09-15]
 */
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const argv = process.argv.slice(2);
const sinceArg = argv[argv.indexOf("--since") + 1];
const since = argv.includes("--since") && sinceArg ? new Date(sinceArg) : null;

const dig = (o, p) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
const pickNum = (raw, paths) => { for (const p of paths) { const v = dig(raw, p); const n = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : Number(v); if (Number.isFinite(n) && n > 0) return n; } return null; };
const CARRIER_PATHS = ["Transport.Carrier_Pay", "Carrier_Pay"];
const PRICE_PATHS = ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price"];
const ORDER_STATUS = new Set(["14","15","16","17","18","19","20","21","22","24"]);
const median = (xs) => { const a = [...xs].sort((p, q) => p - q); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; };
const $ = (x) => x == null ? "n/a" : (x < 0 ? "-$" : "+$") + Math.abs(Math.round(x));
const FLOOR = 150;

// 1. quotes: first estimate per abdId (earliest firstSeenAt wins)
const qs = await db.collection("pricingQuotes").get();
const quotes = new Map();
for (const d of qs.docs) {
  const q = d.data();
  const at = q.firstSeenAt?.toDate?.() ?? new Date(q.pricedAt ?? 0);
  if (since && at < since) continue;
  const prev = quotes.get(q.abdId);
  if (!prev || at < prev.at) quotes.set(q.abdId, { ...q, at });
}
console.log(`pricingQuotes docs: ${qs.size}  |  distinct records: ${quotes.size}${since ? `  (since ${since.toISOString().slice(0,10)})` : ""}`);
if (!quotes.size) { console.log("Nothing to join yet. The ledger fills as agents open records with the card."); process.exit(0); }

// 2. settled carrier pay per abdId from order-stage webhook events (latest wins)
const settled = new Map();
const ids = [...quotes.keys()];
for (let i = 0; i < ids.length; i += 30) {
  const chunk = ids.slice(i, i + 30);
  const snap = await db.collection("proabd_webhook_events").where("entity_id", "in", chunk).get();
  for (const d of snap.docs) {
    const e = d.data(); const raw = e.raw_item ?? {};
    const statusId = String(raw.Status_Id ?? "");
    const isOrder = String(e.entity_type ?? "").toLowerCase() === "order" || ORDER_STATUS.has(statusId);
    if (!isOrder) continue;
    const cp = pickNum(raw, CARRIER_PATHS); if (!cp) continue;
    const t = e.received_at?.toDate?.()?.getTime() ?? 0;
    const prev = settled.get(e.entity_id);
    if (!prev || t >= prev.t) settled.set(e.entity_id, { t, carrierPay: cp, price: pickNum(raw, PRICE_PATHS), statusId, agent: raw.UserName ?? "" });
  }
}

// 3. join
const rows = [];
for (const [abd, q] of quotes) {
  const s = settled.get(abd);
  const est = q.carrierEstimate?.price ?? null, rec = q.recommended?.price ?? null;
  const agentAtPricing = q.crmPriceAtPricing || null, agentLatest = q.crmPriceLatest || null;
  rows.push({ abd, source: q.source, ref: q.referrerId, route: q.route, miles: q.mileage ?? null, est, rec, agentAtPricing, agentLatest,
    settledCP: s?.carrierPay ?? null, finalPrice: s?.price ?? null, statusId: s?.statusId ?? null,
    resid: s && est != null ? s.carrierPay - est : null, margin: s && rec != null ? rec - s.carrierPay : null,
    agentVsTool: agentAtPricing && rec != null ? agentAtPricing - rec : null, at: q.at });
}

// 4. agent vs tool at pricing time (every priced record, settled or not), by source
console.log(`\n===== AGENT PRICE vs TOOL PRICE at the moment the card priced it (all ${rows.length} records) =====`);
const bySrc = {};
for (const r of rows) { (bySrc[r.source] ??= []).push(r); }
for (const [src, rs] of Object.entries(bySrc)) {
  const d = rs.map((r) => r.agentVsTool).filter((x) => x != null);
  const under = d.filter((x) => x < -25).length, over = d.filter((x) => x > 25).length;
  console.log(`  ${src.padEnd(20)} n=${String(rs.length).padStart(3)}  priced-by-agent=${String(d.length).padStart(3)}  median agent-tool ${$(median(d)).padStart(6)}  agent under tool: ${under}  over: ${over}  within $25: ${d.length - under - over}`);
}

// 5. settled: SD vs carrier pay, all sources
const st = rows.filter((r) => r.resid != null);
console.log(`\n===== SETTLED (reached order with carrier pay): ${st.length} of ${rows.length} =====`);
if (st.length) {
  const res = st.map((r) => r.resid), ab = res.map(Math.abs);
  console.log(`  residual (settled - SD est): median ${$(median(res))}  mean ${$(res.reduce((a, b) => a + b, 0) / res.length)}  MAE $${Math.round(ab.reduce((a, b) => a + b, 0) / ab.length)}`);
  console.log(`  within ±$50: ${ab.filter((x) => x <= 50).length}  ±$100: ${ab.filter((x) => x <= 100).length}  ±$150: ${ab.filter((x) => x <= 150).length}`);
  const fails = st.filter((r) => r.margin < FLOOR);
  console.log(`  margin (tool price - carrier pay): median ${$(median(st.map((r) => r.margin)))}  floor fails (<$${FLOOR}): ${fails.length}  below carrier cost: ${st.filter((r) => r.margin < 0).length}`);
  for (const [src, rs] of Object.entries(bySrc)) {
    const ss = rs.filter((r) => r.resid != null); if (!ss.length) continue;
    console.log(`    ${src.padEnd(20)} n=${ss.length}  median resid ${$(median(ss.map((r) => r.resid)))}  median margin ${$(median(ss.map((r) => r.margin)))}  floor fails ${ss.filter((r) => r.margin < FLOOR).length}`);
  }
  const bands = [[0, 500], [500, 1000], [1000, 1500], [1500, 2000], [2000, 2500], [2500, 99999]];
  console.log(`  by distance:`);
  for (const [lo, hi] of bands) { const b = st.filter((r) => r.miles != null && r.miles >= lo && r.miles < hi); if (!b.length) continue;
    console.log(`    ${String(lo).padStart(4)}-${hi === 99999 ? "+   " : String(hi).padEnd(4)} mi  n=${b.length}  median resid ${$(median(b.map((r) => r.resid)))}  floor fails ${b.filter((r) => r.margin < FLOOR).length}`); }
  console.log(`\n  ref        source               route                    miles   SD est   tool    agent@price  settled CP   resid   margin`);
  for (const r of st.sort((a, b) => b.resid - a.resid)) {
    console.log(`  ${r.abd.padEnd(10)} ${String(r.source).padEnd(20)} ${String(r.route).slice(0, 24).padEnd(24)} ${String(r.miles ?? "?").padStart(5)}  $${String(r.est).padStart(5)}  $${String(r.rec).padStart(5)}  $${String(r.agentAtPricing ?? "-").padStart(7)}   $${String(r.settledCP).padStart(6)}   ${$(r.resid).padStart(6)}  ${$(r.margin).padStart(6)}`);
  }
}
console.log(`\nReading: residual > 0 means SD under-estimated the carrier. Margin uses the TOOL's price, i.e. what would have happened if the agent had used the card. n is small until the ledger fills; forward accrual is the proof.`);
process.exit(0);
