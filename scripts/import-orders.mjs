/**
 * One-time (re-runnable) import of the ProABD orders export into Firestore.
 *
 * Feeds the /admin Business Baseline card + Business view. Idempotent:
 * documents are keyed by order_id, so re-running with a newer export
 * upserts rather than duplicates.
 *
 * TIMEZONE (corrected 2026-08-19): ProABD datetimes are EASTERN, not
 * Pacific — measured 2026-08-17 via id-linked calibration against our own
 * createLead records (-3.00h median, 0.00h spread; see
 * scripts/lib/proabd-time.mjs and the fixed prod mirror in
 * src/lib/proabd/shipment-sync.ts). This script guessed Pacific from its
 * creation until today, putting every order timestamp three hours late —
 * enough to move late-evening bookings onto the wrong calendar day.
 * Re-running a full import with this fix silently corrects historical
 * docs (idempotent upsert).
 *
 * Usage: node scripts/import-orders.mjs "../orders-import-jul2026.csv"
 * (CSV lives at the AutoExpress folder root, OUTSIDE this repo, on purpose —
 *  it contains customer PII and must never be committed.)
 */
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

loadEnv({ path: ".env.local" });
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) { console.error("Missing FIREBASE_PROJECT_ID"); process.exit(1); }
if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (clientEmail && privateKey) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  else initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();

const path = process.argv[2];
if (!path) { console.error("Usage: node scripts/import-orders.mjs <csv path>"); process.exit(1); }

/** Minimal CSV parser handling quoted fields with embedded commas. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(readFileSync(path, "utf8"));
const header = rows.shift();
const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
const need = ["order_id", "email", "order_created", "price", "deposit"];
for (const k of need) if (!(k in idx)) { console.error(`CSV missing column: ${k}`); process.exit(1); }

import { parseProabdDate } from "./lib/proabd-time.mjs";

/** CSV datetimes are ProABD-Eastern wall clock (see header). */
const pt = (s) => {
  if (!s) return null;
  const d = parseProabdDate(s);
  return d && !Number.isNaN(d.getTime()) ? Timestamp.fromDate(d) : null;
};
const val = (r, k) => (idx[k] != null ? (r[idx[k]] ?? "").trim() : "");

let written = 0;
let batch = db.batch();
for (const r of rows) {
  const orderId = val(r, "order_id");
  if (!orderId) continue;
  batch.set(db.collection("orders").doc(orderId), {
    orderId,
    firstName: val(r, "first_name"),
    lastName: val(r, "last_name"),
    email: val(r, "email").toLowerCase(),
    phone: val(r, "phone"),
    originCity: val(r, "origin_city"),
    originState: val(r, "origin_state"),
    originZip: val(r, "origin_zip"),
    destCity: val(r, "dest_city"),
    destState: val(r, "dest_state"),
    destZip: val(r, "dest_zip"),
    leadCreatedAt: pt(val(r, "lead_created")),
    orderCreatedAt: pt(val(r, "order_created")),
    availableAt: pt(val(r, "available_date")),
    price: Number(val(r, "price")) || 0,
    deposit: Number(val(r, "deposit")) || 0,
    source: "proabd-export-2026-08",
    importedAt: Timestamp.now(),
  }, { merge: true });
  written++;
  if (written % 400 === 0) { await batch.commit(); batch = db.batch(); }
}
await batch.commit();
console.log(`Imported/updated ${written} orders into 'orders' collection (project ${projectId}).`);
process.exit(0);
