/**
 * One-off: dump the FIELD SHAPES (not values) of recent proabd_webhook_events
 * so the shipments parser can map Shipper/Transport subfields with confidence.
 * Prints keys + value types; only whitelisted non-PII values are shown.
 *
 * v2: no composite index needed — pulls the latest 300 events by
 * received_at only (single-field) and buckets by entity_type client-side.
 * Counts use aggregate count() queries.
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

const SHOW_VALUES = new Set([
  "Type", "Item_Type", "Item_Type_Id", "Status", "Status_Id", "Child_Status",
  "Child_Status_Id", "Booked_Date", "Create_Date", "Available_Date", "Referrer",
  "Referrer_Id", "Mileage", "UserName", "UserId", "Custom_Id",
]);

function shape(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      shape(v, p, out);
    } else if (Array.isArray(v)) {
      out.push(`${p}: array[${v.length}]`);
      if (v.length && typeof v[0] === "object") shape(v[0], `${p}[0]`, out);
    } else {
      const show = SHOW_VALUES.has(k) ? ` = ${JSON.stringify(v)}` : "";
      out.push(`${p}: ${v === null ? "null" : typeof v}${v === "" ? " (empty)" : show}`);
    }
  }
  return out;
}

// Latest 300 events, newest first — single-field orderBy, no index needed.
const recent = await db
  .collection("proabd_webhook_events")
  .orderBy("received_at", "desc")
  .limit(300)
  .get();

const samples = new Map(); // entity_type -> raw_item
for (const d of recent.docs) {
  const t = d.get("entity_type") ?? "(null)";
  if (!samples.has(t)) samples.set(t, d.get("raw_item") ?? {});
}

for (const [t, raw] of samples) {
  console.log(`\n===== newest entity_type=${t} =====`);
  console.log(shape(raw).join("\n"));
}
if (!samples.has("order")) {
  console.log(
    "\n(!) No ORDER event in the latest 300 — the order-price/VIN field names " +
    "are still unconfirmed. Re-run after the next booking.",
  );
}

// Aggregate counts — no composite index required.
const col = db.collection("proabd_webhook_events");
const [total, unparsed, leads, quotes, orders] = await Promise.all([
  col.count().get(),
  col.where("parsed", "==", false).count().get(),
  col.where("entity_type", "==", "lead").count().get(),
  col.where("entity_type", "==", "quote").count().get(),
  col.where("entity_type", "==", "order").count().get(),
]);
console.log("\n===== event counts =====");
console.log({
  total: total.data().count,
  unparsed: unparsed.data().count,
  lead: leads.data().count,
  quote: quotes.data().count,
  order: orders.data().count,
});
process.exit(0);
