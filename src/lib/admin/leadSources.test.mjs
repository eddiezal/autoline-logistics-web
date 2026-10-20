/**
 * leadSources.mjs — pure-module checks (2026-10-20).
 * Run: node src/lib/admin/leadSources.test.mjs   (non-zero exit on failure)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reduceRecords, toLead, buildLeadSources, reportedAt, eventualRange, adWeekdaysLeft, S5_CAMPAIGN_ID } from "./leadSources.mjs";

const curve = JSON.parse(readFileSync(new URL("./booking-curve.json", import.meta.url), "utf8"));
const now = new Date("2026-10-20T18:00:00Z"); // Tue Oct 20, 11:00 PT
const d = (iso) => new Date(iso);
const fsTs = (iso) => ({ toDate: () => new Date(iso) });

// ---- curve helpers
assert.equal(reportedAt(curve.sources.Website, curve.buckets, 10, 45), 1);
assert.equal(reportedAt(curve.sources.iRelocation, curve.buckets, 14, 45), 0.84);
assert.equal(reportedAt(curve.sources.iRelocation, curve.buckets, 50, 45), 1, "past seasoning = fully reported");
assert.ok(reportedAt(curve.sources.Website, curve.buckets, 0.1, 45) < 0.1, "a lead 2 hours old is barely reported");
const rg = eventualRange(24, 0.7, 108);
assert.ok(rg.lo >= 24 && rg.expected > 33 && rg.hi > rg.lo, JSON.stringify(rg));
assert.equal(eventualRange(0, 0.7, 108).hi >= 0, true);
assert.equal(adWeekdaysLeft("2026-10-20"), 9, "Tue Oct 20 through Fri Oct 30: 9 weekdays incl. today");

// ---- records: iRelo Sep lead booked; website Oct lead (paid S5) booked; website Oct organic unbooked; canceled iRelo Sep
const ev = (entityId, receivedAt, raw, created, bookedAt) => ({ entityId, receivedAt: d(receivedAt), raw, created: created ? d(created) : null, bookedAt: bookedAt ? d(bookedAt) : null });
const records = reduceRecords([
  ev("1", "2026-09-10T15:00:00Z", { Referrer_Id: "207", Create_Date: "x", Status_Id: "5" }, "2026-09-10T14:00:00Z", null),
  ev("1", "2026-09-12T15:00:00Z", { Booked_Date: "y", Item_Type: "order", Transport: { Deposit: 250 } }, "2026-09-10T14:00:00Z", "2026-09-12T14:00:00Z"),
  ev("2", "2026-09-11T15:00:00Z", { Referrer_Id: "207", Status_Id: "23", Booked_Date: "y", Transport: { Deposit: 200 } }, "2026-09-11T14:00:00Z", "2026-09-11T20:00:00Z"),
  ev("3", "2026-10-19T17:00:00Z", { Referrer_Id: "18493", Transport: { Total_Price: 1200 } }, "2026-10-19T16:30:00Z", null),
  ev("3", "2026-10-19T20:00:00Z", { Booked_Date: "y", Item_Type: "order", Transport: { Deposit: 240 } }, "2026-10-19T16:30:00Z", "2026-10-19T19:00:00Z"),
  ev("4", "2026-10-20T16:00:00Z", { Referrer_Id: "8" }, "2026-10-20T15:30:00Z", null),
  ev("5", "2026-10-19T16:00:00Z", { Referrer_Id: "207" }, "2026-10-19T15:00:00Z", null),
  ev("37256124", "2026-10-19T16:00:00Z", { Referrer_Id: "8", Booked_Date: "y" }, "2026-10-19T15:00:00Z", "2026-10-19T16:00:00Z"), // known test
]);
assert.equal(records.size, 5);
assert.equal(records.get("1").booked, true);
assert.equal(records.get("2").canceled, true);

const leads = [
  { createdAt: fsTs("2026-10-19T16:30:00Z"), proabdAbdId: "3", attribution: { utmSource: "google", utmMedium: "cpc", utmCampaign: S5_CAMPAIGN_ID, gclid: "g" }, contact: { email: "a@x.com" } },
  { createdAt: fsTs("2026-10-20T15:30:00Z"), proabdAbdId: "4", attribution: { referrer: "https://www.google.com/" }, contact: { email: "b@x.com" } },
  { createdAt: fsTs("2026-10-20T15:00:00Z"), leadRef: "CALL-1", source: "call", attribution: { gclid: "g2" }, contact: {} },
  { createdAt: fsTs("2026-10-20T15:00:00Z"), leadRef: "CALL-2", source: "call", attribution: {}, contact: {} },
].map(toLead).filter(Boolean);
assert.equal(leads[0].bucket, "google");
assert.equal(leads[1].bucket, "organic");
assert.equal(leads[2].isCall && leads[2].bucket === "google", true);

const spend = new Map([[`2026-10-19|${S5_CAMPAIGN_ID}`, 225], [`2026-10-20|${S5_CAMPAIGN_ID}`, 100], ["2026-09-10|24034601757", 40]]);
const out = buildLeadSources({ records, leads, spend, campaignNames: new Map([[S5_CAMPAIGN_ID, "S5 Español"]]), curve, now });

const sep = out.byMonth["2026-09"];
assert.equal(sep.open, false);
assert.equal(sep.rows.irelo.leads, 2);
assert.equal(sep.rows.irelo.booked, 2);
assert.equal(sep.rows.irelo.canceled, 1);
assert.equal(sep.rows.irelo.feeNet, 250, "net excludes the canceled deposit");
assert.equal(sep.rows.irelo.cost, 8);
assert.equal(sep.rows.irelo.settled, true, "Sep iRelo leads are ~40 days old → reported ≥95%");
assert.equal(sep.rows.irelo.closeRate, 1);
assert.equal(sep.rows.google.cost, 40, "spend with no leads still shows as Google cost");

const oct = out.byMonth["2026-10"];
assert.equal(oct.open, true);
assert.equal(oct.rows.google.leads, 2, "1 paid form + 1 Google call");
assert.equal(oct.rows.google.calls, 1);
assert.equal(oct.rows.google.booked, 1);
assert.equal(oct.rows.google.cost, 325);
assert.equal(oct.rows.google.priced, 1);
assert.equal(oct.rows.organic.leads, 1);
assert.equal(oct.rows.irelo.leads, 1);
assert.equal(oct.rows.irelo.settled, false);
assert.ok(oct.rows.irelo.range && oct.rows.irelo.range.hi >= 0);
assert.equal(oct.rows.google.closeRate, null, "no rates on an open row");
assert.equal(oct.campaigns[0].campaignId, S5_CAMPAIGN_ID);
assert.equal(oct.campaigns[0].pricedShare, 1);
assert.equal(oct.allPaid.leads, 3);
assert.equal(oct.free.leads, 1);

assert.equal(out.google.spentToDate, 325);
assert.equal(out.google.weekdaysLeft, 9);
assert.equal(out.weekly.length, 8);
assert.equal(out.weekly[7].partial, true);
assert.equal(out.weekly[7].by.google, 1);

console.log("leadSources: all checks passed");
