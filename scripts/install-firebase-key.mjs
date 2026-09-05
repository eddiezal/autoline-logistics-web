/**
 * Install a Firebase service-account key into .env.local, so scripts stop
 * depending on gcloud ADC (which the org's reauth policy expires every few
 * days — the weekly invalid_rapt dance).
 *
 * Usage:
 *   node scripts/install-firebase-key.mjs "C:\Users\eddie\Downloads\auto-line-logistics-xxxx.json"
 *
 * Get the JSON: Firebase console -> project settings -> Service accounts ->
 * "Generate new private key". Direct link:
 *   https://console.firebase.google.com/project/auto-line-logistics/settings/serviceaccounts/adminsdk
 *
 * What it does: upserts FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY
 * (newline-escaped, quoted) into .env.local, then VERIFIES by initializing
 * firebase-admin with cert() and reading one doc from Firestore.
 * It never prints the key. DELETE the downloaded JSON after this succeeds.
 * .env.local is gitignored; keep it that way.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const keyPath = process.argv[2];
if (!keyPath) { console.error("Usage: node scripts/install-firebase-key.mjs <path-to-service-account.json>"); process.exit(1); }
if (!existsSync(keyPath)) { console.error(`No file at ${keyPath}`); process.exit(1); }

const key = JSON.parse(readFileSync(keyPath, "utf8"));
for (const f of ["project_id", "client_email", "private_key"]) {
  if (!key[f]) { console.error(`Key file missing ${f} — is this a service-account key JSON?`); process.exit(1); }
}
if (key.project_id !== "auto-line-logistics") {
  console.error(`Key is for project "${key.project_id}", expected "auto-line-logistics". Wrong download (check you were in the Auto Line Firebase project, not another one). Nothing written.`);
  process.exit(1);
}

const envPath = ".env.local";
let env = readFileSync(envPath, "utf8");
const esc = key.private_key.replace(/\r/g, "").replace(/\n/g, "\\n");
const upsert = (name, value) => {
  const line = `${name}="${value}"`;
  const re = new RegExp(`^${name}=.*$`, "m");
  if (re.test(env)) env = env.replace(re, line);
  else env += `\n# Service-account auth (installed ${new Date().toISOString().slice(0, 10)} by install-firebase-key.mjs; replaces gcloud ADC)\n${line}\n`;
  return line.length;
};
upsert("FIREBASE_CLIENT_EMAIL", key.client_email);
upsert("FIREBASE_PRIVATE_KEY", esc);
writeFileSync(envPath, env);
console.log(`Wrote FIREBASE_CLIENT_EMAIL (${key.client_email}) and FIREBASE_PRIVATE_KEY to .env.local`);

console.log("Verifying cert auth against Firestore ...");
initializeApp({ credential: cert({ projectId: key.project_id, clientEmail: key.client_email, privateKey: key.private_key }), projectId: key.project_id });
const snap = await getFirestore().collection("leads").limit(1).get();
console.log(`OK — cert auth works (read ${snap.size} doc). ADC is no longer needed for these scripts.`);
console.log(`\nNow DELETE the downloaded key file: ${keyPath}`);
