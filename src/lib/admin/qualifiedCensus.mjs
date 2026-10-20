/**
 * Qualified-lead census — SHARED pure computation (2026-10-20).
 *
 * Powers the /admin "Qualified leads (what S5 bids on)" panel. Since the
 * Oct 19 switch, S5's bidding goal is "Qualified lead (priced)": the FIRST
 * webhook event carrying a Transport price for a WEBSITE ProABD record,
 * uploaded nightly by scripts/upload-qualified-shadow.mjs. The dashboard's
 * older "priced form" means the website's instant estimate, which is a
 * different thing. This module is the agent-priced number.
 *
 * PARITY: the record reduction below (WEBSITE refs, KNOWN_TEST_ABD,
 * PRICE_PATHS, first-priced-event rule, shadowValue) mirrors
 * scripts/upload-qualified-shadow.mjs line for line. The script was left
 * untouched on purpose (it feeds live bidding since Oct 19). When it is
 * next edited, switch it to import from here so the two cannot drift.
 *
 * Pure: no I/O, no env. Importable from Next (allowJs) and plain node.
 */

import { bucketLead, CANCELED_STATUS_ID, MATURITY_DAYS } from "./revenueByCampaign.mjs";

export const QUALIFIED_ACTION_NAME = "Qualified lead (priced)";
/** Weekly trend depth (Mon-Sun weeks, PT). */
export const TREND_WEEKS = 8;
/** Daily table depth (expanded view). */
export const DAILY_DAYS = 14;
export { MATURITY_DAYS };
export const S5_CAMPAIGN_ID = "24034984545";
/** S5 switched to bidding on priced leads (ledger 2026-10-16, $36 target). */
export const SWITCH_DAY = "2026-10-19";
export const S5_TARGET_CPA = 36;
/** Priced ÷ forms assumption behind the form→priced target translation. */
export const ASSUMED_QUALIFIED_RATE = 0.92;
/** Guardrail: < this many S5 priced leads per serving day, 3 serving days running → raise target to $40. */
export const GUARDRAIL_MIN_PRICED_PER_DAY = 5;
export const GUARDRAIL_RUN_DAYS = 3;
/** Nightly upload looks back this many days (workflow default). */
export const UPLOAD_WINDOW_DAYS = 3;
/** First-priced detection reads this far before the window (script parity). */
export const FIRST_PRICED_LOOKBACK_DAYS = 45;

export const WEBSITE_REFS = new Set(["8", "18493"]);
export const KNOWN_TEST_ABD = new Set(["37256124", "37257079", "37257179", "37257192", "37287629", "37287650", "37362879"]);
const SCRIPT_TEST_RE = /test|zaldivar|example\.com|\bfake\b|\bdummy\b/i;
/** Dashboard test markers (src/app/admin/page.tsx TEST_MARKERS). */
const DASH_TEST_MARKERS = [/eddiezal28@gmail\.com/i, /zaldivarlabs\.com/i, /\btest(ing)?\b/i];
export const PRICE_PATHS = ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price", "Total_Tariff", "Tariff"];
export const DEPOSIT_PATHS = ["Transport.Deposit", "Deposit"];

const DAY = 864e5;
const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const dig = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
function pickNum(raw, paths) {
  for (const p of paths) {
    const v = dig(raw, p);
    const n = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** YYYY-MM-DD in Pacific (account timezone). */
export const ptDay = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
/** Day of week for a YYYY-MM-DD key (0 = Sunday). Noon UTC avoids DST edges. */
export const dow = (dayKey) => new Date(`${dayKey}T12:00:00Z`).getUTCDay();
export const isWeekend = (dayKey) => { const w = dow(dayKey); return w === 0 || w === 6; };
/** Inclusive list of YYYY-MM-DD keys from `fromKey` to `toKey`. */
export function dayKeys(fromKey, toKey) {
  const out = [];
  for (let t = new Date(`${fromKey}T12:00:00Z`).getTime(); ; t += DAY) {
    const k = new Date(t).toISOString().slice(0, 10);
    if (k > toKey) break;
    out.push(k);
  }
  return out;
}

/** Monday (PT week start) for a YYYY-MM-DD key. */
export function weekStart(dayKey) {
  const t = new Date(`${dayKey}T12:00:00Z`);
  const w = (t.getUTCDay() + 6) % 7; // Mon=0
  return new Date(t.getTime() - w * DAY).toISOString().slice(0, 10);
}

export const shadowValue = (deposit, price) =>
  deposit != null ? Math.round(deposit) : Math.round(Math.min(400, 150 + 0.09 * (price ?? 0)));

/**
 * Fold webhook events into one record per ABD id with its FIRST priced event.
 * events: [{ receivedAt: Date|null, entityId, raw }] in ANY order (sorted here).
 * Returns Map<abd, { abd, ref, pricedAt: Date|null, price, deposit }>.
 */
export function reducePricedRecords(events) {
  const rec = new Map();
  const sorted = [...events].sort((a, b) => (a.receivedAt?.getTime?.() ?? 0) - (b.receivedAt?.getTime?.() ?? 0));
  for (const e of sorted) {
    const raw = e.raw ?? {};
    const abd = str(e.entityId) || str(raw.ABD_Id);
    if (!abd || KNOWN_TEST_ABD.has(abd)) continue;
    let r = rec.get(abd);
    if (!r) { r = { abd, ref: "", pricedAt: null, price: null, deposit: null }; rec.set(abd, r); }
    const rid = str(raw.Referrer_Id);
    if (!r.ref && rid) r.ref = rid;
    const px = pickNum(raw, PRICE_PATHS);
    if (!r.pricedAt && px != null && e.receivedAt) {
      r.pricedAt = e.receivedAt; r.price = px; r.deposit = pickNum(raw, DEPOSIT_PATHS);
    }
  }
  return rec;
}

/**
 * Normalize a Firestore lead doc into what the panel needs. Returns null for
 * docs with no timestamp. Two test flags because the upload script and the
 * dashboard define "test" differently; each count uses its own owner's rule.
 */
export function toLeadLite(d) {
  const at = d?.createdAt?.toDate?.() ?? (d?.submittedAt ? new Date(d.submittedAt) : null);
  if (!at || Number.isNaN(at.getTime())) return null;
  const a = d.attribution ?? {};
  const src = str(a.utmSource).toLowerCase();
  const med = str(a.utmMedium).toLowerCase();
  const paid = src === "google" && (med === "cpc" || med === "ppc" || med === "paid");
  const gclid = str(a.gclid ?? d.gclid);
  const hay = [d.contact?.email, `${d.contact?.firstName ?? ""} ${d.contact?.lastName ?? ""}`, d.contact?.notes]
    .filter(Boolean).join(" | ");
  const { bucket } = bucketLead(a);
  return {
    at,
    bucket,
    abd: d.proabdAbdId != null ? str(d.proabdAbdId) : "",
    isCall: str(d.leadRef).startsWith("CALL") || d.source === "call",
    campaignId: paid ? (str(a.utmCampaign) || null) : null,
    paid,
    gclid,
    scriptTest: SCRIPT_TEST_RE.test(str(d.email)) || SCRIPT_TEST_RE.test(str(a.utmSource)),
    dashTest: DASH_TEST_MARKERS.some((re) => re.test(hay)),
  };
}

/**
 * Build the panel.
 *   records:   Map from reducePricedRecords
 *   leads:     toLeadLite[] (nulls removed)
 *   spend:     { byDay: Map<day, $>, byDayCampaign: Map<`${day}|${campaignId}`, $> } | null
 *   google:    Map<`${day}|${campaignId}`, conversions by conversion date> | null
 *   fromDay / toDay: inclusive PT day keys for the table window
 *   todayKey:  PT today (partial day)
 */
export function buildQualifiedPanel({ records, leads, spend, google, state, fromDay, toDay, todayKey, tableDays = DAILY_DAYS }) {
  const days = dayKeys(fromDay, toDay);
  const inWindow = (k) => k >= fromDay && k <= toDay;
  const matureCutoffDay = ptDay(new Date(new Date(`${todayKey}T12:00:00Z`).getTime() - MATURITY_DAYS * DAY));

  // Lead join for gclid + campaign — script semantics (scriptTest drops the join).
  const byAbd = new Map();
  for (const l of leads) if (l.abd && !l.scriptTest) byAbd.set(l.abd, l);

  const blankDay = (day) => ({
    day, weekend: isWeekend(day), partial: day === todayKey,
    qualified: 0, s5: 0, paid: 0, organic: 0, unlinked: 0, uploadable: 0, value: 0,
    spend: null, s5Spend: null, googleAll: null, googleS5: null,
    forms: 0, formsPriced: 0, s5Forms: 0, s5FormsPriced: 0,
  });
  const dayMap = new Map(days.map((d) => [d, blankDay(d)]));
  const camp = new Map(); // campaignKey → { key, qualified, uploadable, spend, google }
  const campRow = (key) => {
    let c = camp.get(key);
    if (!c) camp.set(key, (c = { key, qualified: 0, uploadable: 0, spend: null, google: null }));
    return c;
  };

  // [1] Qualified (agent-priced) by priced day.
  for (const r of records.values()) {
    if (!WEBSITE_REFS.has(r.ref) || !r.pricedAt) continue;
    const k = ptDay(r.pricedAt);
    if (!inWindow(k)) continue;
    const row = dayMap.get(k);
    row.qualified++;
    row.value += shadowValue(r.deposit, r.price);
    const lead = byAbd.get(r.abd);
    let key;
    if (!lead) { row.unlinked++; key = "unlinked"; }
    else if (lead.paid) { row.paid++; key = `ads:${lead.campaignId ?? "?"}`; }
    else if (lead.gclid) { row.paid++; key = "ads-incomplete"; }
    else { row.organic++; key = "organic"; }
    if (lead?.campaignId === S5_CAMPAIGN_ID) row.s5++;
    const c = campRow(key);
    c.qualified++;
    if (lead?.gclid) { row.uploadable++; c.uploadable++; }
  }

  // [2] Qualified rate = priced ÷ forms, by FORM-CREATED day (cohort), dashboard test rule.
  for (const l of leads) {
    if (l.isCall || l.dashTest) continue;
    const k = ptDay(l.at);
    if (!inWindow(k)) continue;
    const row = dayMap.get(k);
    const r = l.abd ? records.get(l.abd) : null;
    const priced = !!(r && r.pricedAt && WEBSITE_REFS.has(r.ref));
    row.forms++; if (priced) row.formsPriced++;
    if (l.campaignId === S5_CAMPAIGN_ID) { row.s5Forms++; if (priced) row.s5FormsPriced++; }
  }

  // [3] Spend + Google-counted qualified conversions.
  if (spend) {
    for (const row of dayMap.values()) {
      row.spend = spend.byDay.get(row.day) ?? 0;
      row.s5Spend = spend.byDayCampaign.get(`${row.day}|${S5_CAMPAIGN_ID}`) ?? 0;
    }
    for (const [k, v] of spend.byDayCampaign) {
      const [day, id] = k.split("|");
      if (!inWindow(day)) continue;
      const c = campRow(`ads:${id}`);
      c.spend = (c.spend ?? 0) + v;
    }
  }
  if (google) {
    for (const row of dayMap.values()) { row.googleAll = 0; row.googleS5 = 0; }
    for (const [k, v] of google) {
      const [day, id] = k.split("|");
      if (!inWindow(day)) continue;
      const row = dayMap.get(day);
      row.googleAll += v;
      if (id === S5_CAMPAIGN_ID) row.googleS5 += v;
      const c = campRow(`ads:${id}`);
      c.google = (c.google ?? 0) + v;
    }
  }

  const allRows = days.map((d) => dayMap.get(d));
  const rows = allRows.slice(-tableDays);
  const sum = (arr, f) => arr.reduce((s, r) => s + (f(r) ?? 0), 0);
  const totals = (arr) => ({
    days: arr.length,
    servingDays: arr.filter((r) => !r.weekend).length,
    qualified: sum(arr, (r) => r.qualified),
    s5: sum(arr, (r) => r.s5),
    uploadable: sum(arr, (r) => r.uploadable),
    spend: spend ? sum(arr, (r) => r.spend) : null,
    s5Spend: spend ? sum(arr, (r) => r.s5Spend) : null,
    googleAll: google ? sum(arr, (r) => r.googleAll) : null,
    googleS5: google ? sum(arr, (r) => r.googleS5) : null,
    forms: sum(arr, (r) => r.forms),
    formsPriced: sum(arr, (r) => r.formsPriced),
    s5Forms: sum(arr, (r) => r.s5Forms),
    s5FormsPriced: sum(arr, (r) => r.s5FormsPriced),
  });
  const withCost = (t) => ({
    ...t,
    blendedCpq: t.spend != null && t.qualified > 0 ? t.spend / t.qualified : null,
    s5Cpq: t.s5Spend != null && t.s5 > 0 ? t.s5Spend / t.s5 : null,
    s5GoogleCpa: t.s5Spend != null && t.googleS5 ? t.s5Spend / t.googleS5 : null,
    rate: t.forms > 0 ? t.formsPriced / t.forms : null,
    s5Rate: t.s5Forms > 0 ? t.s5FormsPriced / t.s5Forms : null,
  });

  // Totals over complete days only (today is partial: pricing + upload still landing).
  const complete = rows.filter((r) => !r.partial);
  const sinceSwitch = complete.filter((r) => r.day >= SWITCH_DAY);

  // Guardrail: trailing serving days with S5 priced < 5.
  const serving = complete.filter((r) => !r.weekend);
  let lowRun = 0;
  for (let i = serving.length - 1; i >= 0 && serving[i].s5 < GUARDRAIL_MIN_PRICED_PER_DAY; i--) lowRun++;

  // Upload health: last 3 complete SERVING days (weekends carry ~no paid
  // leads, so a calendar window would often compare zeros) — census-sent
  // (has a gclid) vs Google-counted by conversion date.
  const uploadDays = serving.slice(-UPLOAD_WINDOW_DAYS);
  const uploadCheck = {
    days: uploadDays.map((r) => r.day),
    expected: sum(uploadDays, (r) => r.uploadable),
    counted: google ? sum(uploadDays, (r) => r.googleAll) : null,
  };

  // [4] Weekly trend (Mon-Sun, PT) over the whole window: form fills → priced.
  const weekMap = new Map();
  for (const r of allRows) {
    const wk = weekStart(r.day);
    let w = weekMap.get(wk);
    if (!w) weekMap.set(wk, (w = { week: wk, partial: false, days: [] }));
    w.days.push(r);
    if (r.partial) w.partial = true;
  }
  const weeks = [...weekMap.values()].map((w) => ({
    week: w.week, partial: w.partial, daysIn: w.days.length,
    ...withCost(totals(w.days.filter((r) => !r.partial))),
  }));

  // [5] Revenue per lead by source — MATURE cohort (created ≥14d ago, Clock B),
  // same rule as revenueByCampaign.mjs so the two sections can't disagree.
  // Fees are booking deposits; net excludes currently-canceled records.
  const src = new Map();
  const srcRow = (key) => {
    let g = src.get(key);
    if (!g) src.set(key, (g = { key, leads: 0, qualified: 0, booked: 0, canceled: 0, feeGross: 0, feeNet: 0, spend: null }));
    return g;
  };
  for (const l of leads) {
    if (l.isCall || l.dashTest) continue;
    const k = ptDay(l.at);
    if (k < fromDay || k > matureCutoffDay) continue;
    const key = l.bucket === "ads" ? `ads:${l.campaignId ?? "?"}` : l.bucket;
    const g = srcRow(key);
    g.leads++;
    const r = l.abd ? records.get(l.abd) : null;
    if (r && r.pricedAt && WEBSITE_REFS.has(r.ref)) g.qualified++;
    const st = state && l.abd ? state.get(l.abd) : null;
    if (st && st.booked) {
      g.booked++;
      const canceled = st.statusId === CANCELED_STATUS_ID;
      if (canceled) g.canceled++;
      g.feeGross += st.deposit;
      if (!canceled) g.feeNet += st.deposit;
    }
  }
  if (spend) {
    for (const [k, v] of spend.byDayCampaign) {
      const [day, id] = k.split("|");
      if (day < fromDay || day > matureCutoffDay) continue;
      const key = `ads:${id}`;
      if (!src.has(key)) continue; // spend with zero leads: shown in the Ads account, not here
      const g = srcRow(key);
      g.spend = (g.spend ?? 0) + v;
    }
  }
  const sources = [...src.values()].sort((a, b) => b.feeNet - a.feeNet || b.leads - a.leads);

  return {
    rows,
    weeks,
    sources,
    matureCutoffDay,
    window: withCost(totals(complete)),
    sinceSwitch: sinceSwitch.length ? withCost(totals(sinceSwitch)) : null,
    campaigns: [...camp.values()].sort((a, b) => b.qualified - a.qualified || (b.spend ?? 0) - (a.spend ?? 0)),
    guardrail: { lowRun, tripped: lowRun >= GUARDRAIL_RUN_DAYS, servingDaysRead: serving.length },
    uploadCheck,
  };
}
