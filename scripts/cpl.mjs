/**
 * Cost per lead, paid and blended.
 *
 * We have no Google Ads read from the repo, so spend is passed in. Get it from
 * Google Ads > Campaigns with the SAME date range you pass here, Cost column.
 *
 *   node scripts/cpl.mjs --spend 1605                 # Mon 00:00 PT -> now
 *   node scripts/cpl.mjs --spend 1605 --days 7        # last 7 days
 *   node scripts/cpl.mjs --spend 1605 --from 2026-07-31T15:01:11.329Z --to-date 2026-08-07T15:01:11.329Z
 *
 * Windows are Pacific unless you pass explicit ISO timestamps.
 * Requires FIREBASE_PROJECT_ID + gcloud ADC.
 */
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };

const spend = flag("spend") != null ? Number(flag("spend")) : null;

// Window. Default: Monday 00:00 PT of the current week through now, which is
// what Google Ads shows as "This week (Mon-Today)".
let FROM, TO;
if (flag("from")) {
  FROM = new Date(flag("from"));
  TO = flag("to-date") ? new Date(flag("to-date")) : new Date();
} else if (flag("days")) {
  TO = new Date();
  FROM = new Date(TO.getTime() - Number(flag("days")) * 864e5);
} else {
  const nowPT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const offsetMs = Date.now() - nowPT.getTime();
  const mon = new Date(nowPT);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); // back to Monday
  FROM = new Date(mon.getTime() + offsetMs);
  TO = new Date();
}

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) { console.error("Missing FIREBASE_PROJECT_ID"); process.exit(1); }
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const snap = await db.collection("leads")
  .where("createdAt", ">=", FROM).where("createdAt", "<=", TO)
  .orderBy("createdAt", "desc").limit(1000).get();
const all = snap.docs.map((d) => d.data());

const INTERNAL = [/eddiezal28@gmail\.com/i, /@zaldivarlabs\.com/i, /@superflosystems\.com/i, /\btest(ing)?\b/i];
const isInternal = (d) => {
  const hay = [d.contact?.email, `${d.contact?.firstName ?? ""} ${d.contact?.lastName ?? ""}`, d.contact?.notes]
    .filter(Boolean).join(" | ");
  return INTERNAL.some((re) => re.test(hay));
};
const isCall = (d) => d.source === "call" || String(d.leadRef ?? "").startsWith("CALL-");

// Paid = a Google click ID, or a cpc/ppc/paid medium. gclid is the strong
// signal; utm alone can be set by anything that copies a tagged URL.
const PAID_MEDIUM = /^(cpc|ppc|paid|paidsearch|paid_search)$/i;
const bucket = (d) => {
  const a = d.attribution ?? {};
  if (a.gclid) return "paid";
  if (a.utmMedium && PAID_MEDIUM.test(a.utmMedium)) return "paid";
  if (a.utmSource) return `other tagged (${a.utmSource}/${a.utmMedium ?? "?"})`;
  if (/google\./i.test(a.referrer ?? "")) return "google organic";
  if (a.referrer) return "referral";
  return "direct";
};

const web = all.filter((d) => !isCall(d) && !isInternal(d));
const calls = all.filter(isCall);
const internal = all.filter((d) => !isCall(d) && isInternal(d));

const counts = {};
let backfilled = 0;
for (const d of web) {
  const b = bucket(d);
  counts[b] = (counts[b] ?? 0) + 1;
  if (d.attribution?.backfilled) backfilled++;
}
const paid = counts.paid ?? 0;
const webTotal = web.length;
const callTotal = calls.length;

const pad = (s, n) => String(s).padEnd(n);
const money = (n) => "$" + n.toFixed(2);

console.log(`\nWindow (Pacific): ${FROM.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}  ->  ${TO.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}`);
console.log(`Ad spend supplied: ${spend != null ? money(spend) : "(none — pass --spend)"}`);

console.log(`\nWeb form leads by attribution (internal tests excluded):`);
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pad(k, 32)} ${n}`);
}
console.log(`  ${pad("TOTAL web form", 32)} ${webTotal}`);
console.log(`\nTracked inbound calls (CallRail): ${callTotal}`);
console.log(`Internal test submissions excluded: ${internal.length}`);
if (backfilled) console.log(`Note: ${backfilled} lead(s) have backfilled attribution — treat their source as inferred, not observed.`);

if (spend == null) { console.log("\nPass --spend <dollars> to get CPL.\n"); process.exit(0); }

const line = (label, n) =>
  console.log(`  ${pad(label, 40)} ${pad(n, 5)} ${n ? money(spend / n) : "n/a"}`);

console.log(`\nCost per lead:`);
console.log(`  ${pad("basis", 40)} ${pad("leads", 5)} CPL`);
line("Paid only (gclid / cpc web forms)", paid);
line("Blended, web forms only", webTotal);
line("Blended, web forms + tracked calls", webTotal + callTotal);
console.log("");
console.log("Read these carefully:");
console.log("  - Paid-only CPL is the honest efficiency number for the ads.");
console.log("  - Blended CPL credits ads for organic and direct leads they did not");
console.log("    pay for, so it always looks better. Use it for business math, not");
console.log("    for judging campaign performance.");
console.log("  - Calls are the weakest attribution here: CallRail logs the call but");
console.log("    we do not split site calls from GBP or direct-dial. Including them");
console.log("    in a blended CPL flatters the number by an unknown amount.");
console.log("");
process.exit(0);
