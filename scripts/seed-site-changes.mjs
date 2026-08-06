/**
 * Seed the Work Ledger (`site_changes`) with the build history May 8 → today.
 *
 * Idempotent: doc IDs are date+slug, so re-running updates in place and
 * never duplicates. Safe to re-run after editing an entry below.
 *
 * Usage:  node scripts/seed-site-changes.mjs
 * Add single entries later with: node scripts/add-site-change.mjs
 *
 * VISIBILITY: "client" entries are written for Ben's eyes (he has /admin).
 * "internal" = exhibit rule (errors we created + fixed stay internal).
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

// date, category, scopeItem, title, detail?, link?, impactNote?, visibility?
const ENTRIES = [
  ["2026-05-08", "infra", "-", "Website build started",
    "First commit of the new autolinelogistics.com. 12 straight build weeks from here to launch."],
  ["2026-06-21", "new-page", "-", "Website launched on autolinelogistics.com",
    "45 days from first commit to production: 39 page templates in English and Spanish, quote flow, corridor pages, blog, tools, and legal pages.", "/"],
  ["2026-07-14", "tracking", "E", "Website leads now flow automatically into the CRM",
    "Quote-form submissions create leads in ProABD in real time with a tracking ID that ties every booking back to its source. Status changes flow back to the website within minutes."],
  ["2026-07-17", "ads", "D", "Google Ads relaunch went live",
    "Six campaigns, 211 keywords, English and Spanish, built from a full audit of historical search data. Every dollar now points at real car-shipping intent."],
  ["2026-07-23", "fix", "-", "CRM email deliverability repaired",
    "Caught that CRM emails were landing in spam (~98%) due to missing sender authentication. DNS records fixed; inbox placement recovered within the week.",
    undefined, "Reported by the team as fixed the following week"],
  ["2026-07-24", "new-page", "E", "Customer tracking portal live with real shipment data",
    "Customers can follow their shipment from booked to delivered, in English or Spanish, with a live map for in-transit vehicles and their coordinator's contact card.", "/portal"],
  ["2026-07-27", "fix", "D", "Click-to-call restored on ads",
    "Caught that the ads call button had been silently rejected (unverified number) and never served. Verified the business number; the button was live again the same day.",
    undefined, "First tracked calls arrived within 3 days"],
  ["2026-07-27", "ads", "D", "Ad schedule extended to 6 PM",
    "Order history showed the 2:30–6 PM window produced 18% of fees but ads were dark. Now covered Monday–Friday."],
  ["2026-07-27", "tracking", "E", "CRM status feed outage caught and fixed",
    "Noticed shipment status updates had silently stopped flowing from the CRM; traced it with the vendor and restored the feed, recovering five days of missed updates."],
  ["2026-07-28", "improvement", "-", "Live pricing model v1",
    "The website now prices the way the team actually closes: real carrier-market estimate plus the service fee pattern fitted from 336 booked orders. Replaces the old percentage markup that overquoted big moves and underquoted small ones."],
  ["2026-07-29", "local-gbp", "-", "Google Business Profile live",
    "Auto Line Logistics now appears on Google Maps and local search with photos, hours, and services in English and Spanish."],
  ["2026-07-29", "improvement", "-", "Email-me-this-estimate on the Route Price Checker",
    "Visitors can send themselves their estimate with one click. No spam, no sales calls — the promise that makes people willing to use it.", "/tools/route-price-checker"],
  ["2026-08-03", "local-gbp", "-", "Business Profile full setup",
    "Categories, bilingual service list, website link with tracking, and ads location link so ads can show the verified business name and pin."],
  ["2026-08-05", "local-gbp", "-", "First five Google reviews",
    "Nelson reached out to past customers; four detailed five-star reviews landed naming routes and the locked price holding. Review requests now pacing steadily.",
    undefined, "One review: “the original price I was quoted on remained the same”"],
  ["2026-08-05", "tracking", "D", "Phone calls now count as leads in ads",
    "Qualified website calls (60+ seconds) are now primary conversions the bidding system learns from, alongside form fills and ads call-button calls."],
  ["2026-08-05", "ads", "D", "Search-term audit round two",
    "Blocked wasted spend on rentals, job seekers, equipment haulers, and competitor brand names across all campaigns, in both languages."],
  ["2026-08-06", "fix", "D", "Negative-keyword conflict caught and reversed same day",
    "A keyword-blocking rule added during the audit was suppressing our own corridor ads. Diagnosed from the daily numbers and fixed within hours.",
    undefined, undefined, "internal"],
  ["2026-08-06", "improvement", "-", "Sitewide SEO upgrade: language and canonical tags on every page",
    "Every page now tells Google exactly which URL it is and pairs its English and Spanish versions. Sitemap expanded from 51 to 69 pages, and an automated check now validates all of it on every deploy.",
    undefined, "Post-deploy check: 69 of 69 pages passing"],
  ["2026-08-06", "content-update", "-", "Vehicle lineup aligned across the site",
    "Site copy, quote forms, and calculators now list exactly what we ship (cars, trucks, SUVs, vans) in both languages, with an honest FAQ pointing motorcycle owners to specialists."],
  ["2026-07-15", "analysis", "D", "Historical ads spend audited before relaunch",
    "Full autopsy of the account's all-time search data showed most past spend never reached real car-shipping searches. The finding shaped the entire relaunch structure: every campaign now maps to proven customer intent."],
  ["2026-07-24", "analysis", "-", "Pricing pattern discovered in the order book",
    "Analyzed 336 booked orders and found the consistent way deals actually close: carrier cost plus a predictable service fee. This became the blueprint for the website's live pricing model."],
  ["2026-07-29", "analysis", "D", "Ad budgets recalculated to serving days",
    "Daily budgets had been derived from calendar days, but ads run weekdays only. Recomputed against actual serving days and rebalanced campaigns; the account stopped throttling its best performers."],
  ["2026-07-30", "analysis", "-", "Remote-route pricing premium quantified",
    "Routes far from major metro areas cost measurably more to cover, and now we know how much. Built from our own booked orders; feeds the next version of the pricing model so remote quotes stay accurate."],
  ["2026-08-04", "analysis", "D", "Bid cap experiment: cheaper research clicks, verdict in",
    "Two-week controlled test of a lower bid ceiling on the research campaign.", undefined,
    "31% cheaper per research action at full delivery; cap made permanent"],
  ["2026-08-04", "analysis", "-", "Order book refreshed through August 4",
    "Monthly data pull analyzed and reconciled: 379 booked orders since March, $95.9K in broker fees on $560K gross moved. August opened at the fastest pace in the book's history."],
  ["2026-08-06", "content-update", "-", "Corridor price copy tightened",
    "Thirty strings across ten corridor pages in both languages now carry the precise promise: the locked quote is the final invoice, no surprise increases."],
];

let wrote = 0;
for (const [date, category, scopeItem, title, detail, link, impactNote, visibility] of ENTRIES) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const id = `${date}_${slug}`;
  const doc = {
    date, category, scopeItem, title,
    ...(detail ? { detail } : {}),
    ...(link ? { link } : {}),
    ...(impactNote ? { impactNote } : {}),
    visibility: visibility === "internal" ? "internal" : "client",
    seededAt: new Date().toISOString(),
  };
  await db.collection("site_changes").doc(id).set(doc, { merge: true });
  wrote++;
}
console.log(`Seeded/updated ${wrote} ledger entries.`);
