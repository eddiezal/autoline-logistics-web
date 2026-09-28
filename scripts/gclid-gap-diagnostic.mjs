/**
 * gclid gap diagnostic — decompose "paid (utm_medium=cpc) but no gclid" leads.
 *
 * Why: the qualified-shadow upload can only send leads that carry a Google
 * click id. On 2026-09-28, 87 cpc leads had none. Before fixing capture we
 * need to know WHICH kind of lead is missing it: paid calls (the CallRail
 * webhook never stored gclid), iOS clicks that carry wbraid/gbraid instead of
 * gclid (not captured anywhere), or web forms that lost the cookie.
 *
 * Usage:  node scripts/gclid-gap-diagnostic.mjs [--days 30] [--verbose]
 * Read-only. Prints counts only, no PII.
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
const arg = (n, f) => { const i = argv.indexOf(`--${n}`); return i > -1 && argv[i + 1] ? argv[i + 1] : f; };
const DAYS = Number(arg("days", 30));
const VERBOSE = argv.includes("--verbose");
const since = new Date(Date.now() - DAYS * 864e5);
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const inc = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
const show = (label, m, top = 12) => {
  console.log(`\n  ${label}`);
  [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).forEach(([k, v]) => console.log(`    ${String(v).padStart(4)}  ${k}`));
};

const snap = await db.collection("leads").where("createdAt", ">=", since).get();
let total = 0, cpc = 0, cpcNoGclid = 0;
const bySource = new Map(), gapBySource = new Map(), gapByLocale = new Map(), gapByLanding = new Map(),
  gapByCampaign = new Map(), gapByWeek = new Map(), gapByHourPT = new Map();
const rawSourceKinds = new Map();
let callRawGclid = 0, callRawBraid = 0, callRawNone = 0, callNoRaw = 0;
let formFirstTouchGclid = 0, formNoVisitor = 0, formLandingHasParams = 0;
const gapDocs = [];

for (const d of snap.docs) {
  const x = d.data();
  total++;
  const a = x.attribution ?? {};
  const source = str(x.source) ?? "form";
  inc(bySource, source);
  const isCpc = /^(cpc|ppc|paid)$/i.test(str(a.utmMedium) ?? "");
  if (!isCpc) continue;
  cpc++;
  const gclid = str(a.gclid) ?? str(x.gclid);
  if (gclid) continue;
  cpcNoGclid++;
  gapDocs.push(d.id);
  inc(gapBySource, source);
  inc(gapByLocale, str(a.locale) ?? "?");
  inc(gapByLanding, str(a.landingPath) ?? str(x.callMeta?.landingPage)?.replace(/\?.*$/, "") ?? "?");
  inc(gapByCampaign, str(a.utmCampaign) ?? "?");
  const created = x.createdAt?.toDate?.() ?? null;
  if (created) {
    inc(gapByWeek, created.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }));
    inc(gapByHourPT, created.toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", hour12: false }) + "h");
  }
  if (source === "call") {
    const callId = str(x.callMeta?.callrailId);
    const rawSnap = callId ? await db.collection("callrail_webhook_events").doc(callId).get() : null;
    const raw = rawSnap?.exists ? rawSnap.data()?.raw ?? null : null;
    if (!raw) callNoRaw++;
    else {
      if (str(raw.gclid)) callRawGclid++;
      else if (str(raw.gbraid) || str(raw.wbraid)) callRawBraid++;
      else callRawNone++;
      const lp = [raw.landing_page_url, raw.last_requested_url, x.callMeta?.landingPage].map(str).filter(Boolean).join(" ");
      if (/[?&](gclid|gbraid|wbraid)=/.test(lp)) formLandingHasParams++;
      inc(rawSourceKinds, `${str(raw.source) ?? "?"} · ${str(raw.medium) ?? str(raw.utm_medium) ?? "?"} · gclid:${str(raw.gclid) ? "y" : "n"} · lp:${str(raw.landing_page_url) ? "y" : "n"}`);
      if (VERBOSE) console.log("    raw keys:", Object.keys(raw).filter((k) => /gclid|braid|utm|source|medium|landing|referr|keyword|device/i.test(k)).map((k) => `${k}=${String(raw[k]).slice(0, 40)}`).join(" | "));
    }
  } else {
    if (str(a.firstTouch?.gclid)) formFirstTouchGclid++;
    if (!str(a.visitorId)) formNoVisitor++;
  }
}

console.log(`gclid gap diagnostic — leads since ${since.toISOString().slice(0, 10)} (${DAYS}d), now ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT`);
console.log(`  leads ${total} · paid (utm cpc) ${cpc} · paid WITHOUT gclid ${cpcNoGclid} (${cpc ? Math.round(100 * cpcNoGclid / cpc) : 0}% of paid)`);
show("all leads by source", bySource);
show("GAP by source  (call = CallRail webhook, never stored gclid)", gapBySource);
console.log(`\n  GAP calls, raw CallRail payload:  gclid present ${callRawGclid} · gbraid/wbraid ${callRawBraid} · neither ${callRawNone} · no raw kept ${callNoRaw}`);
console.log(`  GAP calls whose landing URL carried gclid/gbraid/wbraid: ${formLandingHasParams}`);
show("GAP calls by CallRail source · medium · gclid · landing page present", rawSourceKinds);
console.log(`  GAP forms: first-touch gclid present (cookie lost by submit) ${formFirstTouchGclid} · no visitorId ${formNoVisitor}`);
show("GAP by locale", gapByLocale);
show("GAP by campaign (utm_campaign)", gapByCampaign);
show("GAP by landing path", gapByLanding);
show("GAP by day (PT)", gapByWeek, 40);
show("GAP by hour (PT)", gapByHourPT, 24);
if (VERBOSE) console.log("\n  gap doc ids:", gapDocs.join(" "));
console.log(`
Reading guide:
  · GAP calls with raw gclid present  → fix 1 (store gclid from the CallRail payload) recovers these.
  · gbraid/wbraid anywhere            → fix 2 (capture + upload braid ids) recovers these.
  · forms with first-touch gclid      → cookie/URL lost between landing and submit; fix 3 (server-side capture).
  · forms with nothing at all         → the click had no id we can see; enhanced conversions for leads is the only path.`);
