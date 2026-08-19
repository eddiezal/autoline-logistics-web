/**
 * Analysis Library registry — the studies behind the decisions.
 *
 * ⚠️ PUBLICATION GATE (2026-08-16). An external audit of this library found
 * arithmetic errors, unsupported causal language, and internal contradictions
 * across SEVERAL studies — not only the newest one. Its verdict, verified:
 *
 *   lead-economics    WITHDRAWN, not merely blocked. Rerunning at the 21-day
 *                     maturity the audit demanded returns 23 website records and
 *                     ZERO bookings. All 4 bookings behind the $21.62 headline
 *                     come from records created Jul 27 - Aug 2, which are NOT
 *                     mature. Older half 0/23, newer half 4/22, Fisher p=0.049 -
 *                     and the same week carries a pricing change (flatfee-v1,
 *                     7/28) and a 2.6x volume ramp, so three changes are
 *                     confounded across four bookings. There is no stable
 *                     website close rate to report, therefore no measured net
 *                     fee and no value per lead. The study's central number does
 *                     not exist yet. Do not resurrect it by picking the cohort
 *                     that produces a number.
 *                     Also fixed while it was open: two derived figures survived
 *                     the correction of
 *                     their own input ($78 fee gap should be $43.29; 1.4x ratio
 *                     should be 1.67x) and a false platform claim about bidding
 *                     eligibility. It sits in DRAFT_STUDIES and does NOT render.
 *   behavioral-journey UNBLOCKED 2026-08-18. All three items closed by a full
 *                     restatement on session-level accounting (one denominator,
 *                     so started − completed = abandoned and reached − started =
 *                     never-started, by construction): 919 reached / 258 started
 *                     / 62 completed / 196 abandoned / 661 never-started for the
 *                     Jul 14–Aug 14 baseline window. The restated rates land on
 *                     the published ones (28.1% vs 27.8%, 24.0% vs 22.0%), so the
 *                     errors were bookkeeping, not data. Model-derived figures
 *                     (the 19.7/5.7/1.6/0.6/0.4 ladder) are now labeled as model
 *                     estimates, never as raw rates. Early read of the Aug 12/13
 *                     changes added as a dated section.
 *   search-terms      BLOCKED. $3,454 of $6,072 was never observable at query
 *                     level. The honest claim is 7.9% CONFIRMED relevant and
 *                     56.9% unclassifiable, not "under 8% reached real searches".
 *   serving-days      RECLASSIFY as an intervention note. $224x30 and $269x21
 *                     do not reconcile; 30/21 is +42.9% not +25%; $224 to $269
 *                     is +20.1%; 79%->50% is a 37% relative fall, not "halved".
 *                     Caveats array is empty, which is never appropriate.
 *   bid-cap           RECLASSIFY as an early read. Method says two-week test;
 *                     the verdict rests on two serving days. Remove "permanent".
 *   remoteness        Publish after methodological edits (CI on the coefficient,
 *                     robust SEs, controls, sensitivity to the metro list and
 *                     the 50-mile threshold). Replace causal wording.
 *   flat-fee          Publish as DESCRIPTIVE booked-order modelling only. "Every
 *                     booked order decomposes into carrier cost plus fee" is
 *                     tautological — fee is DEFINED as price minus carrier pay.
 *                     Booked orders cannot show that the old model lost leads.
 *   order-book        Publish after wording edits: "booked transport value" not
 *                     "gross moved"; fees are before cancellations and refunds.
 *
 * The pattern across all of them: a useful descriptive signal gets promoted
 * into a causal or economic conclusion the design does not support. For a
 * client-facing library, that distinction has to be airtight.
 *
 * Each entry is a full write-up: the question, the method in plain English,
 * findings, honest caveats, and the decision the study informed. Rendered at
 * /admin/analysis (index) and /admin/analysis/[slug] (detail). Client-visible
 * (Ben has /admin) — write for his eyes; keep pricing-model internals at the
 * level already shared in the quarterly deck, no deeper.
 *
 * DRAFT_STUDIES is deliberately NOT exported into the rendered list. Move an
 * entry into STUDIES only when its blocking items are closed.
 *
 * Registry lives in code, not Firestore: studies are few, rich, and versioned
 * with the site. Add a study = add an object here + a Work Log entry linking
 * to it (scripts/add-site-change.mjs --link /admin/analysis/<slug>).
 */

export interface Study {
  slug: string;
  title: string;
  /** YYYY-MM-DD of the analysis (or latest refresh). */
  date: string;
  /** One-line headline finding, shown on the index card. */
  headline: string;
  /** Status chip: what the study is doing for the business right now. */
  status: string;
  question: string;
  method: string;
  findings: string[];
  caveats: string[];
  informed: string[];
  /** Route to an interactive chart served inside /admin, when one exists. */
  chartHref?: string;
  /** Structured drop-off waterfall, rendered on the detail page (see Funnel). */
  funnel?: Funnel;
  /** Simple bar data rendered inline on the detail page (label, value, display). */
  bars?: { label: string; value: number; display: string }[];
  barCaption?: string;
  /** Deep-dive sections: full methodology, tables, robustness checks. */
  sections?: DeepSection[];
}

export interface DeepSection {
  title: string;
  body?: string;
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  note?: string;
}

/* ---- Drop-off funnel (waterfall) — added 2026-08-18 -----------------------
 * A structured leak funnel rendered on the study detail page. The geometry is
 * a waterfall: each leak bar spans exactly the width REMOVED between one stage
 * and the next, so the subtraction is drawn, not implied. Counts must
 * reconcile: stages[i].count = stages[i+1].count + leaks[i].count — the
 * renderer trusts this, so keep it true (the 2026-08-16 audit existed because
 * counts that "should" reconcile didn't).
 * Leaks and the feeder cross-link to Decision Registry entries (see
 * decisionRegistry.ts) so the funnel's "what we're doing about it" and the
 * registry's decision rules can never drift apart. */

export interface FunnelStage {
  label: string;
  count: number;
  /** Rate string with its denominator NAMED (e.g. "28.1% of arrivals"). */
  detail?: string;
}

export interface FunnelLeak {
  /** First-class leak identity, e.g. "LEAK 1 — FAILURE TO START". */
  code: string;
  count: number;
  /** Share string with its denominator NAMED (the two leaks have different denominators — that distinction is the point). */
  share: string;
  /** What we're doing about it — observational language unless causation is established. */
  note: string;
  /** Decision Registry entry aimed at this leak. */
  registrySlug?: string;
}

export interface FunnelFeeder {
  label: string;
  total: number;
  classes: { label: string; count: number; kind: "continues" | "other" | "nothing" }[];
  note: string;
  registrySlug?: string;
}

export interface Funnel {
  title: string;
  subtitle: string;
  /** stages.length must equal leaks.length + 1; leaks[i] sits between stages[i] and stages[i+1]. */
  stages: FunnelStage[];
  leaks: FunnelLeak[];
  feeder?: FunnelFeeder;
}

export const DRAFT_STUDIES: Study[] = [
  {
    slug: "lead-economics",
    title: "What a lead is worth, and how fast it stops being worth it",
    date: "2026-08-16",
    headline:
      "A website lead generated $21.62 of gross broker fee on average and a purchased iRelocation lead $9.14 - before cancellations and servicing cost - and booking value is heavily front-loaded, with no booking observed later than 20.3 days.",
    status: "New Aug 16 - sets the affordability ceiling and reframes follow-up as a speed problem",
    question:
      "What is one lead actually worth in dollars, how does that change with age, and how much can we afford to pay for one?",
    method:
      "Rebuilt every lead in the CRM from its own change history: 15,972 status events collapsed into 1,289 records created between Jul 8 and Aug 2, each aged at least 14 days so a non-booking means something. For each record we read the booked price and the carrier payment, so the broker fee is measured rather than assumed. Value per lead is the share of records that book multiplied by the average fee those bookings earned. The decay curve comes from the gap between when a lead arrived and when it booked, measured across all 62 bookings in the window. Test submissions and records with corrupted fee entries are excluded and the exclusions are reported.",
    findings: [
      "Gross fee expectancy ranged from $9.14 to $21.62 across the source-and-period combinations observed: website $21.62, Taylor premium $19.52, Taylor shared $11.68, iRelocation $9.14. Because each vendor ran in a different stretch of weeks, these differences cannot yet be attributed to source quality - see the caveats. Read each figure as gross broker fee generated per acquired lead, an upper bound on what a lead can be worth, not a spending ceiling: cancellations, card fees, locked-price losses and the cost of working the lead all come out of it.",
      "Booking value is heavily front-loaded. Across 1,289 records and 62 bookings, no order was observed booking more than 20.3 days after the lead arrived, and half of all bookings happened within a day. Applied to a typical $1,000 move, expected value falls from $8.14 at arrival to $3.97 after a day and $2.01 after five. Because follow-up behaviour was not randomised, this motivates a speed-to-lead test; it does not on its own prove that contacting faster causes more bookings.",
      "Because of that decay, the open backlog is worth far less than its size suggests. All 1,265 currently open leads inside the 21-day window are worth about $1,900 together, roughly $1.51 each, because most are already old. The 375 records past 21 days are worth nothing. Set against that: raising the booking rate across the whole book by a single percentage point would be worth roughly $1,030 a week at current volume and fee. Clearing the backlog is a one-time $1,900. The two are different kinds of move, and the second is the larger one.",
      "Booking rate alone ranks sources misleadingly. Taylor premium books at twice the rate of Taylor shared, but the shared feed earns $43.29 more per booking, so in dollars the gap narrows from 2.0x to 1.67x - the booking-rate ratio overstates the dollar ratio by about 20%. Any comparison that stops at booking percentage is reading the wrong number.",
      "The measured fee corroborates the order book from a completely independent direction. This study reads price minus carrier payment from CRM change events and lands at $247 average; the order-book study reads booked deposits from the monthly export and lands at $253. Two methods, two datasets, six dollars apart.",
      "A small unattributed group - 14 records with no source recorded - books at 28.6% and is worth $63.57 a lead, several times any tracked source. It is too small to trust and we cannot yet say what it is, but it is the most valuable thing in the data we do not understand.",
    ],
    caveats: [
      "The website figure rests on 4 bookings. The honest range around 8.9% is 3.5% to 20.7%, which is why the affordability ceiling is being held where it is rather than moved to match. Twelve bookings is the point at which that number becomes worth acting on. Every dollar figure derived from it - including the roughly $8,400 a year attributed to quote-form work - carries the same width and should be read as a base case, not a forecast.",
      "The cohort is not fully mature and the booking rates are therefore floors. Records were required to be at least 14 days old, but the study also argues that bookings can occur out to 21 days. The youngest records had seen only about 90% of their booking window when this was measured, so some bookings are simply not yet observable and every close rate here is understated by a small amount. Rerunning at a 21-day maturity requirement, or a survival model that handles censoring properly, settles it.",
      "Three orders whose price exactly equalled the carrier payment were excluded from fee averages on the grounds that three delivered loads earning nothing looks like a data-entry pattern. That is a judgement, not a verified fact, and it removes economically unfavourable observations. Treat it as a sensitivity choice: the excluded orders would lower the Taylor premium fee average, and the finding should be confirmed against the source records before it is relied on.",
      "We cannot rank the sources against each other, and this study does not. The lead vendors were switched on one at a time in different weeks - one in early July, the next mid-month, the third late - so each vendor's numbers reflect a different period as much as a different source. After correcting for the number of comparisons made, no difference between any two sources is statistically distinguishable from chance. Settling it needs two feeds running side by side for about three weeks.",
      "The decay curve is measured from leads we actually worked. If nobody calls a five-day-old lead, no five-day-old lead ever books, and the data would then report that five-day-old leads are dead. The strongest evidence against that reading is a group of 176 leads watched for 34 to 39 days that were being worked and still produced no booking after day 13. Treat the tail of the curve as a floor on what an old lead is worth, not a precise measurement.",
      "Fee here means price minus what the carrier is paid. It is before card processing, cancellations, and the cost of honoring a locked price when the carrier market moves against us. True contribution is somewhat lower and is not yet measured.",
      "We know what every source is worth but not what each one costs. Purchased-lead invoices are the missing input; without them the comparison between buying leads and generating them cannot be completed.",
      "Six test submissions were being counted as real website leads until this analysis, including the record created when the CRM connection was first tested in July. Removing them moved the website close rate from 7.8% to 8.9%. Three booked orders also carried a carrier payment exactly equal to the price with no fee recorded, which is a data-entry pattern rather than three deliveries made for free; they are now excluded from fee averages and still counted as bookings.",
    ],
    informed: [
      "Holding the cost-per-lead ceiling where it is until there are twelve website bookings rather than four. The rule was written before these numbers existed, and it held against four defensible ways of counting that implied ceilings from $21.62 to $48.65.",
      "Reframing quote-form work as the largest lever on cost per lead - cost per lead is spend divided by completed forms, so lifting completion cuts it proportionally on traffic already paid for - while placing it correctly against the whole business, where a single point of booking rate across all sources is worth roughly six times more.",
      "Correcting the expected payoff of that form work, which had been overstated twice over: the value of a lead was costed at roughly $48 against a measured $21.62, and the volume it would act on was taken from an early single-day sample of about 150 form starts a week against a measured 57. Lifting completion from 22% to 35% was budgeted near $48,000 a year and is worth about $8,400. Still clearly worth having, and no longer the largest number on the board.",
      "Shifting follow-up priority from persistence to speed. The backlog is a reporting problem worth clearing; the revenue is in the first hour.",
      "A standing request for purchased-lead invoices, and a recommendation to run two vendor feeds concurrently before the next buying decision rather than one at a time.",
    ],
    bars: [
      { label: "Website", value: 21.62, display: "$21.62" },
      { label: "Taylor premium", value: 19.52, display: "$19.52" },
      { label: "Taylor shared", value: 11.68, display: "$11.68" },
      { label: "iRelocation", value: 9.14, display: "$9.14" },
    ],
    barCaption:
      "Dollars of broker fee expected per lead, by source - booking rate multiplied by the average fee those bookings earned. This is the break-even price for a lead, not a ranking: the sources ran in different weeks and cannot be compared to each other.",
    sections: [
      {
        title: "What a lead is worth as it ages",
        body:
          "Taking a typical $1,000 move from a purchased source and following it through the booking curve measured across all 62 bookings in the window.",
        table: {
          headers: ["Lead age", "Still worth", "Booking chance remaining"],
          rows: [
            ["Brand new", "$8.14", "100%"],
            ["6 hours", "$6.87", "84%"],
            ["1 day", "$3.97", "49%"],
            ["2 days", "$3.46", "43%"],
            ["5 days", "$2.01", "25%"],
            ["10 days", "$1.34", "16%"],
            ["15 days", "$0.67", "8%"],
            ["21 days", "$0.00", "0%"],
          ],
        },
        note:
          "Half a lead's value is gone within a day and 87% by day twelve. This is why the first hour matters more than any follow-up sequence.",
      },
      {
        title: "Why booking rate alone is the wrong ranking",
        bullets: [
          "Taylor premium books 8.0% of its leads; Taylor shared books 4.0%. On rate alone the premium feed looks twice as good.",
          "But the shared feed's bookings carry a $288.79 average fee against the premium feed's $245.50 - $43.29 more per booking, which claws back part of the gap.",
          "In dollars per lead the ratio is 1.67x rather than 2.0x, so booking percentage overstates the dollar difference by about 20%.",
          "A feed resold to several brokers at once is also being measured differently: its booking rate reflects our share of a contested lead, not the quality of the lead itself.",
        ],
      },
      {
        title: "The open pipeline, priced",
        table: {
          headers: ["Group", "Records", "Value still winnable"],
          rows: [
            ["Open, inside the 21-day window", "1,265", "$1,916"],
            ["Open, past 21 days", "375", "$0"],
            ["Never contacted, over a day old", "107", "$424"],
          ],
        },
        note:
          "The backlog should still be cleared - every open record nobody is working sits inside the denominator of every performance number in the business and makes results look worse than they are. But it is a reporting task, not a revenue-recovery task. The revenue is in the next table.",
      },
      {
        title: "The levers, priced",
        body:
          "About 417 leads reach the business every week across all sources, of which roughly 19 come from the website quote form. Each lever below is valued at the measured fee of $247 per booking, using the volumes each one actually operates on.",
        table: {
          headers: ["Lever", "Per week", "Per year"],
          rows: [
            ["Booking rate across the whole book, +1 point (4.8% to 5.8%)", "$1,030", "$53,500"],
            ["Website booking rate, 8.9% to 13%", "$188", "$9,800"],
            ["Quote-form completion, 22% to 35%", "$161", "$8,400"],
            ["Quote-form completion, 22% to 32%", "$124", "$6,400"],
            ["Clearing the entire open backlog", "one time", "$1,900"],
          ],
        },
        note:
          "The first row dwarfs the rest for one reason: the website supplies about 4.5% of all leads. Improving how every lead is worked pays roughly five times more than improving the website channel end to end. Both are worth doing, but they answer different questions - the website levers decide whether the advertising is worth funding, while the booking-rate lever is where the money in the business actually sits.",
      },
      {
        title: "The website levers specifically",
        body:
          "Cost per lead is advertising spend divided by completed forms, so the funnel sits in the denominator: improving it lowers cost per lead on traffic already paid for, without spending another dollar.",
        bullets: [
          "Quote-form completion, 22% today. Of every hundred people who start the form, 78 leave. Lifting completion to 35% cuts cost per lead by 37% and adds about $8,400 a year in booked fees. It is the only lever that produces more leads without more spend.",
          "Reaching the form at all, 27.8% today. Roughly 615 visits a month leave the quote page without touching the form - a pool nearly four times larger than the one that starts and abandons. Same work, one step earlier.",
          "The price moment, where 87% currently leave. Part of that is form friction and part is a reaction to the number itself, which means the fix runs through pricing calibration as much as through design.",
          "Booking rate on website leads, 8.9% today. Half of all bookings happen within a day of the lead arriving, so this is a speed lever rather than a follow-up lever.",
          "Bid efficiency. Thirty conversions is our own evaluation threshold for trusting an automated-bidding read, not a platform requirement - Google allows conversion-based bidding without conversion history and recommends roughly 30 for a reliable assessment. The account is at 21, so better form completion brings that evaluation point forward; the funnel lever pulls the advertising decision with it.",
        ],
        note:
          "None of these closes the gap alone, and neither does any pair of them. Run together at moderate improvement they do.",
      },
      {
        title: "How the fee is measured",
        bullets: [
          "Every CRM change event carries the total price and the carrier payment. The broker fee is the difference, measured per order rather than assumed from an average.",
          "Coverage is complete: all 62 bookings in the window carry both figures.",
          "Average measured fee is $247.18 against the order-book study's $253 from monthly booked-order exports - independent confirmation from a separate dataset and method.",
          "Three orders showed a carrier payment exactly equal to the price, producing a zero fee, with no deposit recorded. Three delivered loads earning nothing is not a plausible reading; they are excluded from fee averages and reported rather than quietly dropped.",
        ],
      },
      {
        title: "Provenance",
        bullets: [
          "Unit of analysis: one CRM record, reconstructed from its full change history.",
          "Data window: records created Jul 8 to Aug 2, 2026; change events read through Aug 16, 2026.",
          "Sample: 1,289 records, 62 bookings. Website subset 45 records, 4 bookings.",
          "Primary outcome: gross broker fee - booked price minus carrier payment - per acquired lead.",
          "Evidence type: observational and descriptive. No randomisation, no control group, no causal claim.",
          "Open-pipeline figures come from a separate live snapshot taken Aug 16 across a 60-day window, not from the 1,289-record study cohort; the two populations are different by design.",
          "Source: scripts/source-comparison.mjs and scripts/stale-leads.mjs. Next review when website bookings reach 12.",
        ],
      },
      {
        title: "What we still cannot answer",
        bullets: [
          "Which lead source is best. The vendors were run one at a time, so source and calendar period cannot be separated. Three weeks of concurrent delivery settles it.",
          "What each purchased source costs. This study measures value per lead; the invoices hold the other half.",
          "Whether an old lead worked properly would convert. We have very few examples of one, which is the honest limit on the decay curve.",
          "What the unattributed group is. Fourteen records, the best economics in the data, and no recorded source.",
        ],
      },
    ],
  },
];

export const STUDIES: Study[] = [
  {
    slug: "conversion-signal-integrity",
    title: "Conversion signal integrity — what Google is told, and what it hears",
    date: "2026-08-19",
    headline:
      "Two plumbing faults found in one evening: engagement events were bidding-eligible “conversions,” and 6 of 11 uploaded backfill conversions vanished inside Google despite per-row success. Both are now ledgered; one is fixed, one is escalated.",
    status: "Living doc — updated as discoveries land · gate 2 of 6 closed",
    question:
      "Before any automated bidding is trusted with budget: does the conversion signal this account sends Google actually mean “a lead,” and does what we upload actually arrive?",
    method:
      "Read-only API audit of every conversion action's configuration and daily counts on both date bases (scripts/check-oci-status.mjs), cross-checked against the raw upload files and Google's own per-row upload results in the Ads UI. Every change that followed was registered in the intervention ledger BEFORE execution and verified by re-reading the API afterward.",
    findings: [
      "Three engagement events — deep blog reads, corridor page views, portal sign-ins — were configured as PRIMARY conversions, meaning they counted in the “Conversions” column and were eligible to steer automated bidding. Volume was small (8 events Jul 1–Aug 18 vs ~25 web leads in August alone) but definitionally wrong: a blog read is not a lead. All three were demoted to observation-only on Aug 18, effective Aug 19.",
      "The offline-conversion pipeline drops data silently: across three backfill upload files, 11 distinct conversions were accepted — zero errors, every row individually marked Successful in Google's own results — yet only 5 appear in any report, on either date basis. The gap (6) matches the original support claim exactly. Escalated to Google with execution IDs; no client-side explanation survives the evidence.",
      "Bookings cannot be the training signal at current scale: roughly 3 paid bookings a month, with half arriving within a day but a tail out to ~20 days. Google's own guidance wants ~15 events/month at the chosen funnel stage with a short delay — and value corrections uploaded more than ~7 days after a conversion update reporting, not the bidder's learning.",
    ],
    caveats: [
      "The engagement-event contamination was small in this window; the fix matters for what the bidder would have learned later, not for restating past performance. Comparisons of the “Conversions” column that cross Aug 19 cross a definition change (and a GA4 wiring change on Aug 14) — both are ledgered.",
      "The cause of the 6 uncounted conversions is not yet known — candidates (invalid-traffic filtering, click-attribution failure) are only visible inside Google. Until their answer arrives, “uploads pass diagnostics” cannot be treated as proof of delivery.",
      "Nothing in this study measures ad performance; it measures whether the measurement itself can be trusted. No bidding-strategy change has been made or scheduled.",
    ],
    informed: [
      "The Value-Based Bidding Readiness plan: a six-gate decision tree that must complete before any campaign moves to conversion- or value-based automated bidding. Gate 2 (this cleanup) closed Aug 18; the remaining gates run through the Aug 24 fee/cancellation definition, the Aug 26 Spanish-campaign maturity read, and a funnel-volume audit that picks the deepest timely signal — possibly “qualified lead,” not raw lead and not booking.",
    ],
    sections: [
      {
        title: "How this surfaced",
        body: "A routine claim to Google support (“6 backfill conversions missing”) got a checklist reply: check your columns, check dedup, wait longer. Instead of adjudicating in the UI, we queried the account's configuration and upload diagnostics directly — and the columns question turned out to be the small one. The same configuration pull that answered it showed engagement events sitting in the primary conversion set, days before a planned move toward automated bidding that would have optimized toward them.",
      },
      {
        title: "The missing six, precisely",
        table: {
          headers: ["Upload file", "Rows (distinct clicks)", "Google's per-row result", "Counted in reports"],
          rows: [
            ["backfill-week1 (Aug 7 leads)", "3", "3/3 Successful, 0 errors", "2"],
            ["backfill-csp-outage (Aug 11 leads)", "2", "2/2 Successful, 0 errors", "2"],
            ["backfill-conversions (Aug 10 leads)", "6", "6/6 Successful, 0 errors", "1"],
            ["re-uploads of the same 6 (×4)", "6 each", "“6 successful” each", "no-ops (correct dedup)"],
          ],
        },
        note: "No overlap between files — 11 distinct ad clicks uploaded once each, plus retries that correctly changed nothing. Accepted with zero errors, 5 counted. Escalation is with Google; their answer is a readiness input for any future value pipeline, because daily value uploads would ride this exact path.",
      },
      {
        title: "Discoveries log",
        table: {
          headers: ["Date", "Discovery", "Status"],
          rows: [
            ["Aug 18", "Upload diagnostics: every UI-uploaded event accepted, zero rejected — the missing conversions are not a rejection problem", "Closed"],
            ["Aug 18", "11 uploaded / 5 counted / 0 errors — six conversions vanish between acceptance and reporting", "Escalated to Google (execution IDs on file)"],
            ["Aug 18", "blog_read_deep, corridor_view, lead_portal_signin configured as primary (bidding-eligible)", "Fixed — demoted to secondary, effective Aug 19 (ledger: conversion-primary-cleanup-20260818)"],
            ["Aug 18", "CallRail's uploaded call conversions vs the ads-native 60s+ call action — possible double counting across the two call paths", "Open — resolve before any bidding transition"],
            ["Aug 24", "Canonical fee / cancellation definition (with Ben) — defines what a conversion is worth", "Pending"],
            ["Aug 26", "Spanish-campaign maturity read — demand quality vs service capacity vs immature evidence", "Pending"],
          ],
        },
        note: "This table is the living part of the study — new rows are appended as gates close or Google responds; existing rows are never rewritten.",
      },
      {
        title: "The plan — six gates before any automated bidding",
        bullets: [
          "1 · Freeze the canonical revenue definition (Aug 24, with Ben): what a booked fee is worth after cancellations, decided once, used everywhere.",
          "2 · ✓ DONE — conversion hygiene: engagement events demoted to observation-only, so “Conversions” means leads and real calls, and nothing else can define success for a bidder.",
          "3 · Spanish-campaign maturity read (Aug 26): if Spanish-language demand exists but can't be served, the fix is operational, not algorithmic — no bidder repairs a staffing gap.",
          "4 · Funnel-volume audit: measure trailing-30-day volume and delay for lead → qualified/serviceable → booked, from our own CRM event stream. The deepest stage with ~15+ timely events a month becomes the optimization signal.",
          "5 · Choose the value architecture: optimize to a qualified-lead event if it has the volume; otherwise keep the lead event and assign expected economic value at lead time (route- and estimate-based, recalibrated only from matured cohorts). Late restatements validate — they do not train.",
          "6 · Readiness checklist, then a preregistered switch: identifiers on ~all paid leads, daily uploads passing diagnostics, genuinely differentiated values, one to two clean conversion cycles of history — and only then a bidding change, with its own registered thresholds.",
        ],
      },
      {
        title: "Method notes",
        bullets: [
          "Configuration and counts read via the Google Ads API (GAQL), not the UI — both date bases checked, because offline conversions report on the ad-click date, not the upload date.",
          "Upload ground truth is Google's own per-execution results (Changes / Successful / Errors per row), captured with execution IDs.",
          "The demotion was executed by script with a dry-run, exact-name matching, and post-change verification; the intervention ledger entry was registered before execution and carries the confounder notes.",
        ],
      },
    ],
  },
  {
    slug: "behavioral-journey",
    title: "How visitors actually move through the site",
    date: "2026-08-18",
    headline:
      "Starting the quote form makes a visit ~8x more likely to convert, but the bigger loss pool never starts: 661 of the 919 visits that reached the quote page last month left without touching the form. And 90% of price-checker visitors do nothing after seeing a number.",
    status: "Restated Aug 18 on corrected arithmetic; first early read of the Aug 12/13 changes included",
    question:
      "Where do visits die on the site, and what do the visits that turn into leads do differently?",
    method:
      "Modeled a month of first-party site activity (3,412 tracked actions across 2,008 visits, Jul 14 - Aug 13) as step-by-step journeys: every visit becomes a sequence of pages and actions ending in either a lead (67 in the window, duplicates folded) or an exit. From those sequences we computed, for every page and action, the probability that a visit standing there eventually converts. Probabilities resting on fewer than 20 observations are withheld rather than reported. Refreshed Aug 13 with the same method and vocabulary as the original Aug 10 read, so the two runs are directly comparable; the new field-level form telemetry added Aug 12 is deliberately excluded from journeys to keep it that way. Restated Aug 18 with strict per-visit accounting - every count below shares one denominator, so visits that started minus visits that completed equals visits that abandoned, and visits that reached the quote page minus visits that started equals visits that never started, exactly. The baseline window for those counts is Jul 14 - Aug 14 (before the August site changes); the early-read section at the bottom reads Aug 14 onward separately.",
    findings: [
      "The quote path is the site's biggest lever, and it has two loss pools. The bigger one comes first: of the 919 visits that reached the quote page in the baseline month, 661 left without ever starting the form - 3.4x the 196 who started and then abandoned. Of the 258 visits that started, 62 finished: 24% completion. A visit that starts the form converts at about 8x the site average, so both pools are worth real money: lifting completion from 24% to 30% at current volume adds roughly 15 leads a month with zero extra ad spend, and converting even a tenth of the never-starters into starters is worth about as much again.",
      "Seeing a price in the route price-checker is where visits go to die: of 162 visits that saw an estimate in the baseline month, 146 (90%) did nothing at all afterward - no further page, no form, no capture. Of the rest, 5 continued to the quote page and 11 kept browsing without ever touching the form - different evidence about the price moment than vanishing, and worth separating at the next read. This is specifically a price-checker finding: nearly all measured estimates come from that tool. The quote form also shows prices but does not yet emit this event, so its own price moment is not measured yet; instrumentation for that ships with the next form release. The Aug 13 estimate-moment redesign places a lock-this-price handoff exactly here; the early-read section below tracks whether it moves.",
      "Where a visit enters matters. Visits entering on the homepage convert at 5.8%, entries straight to the quote page at 3.6%, and entries to the price-checker tool at 0.6% despite being about a quarter of all traffic.",
      "The ship-vs-drive calculator is engagement, not funnel: people cycle it repeatedly and then leave (0.4% eventual conversion once a visit is in it). Fine as content; it should hand off harder to the quote form.",
      "Corridor pages have started to register: 27 tracked visits this month (up from 13), converting at rates comparable to the quote page, though the sample is still small. Early sign the search-ranking fixes shipped Aug 10 are working; worth a proper read next month.",
      "Early read on the August changes (four days of data - direction only, no verdicts): the redesigned form is completing at 27% vs 24% on the old form, a gap well inside the noise at this sample size. More useful already: the new field-level telemetry names where people stop - the vehicle-type step is the most common last touch before abandoning, ZIP validation errors fired 7 times, and the captcha expired on 3 visits mid-form. Those are the first three targets for the next form release.",
    ],
    caveats: [
      "Descriptive, not causal. People who ask for a price were already hotter or colder on their own; the model ranks where attention and drop-off live, it cannot prove that changing a page changes outcomes.",
      "Phone calls are invisible here. A visitor who sees a price and dials the number counts as an exit. With roughly 30 calls a month against 57 tracked web conversions, this could soften the price-moment finding. Call records started capturing the caller's page on Aug 10; because call volume is thin, that re-verification needs 4 to 6 weeks of data, around mid-September.",
      "10 of 67 web leads this month could not be matched to a tracked visit (very fast submissions or lost signals), so conversion probabilities are floors.",
      "This refresh includes about one day of the redesigned form released Aug 12 (fewer fields, friction telemetry), far too little to move any number here; the next refresh will read the new form separately. A handful of internal test submissions also sit in the form-start pool as non-completions, slightly understating completion.",
      "Event collection began Jul 23, so any window opening earlier holds fewer data days than calendar days; raw visit counts between runs are not a traffic trend. The rates, which is what this study is about, have been stable across three reads (completion 22.2% / 22.0% / 24.0% under progressively corrected accounting).",
      "The Aug 18 restatement changed bookkeeping, not data: earlier versions of this page mixed step-to-step transition counts into totals, so its counts did not reconcile with each other (an external audit caught it). Every count now shares one per-visit definition and reconciles by construction. The restated rates land within about two points of the originals.",
      "One of our own verification visits (Aug 18, checking the price-checker handoff live) is in the data as a price-checker session that continued to the quote form; future reads should remember it inflates that tiny pool by one.",
    ],
    informed: [
      "The Aug 12 form release: removed the last-name field and the plan-selection step, corrected the pricing copy to promise exactly what the process delivers, and added field-level drop-off telemetry so the next read shows which fields lose people.",
      "A redesigned quote flow (asking for delivery timing before showing a price) is specified for a five-week A/B test once a baseline accrues on the new telemetry.",
      "The estimate-moment redesign, shipped Aug 13 and verified working end-to-end Aug 18: a lock-this-price handoff with the route and vehicle carried over, placed exactly where 90% currently walk away.",
      "Confirmed the research-traffic campaign's pause from the paid-media side: its landing tool converts 0.6% of entries.",
      "Corridor-page re-read scheduled now that traffic is arriving after the search fixes.",
    ],
    funnel: {
      title: "Where quote-path visits go",
      subtitle:
        "Jul 14 – Aug 14 · every bar shares one scale (919 = full width) · each red bar spans exactly the width removed from the stage above it, so the counts reconcile in the geometry itself: 919 = 258 + 661, and 258 = 62 + 196.",
      stages: [
        { label: "Reached the quote page", count: 919 },
        { label: "Started the form", count: 258, detail: "28.1% of arrivals" },
        { label: "Became a lead", count: 62, detail: "24.0% of starters · 6.7% end-to-end" },
      ],
      leaks: [
        {
          code: "LEAK 1 — FAILURE TO START",
          count: 661,
          share: "72% of arrivals",
          note: "Largest conversion opportunity on the site: 72% of addressable quote-page traffic never reaches the form Release 1 is optimizing. The Release-2 quote-path redesign aims here.",
          registrySlug: "quote-path-r2",
        },
        {
          code: "LEAK 2 — FORM ABANDONMENT",
          count: 196,
          share: "76% of starters",
          note: "Observed abandonment concentrations (last field touched before giving up — observational, not proven causes): the vehicle-type step, ZIP validation errors, captcha expiry. Release 1 iterates here.",
          registrySlug: "quote-form-r1",
        },
      ],
      feeder: {
        label: "Price-checker feeder",
        total: 162,
        classes: [
          { label: "continued to the quote page", count: 5, kind: "continues" },
          { label: "kept browsing, never touched the form", count: 11, kind: "other" },
          { label: "no tracked activity after the price", count: 146, kind: "nothing" },
        ],
        note: "162 visits saw a price. The Aug 13 lock-this-price block is the experiment aimed at this edge. The 11 who browsed on are different evidence than the 146 who vanished; the next script revision separates what they did.",
        registrySlug: "pc-estimate-moment",
      },
    },
    bars: [
      { label: "Started quote form", value: 19.7, display: "19.7%" },
      { label: "On quote page", value: 5.7, display: "5.7%" },
      { label: "On homepage", value: 1.6, display: "1.6%" },
      { label: "On price checker", value: 0.6, display: "0.6%" },
      { label: "Just saw a price", value: 0.4, display: "0.4%" },
    ],
    barCaption:
      "MODEL ESTIMATES (Aug 13 run), not raw conversion rates: the model's view of a visit's chance of eventually becoming a lead from each state, looking one step at a time. Raw rates differ (homepage entries convert at 5.8% raw; the model shows 1.6% here because it forgets history). The form leads by construction — it is the last step — so the useful comparison is among the states before it, and the useful question is how fast a visit gets from one of them into the form.",
    sections: [
      {
        title: "How visits become journeys",
        body: "The site records a small vocabulary of first-party signals: page views, form starts, price estimates shown, calculator results, and estimate-email captures. Each visit (a 30-minute activity window) becomes an ordered sequence of those steps, collapsed into page groups like Homepage, Quote page, Price checker, Corridor pages. A visit ends in one of two states: it converted (a lead record from the same visitor inside the visit window) or it exited. Duplicate double-clicked submissions are folded into one conversion, and our own test submissions are excluded from conversions. The field-level form telemetry added Aug 12 is excluded from journeys on purpose so refreshes stay comparable to the original read.",
      },
      {
        title: "Where visits enter, and how each entry converts",
        table: {
          headers: ["Entry point", "Visits", "Converted", "Rate"],
          rows: [
            ["Quote page", "779", "28", "3.6%"],
            ["Price checker", "514", "3", "0.6%"],
            ["Homepage", "394", "23", "5.8%"],
            ["Promise pages", "103", "0", "0%"],
            ["Ship-vs-drive calculator", "57", "2", "3.5%"],
            ["Corridor pages", "18", "0", "small sample"],
            ["Everything else", "143", "1", "small"],
          ],
        },
        note: "Homepage entries browse, build trust, and convert best. Paid traffic mostly enters directly on the quote page or the price checker, and the gap between those two rows is the story: the quote page converts 6x better as a front door than the price tool.",
      },
      {
        title: "Where converting visits pass through",
        table: {
          headers: ["State the visit is in", "Visits touching it", "Eventually converts"],
          rows: [
            ["Started the quote form", "254", "19.7%"],
            ["On the quote page", "913", "5.7%"],
            ["On a corridor page", "27", "5.4% (small sample)"],
            ["On the homepage", "436", "1.6%"],
            ["On a promise page", "156", "0.8%"],
            ["On the price checker", "532", "0.6%"],
            ["Just saw a price estimate", "161", "0.4%"],
            ["Using ship-vs-drive", "155", "0.4%"],
          ],
        },
        note: "These are MODEL ESTIMATES from the Aug 13 run — the model's one-step view, not raw page conversion rates. The form's 19.7% is arithmetic, not insight — it is the last step before the lead, so of course it leads the table. What the table is good for is sizing the two rates that actually decide lead volume, and they multiply: REACH (919 quote-page visits produced 258 form starts — 28.1%, restated Aug 18; the table's 913/254 are the Aug 13 model run's counts, within 2% of the same thing) times COMPLETION (24.0% of starters finish) lands near the quote page's modeled 5.7%. Those are the only two numbers on this page worth optimizing; every other row is geography, not a scoreboard. Reach is the larger prize today because the pool is bigger — 661 visits reached the quote page and never started. And beware reading the rest as page value: homepage entries convert at 5.8% raw while the homepage state shows 1.6% here, because the model looks one step at a time and forgets history.",
      },
      {
        title: "The quote path in numbers (restated Aug 18 — every line reconciles)",
        bullets: [
          "919 visits reached the quote page in the baseline month (Jul 14 – Aug 14).",
          "258 of them started the form (28.1%), which means 661 never started — the pre-form pool, by subtraction.",
          "62 of the 258 starters finished (24.0%), which means 196 abandoned — the post-start pool, by subtraction. The captcha and field count were the suspects; the field-level telemetry now live is naming exact fields (see the early read below).",
          "The price cliff: 146 of 162 visits that saw a price-checker estimate (90%) did nothing afterward, and only 5 continued to the quote page. Today the moment after the price is a dead end; the Aug 13 redesign puts the strongest ask on the site exactly there.",
        ],
      },
      {
        title: "What we still can't see, and the plan for it",
        body: "Phone calls are roughly a third of tracked conversions and none of them appear in these journeys: a caller looks like an exit. Call records began capturing which page the caller was on as of Aug 10; call volume is thin, so a reliable read needs 4 to 6 weeks of data, around mid-September. If price viewers turn out to be heavy callers, the cliff shrinks and the redesign priority shifts from rescuing those visits to making the call path even easier. Either answer is useful. Separately, the quote form's own price moment is unmeasured until it emits the estimate event; that instrumentation ships with the next form release.",
      },
      {
        title: "Refreshed Aug 13 - what changed and why",
        bullets: [
          "Numbers refreshed on a full 30-day window with the identical method. The core rates barely moved (completion 22.2% to 22.0%, price-moment exits 87.2% to 87.0%), which strengthens confidence that both are real patterns rather than noise.",
          "After an external review of the original study, two claims were corrected. The claim that estimate viewers convert at half the rate of non-viewers was removed: it rested on 2 conversions and does not survive statistical scrutiny. And the top finding was reframed from form completion alone to the full quote path, because the pool that never starts the form is nearly 4x the pool that abandons it.",
          "The price cliff is now labeled as a price-checker finding, since nearly all measured estimates come from that tool.",
          "The pass-through table's authority was softened: it describes where converting visits travel, it does not rank page value.",
          "What the study drove since Aug 10: the Aug 12 form release (fewer fields, honest price copy, field-level drop-off telemetry) and the specification of a five-week quote-flow test.",
        ],
      },
      {
        title: "Early read, Aug 18 — how the August changes are tracking",
        body: "Two changes shipped mid-August: the redesigned quote form (Aug 12) and the price-checker fix-plus-redesign (Aug 13 — the tool's get-a-quote buttons had been sending visitors to an EMPTY form since launch because of mismatched link parameters, now fixed, plus a prominent lock-this-price block under every estimate). Four days of data is enough to check direction and plumbing, not to declare results.",
        bullets: [
          "New form vs old, completion: 27% (20 of 74 starts) vs 24% (55 of 225). Right direction, but the gap is well inside the noise at this sample size — no call yet.",
          "Where the new form loses people (first field-level read, 54 abandoned visits): the vehicle-type step is the most common last touch before giving up (13 visits), ZIP entry drew 7 validation errors, and the captcha expired mid-form 3 times. Concrete, fixable, and exactly what this telemetry was added to find.",
          "Price-checker handoff: 0 of 18 post-fix estimate visits continued to the quote page, against a 3% pre-fix baseline. Eighteen visits can't distinguish 0% from 15%, so before reading anything into it we verified the mechanics live on Aug 18: ran a real route, clicked the new block, and the quote form arrived with route and vehicle correctly pre-filled. The plumbing works; the behavioral question needs roughly a month of estimate traffic (~150 visits) for a real answer.",
          "Overall funnel, post-change window: 26% of quote-page visits started the form (vs 28% baseline) and 32% of starters finished (vs 24%) — both consistent with no change at this sample size. Next scheduled reads: price-checker handoff mid-September alongside the call-page re-read; form completion when the new form has ~200 starts.",
        ],
        note: "Everything in this section is deliberately phrased as an early read. The window is four days and it spans a weekend, so weekday-heavy baselines are not directly comparable. This section will be replaced by measured results at the next refresh.",
      },
    ],
  },
  {
    slug: "remoteness-premium",
    sections: [
      {
        title: "The baseline curve",
        body: "First we fitted carrier pay against road miles alone across the 273 continental orders. The result is a tapering curve (long hauls cost less per mile) that explains about two-thirds of the variation in what carriers get paid. The remoteness question is about the third the miles curve can't explain: which orders book above or below it, and why.",
      },
      {
        title: "Measuring remoteness",
        body: "Every pickup and delivery ZIP was measured by straight-line distance to the nearest of ~70 major U.S. metros. The first 50 miles are treated as free (normal metro sprawl); anything beyond counts as excess remote miles, summed across both ends of the move. A route from a metro to a town 120 miles past one scores 70 excess miles.",
      },
      {
        title: "Results by remoteness bucket",
        table: {
          headers: ["Route type", "Orders", "vs miles-only curve", "Median premium"],
          rows: [
            ["Both endpoints metro", "156", "13% below", "carriers are cheap where supply is thick"],
            ["Up to 50 excess miles", "52", "8% below", "still effectively metro"],
            ["50 to 150 excess miles", "54", "12% above", "+$141"],
            ["150+ excess miles", "11", "24% above", "+$230"],
          ],
        },
        note: "The slope works out to about $2.04 of extra carrier pay per excess remote mile (statistically solid, t = 2.8). Delivery-side remoteness matters at least as much as pickup-side: the truck drives out of a remote delivery empty.",
      },
      {
        title: "Robustness checks",
        bullets: [
          "The pattern holds independently in both halves of the year (Feb–May and Jun–Jul), so it is not a seasonal artifact.",
          "Excluding three suspected multi-vehicle orders strengthens the slope to about $2.30 per mile (t = 4.9) rather than weakening it.",
          "Trimming the extreme 5% on each end gives $2.06 per mile — the estimate barely moves.",
          "California-only and non-California orders show nearly the same slope ($1.91 vs $1.83), so it is not a one-region quirk.",
          "A median-based read agrees: remote orders book about $262 above metro-metro orders relative to the curve.",
          "Hawaii and Alaska (10 orders) sit entirely off the curve at $1.9K–$4.6K carrier pay — confirmation they need their own price table, never the formula.",
        ],
      },
      {
        title: "Why we haven't priced it in yet",
        body: "The premium lives in carrier pay, not in our fee. The website already prices from a live carrier-market estimate, so the finding only changes quotes if that live estimate misses remoteness — and adding our premium on top of an estimate that already includes it would overquote remote routes. So the rollout is deliberate: first, silently log an internal floor (miles curve plus the remoteness term) alongside every quote; after about two weeks, compare the live estimates against the floor specifically on remote routes; only if the live estimate systematically sits below the floor does the floor go live. The premium is also easy to stand behind: fewer carriers run remote routes, which is a cost reason, not an opportunistic one.",
      },
    ],
    title: "The remoteness premium",
    date: "2026-07-30",
    headline:
      "Routes far from major metros cost about $2 more per remote mile to cover; the deepest-remote routes book ~24% above the distance curve.",
    status: "Feeding pricing v2 (remote-route floor)",
    question:
      "Do routes far from big metro areas really cost more to cover, and if so, by how much?",
    method:
      "Took 273 booked continental orders, measured how far each pickup and delivery ZIP sits from the nearest of ~70 major U.S. metros, and compared what carriers were actually paid against a distance-only baseline. Checked the result held in both halves of the year, with and without outliers.",
    findings: [
      "Carrier pay rises about $2 for every mile a pickup or delivery sits beyond 50 miles from a major metro. Remote deliveries matter at least as much as remote pickups (the truck drives out empty).",
      "Metro-to-metro moves book about 13% BELOW the distance curve. Dense corridors are cheap because carrier supply is thick there.",
      "The most remote routes (150+ excess miles) book roughly 24% above the curve, about $230 median.",
      "Hawaii and Alaska are a different market entirely, priced off their own table, never the formula.",
    ],
    caveats: [
      "The deepest-remote bucket is small (11 orders): the direction is solid, the exact size is an estimate.",
      "Built from our own book, which skews toward our lanes.",
    ],
    informed: [
      "The next pricing version adds a remoteness-aware floor so remote quotes stay accurate instead of underquoting and forcing an awkward call.",
      "Being validated against live carrier estimates first so we never double-count a premium the market data already includes.",
    ],
    chartHref: "/admin/analysis/remoteness-premium/chart",
  },
  {
    slug: "flat-fee-discovery",
    sections: [
      {
        title: "The fit",
        body: "A straight-line fit of our fee against carrier pay across all 336 booked orders lands at a $149 base plus 9.1% of carrier pay, with a correlation of 0.73 and a median miss of just $32. In production this became: $150 base plus 9% of the carrier estimate, capped at $400, displayed rounded to the nearest $5 (never $X99 — consistent with the no-games brand). 88% of all booked fees fall between $150 and $350.",
      },
      {
        title: "Why a smooth ramp instead of price tiers",
        body: "An earlier draft used a tiered fee ladder ($199 / $259 / $349 by move size). The fitted ramp replaced it for two reasons: tier edges create cliffs where two nearly identical moves get visibly different fees, and the ramp's parameters come from the book rather than from argument. The service tiers (standby / priority / expedited) remain routing labels, not price multipliers.",
      },
      {
        title: "The validation stream",
        body: "Every website quote silently logs its model and the raw carrier estimate server-side, so web-vs-agent comparisons accumulate automatically. The early head-to-head sample (six quotes at analysis time) showed excellent average calibration — median difference +2.6%, mean effectively zero — but a wide spread from 24% under to 29% over. The average said the old model looked fine; the spread is what was losing bookings on both tails, and the spread is what the fitted model fixes. Watching it tighten as rows accrue is the ongoing test.",
      },
    ],
    title: "How winning deals actually price",
    date: "2026-07-24",
    headline:
      "All 336 booked orders decompose as carrier cost plus a predictable service fee. Nobody closes on a percentage markup.",
    status: "Shipped as website pricing v1 (Jul 28)",
    question:
      "How do our agents actually price the deals that close, and does the website quote the same way?",
    method:
      "Decomposed every booked order into carrier pay plus our fee, then fitted how the fee scales with the size of the move.",
    findings: [
      "Every single booked order follows the same structure: carrier cost plus a service fee. Percentage markup appears nowhere in real closed deals.",
      "The fee scales gently with move size: a median of about $159 on the smallest moves up to about $395 on the largest, $245 median overall.",
      "The website's old percentage markup overquoted big moves (losing the lead before the phone rang) and underquoted small ones (sticker shock when the agent walked it up). Both tails cost bookings.",
    ],
    caveats: [
      "Head-to-head comparisons of website quote vs agent quote are still a small sample; they are the ongoing validation stream.",
    ],
    informed: [
      "Website pricing v1 shipped Jul 28: live carrier-market estimate plus the fitted fee. The site now quotes the way the team closes.",
      "Prices display rounded to the nearest $5, never $X99 — consistent with the no-games brand.",
    ],
    bars: [
      { label: "Small moves", value: 159, display: "$159" },
      { label: "~$450 carrier", value: 195, display: "$195" },
      { label: "~$900 carrier", value: 240, display: "$240" },
      { label: "~$1,150 carrier", value: 245, display: "$245" },
      { label: "~$1,700 carrier", value: 295, display: "$295" },
      { label: "Largest moves", value: 395, display: "$395" },
    ],
    barCaption:
      "Median service fee by size of move, from 336 booked orders (Mar–Jul 2026). The gentle ramp is the pattern the website now quotes.",
  },
  {
    slug: "search-terms-autopsy",
    sections: [
      {
        title: "The numbers",
        table: {
          headers: ["Measure", "Value"],
          rows: [
            ["All-time ad spend audited", "$6,072"],
            ["Recorded conversions", "194 (cost per: $31.30)"],
            ["Spend that reached real car-shipping searches", "under 8% (~$477)"],
            ["Conversions from real car-shipping intent", "13"],
            ["Spend invisible to the search-terms report", "$3,454"],
          ],
        },
        note: "Most of the 194 recorded conversions were wrong-intent phone calls, which is why the account looked healthy while producing almost no real business.",
      },
      {
        title: "What the wrong traffic was",
        bullets: [
          "Generic delivery and courier searches: door-to-door transport, small truck delivery service, transportation services near me.",
          "Medical transport, furniture moves, and other services we don't offer, matched by an over-broad automated campaign.",
          "Auction-visibility data confirmed the account had effectively never competed in real car-shipping auctions (impression share below the reporting threshold).",
        ],
      },
      {
        title: "The two real signals in the wreckage",
        bullets: [
          "Competitor brand-name searches appeared and converted — evidence for a future conquesting test, filed for when volume justifies it.",
          "Scam-wary searches (auto transport companies to avoid) converted. Trust content wins customers, which earned the anti-scam guide its own ad group and shaped the price-integrity messaging across the site.",
        ],
      },
    ],
    title: "Where the old ad spend actually went",
    date: "2026-07-15",
    headline:
      "Under 8% of the account's historical ad spend reached real car-shipping searches.",
    status: "Shaped the July ads relaunch",
    question: "What did the account's historical advertising actually buy?",
    method:
      "Pulled the account's all-time search-terms report and classified every query that ever triggered an ad: real car-shipping intent vs couriers, furniture delivery, medical transport, and other wrong-number traffic.",
    findings: [
      "Under 8% of historical spend reached actual car-shipping searches. Most recorded \"conversions\" were wrong-intent phone calls.",
      "The account had effectively never competed in real car-shipping auctions (impression share too low to register).",
      "Scam-wary searches like \"auto transport companies to avoid\" appeared and converted — evidence that trust content wins customers.",
    ],
    caveats: [
      "Search-term reports only show a portion of queries; the classified sample is what Google exposes.",
    ],
    informed: [
      "The entire relaunch structure: every campaign now maps to a proven customer intent, with negative keywords walling off the wrong-number traffic.",
      "The anti-scam guide got its own ad group — trust as an acquisition channel, not just brand polish.",
    ],
  },
  {
    slug: "serving-days-recalc",
    sections: [
      {
        title: "Before and after",
        table: {
          headers: ["Measure", "Before", "After"],
          rows: [
            ["Account daily budget", "$224 (monthly ÷ 30 calendar days)", "$269 (monthly ÷ ~21 serving days)"],
            ["Required per serving day to hit the month", "$300", "$300 (now within reach of pacing)"],
            ["Impressions lost to budget, corridor campaign", "79% on the trigger day", "50% next day, on track down"],
            ["Impressions lost to budget, segments campaign", "54%", "29% next day"],
          ],
        },
        note: "On the trigger day the account as a whole was losing ~30% of its available impressions to budget caps, concentrated in the cheapest converting campaigns.",
      },
      {
        title: "Same-day evidence it worked",
        bullets: [
          "The account set its click record (89) the day after the change, at the same total spend as before.",
          "Average click cost on the corridor campaign crept only from $2.87 to $3.07 — the extra budget bought volume, not inflation.",
        ],
      },
      {
        title: "The discipline that made it readable",
        body: "One lever per campaign. Rank-limited campaigns (ones losing to ad quality, not budget) got no raise, because budget buys nothing against a rank problem. Keeping the levers separate is what made the next experiment (bid caps) readable a week later.",
      },
    ],
    title: "The serving-days budget correction",
    date: "2026-07-29",
    headline:
      "Budgets were derived from calendar days, but ads run weekdays only — the best campaigns were starving ~25% below their real daily need.",
    status: "Applied to all campaign budgets",
    question:
      "Why were the strongest campaigns hitting their budget ceilings while the monthly budget went underspent?",
    method:
      "Compared how daily budgets had been derived (monthly budget ÷ 30 calendar days) against the actual serving schedule (weekdays only), then measured how much auction volume each campaign was losing to budget caps.",
    findings: [
      "The right divisor is ~21 serving days, not 30. Daily budgets were ~25% underfunded for the days ads actually run.",
      "On peak days the account was losing about 30% of its available impressions to budget caps, concentrated in the cheapest converting campaign.",
    ],
    caveats: [],
    informed: [
      "All budgets re-derived on serving days (Jul 29). The corridor campaign's budget starvation halved within one day; account clicks set a record that same day at the same total spend.",
    ],
  },
  {
    slug: "bid-cap-experiment",
    sections: [
      {
        title: "Design",
        body: "Single variable: the research campaign's maximum bid ceiling was cut from $12 to $6 (about twice its average click cost), with budget untouched. Success was defined before the change as cost per research action — price checks and calculator completions — not raw clicks, because cheap clicks that do nothing are how ad experiments fool you.",
      },
      {
        title: "Results",
        table: {
          headers: ["Read", "Clicks", "Avg click cost", "Cost per research action"],
          rows: [
            ["Baseline (pre-change window)", "—", "$2.94 avg", "$9.96"],
            ["Day 1", "22", "$2.38", "$7.47 (−25%)"],
            ["Verdict window (2 serving days)", "42", "$2.63", "$6.91 (−31%)"],
          ],
        },
        note: "Budget delivery stayed full (about 5% lost to budget), meaning the same dollars bought measurably more learning data.",
      },
      {
        title: "Where the mechanism applies, and where it never does",
        bullets: [
          "Only where budget is the binding constraint. A campaign limited by ad rank gets worse from lower bids, so rank-limited campaigns are never capped.",
          "The doctrine was extended to two more campaigns at roughly twice their average click cost, each with a pre-set revert trigger.",
          "Standing watch: if the converter campaign's conversion rate sags under its cap (cheaper clicks but worse ones), it reverts at the next weekly read. The trigger was defined before the change, not after.",
        ],
      },
    ],
    title: "The bid-cap experiment",
    date: "2026-08-04",
    headline:
      "Halving the bid ceiling on the research campaign bought the same traffic 31% cheaper per research action.",
    status: "Cap permanent; doctrine extended to 2 more campaigns",
    question:
      "While campaigns are in learning mode, do lower bid ceilings buy more data for the same money?",
    method:
      "Two-week single-variable test: the research campaign's bid ceiling cut in half, budget untouched, judged on cost per research action (price checks, calculator completions) rather than raw clicks.",
    findings: [
      "31% cheaper per research action, at full budget delivery. Same dollars, more learning data.",
      "The mechanism only works where budget is the binding constraint — campaigns limited by ad rank get worse, not better, from lower bids.",
    ],
    caveats: [
      "Measured on research actions, not booked leads; the lead-level read accrues as volume grows.",
    ],
    informed: [
      "The cap is permanent, and the doctrine (cheaper clicks while learning, budget raises only when cost-per-lead earns them) now governs two more campaigns.",
    ],
  },
  {
    slug: "order-book",
    sections: [
      {
        title: "Month by month",
        table: {
          headers: ["Month", "Broker fees", "Orders"],
          rows: [
            ["March", "$1,530", "7"],
            ["April", "$8,996", "41"],
            ["May", "$32,512", "122"],
            ["June", "$27,796", "113"],
            ["July", "$22,099", "84"],
            ["August (first 2 business days)", "$2,925", "12 — fastest month-open in the book"],
          ],
        },
        note: "May was a spike, not a baseline; this is the business's first year, so seasonality is being learned live.",
      },
      {
        title: "Price per road mile by distance",
        table: {
          headers: ["Distance", "Median booked $/mile"],
          rows: [
            ["Up to 250 mi", "$3.82"],
            ["250–500 mi", "$1.94"],
            ["500–1,000 mi", "$1.40"],
            ["1,000–1,500 mi", "$1.05"],
            ["1,500–2,000 mi", "$0.90"],
            ["2,000–2,500 mi", "$0.75"],
            ["2,500+ mi", "$0.69"],
          ],
        },
        note: "Short moves price steep and the curve flattens with distance. Mileage is estimated from ZIP centroids with a road factor, validated to about 1% median error against full-address calculations.",
      },
      {
        title: "The speed of the business",
        bullets: [
          "53% of customers who book do it the same day they first reach us; 82% within a week. Speed-to-lead is the whole game.",
          "The median order ships 4 days after booking; 35% need pickup same or next day. A third of the market self-identifies as urgent at the date field.",
          "About 12% of customers come back for another move; 51 snowbird candidates and 23 business/dealer contacts are queued for outreach.",
        ],
      },
      {
        title: "Method notes",
        bullets: [
          "Every pull is deduplicated by order ID (the raw export duplicates rows in side-by-side blocks).",
          "Fees are booking deposits — Auto Line's actual revenue. Gross is the full move price including what the carrier is paid.",
          "Each monthly pull is reconciled against the prior one; April through June matched to the dollar.",
        ],
      },
    ],
    title: "The order book as a business",
    date: "2026-08-04",
    headline:
      "379 booked orders since March: $95.9K in broker fees on $560K gross moved (17.1%), with clear repeat, seasonal, and B2B segments.",
    status: "Refreshed monthly (first business day)",
    question: "What does the whole book look like as a business?",
    method:
      "Monthly reconciled pull of every booked order since March, deduplicated by order ID and cut by month, geography, customer type, and urgency.",
    findings: [
      "379 orders · $95.9K fees on $560K gross moved · $253 average fee.",
      "31% of orders touch California; the busiest corridors match the ad campaign structure.",
      "About 12% of customers are repeats; 51 snowbird candidates and 23 business/dealer contacts identified for outreach.",
      "35% of customers need pickup within 48 hours; the median order ships 4 days after booking. Urgency is a real segment, not an edge case.",
    ],
    caveats: [
      "Fees recorded are booking deposits (our revenue); gross is the full move price including carrier pay.",
    ],
    informed: [
      "The Business view outreach tables (repeats / snowbirds / B2B), October snowbird planning, and the monthly report scorecard.",
    ],
  },
];

export function getStudy(slug: string): Study | undefined {
  return STUDIES.find((s) => s.slug === slug);
}
