/**
 * Call cross-check — does each CallRail call belong to a PAST record, did it
 * BECOME a record, or did it vanish?
 *
 * Built 2026-08-19 (Eddie). Joins caller phone numbers against both sides of
 * the house:
 *   · call docs      leads/call_<id> (phone, duration, landing page, utm —
 *                    populated since the 8/10 webhook field-name fix)
 *   · web leads      leads (contact.phone)
 *   · CRM records    proabd_webhook_events raw_item.Shipper.Phone_1 (100%
 *                    populated per the 8/19 field census) + Create_Date
 *                    (EASTERN — parsed via scripts/lib/proabd-time.mjs)
 *
 * Classification per call:
 *   EXISTING   a record with this number existed BEFORE the call (>5min prior)
 *              → follow-up / chase call on a known customer
 *   BECAME     no prior record, but one was created within 72h AFTER the call
 *              → the call converted; call-side lead attribution, including
 *                booked fees when that record booked
 *   NO RECORD  neither → non-prospect, wrong number, or a prospect an agent
 *              never logged (read alongside the unlogged-referrals question)
 *
 * Caveats (also printed):
 *   · The CRM mirror covers records TOUCHED since Jul 8 — a dormant customer
 *     from May calling back misreads as NO RECORD. Treat NO-RECORD as an
 *     upper bound on lost calls.
 *   · A caller who books under a different number than they called from
 *     undercounts matches.
 *   · Calls under 60s are reported separately — they are mostly noise
 *     (the conversions definition has used 60s+ since 8/5).
 *
 * READ ONLY. Prints call ids, ABD_Ids, times, durations, campaigns, counts,
 * dollars — NEVER a phone number, name or email.
 *
 * Usage:
 *   node scripts/call-crosscheck.mjs                  # calls since 2026-08-10
 *   node scripts/call-crosscheck.mjs --since 2026-08-10 --window-hours 72
 */
import { config as loadEnv } from "dotenv";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { parseProabdDate } from "./lib/proabd-time.mjs";

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
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const SINCE = new Date(`${arg("since") ?? "2026-08-10"}T00:00:00-07:00`); // phone captured from 8/10 fix
const WINDOW_H = Number(arg("window-hours") ?? 72);
const MIRROR_START = new Date("2026-07-08T00:00:00-07:00");

/** Mirror of src/lib/leads/identity.ts normalizePhoneKey — keep in lockstep. */
function phoneKey(raw) {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits.length === 10 ? digits : null;
}
const fmtPT = (d) => d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const money = (v) => "$" + v.toFixed(0);

console.log(`Call cross-check · calls since ${SINCE.toISOString().slice(0, 10)} · became-record window ${WINDOW_H}h`);
console.log(`CRM mirror coverage: records touched since ${MIRROR_START.toISOString().slice(0, 10)} — NO-RECORD is an upper bound on lost calls.\n`);

/* ---- [1a] calls — sourced from RAW payloads (callrail_webhook_events), not
   the call docs: the 8/19 census showed the payload carries phone, duration,
   first_call/prior_calls, campaign and gclid at full population while the
   call DOCS store null phone / 0 duration (separate handler bug, flagged in
   the output — do not "fix" this script to read the docs again). ---- */
const crSnap = await db.collection("callrail_webhook_events")
  .orderBy("receivedAt", "asc") // camelCase in THIS collection
  .select("callId", "raw.customer_phone_number", "raw.callernum", "raw.duration",
          "raw.start_time", "raw.created_at", "raw.answered", "raw.call_type",
          "raw.first_call", "raw.prior_calls", "raw.campaign", "raw.source",
          "raw.landing_page_url", "raw.gclid", "raw.spam")
  .get();
const calls = [];
for (const doc of crSnap.docs) {
  const d = doc.data();
  const raw = d.raw ?? {};
  const at = raw.start_time ? new Date(raw.start_time) : raw.created_at ? new Date(raw.created_at) : null;
  if (!at || Number.isNaN(at.getTime()) || at < SINCE) continue;
  if (raw.spam === true) continue;
  calls.push({
    id: String(d.callId ?? doc.id).slice(0, 12),
    at,
    key: phoneKey(raw.customer_phone_number) ?? phoneKey(raw.callernum),
    durationSec: Number(raw.duration ?? 0) || 0,
    answered: raw.answered === true || raw.answered === "true" || raw.call_type === "answered",
    firstCall: raw.first_call === true || raw.first_call === "true",
    priorCalls: Number(raw.prior_calls ?? 0) || 0,
    campaign: raw.campaign || null,
    source: raw.source || null,
    landing: (() => { try { return raw.landing_page_url ? new URL(raw.landing_page_url).pathname : null; } catch { return null; } })(),
    gclid: typeof raw.gclid === "string" && raw.gclid ? true : false,
  });
}

/* ---- [1b] web leads by phone ---- */
const leadSnap = await db.collection("leads")
  .where("createdAt", ">=", MIRROR_START).orderBy("createdAt", "asc").limit(8000).get();
const webByPhone = new Map(); // phoneKey -> [{at, leadRef}]
for (const doc of leadSnap.docs) {
  const d = doc.data();
  const at = d.createdAt?.toDate?.();
  if (!at || doc.id.startsWith("call_")) continue;
  const key = phoneKey(d.contact?.phone);
  if (!key) continue;
  if (!webByPhone.has(key)) webByPhone.set(key, []);
  webByPhone.get(key).push({
    at,
    leadRef: d.leadRef ? String(d.leadRef) : doc.id,
    // Resolve to the CRM record when stamped, so clusters on web-lead matches
    // get the full owner/status/activity trail (gap found 2026-08-19: the
    // hottest cluster in the first run was a web-lead match and fell out of
    // the service analysis entirely).
    abdId: d.proabdAbdId ? String(d.proabdAbdId) : null,
  });
}
console.log(`${calls.length} non-spam calls since ${SINCE.toISOString().slice(0, 10)} (raw payloads) · ${calls.filter((c) => !c.key).length} without a parseable caller number · ${webByPhone.size} distinct web-lead phones`);
console.log(`⚠ known separate bug: leads/call_* docs store null phone / 0 duration although the payload has both — the webhook handler mapping needs a look; this script reads the raw payloads and is unaffected.`);

/* ---- [2] CRM records by phone (earliest create per record) ---- */
const evSnap = await db.collection("proabd_webhook_events")
  .where("received_at", ">=", MIRROR_START).orderBy("received_at", "asc")
  .select("received_at", "raw_item.ABD_Id", "raw_item.Shipper.Phone_1", "raw_item.Create_Date",
          "raw_item.Item_Type", "raw_item.Booked_Date", "raw_item.Transport.Deposit", "raw_item.Referrer",
          "raw_item.UserName", "raw_item.Status", "raw_item.Status_Id")
  .get();
const records = new Map(); // ABD_Id -> {key, createdAt, booked, deposit, referrer}
const recordEvents = new Map(); // ABD_Id -> [{at, user, status, statusId}] asc — the CRM-activity trail
for (const doc of evSnap.docs) {
  const data = doc.data();
  const item = data.raw_item ?? {};
  const id = String(item.ABD_Id ?? "");
  if (!id) continue;
  const evAt = data.received_at?.toDate?.();
  if (evAt) {
    if (!recordEvents.has(id)) recordEvents.set(id, []);
    recordEvents.get(id).push({
      at: evAt,
      user: item.UserName ? String(item.UserName) : null,
      status: item.Status ? String(item.Status) : null,
      statusId: String(item.Status_Id ?? ""),
    });
  }
  const key = phoneKey(item.Shipper?.Phone_1);
  const createdAt = item.Create_Date ? parseProabdDate(item.Create_Date) : null;
  const booked = !!(item.Booked_Date && item.Booked_Date !== "0000-00-00 00:00:00") && String(item.Item_Type) === "order";
  const prev = records.get(id) ?? {};
  records.set(id, {
    key: key ?? prev.key ?? null,
    createdAt: createdAt ?? prev.createdAt ?? null,
    booked: booked || prev.booked || false,
    deposit: booked ? Number(item.Transport?.Deposit ?? 0) || 0 : prev.deposit ?? 0,
    referrer: item.Referrer ?? prev.referrer ?? null,
  });
}
const byPhone = new Map(); // phoneKey -> [{abdId, createdAt, booked, deposit, referrer}]
for (const [abdId, r] of records) {
  if (!r.key || !r.createdAt) continue;
  if (!byPhone.has(r.key)) byPhone.set(r.key, []);
  byPhone.get(r.key).push({ abdId, ...r });
}
console.log(`${evSnap.size} webhook events → ${records.size} records · ${byPhone.size} distinct CRM phones\n`);

/* ---- [3] classify each call ---- */
const GRACE_MS = 5 * 60_000;
const results = [];
for (const c of calls) {
  if (!c.key) { results.push({ ...c, cls: "UNPARSEABLE" }); continue; }
  const crm = byPhone.get(c.key) ?? [];
  const web = webByPhone.get(c.key) ?? [];
  const prior = [...crm.filter((r) => r.createdAt.getTime() < c.at.getTime() - GRACE_MS),
                 ...web.filter((w) => w.at.getTime() < c.at.getTime() - GRACE_MS)
                       .map((w) => ({ abdId: w.abdId ?? `web:${w.leadRef}`, createdAt: w.at }))];
  const after = crm.filter((r) => {
    const dt = r.createdAt.getTime() - c.at.getTime();
    return dt >= -GRACE_MS && dt <= WINDOW_H * 3600_000;
  });
  if (prior.length) {
    // MOST RECENT prior record wins: a caller with an old delivered order and a
    // fresh active one is calling about the fresh one.
    const latest = prior.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    const ageDays = (c.at - latest.createdAt) / 864e5;
    results.push({ ...c, cls: "EXISTING", ref: latest.abdId, ageDays });
  } else if (after.length) {
    const first = after.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
    const lagH = (first.createdAt - c.at) / 3600_000;
    results.push({ ...c, cls: "BECAME", ref: first.abdId, lagH, booked: first.booked, deposit: first.deposit, referrer: first.referrer });
  } else {
    results.push({ ...c, cls: "NO RECORD" });
  }
}

/* ---- [4] report ---- */
const hr = () => console.log("=".repeat(100));
const real = results.filter((r) => r.durationSec >= 60);
const short = results.filter((r) => r.durationSec < 60);
const count = (arr, cls) => arr.filter((r) => r.cls === cls).length;

hr();
console.log(`[1] SUMMARY — calls ≥60s (the conversions definition) vs <60s`);
hr();
for (const [label, arr] of [["≥60s", real], ["<60s", short]]) {
  const n = arr.length;
  console.log(`  ${label.padEnd(6)} ${String(n).padStart(4)} calls · EXISTING ${count(arr, "EXISTING")} · BECAME ${count(arr, "BECAME")} · NO RECORD ${count(arr, "NO RECORD")} · unparseable ${count(arr, "UNPARSEABLE")}`);
}
const becameReal = real.filter((r) => r.cls === "BECAME");
const bookedCalls = becameReal.filter((r) => r.booked);
console.log(`\n  ≥60s call → new record rate: ${real.length ? ((100 * becameReal.length) / real.length).toFixed(1) + "%" : "—"}`);
console.log(`  call-born records booked: ${bookedCalls.length} · fees ${money(bookedCalls.reduce((s, r) => s + (r.deposit ?? 0), 0))} — this is the call revenue that was invisible to the click join`);

hr();
console.log(`[2] EVERY ≥60s CALL (no phone numbers printed — call id · time PT · duration · class · record · detail)`);
hr();
for (const r of real.sort((a, b) => a.at - b.at)) {
  const detail =
    r.cls === "EXISTING" ? `record ${r.ref} · ${r.ageDays.toFixed(1)}d old at call time` :
    r.cls === "BECAME" ? `→ ABD ${r.ref} after ${r.lagH.toFixed(1)}h${r.booked ? ` · BOOKED ${money(r.deposit)}` : ""}${r.referrer ? ` · referrer "${r.referrer}"` : ""}` :
    r.cls === "NO RECORD" ? "no record before or after" : "caller number unparseable";
  const cr = `${r.firstCall ? "1st call" : `repeat(${r.priorCalls})`}${r.campaign ? ` · ${r.campaign}` : r.source ? ` · ${r.source}` : ""}`;
  console.log(`  ${r.id.padEnd(13)} ${fmtPT(r.at)} ${String(r.durationSec + "s").padStart(6)}  ${r.cls.padEnd(10)} ${cr.padEnd(30)} ${detail}`);
}
// Cross-validation: CallRail's own first_call flag vs our CRM/lead match.
const xNew = real.filter((r) => r.firstCall && r.cls === "EXISTING").length;
const xRep = real.filter((r) => !r.firstCall && r.cls === "BECAME").length;
console.log(`\n  cross-check vs CallRail's own tracking: ${xNew} marked first-call but matched an EXISTING record`);
console.log(`  (they know us from another channel) · ${xRep} marked repeat-caller yet only BECAME a record now`);
console.log(`  (earlier calls never got logged — direct evidence for the unlogged-leads question).`);

const noRec = real.filter((r) => r.cls === "NO RECORD");
if (noRec.length) {
  hr();
  console.log(`[3] ≥60s CALLS WITH NO RECORD — a minute-plus conversation that left no trace in the CRM.`);
  console.log(`    Some are vendors/wrong numbers; some are prospects nobody logged. Worth spot-listening`);
  console.log(`    in CallRail (ids above) before the agent conversation about unlogged referrals.`);
  hr();
  const byCampaign = new Map();
  for (const r of noRec) byCampaign.set(r.campaign ?? "(untracked)", (byCampaign.get(r.campaign ?? "(untracked)") ?? 0) + 1);
  console.log(`  by campaign: ${[...byCampaign.entries()].map(([k, v]) => `${k}: ${v}`).join(" · ")}`);
}

/* ---- [4] SERVICE ANALYSIS — clusters, chase proxy, response rate, load ----
 * Definitions here are PROVISIONAL (2026-08-19 review): eyeball the output on
 * real clusters, then freeze thresholds as a preregistered definition BEFORE
 * anything renders on the dashboard. Two honest proxies, named as such:
 *   OWNER  = dominant change-author on the record's webhook events. NOT the
 *            assigned agent (that field needs a Brian/vendor ask — batched).
 *   TOUCH  = any CRM activity (webhook event) on the record. NOT "contact":
 *            an agent who calls back but logs nothing looks untouched here —
 *            which is itself a problem worth seeing, but name it honestly. */
hr();
console.log(`[4] SERVICE ANALYSIS (provisional definitions — inspect before freezing)`);
hr();
const CHASE_WINDOW_H = 24;
const existing = results.filter((r) => r.cls === "EXISTING" && r.ref && !String(r.ref).startsWith("web:"));
const byRecord = new Map();
for (const r of existing) {
  if (!byRecord.has(r.ref)) byRecord.set(r.ref, []);
  byRecord.get(r.ref).push(r);
}

const ownerOf = (abdId) => {
  const evs = recordEvents.get(String(abdId)) ?? [];
  const tally = new Map();
  for (const e of evs) if (e.user) tally.set(e.user, (tally.get(e.user) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "(unknown)";
};
const latestStatus = (abdId) => {
  const evs = recordEvents.get(String(abdId)) ?? [];
  return evs.length ? evs[evs.length - 1] : null;
};
const lastTouchBefore = (abdId, t) => {
  const evs = recordEvents.get(String(abdId)) ?? [];
  let last = null;
  for (const e of evs) { if (e.at < t) last = e; else break; }
  return last;
};
const activityBetween = (abdId, t1, t2) =>
  (recordEvents.get(String(abdId)) ?? []).some((e) => e.at > t1 && e.at < t2);
const OPEN_EXCLUDE = new Set(["5", "6", "12", "13", "25", "2581", "23"]); // lost + canceled
const fmtGap = (ms) => {
  const h = ms / 3600_000;
  return h < 48 ? `${h.toFixed(0)}h` : `${(h / 24).toFixed(1)}d`;
};

console.log(`\n  ${existing.length} existing-customer calls across ${byRecord.size} records · ${(existing.reduce((s2, r) => s2 + r.durationSec, 0) / 60).toFixed(0)} inbound minutes total\n`);

let clusters = 0, likelyChase = 0;
const perOwner = new Map(); // owner -> {records:Set, calls, minutes, clusters, chase}
console.log(`  CLUSTERS (records with 2+ calls in the window):`);
for (const [ref, rs] of [...byRecord.entries()].sort((a, b) => b[1].length - a[1].length)) {
  rs.sort((a, b) => a.at - b.at);
  const owner = ownerOf(ref);
  const st = latestStatus(ref);
  const open = st ? !OPEN_EXCLUDE.has(st.statusId) : true;
  if (!perOwner.has(owner)) perOwner.set(owner, { records: new Set(), calls: 0, minutes: 0, clusters: 0, chase: 0, secondCallable: 0, secondCalled: 0 });
  const po = perOwner.get(owner);
  po.records.add(ref);
  po.calls += rs.length;
  po.minutes += rs.reduce((s2, r) => s2 + r.durationSec, 0) / 60;

  // second-call-before-response: after the FIRST call, did another call land
  // before the next CRM activity (or with no activity within 7 days)?
  const first = rs[0];
  const evs = recordEvents.get(String(ref)) ?? [];
  const nextAct = evs.find((e) => e.at > first.at);
  po.secondCallable++;
  const nextCall = rs[1];
  if (nextCall && (!nextAct || nextCall.at < nextAct.at)) po.secondCalled++;
  else if (!nextCall && !nextAct) { /* single call, no activity — not counted as repeat */ }

  if (rs.length < 2) continue;
  clusters++;
  po.clusters++;
  // likely-chase (PROVISIONAL): any consecutive pair within CHASE_WINDOW_H with
  // NO CRM activity between, on an open record.
  let chasePair = false;
  for (let i = 1; i < rs.length; i++) {
    const gapH = (rs[i].at - rs[i - 1].at) / 3600_000;
    if (gapH <= CHASE_WINDOW_H && !activityBetween(ref, rs[i - 1].at, rs[i].at)) { chasePair = true; break; }
  }
  if (chasePair && open) { likelyChase++; po.chase++; }

  const touch = lastTouchBefore(ref, rs[0].at);
  const touchStr = touch ? `last CRM activity ${fmtGap(rs[0].at - touch.at)} before first call${touch.user ? ` (${touch.user})` : ""}` : "no prior CRM activity in mirror";
  console.log(`\n  ${String(ref)} · owner* ${owner} · status "${st?.status ?? "?"}"${open ? "" : " (closed)"}`);
  console.log(`    ${rs.length} calls: ${rs.map((r) => `${fmtPT(r.at)} (${r.durationSec}s)`).join(" → ")}`);
  console.log(`    ${touchStr}${chasePair ? (open ? " · ⚠ LIKELY CHASE (calls <24h apart, no CRM activity between)" : " · repeat calls but record closed") : ""}`);
}

const postCxl = [...byRecord.entries()].filter(([ref, rs]) => rs.length >= 2 && latestStatus(ref)?.statusId === "23").length;
console.log(`\n  Repeat clusters: ${clusters} · likely-chase (provisional rule): ${likelyChase} · post-cancellation clusters: ${postCxl} (dispute/confusion signal — feed the 8/24 cancellation-rule discussion)`);

console.log(`\n  PER OWNER* (owner = dominant change-author — assigned-agent field is a pending vendor ask):`);
console.log(`  ${"owner".padEnd(22)}${"records-called".padStart(15)}${"calls".padStart(7)}${"minutes".padStart(9)}${"clusters".padStart(10)}${"chase".padStart(7)}${"2nd-call-before-CRM-activity".padStart(30)}`);
for (const [owner, po] of [...perOwner.entries()].sort((a, b) => b[1].calls - a[1].calls)) {
  const scr = po.secondCallable ? `${po.secondCalled}/${po.secondCallable}` : "—";
  console.log(`  ${owner.slice(0, 21).padEnd(22)}${String(po.records.size).padStart(15)}${String(po.calls).padStart(7)}${po.minutes.toFixed(0).padStart(9)}${String(po.clusters).padStart(10)}${String(po.chase).padStart(7)}${scr.padStart(30)}`);
}
console.log(`  * counts are workload description, NOT quality ranking — no caseload denominator yet`);
console.log(`    (active-records-per-agent needs the assigned-agent field; rates stay unpublished until then).`);

console.log(`\n  CALLS BY RECORD STATUS (why customers call — systemic-gap detector):`);
const byStatus = new Map();
for (const r of existing) {
  const st = latestStatus(r.ref);
  const k = st?.status ?? "(unknown)";
  byStatus.set(k, (byStatus.get(k) ?? 0) + 1);
}
for (const [k, v] of [...byStatus.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(30)} ${v}`);
}
console.log(`  If one stage dominates, that's a communication-gap finding, not an agent finding.`);

console.log(`\nCaveats: mirror covers records touched since Jul 8 only (older dormant customers read as`);
console.log(`NO RECORD) · caller using a different number than the record undercounts matches · calls`);
console.log(`before 8/10 have no phone in the payload and are excluded by construction.`);
