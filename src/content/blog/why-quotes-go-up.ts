/**
 * Phase A blog article #1.
 * Topic: Why does a car shipping quote go up at the last minute?
 * Approach: V2 Industry Insider + V5 FAQ block hybrid.
 * Cluster: avoiding-scams (linked to /anti-scam hub).
 */
import type { Article } from "@/lib/blog/types";

export const article: Article = {
  slug: "why-car-shipping-quotes-go-up",
  title: "Why Your Car Shipping Quote Went Up at the Last Minute",
  subtitle:
    "If a broker quoted you $629 then asked for $900, you are not alone. Here is what is actually happening in the industry, and how to make sure your quote is real before you pay.",
  metaDescription:
    "Last-minute car shipping price hikes are an industry pattern, not bad luck. How the bait-and-switch works, the warning signs, and what a real locked-price quote is supposed to look like.",
  publishedAt: "2026-06-15",
  updatedAt: "2026-06-15",
  author: "Auto Line Logistics",
  readMinutes: 8,
  category: "Buyer guide",
  cluster: "avoiding-scams",
  hubLink: { label: "Anti-scam guide", href: "/anti-scam" },
  sections: [
    {
      kind: "pp",
      texts: [
        "There is a reason your auto transport quote went up at the last minute. It was not bad luck. It was not a market shift. It was not the carrier's fault.",
        "Some brokers run this pattern on purpose. It is the default business model at the bottom of the auto transport industry, and it is profitable enough that an entire tier of the market runs on it. The customer who searches 'cheap car shipping' and clicks the lowest quote is exactly the customer this model is built for.",
        "This article is the explainer your broker is not going to give you. How the pattern works. Why it is profitable. What an honest quote process looks like instead. And the questions you can ask to spot a bait before you pay.",
      ],
    },

    { kind: "h2", text: "How car shipping prices actually work" },
    {
      kind: "pp",
      texts: [
        "When you book an auto transport shipment, you are almost always working with a broker. The broker is not the company that drives the truck. They match you to a carrier (the trucking company that actually owns the rig) through a digital marketplace called a load board.",
        "Two load boards dominate the industry: Central Dispatch and Super Dispatch. Brokers post your shipment to the board with a price they are willing to pay a carrier. Carriers (independent truckers and small fleets) browse the board and bid on the loads they want. When a carrier accepts, they get paid the posted price minus a small board fee.",
        "The broker's revenue is the gap between what you pay them and what they pay the carrier. That is the markup.",
        "Two prices, one shipment. If those two prices do not match what the market will actually bear, something has to give. That something is usually you.",
      ],
    },

    {
      kind: "quote",
      text: "I accepted a $900 quote, signed all the paperwork, paid the $200 deposit. Two days before pickup the broker called and said no driver would take it for that price. The new price was $1,400. My move was Friday. I paid.",
      source: "Verbatim from a 2024 r/AutoTransport thread",
    },

    { kind: "h2", text: "The four-step bait-and-switch sequence" },
    {
      kind: "p",
      text: "Once you know the mechanic, the pattern is easy to recognize. It happens in four steps, in this order, every time.",
    },
    {
      kind: "ol",
      items: [
        "The quote. The broker quotes you 20-30% below the actual market rate carriers will accept. This wins the booking. You pick them because they are the cheapest.",
        "The hook. They collect a non-refundable deposit. Most are $150-300. The contract typically describes this as 'securing your spot' or 'reserving the carrier slot.' There is no slot. There is no reserved carrier. The deposit just locks you in.",
        "The wait. They post your load to the load board at the bait price. No carrier accepts it because the price is below market. The broker waits. Days pass. Your pickup date approaches.",
        "The squeeze. 24 to 72 hours before pickup, the broker calls. The story varies (carrier shortage, fuel surge, route change) but the result is identical: they need more money to get a driver. The increase is usually $200-600.",
      ],
    },
    {
      kind: "p",
      text: "You are trapped. Your move is locked in. Canceling means losing the deposit and finding a new broker on a day or two of notice. Most customers pay. Some cancel and forfeit. The broker profits on both.",
    },

    {
      kind: "h2",
      text: "Why this is profitable enough to be the default",
    },
    {
      kind: "pp",
      texts: [
        "A clean honest quote earns the broker maybe $100-200 on top of the carrier's price. That is the standard broker margin.",
        "A bait-and-switch shipment earns the broker the same $100-200 margin PLUS the upsell amount (typically $200-400 more) PLUS the deposit on every customer who walks away rather than pay. Run that math at scale and the broker is earning two to three times more per shipment.",
        "The pattern only works because three things are true about most customers:",
      ],
    },
    {
      kind: "ul",
      items: [
        "They are not auto transport experts. They do not know what the market rate actually is, so they cannot spot a bait quote against a real one.",
        "Their pickup date is fixed. Move-outs, lease handoffs, military orders, college start dates. The customer cannot easily renegotiate the timeline.",
        "The deposit is psychologically locked. Once you have paid even $200, you are more likely to pay another $300 than walk away.",
      ],
    },
    {
      kind: "p",
      text: "The broker is exploiting all three. It is not a bug in their model. It is the model.",
    },

    {
      kind: "quote",
      text: "After my third 'fuel surcharge' call, I realized this was their whole business. The original quote was just to win me. The real price came later.",
      source: "Verbatim from a 2024 r/AutoTransport thread",
    },

    { kind: "h2", text: "The FTC has taken action on this" },
    {
      kind: "pp",
      texts: [
        "This is not speculation. In FTC v. AAAA Auto Brokers (Federal Trade Commission, 2010), the FTC alleged that the company used artificially low quotes followed by last-minute price hikes as a deceptive trade practice. The case settled with restitution to affected customers.",
        "That was one company. The pattern is industry-wide. Trustpilot and Better Business Bureau records for low-cost auto transport brokers show the same complaint over and over: customer was quoted at one price, paid significantly more, and in some cases the carrier never materialized at all.",
        "Naming this pattern out loud is uncommon in the industry because most brokers do not want to be associated with it. The FTC has documented it. Reddit's r/AutoTransport community knows it well. The industry's silence around it is the problem.",
      ],
    },

    {
      kind: "callout",
      tone: "brand",
      title: "What honesty looks like in a quote",
      body: "An honest auto transport quote reflects the price carriers will actually accept on the day of pickup. The deposit, if any, is refundable until a carrier is assigned. The carrier's name and contact are disclosed before the truck arrives. The number you saw at quote time is the number you pay.",
    },

    {
      kind: "h2",
      text: "How to spot a bait quote before you pay",
    },
    {
      kind: "p",
      text: "These are the patterns to watch for. The first five are warning signs. The last five are what a real quote process should look like instead.",
    },
    {
      kind: "checklist",
      items: [
        { label: "The quote is 20%+ below 2-3 other brokers' quotes for the same route.", tone: "warn" },
        { label: "A non-refundable deposit is required before any carrier is named.", tone: "warn" },
        { label: "The broker cannot tell you when a carrier will be assigned.", tone: "warn" },
        { label: "Pickup window is 3-7 days with no specific date confirmed.", tone: "warn" },
        { label: "Aggressive urgency language: 'secure your spot today,' 'price expires in 24 hours.'", tone: "warn" },
        { label: "Quote is within 10-15% of other brokers' quotes.", tone: "ok" },
        { label: "Deposit is refundable, or charged only after a carrier accepts the load.", tone: "ok" },
        { label: "Broker can tell you the carrier's company name and USDOT or MC number.", tone: "ok" },
        { label: "A specific pickup date or 1-day window is confirmed at booking.", tone: "ok" },
        { label: "Carrier insurance certificate is available on request.", tone: "ok" },
      ],
    },

    { kind: "h2", text: "Common questions about last-minute price hikes" },
    { kind: "h3", text: "Is this normal in the auto transport industry?" },
    {
      kind: "p",
      text: "It is common at the bottom tier of the market. Not universal. Honest brokers exist, and you can find them. But the bait-and-switch pattern is well-documented enough that the FTC, the Better Business Bureau, and r/AutoTransport regulars all describe it the same way.",
    },
    { kind: "h3", text: "Can a broker legally raise the price after I have paid a deposit?" },
    {
      kind: "p",
      text: "It depends on the contract. Most broker contracts include a clause that allows price changes if 'market conditions' change. That clause is broad enough that courts often side with the broker. The question is not whether it is legal. The question is whether you would accept the same deal if the original quote had been the real one.",
    },
    { kind: "h3", text: "What is a realistic markup vs a scam markup?" },
    {
      kind: "p",
      text: "Real cost changes between quote and pickup land within 10-15% of the original price. They happen for legitimate reasons: a destination became remote, the vehicle is inoperable when the carrier arrives, weather forced a routing change. A jump of 30% or more means the original quote was never real. It was a hook.",
    },
    { kind: "h3", text: "Should I pay the increase or cancel?" },
    {
      kind: "p",
      text: "Three factors decide it. How non-refundable is the deposit. How tight is your timeline. Can you find another carrier in time. If your pickup is 3+ weeks out, cancel and rebook with a different broker. If it is 3 days out, you are likely stuck. Pay and use the lesson for next time. The real lesson is to ask the deposit and assignment questions BEFORE you pay.",
    },
    { kind: "h3", text: "Can I get my deposit back?" },
    {
      kind: "p",
      text: "Sometimes. Document everything: the original written quote, the demanded increase, all communications, the contract. File with the Better Business Bureau. If you paid with a credit card, file a chargeback within 60 days. A nonzero percentage of disputed deposits get returned. The broker is counting on most customers not bothering.",
    },
    { kind: "h3", text: "How do I tell if my next quote is real before I book?" },
    {
      kind: "p",
      text: "Three checks. Compare against 3+ other brokers' quotes. If one is 20%+ lower than the rest, it is bait. Ask whether the deposit is refundable if no carrier accepts your load. Ask when a carrier will be assigned, by name. If the answers feel evasive, walk away.",
    },
    { kind: "h3", text: "What does Auto Line Logistics do differently?" },
    {
      kind: "p",
      text: "We do not charge a deposit to give you a price. The number you see is the price our carrier network is actually accepting on the day we quote you. Our Logistics side matches you to vetted carriers across the network. Our sister carrier Auto Line Express owns 35 trucks that we run on select routes ourselves. The number you see at quote time is the number on your invoice.",
    },
  ],
  faq: [
    {
      q: "Is a last-minute auto transport price hike normal in the industry?",
      a: "It is common at the bottom tier of the auto transport market but not universal. Honest brokers exist. The bait-and-switch pattern is well-documented by the FTC, the Better Business Bureau, and the r/AutoTransport community.",
    },
    {
      q: "Can a car shipping broker legally raise the price after I have paid a deposit?",
      a: "Most broker contracts include a clause that allows price changes if market conditions change. Courts often side with the broker. The question is not whether it is legal but whether you would accept the same deal if the original quote had been the real one.",
    },
    {
      q: "What is a realistic price markup between quote and pickup?",
      a: "Real cost changes are within 10-15% of the original price and happen for legitimate reasons like remote destinations or inoperable vehicles. A jump of 30% or more means the original quote was never real.",
    },
    {
      q: "Should I pay an increased car shipping price or cancel?",
      a: "Three factors decide it: how non-refundable is the deposit, how tight your timeline is, and whether you can find another carrier in time. If pickup is 3+ weeks out, cancel and rebook. If it is 3 days out, pay and use the lesson next time.",
    },
    {
      q: "Can I get my non-refundable car shipping deposit back?",
      a: "Sometimes. Document everything, file a Better Business Bureau complaint, and if you paid by credit card, file a chargeback within 60 days. The broker is counting on most customers not bothering.",
    },
    {
      q: "How do I tell if a car shipping quote is real before I book?",
      a: "Compare against 3+ other brokers' quotes. If one is 20%+ lower than the rest, it is bait. Ask whether the deposit is refundable if no carrier accepts. Ask when a carrier will be assigned by name.",
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
    eyebrow: "Already have a quote that feels too low?",
    title: "Check your quote against our carrier network",
    body: "Send us your route and vehicle. We will show you what our carrier network is actually accepting today, so you can spot a bait before it costs you. No deposit, no signup.",
    href: "/tools/route-price-checker",
    label: "Check my quote",
  },
};
