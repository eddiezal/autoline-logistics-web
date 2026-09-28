/**
 * List Work Ledger entries (site_changes) from the command line.
 *
 * Usage:  node scripts/list-site-changes.mjs [--since 2026-08-01] [--all] [--ids]
 * --all includes internal entries. Default --since is 45 days ago (Pacific).
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

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
}
const defaultSince = new Date(Date.now() - 45 * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const since = arg("since", defaultSince);
const all = process.argv.includes("--all");
const showIds = process.argv.includes("--ids");

const snap = await db.collection("site_changes").where("date", ">=", since).orderBy("date", "desc").get();
let n = 0;
for (const d of snap.docs) {
  const x = d.data();
  if (!all && x.visibility === "internal") continue;
  n++;
  console.log(`${x.date}  ${String(x.category).padEnd(14)} ${x.visibility === "internal" ? "INT " : "    "} ${x.title}${x.link ? `  → ${x.link}` : ""}${showIds ? `\n            id: ${d.id}` : ""}`);
}
console.log(`\n${n} entries since ${since}${all ? "" : " (client-visible only; --all for internal)"}`);
