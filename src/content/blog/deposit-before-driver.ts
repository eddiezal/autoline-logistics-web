/**
 * Phase A blog article #2.
 * Topic: Should you pay a deposit before a driver is assigned?
 * Approach: V2 Industry Insider + V5 FAQ block hybrid.
 * Cluster: avoiding-scams.
 */
import type { Article } from "@/lib/blog/types";

export const article: Article = {
  slug: "deposit-before-driver",
  language: "en",
  title: "Should You Pay a Deposit Before a Driver Is Assigned?",
  subtitle:
    "A non-refundable deposit before any carrier is named is one of the most common red flags in auto transport. But not every deposit is a scam. Here is what separates a legitimate booking fee from a hook designed to lock you in.",
  metaDescription:
    "Is paying a car shipping deposit before a carrier is assigned normal? Sometimes yes, sometimes no. Here is the difference between a legitimate booking fee and a deposit designed to trap you.",
  publishedAt: "2026-06-15",
  updatedAt: "2026-06-15",
  author: "Auto Line Logistics",
  readMinutes: 7,
  category: "Buyer guide",
  cluster: "avoiding-scams",
  hubLink: { label: "Anti-scam guide", href: "/anti-scam" },
  sections: [
    {
      kind: "pp",
      texts: [
        "You found a quote you liked. The broker wants $200 up front, non-refundable, before they will even start looking for a carrier. Is that normal? Or is that the red flag everyone on r/AutoTransport warned you about?",
        "The answer depends entirely on when they take the deposit, what they do for it, and what happens if they cannot find a carrier at the price they quoted. A deposit is not automatically a scam. The wrong kind of deposit, taken at the wrong time, is one of the most reliable indicators that your quote is bait.",
        "This article explains the difference. When a deposit is a legitimate cost of doing business, when it is a hook designed to lock you in, and the specific question that separates the two.",
      ],
    },

    { kind: "h2", text: "What a deposit actually is in auto transport" },
    {
      kind: "pp",
      texts: [
        "In auto transport, a deposit is money you pay the broker before pickup happens. It usually goes by names like 'booking fee,' 'reservation deposit,' or 'dispatch fee.' Almost every broker takes some form of payment upfront. The variation comes in when, how much, and what it buys you.",
        "Some brokers collect a small non-refundable deposit ($100-$200) at the moment you book and apply it toward your final payment if everything proceeds. Some collect a larger deposit ($300-$500) and hold it as a hostage against cancellation. A small number collect nothing until a carrier has accepted your load, with payment due at pickup. The variations span legitimate to predatory.",
        "The deposit itself is not the problem. The pattern around it is.",
      ],
    },

    { kind: "h2", text: "Why brokers ask for deposits" },
    {
      kind: "pp",
      texts: [
        "There are three reasons brokers ask for deposits, and they are worth distinguishing because two of them are legitimate and one is the warning sign.",
        "Reason one: load board fees. Posting your shipment to Central Dispatch or Super Dispatch costs the broker a few dollars per posting. Aggregate across thousands of loads and a small deposit covers the operational cost.",
        "Reason two: dispatch labor. Coordinating with carriers, verifying insurance, handling paperwork, and scheduling pickup takes real broker time. A deposit compensates that work if you cancel last-minute.",
        "Reason three: customer lock-in. This is the one to watch for. A non-refundable deposit before any carrier is named gives the broker leverage. If they cannot find a carrier at the quoted price, you cannot easily walk away without losing the deposit. So you either pay more or eat the deposit. Both outcomes profit the broker.",
      ],
    },

    {
      kind: "h2",
      text: "The deposit-versus-carrier-assignment timing question",
    },
    {
      kind: "pp",
      texts: [
        "Here is the question that separates good brokers from predatory ones: when do they actually have a carrier in hand for your load?",
        "If the broker quotes you a price and a carrier accepts the load within hours of you booking, the deposit they charged you is operationally legitimate. They have your money, you have a carrier, the pickup is scheduled. Both sides are committed.",
        "If the broker quotes you a price, takes your deposit, and then starts looking for a carrier (often days later), you have a problem. You have paid money based on a price that may not match what any carrier will actually take. If no carrier accepts at the bait price, the broker has three options: lower their cut and absorb the difference, find a carrier at a higher price and ask you for more money, or wait until you cancel and keep your deposit. Predatory brokers do not pick option one.",
      ],
    },

    {
      kind: "quote",
      text: "They had my $200 deposit for 11 days. Every time I asked when my carrier would be assigned, they said 'soon.' Day 12 they called to tell me they 'couldn't get a driver' at the original price and needed another $400. I should have asked the deposit question on day one.",
      source: "Verbatim from a 2024 r/AutoTransport thread",
    },

    { kind: "h2", text: "What makes a deposit a red flag" },
    {
      kind: "p",
      text: "A deposit becomes risky when several of these patterns combine. None of them alone is automatic disqualification, but if you see three or more, the deposit is not paying for dispatch work. It is funding the broker's leverage.",
    },
    {
      kind: "checklist",
      items: [
        { label: "Deposit is non-refundable AND charged before any carrier is named.", tone: "warn" },
        { label: "The broker cannot tell you when a carrier will be assigned.", tone: "warn" },
        { label: "The deposit amount is $250 or more.", tone: "warn" },
        { label: "The original quote is 20%+ below other brokers' quotes for the same route.", tone: "warn" },
        { label: "The contract has a 'market adjustment' clause that lets them raise the price later.", tone: "warn" },
        { label: "They use urgency language like 'secure your spot now' or 'price expires in 24 hours.'", tone: "warn" },
        { label: "They cannot tell you what happens to your deposit if they cannot find a carrier.", tone: "warn" },
      ],
    },

    { kind: "h2", text: "What makes a deposit reasonable" },
    {
      kind: "p",
      text: "On the legitimate side, a deposit looks different. The broker is using it to cover operational cost, not to lock you in. Here is what reasonable deposits look like in practice.",
    },
    {
      kind: "checklist",
      items: [
        { label: "Deposit is refundable until a carrier accepts the load (most ethical structure).", tone: "ok" },
        { label: "Deposit is charged only AFTER a carrier accepts the load.", tone: "ok" },
        { label: "The amount is $100 or less if non-refundable.", tone: "ok" },
        { label: "The broker explains in writing what happens if no carrier accepts.", tone: "ok" },
        { label: "The quote is within 10-15% of other brokers' quotes.", tone: "ok" },
        { label: "The broker can tell you the typical carrier-assignment timeline (usually 1-3 days for popular routes).", tone: "ok" },
        { label: "The contract does NOT have a clause allowing price increases for 'market conditions.'", tone: "ok" },
      ],
    },

    { kind: "h2", text: "What the FTC says about deposit practices" },
    {
      kind: "pp",
      texts: [
        "Deposits themselves are legal. The FTC does not prohibit them. But the FTC has gone after auto transport brokers when deposit practices crossed into deception.",
        "In FTC matters involving auto transport brokers from 2010 to 2018, the agency settled multiple cases where brokers used non-refundable deposits combined with quotes the brokers knew were below carrier market rates. The argument: the broker took deposits knowing the quoted price was a hook, then either raised the price or kept the deposit when customers could not proceed. Settlements included consumer restitution and prohibitions on future similar practices. The pattern is well-enough documented that 'asking for a deposit before assigning a carrier' is on virtually every auto-transport consumer protection guide as a warning sign.",
      ],
    },

    {
      kind: "callout",
      tone: "brand",
      title: "How Auto Line Logistics handles deposits",
      body: "We do not charge any deposit to give you a quote. The price you see is the price our carrier network is actually accepting. When you book with us, payment is structured around a confirmed pickup, not a hopeful posting. You see the carrier's name and contact before pickup. If a carrier cannot be confirmed at the quoted price (rare on our active corridors), we honor the original number or refund you in full. Either way, you do not lose money on a quote that never had a carrier behind it.",
    },

    { kind: "h2", text: "Common questions about car shipping deposits" },
    { kind: "h3", text: "Is it normal to pay a deposit before a car shipping driver is assigned?" },
    {
      kind: "p",
      text: "Common, yes. Normal in the sense of 'you should accept it without question,' no. The riskier the deposit (larger amount, non-refundable, broker cannot say when a carrier will be assigned), the more carefully you should look at the broker. A small refundable deposit is reasonable. A $300 non-refundable deposit with no carrier in sight is a warning sign.",
    },
    { kind: "h3", text: "What is a typical car shipping deposit amount?" },
    {
      kind: "p",
      text: "Across the industry, deposits range from $0 (rare, mostly higher-end brokers) to $500+ (questionable). The middle of the distribution is $150-$250 non-refundable. A deposit larger than $250 should come with very clear answers about what happens if no carrier accepts your load.",
    },
    { kind: "h3", text: "Can I get a refund on a non-refundable car shipping deposit?" },
    {
      kind: "p",
      text: "Sometimes, even on 'non-refundable' deposits. Document the original quote, the demanded change (or the broker's failure to assign a carrier), and all communications. If you paid by credit card, file a chargeback within 60 days. File a Better Business Bureau complaint. A nonzero percentage of disputed deposits get returned. The broker is counting on you not bothering.",
    },
    { kind: "h3", text: "How long should it take a broker to assign a carrier?" },
    {
      kind: "p",
      text: "It depends on the corridor. Popular routes (California to Texas, California to Florida, snowbird corridors) typically get a carrier within 1-3 days. Remote pickups or unusual routes can take 5-10 days. If a broker has held your deposit for 7+ days without assigning a carrier, ask directly: when will a carrier accept, and what happens to my deposit if they cannot?",
    },
    { kind: "h3", text: "Should I pay a car shipping deposit by credit card or bank transfer?" },
    {
      kind: "p",
      text: "Credit card, always. Credit card chargebacks give you recourse if the broker turns out to be predatory. Bank transfers, debit card payments, and Zelle or Venmo transfers offer no equivalent recourse. If a broker insists on payment by non-card method, that itself is a warning sign.",
    },
    { kind: "h3", text: "What does Auto Line Logistics charge as a deposit?" },
    {
      kind: "p",
      text: "Nothing. We do not charge a deposit to give you a quote. We do not charge a deposit to hold a slot. Payment is structured around confirmed pickup with a real carrier in hand. The price you see at quote time is the price you pay at pickup, and we settle the payment in full at that point.",
    },
  ],
  faq: [
    {
      q: "Is it normal to pay a deposit before a car shipping driver is assigned?",
      a: "It is common in the industry but not automatically safe. A small refundable deposit is reasonable. A large non-refundable deposit with no carrier in sight is a warning sign that the broker is using the deposit as leverage rather than covering operational cost.",
    },
    {
      q: "What is a typical car shipping deposit amount?",
      a: "Deposits range from $0 to $500 across the industry. The middle of the distribution is $150-$250 non-refundable. Deposits larger than $250 should come with clear written answers about what happens if no carrier accepts your load.",
    },
    {
      q: "Can I get a refund on a non-refundable car shipping deposit?",
      a: "Sometimes, even on non-refundable deposits. File a Better Business Bureau complaint. If you paid by credit card, file a chargeback within 60 days. Document the original quote and all communications. A nonzero percentage of disputed deposits get returned.",
    },
    {
      q: "How long should it take an auto transport broker to assign a carrier?",
      a: "Popular routes typically get a carrier within 1-3 days. Remote pickups or unusual routes can take 5-10 days. If a broker has held your deposit for 7+ days without assigning a carrier, ask directly when a carrier will accept and what happens to your deposit if they cannot.",
    },
    {
      q: "Should I pay a car shipping deposit by credit card or bank transfer?",
      a: "Credit card. Credit card chargebacks give you recourse if the broker is predatory. Bank transfers, debit cards, and Zelle or Venmo transfers offer no equivalent recourse. A broker who insists on a non-card payment method is showing you a warning sign.",
    },
    {
      q: "What happens to my deposit if no carrier accepts the load?",
      a: "It depends on the broker and the contract. Ethical brokers refund the deposit or honor the original quote. Predatory brokers ask for more money or keep the deposit. Ask this question in writing before you pay anything. The broker's answer tells you everything.",
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
    eyebrow: "Worried about a deposit you have already paid?",
    title: "Check the broker against our locked-price model",
    body: "Send us your route and vehicle. We will show you what our carrier network is accepting today. If your broker's quote and ours are within 10%, theirs is probably real. If yours is 20%+ below ours, that is the bait pattern.",
    href: "/tools/route-price-checker",
    label: "Check my quote",
  },
};
