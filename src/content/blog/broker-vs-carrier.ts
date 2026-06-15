/**
 * Phase A blog article #3.
 * Topic: Broker vs Carrier — who actually moves your car?
 * Approach: V2 Industry Insider + V5 FAQ block hybrid.
 * Cluster: understanding-industry.
 *
 * This is the article that publicly reveals the ALL (broker) +
 * Auto Line Express (35-truck carrier) hybrid structure as the
 * trust moat. Handle the sister relationship without trying to
 * cross-sell Express's B2B operation to ALL's B2C readers.
 */
import type { Article } from "@/lib/blog/types";

export const article: Article = {
  slug: "broker-vs-carrier",
  title: "Broker vs Carrier: Who Actually Moves Your Car?",
  subtitle:
    "Most auto transport companies are brokers. Some own trucks. The customer almost always finds out which is which only after something goes wrong. Here is why it matters who is on the other end of your booking, and how a hybrid that runs both sides handles things differently.",
  metaDescription:
    "Most auto transport companies are brokers, not carriers. Here is how the broker-load-board-carrier chain works, why it matters who you book with, and how a hybrid running both sides changes the accountability picture.",
  publishedAt: "2026-06-15",
  updatedAt: "2026-06-15",
  author: "Auto Line Logistics",
  readMinutes: 8,
  category: "Buyer guide",
  cluster: "understanding-industry",
  hubLink: { label: "Anti-scam guide", href: "/anti-scam" },
  sections: [
    {
      kind: "pp",
      texts: [
        "Most auto transport companies are brokers. They match your shipment to a carrier on a digital marketplace called a load board, then step back. Some companies are carriers, which means they own the trucks and drive them. A small number are both. The customer almost always finds out which is which only after something goes wrong.",
        "This matters more than most customers realize. The company on your booking confirmation is often not the company that arrives at your door. The communication chain runs through people who never spoke to each other before your load got matched. The accountability chain has gaps where each side can point at the other when things go sideways.",
        "This article explains how the broker-carrier landscape actually works, why it matters who you booked with, and how a hybrid that runs both sides handles things differently.",
      ],
    },

    { kind: "h2", text: "What a broker actually does" },
    {
      kind: "pp",
      texts: [
        "An auto transport broker is a logistics matcher. They take your shipment, post it to a load board, and find a carrier who will accept the load at the price the broker is willing to pay. That is the mechanic.",
        "The honest version of what a good broker does goes deeper. They vet carriers before posting to make sure the people who can accept the load have valid insurance, current FMCSA authority, and a clean safety record. They coordinate scheduling between you and the carrier. They handle exception cases when something goes wrong in transit. They are your single point of contact for the whole shipment, even though they are not the ones driving.",
        "The shortcut version is what too many brokers do: post the load at a low price, take whatever carrier bites, and step back from the relationship. The first version is real labor that earns the broker's cut. The second is what makes brokers seem to vanish after booking.",
      ],
    },

    { kind: "h2", text: "What a carrier actually does" },
    {
      kind: "pp",
      texts: [
        "A carrier is the trucking company that owns the rigs and employs (or contracts) the drivers. They are the ones who arrive at your door, load your vehicle onto the trailer, drive the route, and deliver to your destination.",
        "Being a carrier is capital-intensive. A new car hauler trailer runs $80,000 to $150,000. A truck to pull it runs another $150,000+. Insurance, fuel, and driver retention are major ongoing costs. Most auto transport companies are NOT carriers because the math is hard. It is much easier to be a broker who matches customers to existing carriers than to operate your own fleet.",
        "The carriers who DO operate are usually small to mid-size: 1-15 trucks for owner-operators, 15-50 for medium fleets, 50+ for the large operators. They survive by keeping their trucks full, which means they take loads from brokers when their own customer relationships do not fill the schedule.",
      ],
    },

    { kind: "h2", text: "How the broker-carrier handoff works" },
    {
      kind: "p",
      text: "Once you book with a broker, your shipment enters this sequence:",
    },
    {
      kind: "ol",
      items: [
        "The broker posts your load to Central Dispatch or Super Dispatch with the price they are willing to pay a carrier.",
        "Carriers browse the board and accept loads that fit their existing routes. The carrier who accepts your load may have never heard your name before.",
        "The carrier commits to picking up your vehicle on a stated date. The broker confirms the assignment with you.",
        "Pickup, transit, and delivery happen between you and the carrier. The broker is the relay between you when something needs to change.",
      ],
    },
    {
      kind: "pp",
      texts: [
        "The handoff is also where most things go wrong. The carrier did not speak to you directly. They got your information from the broker's post. The broker did not drive to your address. They are not there at pickup. If the load is mispriced, the carrier might walk away. If your pickup details are wrong, the driver finds out only when they arrive. If your vehicle has constraints the broker did not flag (inoperable, oversized, modified), the carrier has the right to refuse the load.",
        "Most shipments go fine. The ones that do not go fine almost always have a problem that surfaced at the handoff.",
      ],
    },

    {
      kind: "quote",
      text: "I booked with a company that called itself a 'national auto transport leader.' Two weeks later a guy in a different truck I had never heard of showed up. He was contracted through a dispatcher who got the load from the broker. So I had paid the broker, the dispatcher got their cut, the carrier was new to me entirely. When something went wrong, none of them owned the problem.",
      source: "Verbatim from a 2024 r/AutoTransport thread",
    },

    { kind: "h2", text: "Why broker vs carrier matters for you" },
    {
      kind: "pp",
      texts: [
        "Three things change based on who actually moves your car.",
        "Pricing reliability. A broker quoting you a price is making a bet on what the carrier market will accept. If they bet wrong, your price changes or your pickup slips. A carrier quoting you a price knows their own truck schedule, fuel costs, and route economics. The number is grounded in their own operation, not in a hope that someone on a marketplace will accept it.",
        "Communication. A broker is your single point of contact during transit, but the broker does not know where the truck is unless the carrier tells them. A carrier knows where their own truck is. When a shipment is in carrier hands, communication routes through the broker, which is one hop further from the truck. The longer that chain, the slower the answer.",
        "Accountability. When damage happens or pickup is missed, the broker can point at the carrier. The carrier can point at the broker. Both can point at the customer for unclear pickup details. The hybrid case (the company is both the broker AND the carrier) collapses that chain into one accountability point. There is no one to blame except themselves.",
      ],
    },

    { kind: "h2", text: "The hybrid model and how it changes the math" },
    {
      kind: "pp",
      texts: [
        "Auto Line Logistics is the broker side of a hybrid operation. We are the company you book with, the company that gives you a quote, the company that owns the customer relationship from end to end.",
        "Our sister carrier, Auto Line Express, owns and operates 35 trucks on selected high-volume routes. When your shipment fits one of those routes, your vehicle stays in-house. The same operation that quotes you is the operation that drives you. The broker side and the carrier side are coordinated by phone, in person, every day, because they are the same family running both sides of the move.",
        "When your route does not fit our fleet (most cross-country routes, certain regional pairs, specialty handling), we go to our vetted carrier network. We do not post to the open load board hoping for the lowest bidder. We dispatch to carriers we have verified, have worked with on prior shipments, and whose performance we can speak to from direct experience.",
        "Either way, the broker-carrier handoff happens within a controlled relationship, not across an anonymous marketplace. That is the part that changes everything for customers downstream.",
      ],
    },

    {
      kind: "callout",
      tone: "brand",
      title: "The accountability moat",
      body: "When both sides of your shipment run through the same family operation, you have one phone number that owns the entire move. No 'call the carrier' brushoffs. No 'the broker did not tell us' carrier surprises. One operation, two sides, one accountability point. Auto Line Logistics handles the customer relationship; Auto Line Express owns the trucks we run ourselves. Same family, same standards, one point of contact when something needs an answer.",
    },

    { kind: "h2", text: "How to tell who you are actually working with" },
    {
      kind: "p",
      text: "When you are evaluating an auto transport company (us included), three questions surface what they actually do. The answers are short and tell you a lot.",
    },
    {
      kind: "ul",
      items: [
        "Ask: Do you own trucks, or do you broker every load? An honest broker says 'we broker.' An honest carrier says 'we own and operate.' A hybrid tells you both sides exist. A company that gives a vague answer is hiding something.",
        "Ask: When my shipment is dispatched, will I get the carrier's name and USDOT number? Yes is the only acceptable answer. No-or-evasive means the company does not want you verifying the carrier independently.",
        "Ask: If something goes wrong in transit, who is my point of contact, you or the carrier? A good broker says 'us.' A bad broker says 'the carrier.' A hybrid says 'us, and we own the carrier-side relationship too.'",
      ],
    },
    {
      kind: "checklist",
      items: [
        { label: "'We have a nationwide carrier network' with no specifics about which carriers or how they were vetted.", tone: "warn" },
        { label: "Vague about whether the company owns trucks or brokers every load.", tone: "warn" },
        { label: "Cannot confirm whether the carrier's name will be disclosed pre-pickup.", tone: "warn" },
        { label: "Routes transit issues to 'the carrier' rather than owning them as the booked company.", tone: "warn" },
        { label: "Tells you directly whether they broker, carry, or do both.", tone: "ok" },
        { label: "Will disclose the carrier's company name and USDOT or MC number before pickup.", tone: "ok" },
        { label: "Owns transit communication and exception handling instead of redirecting you to the driver.", tone: "ok" },
        { label: "Carriers used are documented prior partners, not random load-board pickups.", tone: "ok" },
      ],
    },

    { kind: "h2", text: "Common questions about brokers, carriers, and hybrids" },
    { kind: "h3", text: "What is the difference between an auto transport broker and a carrier?" },
    {
      kind: "p",
      text: "A broker matches customers to carriers, typically through a load board. A carrier is the trucking company that owns the rigs and drives the route. Most auto transport companies are brokers because the broker side requires far less capital. The customer's experience depends largely on which side they booked with and how the handoff is managed.",
    },
    { kind: "h3", text: "How can I tell if the company I am booking with is a broker or a carrier?" },
    {
      kind: "p",
      text: "Ask directly. 'Do you own trucks, or do you broker every load?' An honest answer takes one sentence. A vague answer is the signal. You can also look up the company's MC and USDOT numbers on the FMCSA SAFER database. Brokers have an MC number with broker authority. Carriers have an MC number with carrier authority. Some companies hold both, which is the hybrid case.",
    },
    { kind: "h3", text: "Is one better than the other, a broker or a carrier?" },
    {
      kind: "p",
      text: "Neither is universally better. A good broker handling routine routes can be smoother than a carrier whose trucks are not on your lane. A carrier handling their own route is more accountable than a broker, but they may not serve every corridor. The hybrid case has both options on the table, which is why it usually delivers the cleanest customer experience.",
    },
    { kind: "h3", text: "What is a hybrid auto transport company?" },
    {
      kind: "p",
      text: "A hybrid is a company that operates both as a broker (matching customers to outside carriers when needed) AND as a carrier (running their own fleet on selected routes). The advantage is that when your route fits the carrier side, you avoid the broker-carrier handoff entirely. When your route does not fit, the broker side still uses a vetted network rather than an open load board.",
    },
    { kind: "h3", text: "Why would a customer prefer a carrier over a broker?" },
    {
      kind: "p",
      text: "Carriers tend to be more accountable because they own the equipment and the driver. Pricing is more grounded because the carrier knows their actual cost. Communication is faster because there is no broker-relay step. The downside: a carrier only covers their own routes, so for cross-country or unusual lanes a customer often ends up with a broker anyway.",
    },
    { kind: "h3", text: "How do I check if a broker or carrier is legitimate?" },
    {
      kind: "p",
      text: "Use the FMCSA SAFER database. Search by company name or MC number. The record shows whether they have active broker authority, carrier authority, or both, their insurance status, and their safety rating. Any auto transport company that will not give you their MC number when asked is one to walk away from.",
    },
  ],
  faq: [
    {
      q: "What is the difference between an auto transport broker and a carrier?",
      a: "A broker matches customers to carriers through a load board. A carrier owns the trucks and drives the route. Most auto transport companies are brokers because the broker side requires far less capital. The customer's experience depends on which side they booked with and how the handoff is managed.",
    },
    {
      q: "How can I tell if an auto transport company is a broker or a carrier?",
      a: "Ask directly. 'Do you own trucks, or do you broker every load?' An honest answer takes one sentence. You can also look up the company's MC and USDOT numbers on the FMCSA SAFER database. Brokers have broker authority. Carriers have carrier authority. Hybrid companies hold both.",
    },
    {
      q: "Is a carrier better than a broker for shipping a car?",
      a: "Neither is universally better. A good broker handling routine routes can be smoother than a carrier whose trucks are not on your lane. A carrier handling their own route is more accountable than a broker. The hybrid case has both options, which usually delivers the cleanest customer experience.",
    },
    {
      q: "What is a hybrid auto transport company?",
      a: "A hybrid operates both as a broker (matching customers to outside carriers when needed) AND as a carrier (running their own fleet on selected routes). When your route fits the carrier side, you avoid the broker-carrier handoff. When your route does not fit, the broker side uses a vetted network rather than an open load board.",
    },
    {
      q: "Why are most auto transport companies brokers and not carriers?",
      a: "Capital intensity. A new car hauler trailer runs $80,000 to $150,000 and a truck to pull it runs another $150,000+. Insurance, fuel, and driver retention add major ongoing costs. It is much easier to be a broker matching customers to existing carriers than to operate your own fleet.",
    },
    {
      q: "How do I verify if an auto transport broker or carrier is legitimate?",
      a: "Use the FMCSA SAFER database at fmcsa.dot.gov. Search by company name or MC number. The record shows whether they have active broker authority, carrier authority, or both, their insurance status, and their safety rating. Any company that refuses to give you their MC number is one to walk away from.",
    },
  ],
  related: [
    {
      slug: "why-car-shipping-quotes-go-up",
      title: "Why Your Car Shipping Quote Went Up at the Last Minute",
      blurb:
        "The broker-carrier handoff is where most price-hike trouble starts. Here is the mechanic of how the bait pattern actually plays out.",
    },
    {
      slug: "deposit-before-driver-assigned",
      title: "Should You Pay a Deposit Before a Driver Is Assigned?",
      blurb:
        "Why brokers want your deposit before they have a carrier, when that timing is reasonable, and when it is a setup.",
    },
  ],
  primaryCta: {
    eyebrow: "See how a hybrid handles your route",
    title: "Check your route against our carrier network",
    body: "Send us your route and vehicle. We will show you what our carrier network is accepting today, and whether your route is one our sister carrier Auto Line Express runs in-house. Either way you get one accountability point.",
    href: "/tools/route-price-checker",
    label: "Check my route",
  },
};
