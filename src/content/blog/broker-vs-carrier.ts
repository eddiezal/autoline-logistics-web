/**
 * Phase A blog article #3.
 * Topic: Broker vs Carrier — who actually moves your car?
 * This article is the ALL/ALE hybrid reveal piece.
 *
 * Status: SCAFFOLDED (Hour 1). Prose lands in Hour 2.
 */
import type { Article } from "@/lib/blog/types";

export const article: Article = {
  slug: "broker-vs-carrier",
  title: "Broker vs Carrier: Who Actually Moves Your Car?",
  subtitle:
    "Most auto transport companies are brokers. They match your shipment to a carrier on a load board, then step back. Here is why it matters whether the company you book is the company that drives, and how a hybrid like ours fits the picture.",
  metaDescription:
    "Most auto transport companies are brokers, not carriers. Here is how the broker-load-board-carrier chain works, why most companies hide it, and what a hybrid that runs both sides looks like in practice.",
  publishedAt: "2026-06-15",
  updatedAt: "2026-06-15",
  author: "Auto Line Logistics",
  readMinutes: 7,
  category: "Buyer guide",
  hubLink: { label: "Anti-scam guide", href: "/anti-scam" },
  sections: [
    {
      kind: "p",
      text: "PLACEHOLDER. Prose for this article is drafted in Hour 2. This is the article where we explain the ALL/ALE hybrid structure publicly.",
    },
  ],
  related: [
    {
      slug: "why-car-shipping-quotes-go-up",
      title: "Why Your Car Shipping Quote Went Up at the Last Minute",
      blurb:
        "The broker-carrier handoff is where most price-hike trouble starts. Here is the mechanic.",
    },
    {
      slug: "deposit-before-driver-assigned",
      title: "Should You Pay a Deposit Before a Driver Is Assigned?",
      blurb:
        "Why brokers want your deposit before they have a carrier, and what that means for your booking.",
    },
  ],
  primaryCta: {
    eyebrow: "See how we handle your route",
    title: "Get a real quote backed by our own fleet where it makes sense",
    body: "Logistics matches you to vetted carriers across the network. Express owns the trucks. Where the route fits our fleet, your shipment stays in-house.",
    href: "/quote",
    label: "Get my locked price",
  },
};
