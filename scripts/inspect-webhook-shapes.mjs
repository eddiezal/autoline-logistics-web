/**
 * One-off: dump the FIELD SHAPES (not values) of recent proabd_webhook_events
 * so the shipments parser can map Shipper/Transport subfields with confidence.
 * Prints keys + value types; only whitelisted non-PII values are shown.
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

for (const entityType of ["order", "quote", "lead"]) {
  const snap = await db
    .collection("proabd_webhook_events")
    .where("entity_type", "==", entityType)
    .orderBy("received_at", "desc")
    .limit(1)
    .get();
  console.log(`\n===== entity_type=${entityType} (${snap.size} found) =====`);
  for (const d of snap.docs) {
    const raw = d.data().raw_item ?? {};
    console.log(shape(raw).join("\n"));
  }
}

// Count events by entity_type + parsed flag for sizing the backfill.
const counts = {};
const all = await db.collection("proabd_webhook_events").select("entity_type", "parsed").get();
for (const d of all.docs) {
  const k = `${d.get("entity_type")}|parsed=${d.get("parsed")}`;
  counts[k] = (counts[k] ?? 0) + 1;
}
console.log("\n===== event counts =====");
console.log(counts, "total:", all.size);
process.exit(0);
