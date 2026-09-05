/**
 * Daily P4 unique-lead series for charting (monthly deck slide 3 EMA).
 * Same loading + dedup as weekly-report-preview.mjs; one row per Pacific day.
 * Usage: node scripts/daily-lead-series.mjs [--days 45]
 * Writes ../daily-leads.json (AutoExpress root, OUTSIDE the repo) and prints the table.
 */
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { writeFileSync } from "node:fs";
import { ymd, toUniqueLeads, isCall } from "../src/lib/reports/weeklyReport.mjs";

loadEnv({ path: ".env.local" });
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) { console.error("Missing FIREBASE_PROJECT_ID"); process.exit(1); }
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  let inited = false;
  if (clientEmail && privateKey) {
    try { initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }); inited = true; }
    catch { console.warn("(env key unparseable; falling back to gcloud ADC)"); }
  }
  if (!inited) initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const argv = process.argv.slice(2);
const dIdx = argv.indexOf("--days");
const DAYS = dIdx >= 0 ? Number(argv[dIdx + 1]) || 45 : 45;
const now = new Date();
const since = new Date(now.getTime() - DAYS * 864e5);

const snap = await db.collection("leads")
  .where("createdAt", ">=", since).orderBy("createdAt", "desc").limit(4000).get();
const leads = snap.docs
  .map((d) => { const x = d.data(); return { at: x.createdAt?.toDate?.() ?? null, lead: x }; })
  .filter((x) => x.at);
console.log(`${snap.size} docs · ${leads.length} usable`);

const unique = toUniqueLeads(leads);
const byDay = new Map();
for (const u of unique) {
  const k = ymd(u.at);
  const row = byDay.get(k) ?? { web: 0, calls: 0 };
  if (isCall(u.lead)) row.calls++; else row.web++;
  byDay.set(k, row);
}
// dense series, oldest -> newest, zero-filled
const out = [];
for (let t = since.getTime() + 864e5; t <= now.getTime(); t += 864e5) {
  const k = ymd(new Date(t));
  if (!out.find((r) => r.day === k)) {
    const row = byDay.get(k) ?? { web: 0, calls: 0 };
    out.push({ day: k, web: row.web, calls: row.calls, leads: row.web + row.calls });
  }
}
for (const r of out) console.log(`${r.day}  web ${String(r.web).padStart(3)}  calls ${String(r.calls).padStart(3)}  ${"#".repeat(r.web)}${"o".repeat(r.calls)}`);
writeFileSync("../daily-leads.json", JSON.stringify(out, null, 1));
console.log(`\nwrote ../daily-leads.json (${out.length} days)`);
