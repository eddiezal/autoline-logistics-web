/**
 * Analysis Library registry — the studies behind the decisions.
 *
 * Each entry is a full write-up: the question, the method in plain English,
 * findings, honest caveats, and the decision the study informed. Rendered at
 * /admin/analysis (index) and /admin/analysis/[slug] (detail). Client-visible
 * (Ben has /admin) — write for his eyes; keep pricing-model internals at the
 * level already shared in the quarterly deck, no deeper.
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

export const STUDIES: Study[] = [
  {
    slug: "behavioral-journey",
    title: "How visitors actually move through the site",
    date: "2026-08-10",
    headline:
      "Starting the quote form makes a visit 10x more likely to convert, but only 22% who start it finish. And 87% of visitors leave immediately after seeing a price.",
    status: "Driving the quote-form and estimate-moment fixes",
    question:
      "Where do visits die on the site, and what do the visits that turn into leads do differently?",
    method:
      "Modeled a month of first-party site activity (2,506 tracked actions across 1,636 visits) as step-by-step journeys: every visit becomes a sequence of pages and actions ending in either a lead or an exit. From those sequences we computed, for every page and action, the probability that a visit standing there eventually converts. Probabilities resting on fewer than 20 observations are withheld rather than reported.",
    findings: [
      "The quote form is the site's biggest lever. 192 visits started the form; only 22% finished. A visit that reaches the form is 10x more likely to convert than the average visit, so every extra completion is nearly a lead. Lifting completion from 22% to 30% would add roughly 15 leads a month with zero extra ad spend.",
      "Seeing a price is where the most visitors leave: 87% exit immediately after an estimate renders, and visits that saw an estimate converted at half the rate of visits that didn't (1.4% vs 2.8%). The likely story: the number satisfies their research and they take it comparison shopping. The moment after the price renders is the most valuable unused screen real estate on the site.",
      "Where a visit enters matters. Visits entering on the homepage convert at 6.0%, entries straight to the quote page at 3.5%, and entries to the price-checker tool at just 0.7% despite being 28% of all traffic.",
      "The ship-vs-drive calculator is engagement, not funnel: people cycle it repeatedly and then leave (0.3% eventual conversion). Fine as content; it should hand off harder to the quote form.",
      "Corridor pages barely register: 13 tracked visits all month. The search-ranking fixes shipped last week should change this; worth re-reading in a month.",
    ],
    caveats: [
      "Descriptive, not causal. People who ask for a price were already hotter or colder on their own; the model ranks where attention and drop-off live, it cannot prove that changing a page changes outcomes.",
      "Phone calls are invisible here. A visitor who sees a price and dials the number counts as an exit. With roughly 30 calls a month against 44 tracked web conversions, this could soften the price-moment finding. Instrumentation to tie calls to the page the caller was on shipped 2026-08-10; the finding gets re-verified about two weeks later.",
      "14 of 58 web leads that month could not be matched to a tracked visit (very fast submissions or lost signals), so conversion probabilities are floors.",
      "One month of data from a young tracking system; small pages are suppressed rather than guessed at.",
    ],
    informed: [
      "Quote-form friction review moved to the top of the site roadmap (fewer fields, lighter verification step).",
      "The estimate moment gets redesigned: the email-me-this-estimate offer and a stronger lock-this-price handoff belong exactly where 87% currently walk away.",
      "Confirmed the research-traffic campaign's budget cut from the paid-media side: its landing tool converts 0.7% of entries.",
      "Corridor-page traffic re-read scheduled after the search fixes settle.",
    ],
    bars: [
      { label: "Started quote form", value: 19.6, display: "19.6%" },
      { label: "On quote page", value: 5.5, display: "5.5%" },
      { label: "On homepage", value: 1.7, display: "1.7%" },
      { label: "On price checker", value: 0.6, display: "0.6%" },
      { label: "Just saw a price", value: 0.4, display: "0.4%" },
    ],
    barCaption:
      "Chance a visit eventually becomes a lead, given where it is right now.",
    sections: [
      {
        title: "How visits become journeys",
        body: "The site records a small vocabulary of first-party signals: page views, form starts, price estimates shown, calculator results, and estimate-email captures. Each visit (a 30-minute activity window) becomes an ordered sequence of those steps, collapsed into page groups like Homepage, Quote page, Price checker, Corridor pages. A visit ends in one of two states: it converted (a lead record from the same visitor inside the visit window) or it exited. Duplicate double-clicked submissions are folded into one conversion, and our own test submissions are excluded.",
      },
      {
        title: "Where visits enter, and how each entry converts",
        table: {
          headers: ["Entry point", "Visits", "Converted", "Rate"],
          rows: [
            ["Quote page", "605", "21", "3.5%"],
            ["Price checker", "454", "3", "0.7%"],
            ["Homepage", "316", "19", "6.0%"],
            ["Promise pages", "82", "0", "0%"],
            ["Ship-vs-drive calculator", "45", "0", "0%"],
            ["Everything else", "134", "1", "small"],
          ],
        },
        note: "Homepage entries browse, build trust, and convert best. Paid traffic mostly enters directly on the quote page or the price checker, and the gap between those two rows is the story: the quote page converts 5x better as a front door than the price tool.",
      },
      {
        title: "The chance of converting, from every state",
        table: {
          headers: ["State the visit is in", "Visits touching it", "Eventually converts"],
          rows: [
            ["Started the quote form", "192", "19.6%"],
            ["On the quote page", "711", "5.5%"],
            ["On the homepage", "349", "1.7%"],
            ["On a promise page", "121", "0.9%"],
            ["On the price checker", "466", "0.6%"],
            ["Just saw a price estimate", "141", "0.4%"],
            ["Using ship-vs-drive", "126", "0.3%"],
          ],
        },
        note: "Reaching the form is the watershed: nothing else on the site comes close to its 19.6%. Everything upstream should be judged by how well it moves people to the form.",
      },
      {
        title: "The two findings that matter",
        bullets: [
          "Form abandonment: of 192 form starts, 129 exited without finishing (67%). The captcha and field count are the suspects. This is the cheapest 15 leads a month available anywhere in the business.",
          "The price cliff: 87.2% of visits exit immediately after an estimate renders, the worst exit rate of any state. Only 2 of 140 estimate-viewing visits converted. Today the moment after the price is a dead end; it should be the strongest ask on the site.",
        ],
      },
      {
        title: "What we still can't see, and the plan for it",
        body: "Phone calls are a third of tracked conversions and none of them appear in these journeys: a caller looks like an exit. As of this study's date, call records now capture which page the caller was on when they dialed. Once two weeks of that data accrues, the price-cliff finding gets re-read: if price viewers turn out to be heavy callers, the cliff shrinks and the redesign priority shifts from rescuing those visits to making the call path even easier. Either answer is useful.",
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
