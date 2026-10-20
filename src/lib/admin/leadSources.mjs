/**
 * Lead Sources — SHARED pure computation (2026-10-20).
 *
 * The /admin Overview: every lead source on the same row, same cohort rule,
 * same fee definition. Spec: claude/lead-sources-page-spec-2026-10-20.md.
 * Curve: claude/booking-delay-curve-2026-10-20.md → booking-curve.json.
 *
 * Cohorts are LEAD-CREATED months (PT). A booking counts in the month its
 * lead arrived, whatever date it books. An open month shows bookings so far
 * plus an 80% range for the eventual count from each source's own
 * reporting curve; fees are never projected.
 *
 * Pure: no I/O, no env. Importable from Next (allowJs) and plain node.
 * Live wrapper: src/lib/admin/leadSourcesLive.ts.
 */

const DAY = 864e5;
const PT = "America/Los_Angeles";
export const CANCELED_STATUS_ID = "23";
export const WEBSITE_REFS = new Set(["8", "18493"]);
export const S5_CAMPAIGN_ID = "24034984545";
export const GOOGLE_MONTHLY_CAP = 10_000;
/** A cohort is settled (rates + colors allowed) at this reported share. */
export const SETTLED_AT = 0.95;
/** Days into a month before any projection is shown. */
export const TOO_EARLY_DAYS = 3;
/** Earliest month with usable data (CRM mirror starts Jul 8; ads relaunch Jul 20). */
export const FIRST_MONTH = "2026-07";
export const KNOWN_TEST_ABD = new Set(["37256124", "37257079", "37257179", "37257192", "37287629", "37287650", "37362879"]);
const DASH_TEST_MARKERS = [/eddiezal28@gmail\.com/i, /zaldivarlabs\.com/i, /\btest(ing)?\b/i];
const TEST_RE = /\btest(ing|keyword)?\b|\bfake\b|\bdummy\b/i;

/**
 * Source rows. `cost` is per record for vendors; Google's cost comes from
 * the Ads API. `paid` rows go in the main table; the rest in the Free block.
 */
export const SOURCES = {
  google:    { key: "google",    label: "Google Ads",    paid: true,  cost: null, curve: "Website",     avail: "capped at $10K/mo" },
  irelo:     { key: "irelo",     label: "iRelocation",   paid: true,  cost: 4,    curve: "iRelocation", avail: "shared · $4 · ~50/day, more on request" },
  livetr:    { key: "livetr",    label: "LiveTransport", paid: true,  cost: 4,    curve: "iRelocation", avail: "shared · $4 stand-in, rate unverified (Kacy)", unverified: true },
  taylorP:   { key: "taylorP",   label: "Taylor premium", paid: true, cost: 20,   curve: "iRelocation", avail: "exclusive · $20 · off since Aug", history: true },
  taylorS:   { key: "taylorS",   label: "Taylor shared", paid: true,  cost: 6,    curve: "iRelocation", avail: "shared · $6 · off since Aug", history: true },
  organic:   { key: "organic",   label: "Organic search", paid: false, cost: 0,   curve: "Website" },
  referral:  { key: "referral",  label: "Referral",       paid: false, cost: 0,   curve: "Website" },
  direct:    { key: "direct",    label: "Direct / unattributed website", paid: false, cost: 0, curve: "Website" },
  handkeyed: { key: "handkeyed", label: "Hand-keyed",     paid: false, cost: 0,   curve: "Hand-keyed", note: "repeat, walk-in, agent-entered" },
  other:     { key: "other",     label: "Other referrer", paid: false, cost: 0,   curve: "iRelocation", note: "unidentified referrer ids (ask Kacy)" },
};
const REF_TO_SOURCE = { "207": "irelo", "15315": "livetr", "503": "taylorP", "18": "taylorS", "0": "handkeyed" };

const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const dig = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const PRICE_PATHS = ["Transport.Total_Price", "Transport.Price", "Total_Price", "Price", "Total_Tariff", "Tariff"];
function pickNum(raw, paths) {
  for (const p of paths) {
    const v = dig(raw, p);
    const n = typeof v === "string" ? Number(v.replace(/[$,]/g, "")) : Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}
export const ptDay = (d) => d.toLocaleDateString("en-CA", { timeZone: PT });
export const ptMonth = (d) => ptDay(d).slice(0, 7);
export const dayStartPT = (dayKey) => new Date(`${dayKey}T00:00:00-07:00`); // DST: PT is -07 until Nov 1 2026, -08 after; 1h error on boundaries is acceptable for cohorts
export function monthKeys(fromKey, toKey) {
  const out = [];
  let [y, m] = fromKey.split("-").map(Number);
  for (;;) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    if (k > toKey) break;
    out.push(k);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
export function weekStart(dayKey) {
  const t = new Date(`${dayKey}T12:00:00Z`);
  const w = (t.getUTCDay() + 6) % 7;
  return new Date(t.getTime() - w * DAY).toISOString().slice(0, 10);
}
/** Ad weekdays (Mon–Fri) remaining in the month after `dayKey`, inclusive of today if a weekday. */
export function adWeekdaysLeft(dayKey) {
  const [y, m] = dayKey.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let n = 0;
  for (let d = Number(dayKey.slice(8)); d <= last; d++) {
    const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (w >= 1 && w <= 5) n++;
  }
  return n;
}

/* ---------------- Reduction ---------------- */

/**
 * Fold webhook events (any order) into one record per ABD id.
 * events: [{ receivedAt: Date|null, entityId, raw }]; raw carries Create_Date /
 * Booked_Date already parsed by the caller into `created` / `bookedAt` Dates
 * (ProABD naive timestamps are Eastern: scripts/lib/proabd-time.mjs).
 */
export function reduceRecords(events) {
  const rec = new Map();
  const sorted = [...events].sort((a, b) => (a.receivedAt?.getTime?.() ?? 0) - (b.receivedAt?.getTime?.() ?? 0));
  for (const e of sorted) {
    const raw = e.raw ?? {};
    const abd = str(e.entityId) || str(raw.ABD_Id);
    if (!abd || KNOWN_TEST_ABD.has(abd)) continue;
    let r = rec.get(abd);
    if (!r) { r = { abd, ref: "", created: null, bookedAt: null, firstOrderSeen: null, pricedAt: null, statusId: "", deposit: 0, test: false }; rec.set(abd, r); }
    const rid = str(raw.Referrer_Id); if (!r.ref && rid) r.ref = rid;
    if (e.created && (!r.created || e.created < r.created)) r.created = e.created;
    if (e.bookedAt && (!r.bookedAt || e.bookedAt < r.bookedAt)) r.bookedAt = e.bookedAt;
    const isOrder = str(raw.Item_Type).toLowerCase() === "order" || !!str(raw.Booked_Date);
    if (isOrder && e.receivedAt && !r.firstOrderSeen) r.firstOrderSeen = e.receivedAt;
    if (!r.pricedAt && e.receivedAt && pickNum(raw, PRICE_PATHS) != null) r.pricedAt = e.receivedAt;
    const sid = str(raw.Status_Id); if (sid) r.statusId = sid;           // latest wins (sorted)
    const dep = Number(dig(raw, "Transport.Deposit") ?? raw.Deposit ?? 0); if (Number.isFinite(dep) && dep > 0) r.deposit = dep;
    const hay = `${str(raw.Shipper?.Email)} ${str(raw.Shipper?.First_Name)} ${str(raw.Shipper?.Last_Name)}`;
    if (TEST_RE.test(hay)) r.test = true;
  }
  for (const r of rec.values()) {
    r.booked = !!(r.bookedAt ?? r.firstOrderSeen);
    r.bookedAtEff = r.bookedAt ?? r.firstOrderSeen;
    r.canceled = r.statusId === CANCELED_STATUS_ID;
  }
  return rec;
}

/** Normalize a Firestore lead doc. */
export function toLead(d) {
  const at = d?.createdAt?.toDate?.() ?? (d?.submittedAt ? new Date(d.submittedAt) : null);
  if (!at || Number.isNaN(at.getTime())) return null;
  const a = d.attribution ?? {};
  const src = str(a.utmSource).toLowerCase(), med = str(a.utmMedium).toLowerCase();
  const gclid = !!str(a.gclid ?? d.gclid);
  const paid = (src === "google" && (med === "cpc" || med === "ppc" || med === "paid")) || gclid;
  const ref = str(a.referrer).toLowerCase();
  const bucket = paid ? "google" : src ? "referral" : /google\.|bing\.|duckduckgo\.|yahoo\./.test(ref) ? "organic" : "direct";
  const hay = [d.contact?.email, `${d.contact?.firstName ?? ""} ${d.contact?.lastName ?? ""}`, d.contact?.notes, a.utmSource, a.utmTerm, a.utmCampaign, d.leadRef].filter(Boolean).join(" | ");
  return {
    at,
    abd: d.proabdAbdId != null ? str(d.proabdAbdId) : "",
    isCall: str(d.leadRef).startsWith("CALL") || d.source === "call",
    bucket,
    campaignId: paid ? (str(a.utmCampaign) || "?") : null,
    test: DASH_TEST_MARKERS.some((re) => re.test(hay)) || TEST_RE.test(hay),
  };
}

/* ---------------- Curve ---------------- */

/** Step-function reported share at `ageDays` for a curve entry {buckets, cum}. Beyond the last bucket: 1 once past seasonDays, else last value. */
export function reportedAt(curveSrc, buckets, ageDays, seasonDays) {
  if (!curveSrc) return null;
  if (ageDays >= seasonDays) return 1;
  let v = 0;
  for (let i = 0; i < buckets.length; i++) if (ageDays >= buckets[i]) v = curveSrc.cum[i]; else break;
  // Below the first bucket (age < 1 day): scale the same-day share by hours elapsed, so a lead minutes old counts ~0.
  if (ageDays < 1) v = curveSrc.cum[0] * Math.min(1, ageDays);
  return v;
}

/**
 * 80% range for eventual bookings given booked-so-far, reported share s, and
 * the curve's booking count n (for the share's own uncertainty).
 * Poisson on the unreported remainder, share uncertainty via Wilson-ish sd.
 */
export function eventualRange(booked, s, nCurve) {
  if (s == null || s <= 0) return null;
  const z = 1.2816;
  const sd = nCurve ? Math.sqrt(Math.max(s * (1 - s), 0.0025) / nCurve) : 0;
  const sLo = Math.min(0.999, s + z * sd), sHi = Math.max(0.05, s - z * sd);
  const exp = booked / s;
  const rem = Math.max(0, exp - booked);
  const lo = Math.max(booked, Math.round(booked / sLo - z * Math.sqrt(rem)));
  const hi = Math.max(lo, Math.round(booked / sHi + z * Math.sqrt(rem)));
  return { expected: exp, lo, hi };
}

/* ---------------- Build ---------------- */

/**
 * records:  Map from reduceRecords
 * leads:    toLead[] (nulls removed)
 * spend:    Map<`${day}|${campaignId}`, $> (Google Ads) | null
 * campaignNames: Map<id, name>
 * curve:    booking-curve.json
 * now:      Date
 */
export function buildLeadSources({ records, leads, spend, campaignNames, curve, now }) {
  const todayKey = ptDay(now);
  const thisMonth = todayKey.slice(0, 7);
  const months = monthKeys(FIRST_MONTH, thisMonth);
  const leadByAbd = new Map();
  for (const l of leads) if (l.abd && !l.test) leadByAbd.set(l.abd, l);

  // Source of a CRM record.
  const sourceOf = (r) => {
    if (WEBSITE_REFS.has(r.ref)) {
      const l = leadByAbd.get(r.abd);
      if (!l) return { key: "direct", campaignId: null };
      return { key: l.bucket === "google" ? "google" : l.bucket, campaignId: l.campaignId };
    }
    const k = REF_TO_SOURCE[r.ref];
    return { key: k ?? "other", campaignId: null };
  };

  // Rows: month → sourceKey → agg; Google campaigns: month → campaignId → agg.
  const blank = (key) => ({ key, leads: 0, calls: 0, priced: 0, booked: 0, canceled: 0, feeGross: 0, feeNet: 0, cost: 0, ages: [], bookedByWeek: new Map() });
  const table = new Map();
  const rowFor = (month, key) => {
    let m = table.get(month); if (!m) table.set(month, (m = new Map()));
    let r = m.get(key); if (!r) m.set(key, (r = blank(key)));
    return r;
  };
  const campaigns = new Map(); // `${month}|${campaignId}` → agg

  for (const r of records.values()) {
    if (r.test || !r.created) continue;
    const month = ptMonth(r.created);
    if (month < FIRST_MONTH || month > thisMonth) continue;
    const { key, campaignId } = sourceOf(r);
    const src = SOURCES[key];
    const row = rowFor(month, key);
    row.leads++;
    if (src.cost) row.cost += src.cost;
    if (r.pricedAt) row.priced++;
    row.ages.push((now.getTime() - r.created.getTime()) / DAY);
    if (r.booked) {
      row.booked++;
      if (r.canceled) row.canceled++;
      row.feeGross += r.deposit;
      if (!r.canceled) row.feeNet += r.deposit;
    }
    if (key === "google") {
      const ck = `${month}|${campaignId ?? "?"}`;
      let c = campaigns.get(ck); if (!c) campaigns.set(ck, (c = { ...blank(campaignId ?? "?"), month, campaignId: campaignId ?? "?" }));
      c.leads++; if (r.pricedAt) c.priced++;
      if (r.booked) { c.booked++; if (r.canceled) c.canceled++; c.feeGross += r.deposit; if (!r.canceled) c.feeNet += r.deposit; }
    }
  }
  // Google-attributed tracked calls: leads, not CRM records (no ABD id). Count toward Google's lead total.
  for (const l of leads) {
    if (l.test || !l.isCall || l.bucket !== "google") continue;
    const month = ptMonth(l.at);
    if (month < FIRST_MONTH || month > thisMonth) continue;
    const row = rowFor(month, "google");
    row.leads++; row.calls++;
    row.ages.push((now.getTime() - l.at.getTime()) / DAY);
  }
  // Google spend by month and campaign.
  if (spend) {
    for (const [k, v] of spend) {
      const [day, id] = k.split("|");
      const month = day.slice(0, 7);
      if (month < FIRST_MONTH || month > thisMonth) continue;
      rowFor(month, "google").cost += v;
      const ck = `${month}|${id}`;
      let c = campaigns.get(ck); if (!c) campaigns.set(ck, (c = { ...blank(id), month, campaignId: id }));
      c.cost += v;
    }
  }

  // Finish rows: reported share, range, money.
  const daysIntoMonth = (month) => month === thisMonth ? Number(todayKey.slice(8)) : 31;
  const finish = (row, month, curveName) => {
    const cv = curve.sources[curveName];
    const sList = row.ages.map((a) => reportedAt(cv, curve.buckets, a, curve.seasonDays) ?? 1);
    const reported = sList.length ? sList.reduce((a, b) => a + b, 0) / sList.length : 1;
    const tooEarly = month === thisMonth && daysIntoMonth(month) <= TOO_EARLY_DAYS;
    const settled = reported >= SETTLED_AT;
    const range = settled || tooEarly ? null : eventualRange(row.booked, reported, cv?.booked ?? 0);
    const hasCost = row.cost > 0;
    return {
      ...row, ages: undefined,
      reported, settled, tooEarly,
      range,
      costPerLead: row.leads ? row.cost / row.leads : null,
      closeRate: settled && row.leads ? row.booked / row.leads : null,
      feeMinusSpend: hasCost || row.cost === 0 ? row.feeNet - row.cost : null,
      recoveredPerDollar: hasCost ? row.feeNet / row.cost : null,
      breakEvenCpl: row.leads ? row.feeNet / row.leads : null,
      costPerBooking: hasCost && row.booked - row.canceled > 0 ? row.cost / (row.booked - row.canceled) : null,
    };
  };

  const byMonth = {};
  for (const month of months) {
    const m = table.get(month) ?? new Map();
    const rows = {};
    for (const [key, src] of Object.entries(SOURCES)) {
      const row = m.get(key);
      if (!row) continue;
      rows[key] = finish(row, month, src.curve);
    }
    const paidKeys = Object.keys(rows).filter((k) => SOURCES[k].paid);
    const sum = (keys, f) => keys.reduce((s, k) => s + (f(rows[k]) ?? 0), 0);
    const paidLeads = sum(paidKeys, (r) => r.leads);
    const allPaid = {
      leads: paidLeads,
      cost: sum(paidKeys, (r) => r.cost),
      booked: sum(paidKeys, (r) => r.booked),
      canceled: sum(paidKeys, (r) => r.canceled),
      feeNet: sum(paidKeys, (r) => r.feeNet),
      reported: paidLeads ? sum(paidKeys, (r) => r.reported * r.leads) / paidLeads : 1,
      lo: sum(paidKeys, (r) => r.range ? r.range.lo : r.booked),
      hi: sum(paidKeys, (r) => r.range ? r.range.hi : r.booked),
    };
    allPaid.feeMinusSpend = allPaid.feeNet - allPaid.cost;
    allPaid.recoveredPerDollar = allPaid.cost ? allPaid.feeNet / allPaid.cost : null;
    allPaid.settled = allPaid.reported >= SETTLED_AT;
    const freeKeys = Object.keys(rows).filter((k) => !SOURCES[k].paid);
    const free = { leads: sum(freeKeys, (r) => r.leads), booked: sum(freeKeys, (r) => r.booked), feeNet: sum(freeKeys, (r) => r.feeNet) };
    byMonth[month] = {
      month, open: month === thisMonth, daysIn: daysIntoMonth(month), rows, allPaid, free,
      campaigns: [...campaigns.values()].filter((c) => c.month === month).map((c) => ({
        ...c, ages: undefined, name: campaignNames?.get(c.campaignId) ?? c.campaignId,
        costPerLead: c.leads ? c.cost / c.leads : null, pricedShare: c.leads ? c.priced / c.leads : null,
        costPerPriced: c.priced ? c.cost / c.priced : null, feeMinusSpend: c.feeNet - c.cost,
        recoveredPerDollar: c.cost ? c.feeNet / c.cost : null,
      })).sort((a, b) => b.cost - a.cost),
    };
  }

  // Weekly bookings by lead-created week (last 8 weeks), by source group.
  const wkFrom = new Date(new Date(`${weekStart(todayKey)}T12:00:00Z`).getTime() - 7 * 7 * DAY).toISOString().slice(0, 10);
  const weeks = new Map();
  for (const r of records.values()) {
    if (r.test || !r.created || !r.booked) continue;
    const dk = ptDay(r.created);
    if (dk < wkFrom) continue;
    const wk = weekStart(dk);
    const { key } = sourceOf(r);
    const g = SOURCES[key].paid ? key : "free";
    let w = weeks.get(wk); if (!w) weeks.set(wk, (w = { week: wk, partial: wk === weekStart(todayKey), by: {} }));
    w.by[g] = (w.by[g] ?? 0) + 1;
  }
  const weekly = [];
  for (let t = new Date(`${wkFrom}T12:00:00Z`).getTime(); ; t += 7 * DAY) {
    const wk = new Date(t).toISOString().slice(0, 10);
    if (wk > todayKey) break;
    weekly.push(weeks.get(wk) ?? { week: wk, partial: wk === weekStart(todayKey), by: {} });
  }

  // Google pacing this month.
  const g = byMonth[thisMonth]?.rows.google;
  const spentToDate = g?.cost ?? 0;
  const weekdaysLeft = adWeekdaysLeft(todayKey);
  const weekdaysElapsed = (() => { let n = 0; const [y, m] = todayKey.split("-").map(Number); for (let d = 1; d < Number(todayKey.slice(8)); d++) { const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); if (w >= 1 && w <= 5) n++; } return n; })();
  const dailyPace = weekdaysElapsed ? spentToDate / weekdaysElapsed : 0;
  const google = {
    spentToDate, cap: GOOGLE_MONTHLY_CAP, weekdaysLeft,
    projected: spentToDate + dailyPace * weekdaysLeft,
    holdDaily: weekdaysLeft ? Math.max(0, (GOOGLE_MONTHLY_CAP - spentToDate) / weekdaysLeft) : null,
  };

  return { todayKey, thisMonth, months, byMonth, weekly, google, curve: { measuredAt: curve.measuredAt, seasonDays: curve.seasonDays, buckets: curve.buckets, sources: curve.sources } };
}
