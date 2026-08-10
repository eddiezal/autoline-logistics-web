/**
 * Where were callers when they dialed?
 *
 * Built 2026-08-10 as the verification step for the behavioral-journey
 * "estimate cliff" finding: 87% of sessions exit right after seeing a
 * price, and web-only analysis counts a caller as an EXIT. If estimate
 * viewers disproportionately CALL instead of submitting the form, the
 * cliff is partly a phone artifact. CallRail stamps the page the visitor
 * was on (callMeta.landingPage) — this tallies it.
 *
 * Usage:
 *   node scripts/call-landing.mjs            # last 30 days
 *   node scripts/call-landing.mjs --days 45
 */
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const DAYS = Number(flag("days")) || 30;

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) { console.error("Missing FIREBASE_PROJECT_ID"); process.exit(1); }
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const since = new Date(Date.now() - DAYS * 864e5);
const snap = await db.collection("leads")
  .where("createdAt", ">=", since).orderBy("createdAt", "desc").limit(500).get();
const calls = snap.docs.map((d) => d.data())
  .filter((d) => d.source === "call" || String(d.leadRef ?? "").startsWith("CALL-"));

// Same page-class mapping as behavior-journey.mjs so the two reads align.
function pageState(raw) {
  if (!raw) return "(no landing page recorded)";
  let p;
  try { p = new URL(raw, "https://x.test").pathname; } catch { p = String(raw); }
  p = p.replace(/^\/es(?=\/|$)/, "") || "/";
  if (p === "/") return "HOME";
  if (p === "/quote") return "QUOTE";
  if (p.startsWith("/tools/route-price-checker")) return "PRICE_CHECKER";
  if (p.startsWith("/tools/ship-vs-drive")) return "SHIP_VS_DRIVE";
  if (p.startsWith("/corridors")) return "CORRIDOR";
  if (p.startsWith("/blog")) return "BLOG";
  if (p.startsWith("/resources")) return "GUIDES";
  if (/^\/(price|damage|people)-promise/.test(p)) return "PROMISES";
  if (p.startsWith("/anti-scam")) return "ANTI_SCAM";
  return "OTHER (" + p + ")";
}

console.log(`\nCALL LEADS — last ${DAYS} days: ${calls.length} calls`);
const byPage = {};
const byDuration = { under60: 0, over60: 0, unknown: 0 };
for (const c of calls) {
  // Prefer the page they were ON when dialing; fall back to session landing.
  // (Both null before the 2026-08-10 webhook field-name fix; durations were
  // stored as strings before it too — Number() handles both eras.)
  const st = pageState(c.callMeta?.lastRequestedUrl ?? c.callMeta?.landingPage);
  byPage[st] = (byPage[st] ?? 0) + 1;
  const dur = Number(c.callMeta?.durationSec);
  if (Number.isFinite(dur)) (dur >= 60 ? byDuration.over60++ : byDuration.under60++);
  else byDuration.unknown++;
}

console.log("\nPage the caller was on when they dialed:");
for (const [k, n] of Object.entries(byPage).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(34)} ${String(n).padStart(3)}  (${(100 * n / calls.length).toFixed(0)}%)`);
}
console.log(`\nDuration: ${byDuration.over60} calls ≥60s (real conversations), ${byDuration.under60} under 60s, ${byDuration.unknown} unknown`);

console.log("\nDetail (newest first):");
for (const c of calls.slice(0, 20)) {
  const t = c.createdAt?.toDate?.()?.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) ?? "?";
  const dur = c.callMeta?.durationSec != null ? `${c.callMeta.durationSec}s` : "?";
  console.log(`  ${t}  ${String(dur).padStart(5)}  ${pageState(c.callMeta?.landingPage)}`);
}
console.log(`
READ: if PRICE_CHECKER's share of calls is large relative to its ~28%
share of sessions, estimate viewers are calling rather than exiting and
the "estimate cliff" in behavior-journey.mjs is partly a phone artifact.
If calls skew HOME/QUOTE like general traffic, the cliff stands.
`);
process.exit(0);
