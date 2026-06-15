/**
 * Phase A blog article #1.
 * Topic: Why does a car shipping quote go up at the last minute?
 *
 * Status: SCAFFOLDED (Hour 1). Prose lands in Hour 2.
 * Cluster: /anti-scam topical hub.
 */
import type { Article } from "@/lib/blog/types";

export const article: Article = {
  slug: "why-car-shipping-quotes-go-up",
  title: "Why Your Car Shipping Quote Went Up at the Last Minute",
  subtitle:
    "If a broker quoted you $629 then asked for $900, you are not alone. Here is what is actually happening in the industry, and how to make sure your quote is real before you pay.",
  metaDescription:
    "Last-minute car shipping price hikes are an industry pattern, not bad luck. Here is how the bait-and-switch works, the warning signs to spot it, and how a locked-price quote is supposed to work.",
  publishedAt: "2026-06-15",
  updatedAt: "2026-06-15",
  author: "Auto Line Logistics",
  readMinutes: 6,
  category: "Buyer guide",
  cluster: "avoiding-scams",
  hubLink: { label: "Anti-scam guide", href: "/anti-scam" },
  sections: [
    {
      kind: "p",
      text: "PLACEHOLDER. Prose for this article is drafted in Hour 2. The structure is locked.",
    },
  ],
  related: [
    {
      slug: "deposit-before-driver-assigned",
      title: "Should You Pay a Deposit Before a Driver Is Assigned?",
      blurb:
        "Most brokers ask. Here is what is normal versus when a deposit becomes a red flag.",
    },
    {
      slug: "broker-vs-carrier",
      title: "Broker vs Carrier: Who Actually Moves Your Car?",
      blurb:
        "Most auto transport companies are brokers. Some own trucks. Here is why it matters who is on the other end of your booking.",
    },
  ],
  primaryCta: {
    eyebrow: "Get a real quote",
    title: "See what a locked-price quote looks like",
    body: "No deposit to receive the quote. We tell you the price before we ask for a card. If your route is one of our live corridors, you see the range our carrier network is actually accepting today.",
    href: "/quote",
    label: "Get my locked price",
  },
};
