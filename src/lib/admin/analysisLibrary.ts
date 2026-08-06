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
}

export const STUDIES: Study[] = [
  {
    slug: "remoteness-premium",
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
