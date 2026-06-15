/**
 * Phase A blog article #2.
 * Topic: Should you pay a deposit before a driver is assigned?
 *
 * Status: SCAFFOLDED (Hour 1). Prose lands in Hour 2.
 */
import type { Article } from "@/lib/blog/types";

export const article: Article = {
  slug: "deposit-before-driver-assigned",
  title: "Should You Pay a Deposit Before a Driver Is Assigned?",
  subtitle:
    "A non-refundable deposit before any carrier is named is one of the most common red flags in auto transport. Here is when a deposit is normal, and when it should worry you.",
  metaDescription:
    "Many car shipping brokers ask for a $150-$250 non-refundable deposit before assigning a driver. Here is what is normal in the industry, and the warning signs that a deposit is funding a bait-and-switch.",
  publishedAt: "2026-06-15",
  updatedAt: "2026-06-15",
  author: "Auto Line Logistics",
  readMinutes: 5,
  category: "Buyer guide",
  cluster: "avoiding-scams",
  hubLink: { label: "Anti-scam guide", href: "/anti-scam" },
  sections: [
    {
      kind: "p",
      text: "PLACEHOLDER. Prose for this article is drafted in Hour 2.",
    },
  ],
  related: [
    {
      slug: "why-car-shipping-quotes-go-up",
      title: "Why Your Car Shipping Quote Went Up at the Last Minute",
      blurb:
        "How the bait-and-switch works once a broker has your deposit, and how to tell a real quote from a hook.",
    },
    {
      slug: "broker-vs-carrier",
      title: "Broker vs Carrier: Who Actually Moves Your Car?",
      blurb:
        "If the company you booked is not the company driving, here is what changes about how your deposit and pickup actually work.",
    },
  ],
  primaryCta: {
    eyebrow: "Get a real quote",
    title: "No deposit to receive the quote",
    body: "We do not charge a deposit to give you a price. We tell you the rate up front, name the coordinator who handles your shipment, and lock the price before any money changes hands.",
    href: "/quote",
    label: "Get my locked price",
  },
};
