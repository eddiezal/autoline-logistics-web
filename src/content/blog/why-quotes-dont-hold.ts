/**
 * Phase A blog article #2 (replacement for deposit-before-driver).
 * Topic: Why your auto transport quote might not hold.
 * Approach: Consumer-language framing of the bid-and-bump pattern + 4-question
 *   action tool for the customer.
 * Cluster: avoiding-scams (linked to /anti-scam hub).
 * Created 2026-06-22 after Path 1 positioning shift.
 */
import type { Article } from "@/lib/blog/types";

export const article: Article = {
  slug: "why-quotes-dont-hold",
  language: "en",
  title: "Why Your Auto Transport Quote Might Not Hold (And What to Look For)",
  subtitle:
    "A low first quote does not always mean a fair price. Here is why some quotes get raised after you book, how to tell which ones are at risk, and the four questions you can ask any broker to find out.",
  metaDescription:
    "Why auto transport quotes get raised after booking, the data sources brokers use, and the four questions to ask a broker before paying a booking deposit.",
  publishedAt: "2026-06-22",
  updatedAt: "2026-06-22",
  author: "Auto Line Logistics",
  readMinutes: 7,
  category: "Buyer guide",
  cluster: "avoiding-scams",
  hubLink: { label: "Anti-scam guide", href: "/anti-scam" },
  sections: [
    {
      kind: "pp",
      texts: [
        "You called five brokers for the same shipment. One came in $300 below the rest. You paid a small booking deposit. Eight days later, the broker calls back: \"We cannot find a carrier at that price. We need another $400, or you can cancel and lose the deposit.\"",
        "Is that a scam? Is it a normal hiccup? Or is it something in between?",
        "The honest answer: it depends on why the quote was that low in the first place. Some brokers know their first quote will not hold. They quote low on purpose to win you over the phone, then renegotiate once your deposit is in. The industry calls this the bait-and-bump. This article explains how it works, why it works, and the four questions you can ask any broker to figure out whether their quote will hold.",
      ],
    },

    { kind: "h2", text: "Three reasons a quote stops holding" },
    {
      kind: "pp",
      texts: [
        "There are three ways a broker can come up with the number they show you, and each has a different chance of holding once you have paid the deposit.",
      ],
    },

    { kind: "h3", text: "1. The quote was based on old averages" },
    {
      kind: "pp",
      texts: [
        "Some brokers price your shipment using averages from past loads on similar routes. The number looks reasonable. The problem is that the number does not know what happened this week. Fuel prices may have moved. Carrier capacity may be tighter than usual. A storm may have rerouted half the trucks crossing your corridor. The number on the page is a guess based on history, not a number any carrier has confirmed they will take today.",
        "When reality does not match the guess, the broker has two choices. Eat the difference themselves, or call you back asking for more money. Most pick the second.",
      ],
    },

    { kind: "h3", text: "2. The quote was posted before a carrier accepted it" },
    {
      kind: "pp",
      texts: [
        "Some brokers post your shipment on an industry marketplace (a private platform where carriers see jobs and decide which ones to take) before any carrier has agreed to the price. The broker shows you a number, takes your deposit, then waits to see if anyone will actually accept the job at that number.",
        "When no carrier accepts, the broker has to either raise the posted price (which means asking you for more money) or keep posting at the original number and hope someone bites before your pickup date. If nothing changes by the deadline, you get the callback.",
      ],
    },

    { kind: "h3", text: "3. The deposit was taken before the real price was known" },
    {
      kind: "pp",
      texts: [
        "This is the structural problem behind the first two. Brokers who use stale data or post-before-confirming know there is a chance their first quote will not hold. The deposit gives them the leverage to renegotiate. You can pay the higher price, or you can eat the deposit. Most customers pay because they have already planned around the shipment.",
        "A deposit by itself is not a red flag. Every established broker collects some form of booking deposit to cover dispatch coordination. The red flag is when the deposit gets taken before the quote has been validated against reality.",
      ],
    },

    {
      kind: "quote",
      text: "They had my $200 deposit for 11 days. Every time I asked when my carrier would be assigned, they said 'soon.' Day 12 they called to tell me they could not get a driver at the original price and needed another $400. I should have asked the deposit question on day one.",
      source: "Verbatim from a 2024 r/AutoTransport thread",
    },

    { kind: "h2", text: "The bait-and-bump, plainly" },
    {
      kind: "pp",
      texts: [
        "The bait-and-bump is the predictable end of the patterns above. The first quote is the bait. It gets you to choose this broker over the four others you called. The deposit is the lock. Once you have paid it, you are anchored. The second quote, two weeks later, is the real price.",
        "Brokers running this pattern are not always trying to scam you. Some are genuinely overwhelmed and quote optimistically because the alternative is losing the lead to a competitor. The result for you is the same: the quote you booked is not the quote you pay.",
      ],
    },

    { kind: "h2", text: "Four questions to ask any broker before you pay anything" },
    {
      kind: "pp",
      texts: [
        "Any honest broker can answer these four questions without hesitating. If a broker dodges, gives vague answers, or pushes you to pay before answering, the quote is at risk.",
      ],
    },
    {
      kind: "ol",
      items: [
        "How do you come up with your quote? Live carrier prices, or averages from past shipments? Honest answer: live market data refreshed at the time of the quote. Risky answer: a vague \"we use historical data\" or \"it is based on the market.\"",
        "Do you have a confirmed carrier for my route at this price, or are you posting it to wait for offers? Honest answer: a confirmed carrier within hours of booking, or a clear explanation of how the posting-and-waiting process works. Risky answer: \"we will find one for you, do not worry.\"",
        "What exactly happens to my deposit if no carrier accepts at the quoted price? Honest answer: a specific written commitment (held until carrier accepts, fully refundable, applied to the higher price if you agree to it). Risky answer: \"that is unlikely to happen.\"",
        "Will you put the quote-stability promise in writing? Honest answer: yes, in the contract you sign before paying. Risky answer: any version of \"we do not do that, but we promise.\"",
      ],
    },

    { kind: "h2", text: "How Auto Line Logistics quotes" },
    {
      kind: "pp",
      texts: [
        "We use live carrier market data, refreshed the moment you request a quote. We can see what carriers in our network are actually accepting today, on your specific route, for your specific vehicle. We add a fair margin on top to cover dispatch coordination, claims handling, and the named-coordinator support you get from booking through delivery. The number you see is the number you pay.",
        "Like many established brokers, we collect a small booking deposit when you choose to move forward. The deposit goes toward your final invoice. The difference is what happens next. We do not use the deposit as leverage for a price change, because our pricing was based on what carriers were actually accepting in the first place. The locked price holds.",
        "If a carrier cannot be confirmed at your locked price (rare on the corridors we run actively), we tell you upfront. You decide what happens next: hold and wait for a carrier to accept, adjust to a new price if you agree, or refund your deposit. The choice is yours.",
      ],
    },
  ],
  related: [
    {
      slug: "why-quotes-go-up",
      title: "Why your car shipping quote went up at the last minute",
      blurb: "The mechanics of the bait-and-bump pattern in plain English.",
    },
    {
      slug: "broker-vs-carrier",
      title: "Broker vs. carrier: what is the difference?",
      blurb: "The two roles, the math, and why most customers ship through a broker.",
    },
  ],
  primaryCta: {
    eyebrow: "Check the math on your route",
    title: "Get a live carrier price for your route",
    body: "Send us your route and vehicle. We will show you what our carrier network is actually accepting today, so you can spot a bait quote before it costs you. No commitment, no signup.",
    href: "/tools/route-price-checker",
    label: "Get my locked price",
  },
  faq: [
    {
      q: "How long should it take a broker to assign a carrier?",
      a: "It depends on the route. Popular corridors (California to Texas, California to Florida, snowbird corridors) typically get a carrier within 1 to 3 days. Remote pickups or unusual routes can take 5 to 10 days. If a broker has held your deposit for 7+ days without confirming a carrier, ask directly when a carrier will accept and what happens to your deposit if they cannot.",
    },
    {
      q: "Is it normal to pay a small deposit when booking?",
      a: "Yes. Most established brokers collect a small booking deposit (typically $100 to $250) when you choose to move forward. The deposit covers dispatch coordination and goes toward your final invoice. The risk is not the deposit itself. The risk is whether the broker can hold the quoted price after taking your money.",
    },
    {
      q: "What should I pay a car shipping deposit with?",
      a: "Credit card, every time. Credit card chargebacks give you recourse if the broker turns out to use a bait pricing model. Bank transfers, debit cards, and apps like Zelle or Venmo offer no equivalent protection. If a broker insists on a non-card payment method, that itself is a warning sign.",
    },
    {
      q: "What does Auto Line Logistics do if a carrier cannot be confirmed at the quoted price?",
      a: "We tell you upfront before anything changes. You decide what happens next: hold and wait for a carrier to accept at the original price, adjust to a new price if you agree it is fair, or refund your deposit and walk away. The choice is yours and we put it in writing.",
    },
    {
      q: "What is the typical car shipping deposit amount?",
      a: "Across the industry, deposits range from $0 (rare, mostly higher-end brokers with their own carrier network) to $500+ (questionable). The middle of the distribution is $150 to $250. A deposit larger than $250 should come with very clear written answers about what happens if no carrier accepts your load at the quoted price.",
    },
  ],
};
