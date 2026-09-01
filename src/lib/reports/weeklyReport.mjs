/**
 * Weekly report — shared computation and rendering.
 *
 * PURE. No Firestore, no Resend, no Ads client, no env reads. Callers supply
 * the data; this module turns it into figures and HTML and nothing else.
 *
 * That is deliberate. The alternative — the route computing one way and a test
 * harness computing another — is precisely the failure this project has spent a
 * day paying for: six scripts holding six opinions about what a ProABD
 * timestamp meant. One module, two callers:
 *
 *   src/app/api/cron/weekly-report/route.ts   (Monday cron, sends the draft)
 *   scripts/weekly-report-preview.mjs         (local preview, writes an .html)
 *
 * If the preview looks right, the email is right, because it is the same code.
 *
 * DATES ARE PACIFIC. There is no toISOString in the render path. The previous
 * digest built its week label from UTC while running at 19:00 PT and stamped
 * every email with the NEXT day's date.
 */

export const PT = "America/Los_Angeles";

export const ymd = (d) => d.toLocaleDateString("en-CA", { timeZone: PT });
export const prettyPT = (d) =>
  d.toLocaleDateString("en-US", { timeZone: PT, month: "short", day: "numeric" });

export function ptParts(d) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: PT, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(d).reduce((a, x) => ((a[x.type] = x.value), a), {});
  return { y: +p.year, m: +p.month, d: +p.day, dow: p.weekday };
}

export const money = (n) => "$" + Math.round(n).toLocaleString();

export const isCall = (l) =>
  l.source === "call" || (l.leadRef ?? "").startsWith("CALL-");
export const isPaidAttributed = (l) =>
  !!l?.attribution?.gclid || l?.attribution?.utmMedium === "cpc";

/** Weekdays only — the account runs a weekday-only ad schedule (shipped 7/27). */
export function weekdaysInMonth(year, month1, todayDom) {
  let total = 0, elapsed = 0;
  const days = new Date(Date.UTC(year, month1, 0)).getUTCDate();
  for (let d = 1; d <= days; d++) {
    const dow = new Date(Date.UTC(year, month1 - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    total++;
    if (d <= todayDom) elapsed++;
  }
  return { total, elapsed };
}


/* ===========================================================================
 * P4 UNIQUE LEADS — ported from src/lib/leads/identity.ts (ratified 2026-07-28,
 * metric-contract §3/§7.1).
 *
 * ⚠️ THIS IS A SECOND IMPLEMENTATION OF SHIPPED LOGIC, and that is a debt, not
 * a design. It exists because identity.ts is TypeScript and this module must
 * stay importable from plain node so the preview script and the cron route can
 * share one renderer. The alternative — the weekly counting RAW records while
 * /admin counts P4 — is worse: it puts two different "leads this week" numbers
 * in front of the same client, which is exactly what metric-contract Law 2 is
 * written to prevent.
 *
 * FOLLOW-UP: make identity.ts re-export from here (or extract both from a
 * shared module) so there is one union-find in the repo. Until that lands,
 * any change to identity.ts must be mirrored here.
 * =========================================================================== */

/** US phone → 10-digit key. Strips punctuation and a leading country 1. */
export function normalizePhoneKey(raw) {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits.length === 10 ? digits : null;
}

/** Email → lowercase-trimmed key; rejects non-email shapes. */
export function normalizeEmailKey(raw) {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

const DEFAULT_WINDOW_MS = 30 * 86_400_000;

/**
 * Collapse lead records into unique lead entities. Identity is transitive
 * (union-find) and the collapse window is ROLLING per key: each new touch on a
 * key extends that key's window.
 * @returns [{ origin, touches }] — touches ascending, origin first.
 */
export function dedupeLeads(rows, collapseWindowMs = DEFAULT_WINDOW_MS) {
  const sorted = rows.slice().sort((a, b) => a.t.getTime() - b.t.getTime());
  const parent = sorted.map((_, i) => i);
  const find = (i) => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    let c = i;
    while (parent[c] !== c) { const n = parent[c]; parent[c] = r; c = n; }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  const lastByKey = new Map();
  sorted.forEach((row, i) => {
    const at = row.t.getTime();
    for (const key of [
      row.phoneKey !== null ? "p:" + row.phoneKey : null,
      row.emailKey !== null ? "e:" + row.emailKey : null,
    ]) {
      if (key === null) continue;
      const prev = lastByKey.get(key);
      if (prev && at - prev.lastAt <= collapseWindowMs) union(prev.idx, i);
      lastByKey.set(key, { idx: i, lastAt: at });
    }
  });
  const groups = new Map();
  sorted.forEach((row, i) => {
    const root = find(i);
    const g = groups.get(root) ?? [];
    g.push(row);
    groups.set(root, g);
  });
  return [...groups.values()].map((touches) => ({ origin: touches[0], touches }));
}

/** Turn raw {at, lead} rows into P4 entities keyed to their ORIGIN touch. */
export function toUniqueLeads(leads) {
  const rows = leads.map((x) => ({
    t: x.at,
    phoneKey: normalizePhoneKey(x.lead?.contact?.phone),
    emailKey: normalizeEmailKey(x.lead?.contact?.email),
    at: x.at,
    lead: x.lead,
  }));
  /* The entity's channel and attribution come from the ORIGIN touch, per the
     ratified rule "the earliest record owns the entity's channel-of-origin".
     Using "any touch" would let a later paid click relabel an organic lead as
     paid — the same reverse-attribution error the referral work turned up. */
  return dedupeLeads(rows).map((e) => ({ at: e.origin.at, lead: e.origin.lead, touches: e.touches.length }));
}

/**
 * Turn raw leads + daily ad cost into every figure the report needs.
 *
 * @param leads  [{ at: Date, lead: {...} }]  — already date-resolved
 * @param byDay  Map<'YYYY-MM-DD', number>    — Pacific-keyed daily ad spend
 * @param now    Date
 * @param ceiling monthly ad ceiling in dollars
 */
export function computeFigures({ leads, byDay = new Map(), now = new Date(), ceiling = 7000, unique = true }) {
  const rawLeads = leads;
  leads = unique ? toUniqueLeads(leads) : leads;
  /* Runs Monday: the reporting week is the seven days ending YESTERDAY, so the
     week is complete before a single number is computed. */
  const startOfTodayPT = new Date(`${ymd(now)}T00:00:00${ptOffset(now)}`);
  const weekEnd = new Date(startOfTodayPT.getTime() - 1);
  const weekStart = new Date(startOfTodayPT.getTime() - 7 * 864e5);

  const weeks = [3, 2, 1, 0].map((back) => {
    const s = new Date(startOfTodayPT.getTime() - (back + 1) * 7 * 864e5);
    const e = new Date(startOfTodayPT.getTime() - back * 7 * 864e5);
    const inWeek = leads.filter((x) => x.at >= s && x.at < e);
    let spend = 0;
    for (let t = s.getTime(); t < e.getTime(); t += 864e5) spend += byDay.get(ymd(new Date(t))) ?? 0;
    return {
      start: s,
      end: new Date(e.getTime() - 1),
      total: inWeek.length,
      web: inWeek.filter((x) => !isCall(x.lead)).length,
      calls: inWeek.filter((x) => isCall(x.lead)).length,
      attributed: inWeek.filter((x) => isPaidAttributed(x.lead)).length,
      spend,
    };
  });

  const p = ptParts(now);
  const monthStartKey = `${p.y}-${String(p.m).padStart(2, "0")}-01`;
  let mtd = 0;
  for (const [k, v] of byDay) if (k >= monthStartKey) mtd += v;

  /* PACING IS MEASURED THROUGH YESTERDAY, NOT THROUGH THE MOMENT THIS RUNS.
     Spend for today is zero or partial when a Monday-morning job fires, so
     counting today in the denominator divides complete-through-yesterday spend
     by one extra day and understates the daily rate. On the 2026-08-17 run that
     turned $7,428 projected — $428 OVER the ceiling — into $6,752, i.e. $248
     under. It would have told the client the opposite of the truth.
     If the reporting week ended in a previous month, this month has no elapsed
     ad days yet and pacing is meaningless; guard with max(0, ...). */
  const yest = ptParts(new Date(startOfTodayPT.getTime() - 1));
  const pacingDom = yest.y === p.y && yest.m === p.m ? yest.d : 0;
  const { total: adDaysTotal, elapsed: adDaysElapsed } = weekdaysInMonth(p.y, p.m, pacingDom);
  const projected = adDaysElapsed ? (mtd / adDaysElapsed) * adDaysTotal : 0;

  /* Raw record counts per week, for the preview's visibility only. Never
     rendered to the client — the client sees P4, the population /admin uses. */
  const rawWeeks = [3, 2, 1, 0].map((back) => {
    const s2 = new Date(startOfTodayPT.getTime() - (back + 1) * 7 * 864e5);
    const e2 = new Date(startOfTodayPT.getTime() - back * 7 * 864e5);
    return rawLeads.filter((x) => x.at >= s2 && x.at < e2).length;
  });

  const cur = weeks[3], prev = weeks[2];
  return {
    now, weekStart, weekEnd, weeks, cur, prev, rawWeeks, unique,
    mtd, projected, ceiling, overUnder: projected - ceiling,
    adDaysTotal, adDaysElapsed,
    totals4: weeks.reduce((a, w) => a + w.total, 0),
    spend4: weeks.reduce((a, w) => a + w.spend, 0),
    monthName: now.toLocaleString("en-US", { timeZone: PT, month: "long" }),
    suspiciousZero: cur.total === 0,
    hasSpend: weeks.some((w) => w.spend > 0),
  };
}

/** Pacific UTC offset for a given instant, as "-07:00" / "-08:00". */
export function ptOffset(d) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: PT, timeZoneName: "shortOffset",
  }).formatToParts(d).find((x) => x.type === "timeZoneName")?.value ?? "GMT-8";
  const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(f);
  if (!m) return "-08:00";
  const h = Number(m[1]);
  return `${h < 0 ? "-" : "+"}${String(Math.abs(h)).padStart(2, "0")}:${m[2] ?? "00"}`;
}

/** Placeholder id → narrative key. Keep in step with the four slots below. */
export const TODO_KEYS = {
  "BOTTOM LINE": "bottomLine",
  "TREND": "trend",
  "BUDGET ACTION": "budgetAction",
  "WHAT'S NEXT": "whatsNext",
};

export const cplOf = (w) => (w.total ? w.spend / w.total : 0);
export const gcplOf = (w) => (w.attributed ? w.spend / w.attributed : 0);

/**
 * Render the email.
 * @param f        result of computeFigures
 * @param adsNote  '' when spend is real; otherwise the reason it is missing
 * @param mode     'draft' (banner + subject strip) | 'clean' (what Ben receives)
 */
export function renderWeeklyReport(f, { adsNote = "", mode = "draft", narrative = {} } = {}) {
  const { cur, prev, weeks } = f;
  const PX = 3, maxBar = 132;

  /* A narrative slot renders as PROSE when supplied and as a loud yellow
     placeholder when not. Nothing between those two states — a half-filled
     report should look unfinished, not merely thin. */
  const para = (t) =>
    `<div style="font:400 14px/1.7 Arial,sans-serif;color:#374151;">${t}</div>`;
  const slot = (key, id, hint) => {
    const v = narrative?.[key];
    if (typeof v === "string" && v.trim()) return para(v.trim());
    return `<div style="background:#fef9c3;border:1px dashed #ca8a04;border-radius:6px;padding:10px 12px;margin:6px 0;font:400 13px/1.6 Arial,sans-serif;color:#713f12;"><strong>&#9997; ${id}</strong> &mdash; ${hint}</div>`;
  };
  const TODO = (id, hint) => slot(TODO_KEYS[id] ?? id, id, hint);

  const bars = weeks.map((w) => {
    const paid = Math.min(Math.round(w.attributed * PX), maxBar);
    const other = Math.min(Math.round((w.total - w.attributed) * PX), maxBar - paid);
    return `<td width="25%" align="center" valign="bottom" style="height:${maxBar}px;">
<div style="font:700 13px/1 Arial,sans-serif;color:#1a1a1a;padding-bottom:6px;">${w.total}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="38" style="width:38px;">
<tr><td height="${other}" bgcolor="#94a3b8" style="background-color:#94a3b8;height:${other}px;font-size:0;line-height:0;border-radius:3px 3px 0 0;">&nbsp;</td></tr>
<tr><td height="${paid}" bgcolor="#2a78d6" style="background-color:#2a78d6;height:${paid}px;font-size:0;line-height:0;">&nbsp;</td></tr>
</table></td>`;
  }).join("");

  const barLabels = weeks.map((w, i) =>
    `<td align="center" style="padding-top:8px;font:${i === 3 ? 700 : 400} 11.5px/1.4 Arial,sans-serif;color:${i === 3 ? "#1a1a1a" : "#6b7280"};">${prettyPT(w.start)}</td>`).join("");

  const rows = weeks.map((w, i) => {
    const b = i === 3;
    const td = `padding:8px 10px;${b ? "font-weight:700;color:#1a1a1a;" : "border-bottom:1px solid #f1f3f6;"}`;
    return `<tr${b ? ' style="background:#f8fafc;"' : ""}><td style="${td}">${prettyPT(w.start)}</td><td align="right" style="${td}">${w.total}</td><td align="right" style="${td}">${w.spend ? money(cplOf(w)) : "&mdash;"}</td><td align="right" style="${td}">${w.spend && w.attributed ? money(gcplOf(w)) : "&mdash;"}</td></tr>`;
  }).join("");

  const pacePct = Math.min(100, Math.round((f.adDaysElapsed / f.adDaysTotal) * 100));
  const overPct = Math.max(0, Math.min(20, Math.round((Math.max(0, f.overUnder) / f.ceiling) * 100)));
  const restPct = Math.max(0, 100 - pacePct - overPct);

  const subject = `Auto Line weekly: ${cur.total} leads${cur.spend ? ` at ${money(cplOf(cur))}` : ""}${f.overUnder > 0 && f.hasSpend ? `; ${f.monthName} pacing ${money(f.overUnder)} over` : ""}`;

  const draftChrome = mode !== "draft" ? "" :
`<div style="max-width:640px;margin:0 auto;padding:20px 16px 0;">
<div style="background:#fee2e2;border:1px solid #ef4444;border-radius:8px;padding:12px 14px;font:400 12.5px/1.55 Arial,sans-serif;color:#7f1d1d;">
<strong>DRAFT &mdash; not sent to Ben.</strong> Figures for ${prettyPT(f.weekStart)}&ndash;${prettyPT(f.weekEnd)} Pacific. Fill every yellow block, delete this banner and the subject strip, then send.${adsNote ? ` <strong>${adsNote}</strong> &mdash; spend shows as &mdash;.` : ""}${f.suspiciousZero ? " <strong>ZERO LEADS THIS WEEK &mdash; verify the query before trusting anything here.</strong>" : ""}
</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 6px;font-size:12.5px;color:#4b5563;">
<tr><td width="72" style="color:#9ca3af;">Subject</td><td style="color:#111827;font-weight:700;">${subject}</td></tr>
</table></div>`;

  const html =
`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Auto Line &mdash; weekly report</title>
<style>@media only screen and (max-width:620px){.wrap{width:100%!important}.pad{padding-left:18px!important;padding-right:18px!important}.kpi{display:block!important;width:100%!important;border-left:0!important;border-top:1px solid #eef0f2!important;padding:12px 0 0!important}.kpi-first{border-top:0!important;padding-top:0!important}.tbl{font-size:12.5px!important}}</style>
</head><body style="margin:0;padding:0;background:#e9ebee;font-family:Arial,Helvetica,sans-serif;">
${draftChrome}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#e9ebee;"><tr><td align="center" style="padding:10px 10px 40px;">
<table role="presentation" class="wrap" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:#ffffff;border-radius:10px;border:1px solid #dfe3e8;">

<tr><td class="pad" style="padding:22px 28px 14px;border-bottom:1px solid #eef0f2;">
<div style="font:700 15px/1.3 Arial,sans-serif;color:#1a1a1a;letter-spacing:.3px;">AUTO LINE LOGISTICS</div>
<div style="font:400 13px/1.5 Arial,sans-serif;color:#6b7280;margin-top:3px;">Weekly marketing report &middot; ${prettyPT(f.weekStart)}&ndash;${prettyPT(f.weekEnd)}, ${ptParts(f.now).y}</div>
</td></tr>

<tr><td class="pad" style="padding:22px 28px 0;">
<div style="font:700 17px/1.35 Arial,sans-serif;color:#1a1a1a;margin-bottom:9px;">Bottom line</div>
${TODO("BOTTOM LINE", `2&ndash;4 sentences. To hand: ${cur.total} leads (from ${prev.total}), blended CPL ${cur.spend ? money(cplOf(cur)) : "n/a"} (from ${prev.spend ? money(cplOf(prev)) : "n/a"}), month projected ${f.projected ? money(f.projected) : "n/a"} vs ${money(f.ceiling)}. State plainly whether anything needs Ben's approval.`)}
</td></tr>

<tr><td class="pad" style="padding:24px 28px 0;"><div style="border-top:1px solid #eef0f2;padding-top:20px;">
<div style="font:700 17px/1.35 Arial,sans-serif;color:#1a1a1a;margin-bottom:14px;">This week</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td class="kpi kpi-first" width="50%" valign="top" style="padding:0 14px 14px 0;">
<div style="font:400 12px/1.4 Arial,sans-serif;color:#6b7280;">Total leads</div>
<div style="font:700 30px/1.15 Arial,sans-serif;color:#1a1a1a;margin-top:3px;">${cur.total}</div>
<div style="font:400 13px/1.5 Arial,sans-serif;color:${cur.total >= prev.total ? "#128A3A" : "#c2521f"};">${cur.total >= prev.total ? "&#9650;" : "&#9660;"} from ${prev.total} last week</div></td>
<td class="kpi" width="50%" valign="top" style="padding:0 0 14px 14px;border-left:1px solid #eef0f2;">
<div style="font:400 12px/1.4 Arial,sans-serif;color:#6b7280;">Blended media CPL</div>
<div style="font:700 30px/1.15 Arial,sans-serif;color:#1a1a1a;margin-top:3px;">${cur.spend ? money(cplOf(cur)) : "&mdash;"}</div>
<div style="font:400 13px/1.5 Arial,sans-serif;color:${cplOf(cur) <= cplOf(prev) ? "#128A3A" : "#c2521f"};">${prev.spend && cur.spend ? `${cplOf(cur) <= cplOf(prev) ? "&#9660;" : "&#9650;"} from ${money(cplOf(prev))} last week` : "&nbsp;"}</div></td>
</tr><tr>
<td class="kpi" width="50%" valign="top" style="padding:14px 14px 0 0;border-top:1px solid #eef0f2;">
<div style="font:400 12px/1.4 Arial,sans-serif;color:#6b7280;">Google-attributed CPL</div>
<div style="font:700 30px/1.15 Arial,sans-serif;color:#1a1a1a;margin-top:3px;">${cur.spend && cur.attributed ? money(gcplOf(cur)) : "&mdash;"}</div>
<div style="font:400 13px/1.5 Arial,sans-serif;color:#6b7280;">${cur.attributed} of ${cur.total} traced to a click</div></td>
<td class="kpi" width="50%" valign="top" style="padding:14px 0 0 14px;border-top:1px solid #eef0f2;border-left:1px solid #eef0f2;">
<div style="font:400 12px/1.4 Arial,sans-serif;color:#6b7280;">Google Ads spend</div>
<div style="font:700 30px/1.15 Arial,sans-serif;color:#1a1a1a;margin-top:3px;">${cur.spend ? money(cur.spend) : "&mdash;"}</div>
<div style="font:400 13px/1.5 Arial,sans-serif;color:#6b7280;">this week</div></td>
</tr></table>
<div style="font:400 12.5px/1.65 Arial,sans-serif;color:#6b7280;margin-top:14px;">
${cur.attributed} lead${cur.attributed === 1 ? " was" : "s were"} directly attributed to Google Ads. Some of the remaining ${cur.total - cur.attributed} may also have come from ads but could not be matched to a click reliably. <strong style="color:#374151;">Blended media CPL</strong> divides ad spend by every lead the site produced; <strong style="color:#374151;">Google-attributed CPL</strong> divides the same spend only by the leads we can trace to an ad. Neither includes our fee or the cost of the site.
</div></div></td></tr>

<tr><td class="pad" style="padding:24px 28px 0;"><div style="border-top:1px solid #eef0f2;padding-top:20px;">
<div style="font:700 17px/1.35 Arial,sans-serif;color:#1a1a1a;">Four weeks in</div>
<div style="font:400 12px/1.5 Arial,sans-serif;color:#6b7280;margin-top:3px;margin-bottom:14px;">
<span style="display:inline-block;width:9px;height:9px;background:#2a78d6;border-radius:2px;">&nbsp;</span> Google Ads &nbsp;
<span style="display:inline-block;width:9px;height:9px;background:#94a3b8;border-radius:2px;">&nbsp;</span> Other sources</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr style="height:${maxBar}px;">${bars}</tr><tr>${barLabels}</tr></table>
<table role="presentation" class="tbl" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px;font:400 13.5px/1.5 Arial,sans-serif;color:#374151;">
<tr style="background:#f8fafc;">
<th align="left" style="padding:8px 10px;font:700 11.5px/1.4 Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e5e9ef;">Week</th>
<th align="right" style="padding:8px 10px;font:700 11.5px/1.4 Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e5e9ef;">Leads</th>
<th align="right" style="padding:8px 10px;font:700 11.5px/1.4 Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e5e9ef;">Blended CPL</th>
<th align="right" style="padding:8px 10px;font:700 11.5px/1.4 Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e5e9ef;">Google CPL</th></tr>
${rows}</table>
<div style="font:400 14px/1.7 Arial,sans-serif;color:#374151;margin-top:14px;">
${f.totals4} leads over four weeks${f.spend4 ? `, averaging ${money(f.spend4 / (f.totals4 || 1))} each on ${money(f.spend4)} of ad spend` : ""}.
</div>
${TODO("TREND", "One or two sentences on what the four-week shape means. Do not assert a cause you have not measured &mdash; that is what caused the 2026-08-07 incident.")}
</div></td></tr>

<tr><td class="pad" style="padding:24px 28px 0;"><div style="border-top:1px solid #eef0f2;padding-top:20px;">
<div style="font:700 17px/1.35 Arial,sans-serif;color:#1a1a1a;margin-bottom:14px;">Budget</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font:400 14px/1.7 Arial,sans-serif;color:#374151;margin-bottom:16px;">
<tr><td width="92" valign="top" style="padding:0 0 5px;font-weight:700;color:#1a1a1a;">Spent</td><td style="padding:0 0 5px;">${f.mtd ? money(f.mtd) : "&mdash;"} of ${money(f.ceiling)}, with ${f.adDaysElapsed} of ${f.adDaysTotal} advertising days done</td></tr>
<tr><td valign="top" style="padding:0 0 5px;font-weight:700;color:#1a1a1a;">Projected</td><td style="padding:0 0 5px;">${f.projected ? `about ${money(f.projected)} &mdash; roughly ${money(Math.abs(f.overUnder))} ${f.overUnder >= 0 ? "over" : "under"}` : "&mdash;"}</td></tr>
<tr><td valign="top" style="padding:0;font-weight:700;color:#1a1a1a;">Action</td><td style="padding:0;">${TODO("BUDGET ACTION", "What are you doing about the pacing, in one line? If nothing is needed, say so.")}</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td width="${pacePct}%" bgcolor="#374151" height="18" style="background-color:#374151;height:18px;font-size:0;line-height:0;border-radius:4px 0 0 4px;">&nbsp;</td>
${overPct ? `<td width="${overPct}%" bgcolor="#eb6834" height="18" style="background-color:#eb6834;height:18px;font-size:0;line-height:0;">&nbsp;</td>` : ""}
<td width="${restPct}%" bgcolor="#e5e9ef" height="18" style="background-color:#e5e9ef;height:18px;font-size:0;line-height:0;border-radius:0 4px 4px 0;">&nbsp;</td>
</tr></table>
<div style="font:400 12px/1.6 Arial,sans-serif;color:#6b7280;margin-top:7px;">Dark grey is the share of advertising days elapsed${overPct ? "; the orange sliver is the projected overshoot" : ""}.</div>
</div></td></tr>

<tr><td class="pad" style="padding:24px 28px 0;"><div style="border-top:1px solid #eef0f2;padding-top:20px;">
<div style="font:700 17px/1.35 Arial,sans-serif;color:#1a1a1a;margin-bottom:9px;">What remains unproven</div><!-- Reviewed 2026-08-31: keep this block durable (no dated claims). 8/07 incident rule: state only what is measured. -->
<div style="font:400 14px/1.7 Arial,sans-serif;color:#374151;">
<strong style="color:#1a1a1a;">Lead quality.</strong> More leads at a lower cost is not the same as more booked business, and we are not claiming it is. The first lead-to-revenue read is now in: booked-business value per website lead has a measured baseline, tracked weekly alongside cost. What remains unproven is whether that quality holds as volume grows &mdash; the sample is still small and the honest error bars are wide. Each week of data narrows them.
</div></div></td></tr>

<tr><td class="pad" style="padding:24px 28px 0;"><div style="border-top:1px solid #eef0f2;padding-top:20px;">
<div style="font:700 17px/1.35 Arial,sans-serif;color:#1a1a1a;margin-bottom:13px;">What's next</div>
${TODO("WHAT'S NEXT", "Dated rows. Carry forward anything still open from last week, and mark clearly anything needing Ben's decision and by when.")}
</div></td></tr>

<tr><td class="pad" style="padding:22px 28px 26px;">
<div style="border-top:1px solid #eef0f2;padding-top:14px;font:400 11px/1.5 Arial,sans-serif;color:#9ca3af;">
Auto Line Logistics &middot; week of ${prettyPT(f.weekStart)}&ndash;${prettyPT(f.weekEnd)} &middot; figures as of ${prettyPT(f.now)} Pacific
</div></td></tr>

</table></td></tr></table></body></html>`;

  const text =
`Weekly report — ${prettyPT(f.weekStart)}–${prettyPT(f.weekEnd)} (Pacific)

Leads ${cur.total} (prev ${prev.total}) · attributed ${cur.attributed} · calls ${cur.calls}
Spend ${cur.spend ? money(cur.spend) : "n/a"} · blended CPL ${cur.spend ? money(cplOf(cur)) : "n/a"} · Google CPL ${cur.spend && cur.attributed ? money(gcplOf(cur)) : "n/a"}
Month to date ${f.mtd ? money(f.mtd) : "n/a"} of ${money(f.ceiling)} · ${f.adDaysElapsed}/${f.adDaysTotal} ad days · projected ${f.projected ? money(f.projected) : "n/a"}
${adsNote}
${mode === "draft" ? "Open the HTML part: four yellow blocks need your words before this can go to Ben." : ""}`;

  const unfilled = Object.values(TODO_KEYS).filter(
    (k) => !(typeof narrative?.[k] === "string" && narrative[k].trim()),
  );
  return { subject, html, text, unfilled };
}
