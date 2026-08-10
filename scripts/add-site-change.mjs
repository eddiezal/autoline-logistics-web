/**
 * Add one Work Ledger entry from the command line.
 *
 * Usage:
 *   node scripts/add-site-change.mjs \
 *     --title "Launched CA to Washington corridor page" \
 *     --cat new-page --scope C --link /corridors/california-washington \
 *     [--date 2026-08-12] [--detail "..."] [--impact "..."] [--internal]
 *
 * Categories: new-page content-update improvement fix ads analysis tracking local-gbp infra
 * Scope: A B C D E Lab -    (default "-")
 * Date defaults to today (Pacific). Internal entries only show with ?all=1.
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
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}

const CATS = ["new-page", "content-update", "improvement", "fix", "ads", "analysis", "tracking", "local-gbp", "infra"]; // keep in sync with CATEGORY_LABELS in src/lib/admin/siteChanges.ts
const SCOPES = ["A", "B", "C", "D", "E", "Lab", "-"];

const title = arg("title");
const category = arg("cat", "improvement");
const scopeItem = arg("scope", "-");
const date = arg("date", new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }));
const detail = arg("detail");
const link = arg("link");
const impactNote = arg("impact");
const internal = process.argv.includes("--internal");

if (!title) { console.error("--title is required"); process.exit(1); }
if (!CATS.includes(category)) { console.error(`--cat must be one of: ${CATS.join(" ")}`); process.exit(1); }
if (!SCOPES.includes(scopeItem)) { console.error(`--scope must be one of: ${SCOPES.join(" ")}`); process.exit(1); }
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error("--date must be YYYY-MM-DD"); process.exit(1); }

const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const id = `${date}_${slug}`;
await db.collection("site_changes").doc(id).set({
  date, category, scopeItem, title,
  ...(detail ? { detail } : {}),
  ...(link ? { link } : {}),
  ...(impactNote ? { impactNote } : {}),
  visibility: internal ? "internal" : "client",
  addedAt: new Date().toISOString(),
}, { merge: true });
console.log(`Logged: [${date}] ${title} (${category}, scope ${scopeItem}${internal ? ", INTERNAL" : ""}) — id ${id}`);
