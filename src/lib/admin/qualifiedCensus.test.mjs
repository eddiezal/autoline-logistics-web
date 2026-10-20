/**
 * qualifiedCensus.mjs — pure-module checks (2026-10-20).
 * Run: node src/lib/admin/qualifiedCensus.test.mjs   (non-zero exit on failure)
 */
import assert from "node:assert/strict";
import {
  reducePricedRecords, toLeadLite, buildQualifiedPanel, dayKeys, isWeekend, S5_CAMPAIGN_ID,
} from "./qualifiedCensus.mjs";

const ts = (iso) => new Date(iso);
const fsTs = (iso) => ({ toDate: () => new Date(iso) });

// Mon Oct 19 + Tue Oct 20 2026 (PT). 10:00 PT = 17:00Z.
const events = [
  // A: website, priced Mon, later re-priced (must keep FIRST price)
  { receivedAt: ts("2026-10-19T17:00:00Z"), entityId: "1001", raw: { Referrer_Id: "8" } },
  { receivedAt: ts("2026-10-19T18:00:00Z"), entityId: "1001", raw: { Transport: { Total_Price: "1,250", Deposit: 240 } } },
  { receivedAt: ts("2026-10-20T18:00:00Z"), entityId: "1001", raw: { Transport: { Total_Price: 1400 } } },
  // B: website, priced Mon 11:30 PM PT (= Tue 06:30Z) → PT day is Monday
  { receivedAt: ts("2026-10-20T06:30:00Z"), entityId: "1002", raw: { Referrer_Id: "18493", Price: 900 } },
  // C: Taylor (not website) priced → excluded
  { receivedAt: ts("2026-10-19T19:00:00Z"), entityId: "1003", raw: { Referrer_Id: "503", Price: 800 } },
  // D: known test ABD → excluded
  { receivedAt: ts("2026-10-19T19:00:00Z"), entityId: "37256124", raw: { Referrer_Id: "8", Price: 800 } },
  // E: website, never priced
  { receivedAt: ts("2026-10-19T20:00:00Z"), entityId: "1005", raw: { Referrer_Id: "8" } },
  // F: website, priced Tue, no lead doc
  { receivedAt: ts("2026-10-20T19:00:00Z"), entityId: "1006", raw: { Referrer_Id: "8", Price: 700 } },
];
// Out of order on purpose: reducer must sort.
const records = reducePricedRecords([...events].reverse());
assert.equal(records.get("1001").price, 1250, "first price kept");
assert.equal(records.get("1001").deposit, 240);
assert.equal(records.has("37256124"), false, "known test ABD dropped");

const leads = [
  { createdAt: fsTs("2026-10-19T16:50:00Z"), proabdAbdId: 1001, attribution: { utmSource: "google", utmMedium: "cpc", utmCampaign: S5_CAMPAIGN_ID, gclid: "g1" }, contact: { email: "a@x.com" } },
  { createdAt: fsTs("2026-10-19T16:55:00Z"), proabdAbdId: "1002", attribution: { referrer: "https://www.google.com/" }, contact: { email: "b@x.com" } },
  { createdAt: fsTs("2026-10-19T17:10:00Z"), proabdAbdId: "1005", attribution: { utmSource: "google", utmMedium: "cpc", utmCampaign: S5_CAMPAIGN_ID, gclid: "g5" }, contact: { email: "e@x.com" } },
  // call lead: not a form
  { createdAt: fsTs("2026-10-19T18:00:00Z"), leadRef: "CALL-1", attribution: {}, contact: {} },
  // dashboard test: not a form
  { createdAt: fsTs("2026-10-19T18:10:00Z"), attribution: {}, contact: { email: "eddiezal28@gmail.com" } },
].map(toLeadLite).filter(Boolean);
assert.equal(leads.length, 5);
assert.equal(leads[3].isCall, true);
assert.equal(leads[4].dashTest, true);

const spend = {
  byDay: new Map([["2026-10-19", 300], ["2026-10-20", 100]]),
  byDayCampaign: new Map([[`2026-10-19|${S5_CAMPAIGN_ID}`, 200], [`2026-10-20|${S5_CAMPAIGN_ID}`, 80], ["2026-10-19|999", 100]]),
};
const google = new Map([[`2026-10-19|${S5_CAMPAIGN_ID}`, 1]]);

const p = buildQualifiedPanel({ records, leads, spend, google, fromDay: "2026-10-18", toDay: "2026-10-20", todayKey: "2026-10-20" });
const [sun, mon, tue] = p.rows;
assert.equal(sun.weekend, true);
assert.equal(mon.qualified, 2, "A + B (late-night PT) on Monday");
assert.equal(mon.s5, 1);
assert.equal(mon.organic, 1);
assert.equal(mon.uploadable, 1, "only A has a gclid");
assert.equal(mon.forms, 3, "A, B, E forms; call + test excluded");
assert.equal(mon.formsPriced, 2);
assert.equal(mon.s5Forms, 2);
assert.equal(mon.s5FormsPriced, 1);
assert.equal(mon.googleS5, 1);
assert.equal(tue.partial, true);
assert.equal(tue.qualified, 1);
assert.equal(tue.unlinked, 1);

// Totals exclude today.
assert.equal(p.window.days, 2);
assert.equal(p.window.qualified, 2);
assert.equal(p.window.spend, 300);
assert.equal(p.window.blendedCpq, 150);
assert.equal(p.window.s5Cpq, 200);
assert.equal(p.sinceSwitch.days, 1);
assert.equal(p.sinceSwitch.s5GoogleCpa, 200);
assert.equal(p.uploadCheck.expected, 1);
assert.equal(p.uploadCheck.counted, 1);
// Guardrail: 1 serving day with S5 < 5 → run 1, not tripped.
assert.equal(p.guardrail.lowRun, 1);
assert.equal(p.guardrail.tripped, false);

const s5Row = p.campaigns.find((c) => c.key === `ads:${S5_CAMPAIGN_ID}`);
assert.equal(s5Row.qualified, 1);
assert.equal(s5Row.spend, 280);
assert.equal(p.campaigns.find((c) => c.key === "unlinked").qualified, 1);

// No Ads → blanks, not zeros.
const q = buildQualifiedPanel({ records, leads, spend: null, google: null, fromDay: "2026-10-19", toDay: "2026-10-20", todayKey: "2026-10-20" });
assert.equal(q.rows[0].spend, null);
assert.equal(q.window.blendedCpq, null);
assert.equal(q.uploadCheck.counted, null);

// Helpers across DST end (Nov 1 2026).
assert.deepEqual(dayKeys("2026-10-31", "2026-11-02"), ["2026-10-31", "2026-11-01", "2026-11-02"]);
assert.equal(isWeekend("2026-10-24"), true);
assert.equal(isWeekend("2026-10-23"), false);

console.log("qualifiedCensus: all checks passed");
