/**
 * Lead Pulse — data layer for the /admin at-a-glance strip + weekly trend.
 * Spec: claude/lead-pulse-dashboard-spec.md (v2, 2026-08-13).
 *
 * TRUTH RULES
 *  - Lead counts come ONLY from Firestore `leads` (first-party truth; GA4
 *    and Ads reporting both failed silently multiple times in Aug 2026).
 *  - Ads spend comes ONLY from the Ads API (fetchAdsCostByDay) and is used
 *    for CPL — never for lead counts.
 *  - Every day/week boundary is computed in America/Los_Angeles explicitly
 *    (the twice-learned PT standing rule; server clocks are UTC).
 *
 * CLASSIFICATION — kept in lockstep with the reporting scripts so this
 * dashboard can never disagree with them:
 *  - internal-test regex  = scripts/cpl.mjs + scripts/behavior-journey.mjs
 *  - call lead            = source "call" or leadRef "CALL-…"
 *  - paid (click-proof)   = attribution.gclid, or a cpc/ppc/paid utm medium
 *                           (a FLOOR — some real paid leads miss click IDs)
 *  - unique lead          = P4 entity via the shared dedupeLeads lib
 *                           (metric-contract §3/§7.1, ratified 7/28);
 *                           entity channel = origin touch's channel, entity
 *                           is paid if ANY touch is click-proof.
 */

import { getAdminDb } from "@/lib/firebase/admin";
import {
  dedupeLeads,
  normalizePhoneKey,
  normalizeEmailKey,
} from "@/lib/leads/identity";

/* ── PT calendar utilities ─────────────────────────────────────────── */

const PT = "America/Los_Angeles";

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: PT,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: PT,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** YYYY-MM-DD in PT. */
export function ptDayKey(d: Date): string {
  return dayFmt.format(d);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type WeekdayShort = (typeof WEEKDAYS)[number];

/** {weekday, minutesOfDay} in PT. */
export function ptClock(d: Date): { weekday: WeekdayShort; minutes: number } {
  const parts = partsFmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24; // "24" at midnight in some ICU builds
  return {
    weekday: (get("weekday") as WeekdayShort) ?? "Sun",
    minutes: hour * 60 + Number(get("minute")),
  };
}

/** The PT Monday (YYYY-MM-DD) of the week containing `d`. */
export function ptMondayKey(d: Date): string {
  const { weekday } = ptClock(d);
  const idx = WEEKDAYS.indexOf(weekday); // Sun=0 … Sat=6
  const daysSinceMonday = (idx + 6) % 7; // Mon=0 … Sun=6
  return ptDayKey(new Date(d.getTime() - daysSinceMonday * 86_400_000));
}

/** "Aug 4" label from a YYYY-MM-DD key. */
export function shortDateLabel(dayKey: string): string {
  const [y, m, dd] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd, 12)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/* ── Classification (mirrors scripts/cpl.mjs) ──────────────────────── */

const INTERNAL = [
  /eddiezal28@gmail\.com/i,
  /@zaldivarlabs\.com/i,
  /@superflosystems\.com/i,
  /\btest(ing)?\b/i,
];
const PAID_MEDIUM = /^(cpc|ppc|paid|paidsearch|paid_search)$/i;

interface LeadDoc {
  createdAt?: { toDate?: () => Date };
  leadRef?: unknown;
  source?: unknown;
  contact?: { firstName?: unknown; lastName?: unknown; email?: unknown; phone?: unknown; notes?: unknown };
  attribution?: { gclid?: unknown; utmMedium?: unknown; utmSource?: unknown };
}

function isInternal(d: LeadDoc): boolean {
  const hay = [
    d.contact?.email,
    `${d.contact?.firstName ?? ""} ${d.contact?.lastName ?? ""}`,
    d.contact?.notes,
  ]
    .filter(Boolean)
    .join(" | ");
  return INTERNAL.some((re) => re.test(String(hay)));
}

function isCall(d: LeadDoc): boolean {
  return d.source === "call" || String(d.leadRef ?? "").startsWith("CALL-");
}

function isPaid(d: LeadDoc): boolean {
  const a = d.attribution ?? {};
  if (a.gclid) return true;
  return typeof a.utmMedium === "string" && PAID_MEDIUM.test(a.utmMedium);
}

/* ── Public result shape ───────────────────────────────────────────── */

export interface PulseCounts {
  blended: number;
  web: number;
  calls: number;
  paid: number;
}

export interface WeekBucket extends PulseCounts {
  /** PT Monday, YYYY-MM-DD. */
  mondayKey: string;
  /** "Aug 4" */
  label: string;
  isCurrent: boolean;
}

export interface LeadPulseData {
  /** PT clock at compute time, e.g. "2:40 PM". */
  asOfPt: string;
  todayWeekday: WeekdayShort;
  today: PulseCounts;
  /** Avg leads by this clock time on the last 4 same-weekdays (1dp). */
  paceBaseline: number;
  /** Avg full-day leads on the last 4 same-weekdays (1dp). */
  fullDayBaseline: number;
  /** null = suppressed (thin baseline or before 8 AM PT). */
  pacePct: number | null;
  /** true when |pacePct| ≤ 15 → render neutral "on pace". */
  paceNeutral: boolean;
  last7: PulseCounts;
  prior7: PulseCounts;
  /** Oldest → today; for the mini day-bars. */
  last7Days: { dayKey: string; blended: number; paid: number }[];
  /** Oldest → current week. Up to 8 complete + the in-progress week. */
  weeks: WeekBucket[];
}

/* ── Compute ───────────────────────────────────────────────────────── */

const FETCH_DAYS = 63; // 8 trend weeks + pace baselines, spec §5

/**
 * Weekly-trend epoch: the PT Monday of the first week the RELAUNCHED ads
 * account served continuously (campaign UTM templates live ~Jul 20–22).
 * Weeks before this mix legacy-account spend with modern lead flow and
 * produce misleading CPL points (a ~$150 legacy week, a fake-cheap
 * transition week), so the trend starts here. The pulse cards (today /
 * last-7) are unaffected — they only look back 4 weeks.
 */
const TREND_EPOCH_MONDAY = "2026-07-20";

export async function computeLeadPulse(now: Date = new Date()): Promise<LeadPulseData> {
  const since = new Date(now.getTime() - FETCH_DAYS * 86_400_000);
  const db = getAdminDb();
  const snap = await db
    .collection("leads")
    .where("createdAt", ">=", since)
    .orderBy("createdAt", "asc")
    .get();

  // Raw touches → P4 unique-lead entities. Entity channel = origin's
  // channel; entity time = origin time; paid if ANY touch is click-proof.
  const touches = snap.docs
    .map((doc) => {
      const d = doc.data() as LeadDoc;
      const t = d.createdAt?.toDate?.();
      if (!t || isInternal(d)) return null;
      return {
        t,
        phoneKey: normalizePhoneKey(d.contact?.phone),
        emailKey: normalizeEmailKey(d.contact?.email),
        call: isCall(d),
        paid: isPaid(d),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const entities = dedupeLeads(touches).map((e) => ({
    t: e.origin.t,
    call: e.origin.call,
    paid: e.touches.some((x) => x.paid),
  }));

  /* Day-indexed counts. */
  const byDay = new Map<string, { blended: number; web: number; calls: number; paid: number; times: number[] }>();
  for (const e of entities) {
    const key = ptDayKey(e.t);
    const row = byDay.get(key) ?? { blended: 0, web: 0, calls: 0, paid: 0, times: [] };
    row.blended += 1;
    if (e.call) row.calls += 1;
    else row.web += 1;
    if (e.paid) row.paid += 1;
    row.times.push(ptClock(e.t).minutes);
    byDay.set(key, row);
  }
  const countsFor = (key: string): PulseCounts => {
    const r = byDay.get(key);
    return r
      ? { blended: r.blended, web: r.web, calls: r.calls, paid: r.paid }
      : { blended: 0, web: 0, calls: 0, paid: 0 };
  };

  const todayKey = ptDayKey(now);
  const { weekday: todayWeekday, minutes: nowMinutes } = ptClock(now);
  const today = countsFor(todayKey);

  /* Pace baselines: last 4 same-weekdays (7/14/21/28 days back). */
  let paceSum = 0;
  let fullSum = 0;
  for (let k = 1; k <= 4; k++) {
    const key = ptDayKey(new Date(now.getTime() - k * 7 * 86_400_000));
    const row = byDay.get(key);
    if (!row) continue;
    fullSum += row.blended;
    paceSum += row.times.filter((m) => m <= nowMinutes).length;
  }
  const paceBaseline = Math.round((paceSum / 4) * 10) / 10;
  const fullDayBaseline = Math.round((fullSum / 4) * 10) / 10;

  // Suppression: before 8 AM PT, or by-now baseline under 3 → no arrow.
  let pacePct: number | null = null;
  let paceNeutral = false;
  if (nowMinutes >= 8 * 60 && paceBaseline >= 3) {
    pacePct = Math.round(((today.blended - paceBaseline) / paceBaseline) * 100);
    paceNeutral = Math.abs(pacePct) <= 15;
  }

  /* Trailing 7 PT days (incl. today) vs the prior 7. */
  const sumDays = (fromOffset: number, toOffset: number): PulseCounts => {
    const acc = { blended: 0, web: 0, calls: 0, paid: 0 };
    for (let o = fromOffset; o <= toOffset; o++) {
      const c = countsFor(ptDayKey(new Date(now.getTime() - o * 86_400_000)));
      acc.blended += c.blended;
      acc.web += c.web;
      acc.calls += c.calls;
      acc.paid += c.paid;
    }
    return acc;
  };
  const last7 = sumDays(0, 6);
  const prior7 = sumDays(7, 13);
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const dayKey = ptDayKey(new Date(now.getTime() - (6 - i) * 86_400_000));
    const c = countsFor(dayKey);
    return { dayKey, blended: c.blended, paid: c.paid };
  });

  /* PT Mon–Sun weekly buckets: 8 complete + current. */
  const currentMonday = ptMondayKey(now);
  const weekKeys: string[] = [];
  for (let w = 8; w >= 0; w--) {
    // Monday keys walk back in exact 7-day steps from the current Monday.
    const [y, m, dd] = currentMonday.split("-").map(Number);
    const monday = new Date(Date.UTC(y, m - 1, dd, 12) - w * 7 * 86_400_000);
    weekKeys.push(ptDayKey(monday));
  }
  const byWeek = new Map<string, PulseCounts>(
    weekKeys.map((k) => [k, { blended: 0, web: 0, calls: 0, paid: 0 }]),
  );
  for (const e of entities) {
    const wk = ptMondayKey(e.t);
    const row = byWeek.get(wk);
    if (!row) continue; // outside the 9-week frame
    row.blended += 1;
    if (e.call) row.calls += 1;
    else row.web += 1;
    if (e.paid) row.paid += 1;
  }
  // Clip to the relaunch epoch, then drop leading empty weeks (account is
  // young); always keep ≥ 2 buckets.
  let weeks: WeekBucket[] = weekKeys
    .filter((k) => k >= TREND_EPOCH_MONDAY)
    .map((k) => ({
      mondayKey: k,
      label: shortDateLabel(k),
      isCurrent: k === currentMonday,
      ...(byWeek.get(k) as PulseCounts),
    }));
  while (weeks.length > 2 && weeks[0].blended === 0) weeks = weeks.slice(1);

  const asOfPt = now.toLocaleTimeString("en-US", {
    timeZone: PT,
    hour: "numeric",
    minute: "2-digit",
  });

  return {
    asOfPt,
    todayWeekday,
    today,
    paceBaseline,
    fullDayBaseline,
    pacePct,
    paceNeutral,
    last7,
    prior7,
    last7Days,
    weeks,
  };
}

/** Sum an Ads cost-by-day map (YYYY-MM-DD PT → dollars) into the same
 *  PT Mon–Sun buckets used above. */
export function spendByWeek(
  costByDay: ReadonlyMap<string, number>,
  weeks: WeekBucket[],
): Map<string, number> {
  const keys = new Set(weeks.map((w) => w.mondayKey));
  const out = new Map<string, number>();
  for (const [day, dollars] of costByDay) {
    const [y, m, dd] = day.split("-").map(Number);
    const wk = ptMondayKey(new Date(Date.UTC(y, m - 1, dd, 12)));
    if (!keys.has(wk)) continue;
    out.set(wk, (out.get(wk) ?? 0) + dollars);
  }
  return out;
}
