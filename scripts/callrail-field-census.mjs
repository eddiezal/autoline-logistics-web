/**
 * CallRail webhook field census — what does CallRail ACTUALLY send us?
 *
 * Built 2026-08-19 after call-crosscheck.mjs found all 33 call docs since
 * 8/10 carry null phone and duration 0. The 8/10 fix preserved raw payloads
 * in callrail_webhook_events for exactly this diagnosis. Same approach as
 * proabd-field-census.mjs: enumerate field paths and population %, values
 * shown ONLY for structural keys — anything that could identify a caller
 * (numbers, names, transcripts, recordings) prints presence, never content.
 *
 * The specific questions:
 *   · Is customer_phone_number (or any phone-ish key) present in the payload?
 *   · Is duration present, and on which event type? (CallRail's pre-call
 *     webhook has no duration; call-completed does — if we're subscribed to
 *     the wrong one, duration is structurally absent.)
 *   · Is there an event/type discriminator so the handler can tell them apart?
 *
 * Usage: node scripts/callrail-field-census.mjs [--limit 500]
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
const limIdx = argv.indexOf("--limit");
const LIMIT = limIdx >= 0 ? Number(argv[limIdx + 1]) || 500 : 500;

// Keys whose VALUES may identify a caller — presence only, never content.
const PII_KEY = /phone|number|name|email|transcript|recording|address|city|zip|caller|customer/i;
// Keys safe to sample values from (structural / enum-ish).
const SAFE_KEY = /^(type|event|call_type|direction|answered|duration|first_call|device_type|company_id|tracking|source|medium|campaign|keywords|landing|referrer|utm_|gclid|start_time|created_at|state)$/i;

const snap = await db.collection("callrail_webhook_events")
  .orderBy("receivedAt", "desc").limit(LIMIT).get(); // camelCase — this collection differs from proabd_webhook_events
console.log(`${snap.size} callrail_webhook_events sampled (newest first)\n`);
if (!snap.size) {
  console.log("Collection is empty — the raw-payload preservation may not be deployed, or the");
  console.log("webhook is not firing. Check CallRail's webhook config + /api/webhooks/callrail logs.");
  process.exit(0);
}

const stats = new Map(); // path -> {n, types:Set, samples:Set}
function walk(obj, prefix) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    let s = stats.get(path);
    if (!s) stats.set(path, (s = { n: 0, types: new Set(), samples: new Set() }));
    if (v === null || v === undefined || v === "") continue;
    s.n++;
    s.types.add(Array.isArray(v) ? "array" : typeof v);
    if (typeof v === "object" && !Array.isArray(v)) { walk(v, path); continue; }
    const leaf = k.split(".").pop();
    if (!PII_KEY.test(path) && SAFE_KEY.test(leaf) && s.samples.size < 5 && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
      s.samples.add(String(v).slice(0, 40));
    }
  }
}
for (const doc of snap.docs) walk(doc.data(), "");

const total = snap.size;
console.log("path".padEnd(52) + "pop".padStart(6) + "  type / sample");
console.log("-".repeat(100));
for (const [path, s] of [...stats.entries()].sort((a, b) => b[1].n - a[1].n)) {
  const pop = ((100 * s.n) / total).toFixed(0) + "%";
  const val = PII_KEY.test(path)
    ? "(PII — present, value withheld)"
    : [...s.samples].join(", ") || [...s.types].join("/") || "—";
  console.log(path.slice(0, 51).padEnd(52) + pop.padStart(6) + "  " + val.slice(0, 60));
}

console.log(`\n── What to look for ──`);
console.log(`  · a phone-ish key at high population → the handler's field name is wrong, easy fix`);
console.log(`  · duration only present on some events → we receive multiple webhook types; the`);
console.log(`    handler must read call-completed (or CallRail config should subscribe to it)`);
console.log(`  · nothing phone-ish at all → CallRail webhook config sends a minimal payload;`);
console.log(`    fix is in CallRail's webhook settings, not our code`);
