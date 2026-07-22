/**
 * Blog article #4 (2026-07-22).
 * Topic: How to get an ACCURATE car shipping quote + mistakes to avoid.
 * Approach: V2 Industry Insider + V5 FAQ block hybrid (house style).
 * Cluster: planning-shipment.
 *
 * WHY THIS ARTICLE: GSC 28-day read (Jul 22) shows a live non-brand
 * cluster with zero clicks — "auto transport quote tips" (18 impressions),
 * "how to get accurate car shipping estimates", "mistakes to avoid in car
 * shipping", "should you ship a car or drive it". This page consolidates
 * that cluster into one authoritative target and is internally linked from
 * the corridor pages. Spanish sibling: como-obtener-cotizacion-precisa.
 */
import type { Article } from "@/lib/blog/types";

export const article: Article = {
  slug: "accurate-car-shipping-quote",
  language: "en",
  title: "How to Get an Accurate Car Shipping Quote (9 Tips + the Mistakes That Cost You)",
  subtitle:
    "Most car shipping quotes are built to win your booking, not to predict your final price. Here is how to feed a quote engine the right information, read the numbers that come back, and spot the ones that were never real.",
  metaDescription:
    "Nine practical tips for getting an accurate auto transport quote — what details actually move the price, how to compare quotes, the mistakes that cost real money, and when driving beats shipping.",
  publishedAt: "2026-07-22",
  updatedAt: "2026-07-22",
  author: "Auto Line Logistics",
  readMinutes: 9,
  category: "Buyer guide",
  cluster: "planning-shipment",
  hubLink: { label: "Anti-scam guide", href: "/anti-scam" },
  sections: [
    {
      kind: "pp",
      texts: [
        "A car shipping quote is a prediction. Someone is telling you what a truck driver they have never spoken to will accept, on a route with prices that move weekly, for a vehicle they are trusting you to describe correctly. Done honestly, that prediction can be tight. Done the way much of this industry does it, the quote is a marketing number — set low enough to win your booking, adjusted upward later when reality arrives.",
        "The good news: accuracy is mostly a process, and you control half of it. The information you give, the questions you ask, and the way you read the answers determine whether the number you plan around is the number you pay.",
        "Here is the process, from someone on the inside of the pricing machine.",
      ],
    },

    { kind: "h2", text: "Why quotes vary so much for the same route" },
    {
      kind: "pp",
      texts: [
        "Ask five companies to ship the same sedan from Los Angeles to Dallas and you may get five numbers spread $400 apart. That spread has two honest causes and one dishonest one.",
        "Honest cause one: timing. Carrier prices move with fuel, season, and how many trucks happen to be on that lane this week. A quote pulled from live market data and a quote pulled from last quarter's rate sheet will legitimately disagree.",
        "Honest cause two: what's included. Door-to-door versus terminal, open versus enclosed, a real insurance chain versus 'the carrier probably has coverage' — these change the cost of the service, not just the price of it.",
        "The dishonest cause: some brokers quote a number no carrier will accept, collect your deposit, and renegotiate when pickup week arrives. If one quote sits 20% below the pack, it is not a bargain — it is bait. We wrote a whole explainer on that pattern; the short version is that the lowest quote is usually the most expensive one.",
      ],
    },

    { kind: "h2", text: "The 9 tips for an accurate quote" },

    { kind: "h3", text: "1. Use exact ZIP codes, not city names" },
    {
      kind: "p",
      text: "\"Los Angeles to Dallas\" spans a hundred miles of real pickup geography. A ZIP in a dense metro grid prices differently from a ZIP up a canyon road thirty minutes from the freeway. Every accurate quote starts with two five-digit ZIPs. If a form only asks for cities, it is estimating loosely by design.",
    },

    { kind: "h3", text: "2. Describe the vehicle exactly — including the embarrassing parts" },
    {
      kind: "p",
      text: "Year, make, model, and the honest extras: lift kit, roof rack, oversized tires, a trunk full of boxes, or a car that does not run. An inoperable vehicle needs a winch truck. A lifted truck takes a taller slot on the trailer. Mis-described vehicles are the number one legitimate reason prices change at pickup — and the number one excuse dishonest brokers reach for. Take that excuse off the table.",
    },

    { kind: "h3", text: "3. Be straight about your dates" },
    {
      kind: "p",
      text: "Flexibility is a discount. A three-to-five-day pickup window lets a dispatcher slot you into a truck that is already coming; \"it must leave tomorrow\" means paying a premium for whoever is closest. If your dates are hard, say so and accept the premium as real. If they're soft, say that too — it is the cheapest lever you have.",
    },

    { kind: "h3", text: "4. Ask the one clarifying question: \"Is this locked, or an estimate?\"" },
    {
      kind: "p",
      text: "This single question sorts the industry. An estimate can move; a locked price cannot. Make the company say which one you are holding, in writing. If the answer is hedged — \"it's usually accurate,\" \"prices rarely change\" — you have an estimate wearing a locked price's clothes.",
    },

    { kind: "h3", text: "5. Compare three or more quotes — and read the outlier correctly" },
    {
      kind: "p",
      text: "Three quotes give you the market's real shape: a cluster and maybe an outlier. The cluster is what carriers actually accept. A high outlier might be enclosed transport or white-glove service. A low outlier, 20% or more under the cluster, is a number designed to win a phone call. Cross it off first, not last.",
    },

    { kind: "h3", text: "6. Ask exactly what the number includes" },
    {
      kind: "p",
      text: "Door-to-door or terminal-to-terminal? Is the carrier's cargo insurance verified, and for how much? Fuel included? Any \"dispatch fee\" or \"broker fee\" arriving later? An accurate quote is an all-in quote. Anything itemized after you commit was hidden on purpose.",
    },

    { kind: "h3", text: "7. Ask where the price comes from" },
    {
      kind: "p",
      text: "\"How did you price this?\" is a fair question and the answers are revealing. Live market data from the load boards where carriers actually accept loads this week is one kind of answer. A rate sheet, a national average, or silence is another. Prices set from stale data are wrong in one direction or the other — and never in your favor for long.",
    },

    { kind: "h3", text: "8. Respect the season and the direction" },
    {
      kind: "p",
      text: "January trucks pour into Florida full and come back empty; snowbird season inverts twice a year. Routes into remote areas cost more than the mileage suggests; return legs on busy loops (Texas back to California, for example) can price surprisingly well because carriers need loads home. If your dates can slide a couple of weeks around a seasonal peak, the same shipment gets cheaper.",
    },

    { kind: "h3", text: "9. Never pay a large deposit for an estimate" },
    {
      kind: "p",
      text: "A deposit should buy you a committed, locked price — not a place in line for a renegotiation. If the number can still move, your money should not have moved yet. This one rule filters out most of the industry's worst actors by itself.",
    },

    { kind: "h2", text: "Mistakes that cost real money" },
    {
      kind: "checklist",
      items: [
        { label: "Booking the cheapest of five quotes without asking why it's the cheapest", tone: "warn" },
        { label: "Hiding that the car doesn't run (the winch truck finds out anyway — at pickup)", tone: "warn" },
        { label: "Entering your phone number on a quote-comparison site that resells your info to a dozen brokers — the calls do not stop for weeks", tone: "warn" },
        { label: "Waiting until three days before you need the car moved, then negotiating from desperation", tone: "warn" },
        { label: "Treating a verbal number as a commitment — if it isn't written, it doesn't exist", tone: "warn" },
        { label: "Getting the quote in writing with a locked price and a named pickup window", tone: "ok" },
      ],
    },

    { kind: "h2", text: "Ship it or drive it?" },
    {
      kind: "pp",
      texts: [
        "The comparison people get wrong most often isn't between two quotes — it's between shipping and driving. Drivers count gas and forget everything else: hotels, meals, the extra 2,800 miles of depreciation and tire wear, the vacation days burned, and the risk exposure of a long haul.",
        "Run the honest math on a coast-adjacent route and driving usually costs within a few hundred dollars of shipping — before you price your own time at anything above zero. If the trip itself is the point, drive and enjoy it. If it's a chore standing between you and your move, that is exactly what transport carriers are for.",
      ],
    },

    {
      kind: "callout",
      tone: "brand",
      title: "How our quote works",
      body: "The number our calculator shows is pulled from live carrier market data for your exact ZIPs and vehicle, at the moment you ask — then it locks. No deposit to see it, no renegotiation at pickup week, and a bilingual team (English/Español) on the other end. It takes about two minutes and doesn't put you on anyone's call list.",
    },

    {
      kind: "cta",
      title: "Get a locked, all-in quote in two minutes",
      body: "Exact ZIPs in, real market price out. The number you see is the number you pay.",
      href: "/quote",
      label: "Get my locked quote",
    },
  ],
  faq: [
    {
      q: "How do I get an accurate car shipping quote?",
      a: "Give exact ZIP codes, describe the vehicle honestly (including modifications or if it doesn't run), be clear about date flexibility, and ask whether the number is a locked price or an estimate. Then compare against at least two other quotes and discard any outlier priced 20%+ below the pack.",
    },
    {
      q: "What information do I need to provide for a car shipping quote?",
      a: "Pickup and delivery ZIP codes, the vehicle's year, make, and model, whether it runs, any modifications (lift, racks, oversized tires), your preferred pickup window, and whether you need open or enclosed transport.",
    },
    {
      q: "Why are car shipping quotes so different from each other?",
      a: "Timing (live market data versus stale rate sheets), scope (door-to-door versus terminal, insurance verified or not), and honesty. A quote far below the cluster of other quotes is usually bait that gets renegotiated before pickup.",
    },
    {
      q: "Is it cheaper to drive or ship a car cross-country?",
      a: "Counting gas, hotels, meals, depreciation, and your time, driving a long route typically lands within a few hundred dollars of shipping — often more expensive once your days off have any value. Shipping wins on effort; driving wins only if you want the road trip.",
    },
    {
      q: "How far in advance should I book auto transport?",
      a: "Two to three weeks ahead is the sweet spot: enough lead time for dispatchers to place you on a truck already running your lane, without the last-minute premium. Booking day-of is possible but you pay for proximity, not efficiency.",
    },
  ],
  related: [
    {
      slug: "why-quotes-dont-hold",
      title: "Why your auto transport quote might not hold (and what to look for)",
      blurb: "Three reasons quotes get raised after booking + four questions to ask any broker.",
    },
    {
      slug: "why-quotes-go-up",
      title: "Why Your Car Shipping Quote Went Up at the Last Minute",
      blurb: "The bait-and-switch pattern explained: how it works, why it's profitable, and the warning signs.",
    },
  ],
  primaryCta: {
    eyebrow: "Ready for a number you can plan around?",
    title: "Get a locked, all-in price for your exact route",
    body: "Two ZIPs and a vehicle. Live market pricing, locked when you see it, no deposit required. English y Español.",
    href: "/quote",
    label: "Get my locked quote",
  },
};
