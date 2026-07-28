/**
 * Business-view aggregation over the imported ProABD `orders` collection.
 *
 * Shared by /admin (?view=business — the B3 "numbers | people" layout) and
 * /admin/export (CSV download of the active tab), so the table on screen and
 * the file Ginger works from can never disagree.
 *
 * Definitions (keep in sync with the Business Baseline card on Overview):
 *  repeat customer   ≥2 orders under the same email
 *  snowbird target   any order departing FL/AZ for a non-FL/AZ state —
 *                    northbound spring migration; the October outreach list
 *  B2B account       email on a non-consumer domain (company/org mailbox) or
 *                    a business term in the shipper name. ISP and webmail
 *                    domains (gmail, rr.com, charter.net, juno.com, …) are
 *                    consumer by definition.
 *
 * PII note: names/emails/phones appear here deliberately — Eddie approved PII
 * in the internal dashboards ("why would we exclude it?"), and the whole
 * point of the view is outreach. /admin sits behind Basic auth.
 */

export interface BizOrder {
  orderId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  originCity: string;
  originState: string;
  originZip: string;
  destCity: string;
  destState: string;
  destZip: string;
  orderCreatedAt: Date | null;
  availableAt: Date | null;
  price: number;
  deposit: number;
}

export interface CustomerRow {
  name: string;
  email: string;
  phone: string;
  orders: number;
  fees: number; // Σ deposit — Auto Line revenue, not customer gross
  totalPaid: number; // Σ price — customer gross
  lastOrderAt: Date | null;
  /** Representative route (most recent order). */
  route: string;
  /** Last order's customer price — the "Paid" column on the snowbird tab. */
  lastPaid: number;
  /** B2B signal shown in the table (email domain or name match). */
  bizSignal: string | null;
}

export type BusinessTab = "repeats" | "snowbirds" | "b2b";

const SOUTH = new Set(["FL", "AZ"]);

/** Business term appearing in the shipper name field. */
const BIZ_NAME =
  /\b(llc|inc|corp|corporation|ltd|co\.|company|motors?|dealers?|auto sales|logistics|transport|towing|group|enterprises?|solutions|services)\b/i;

/**
 * Consumer mailbox domains: webmail + residential ISPs + legacy portals.
 * Anything NOT here (and not obviously a typo'd webmail) counts as a
 * company/org mailbox for the B2B tab.
 */
const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "hotmail.com",
  "outlook.com",
  "outlookk.com", // observed typo in the book — still a consumer mailbox
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "yandex.com",
  "hey.com",
  "duck.com",
  "mailer.me",
  "comcast.net",
  "att.net",
  "sbcglobal.net",
  "verizon.net",
  "cox.net",
  "bellsouth.net",
  "earthlink.net",
  "charter.net",
  "spectrum.net",
  "juno.com",
  "rcn.com",
  "myctl.net",
  "centurylink.net",
  "frontier.com",
  "windstream.net",
  "optonline.net",
  "roadrunner.com",
]);

function isConsumerDomain(domain: string): boolean {
  if (CONSUMER_DOMAINS.has(domain)) return true;
  // Regional Road Runner / Yahoo country domains: cfl.rr.com, yahoo.fr, …
  if (domain.endsWith(".rr.com")) return true;
  if (domain.startsWith("yahoo.")) return true;
  if (domain.startsWith("hotmail.")) return true;
  if (domain.startsWith("outlook.")) return true;
  return false;
}

function bizSignalFor(o: BizOrder): string | null {
  const name = `${o.firstName} ${o.lastName}`.trim();
  const m = name.match(BIZ_NAME);
  const domain = o.email.includes("@") ? o.email.split("@")[1] : "";
  if (domain && !isConsumerDomain(domain)) return "@" + domain;
  if (m) return `“${name}”`;
  return null;
}

/** Group orders into per-customer rows (keyed by email; no-email orders keyed by name). */
export function customersFrom(orders: BizOrder[]): CustomerRow[] {
  const byKey = new Map<string, CustomerRow & { _lastAt: number }>();
  for (const o of orders) {
    const key = o.email || `${o.firstName} ${o.lastName}`.trim().toLowerCase();
    if (!key) continue;
    const at = o.orderCreatedAt?.getTime() ?? 0;
    const cur =
      byKey.get(key) ??
      ({
        name: `${o.firstName} ${o.lastName}`.trim() || o.email,
        email: o.email,
        phone: o.phone,
        orders: 0,
        fees: 0,
        totalPaid: 0,
        lastOrderAt: null,
        route: "",
        lastPaid: 0,
        bizSignal: null,
        _lastAt: -1,
      } as CustomerRow & { _lastAt: number });
    cur.orders++;
    cur.fees += o.deposit;
    cur.totalPaid += o.price;
    if (at >= cur._lastAt) {
      cur._lastAt = at;
      cur.lastOrderAt = o.orderCreatedAt;
      cur.route = `${o.originState} → ${o.destState}`;
      cur.lastPaid = o.price;
      if (o.phone) cur.phone = o.phone;
    }
    const sig = bizSignalFor(o);
    if (sig && !cur.bizSignal) cur.bizSignal = sig;
    byKey.set(key, cur);
  }
  return [...byKey.values()].map((c) => {
    const row: CustomerRow = {
      name: c.name,
      email: c.email,
      phone: c.phone,
      orders: c.orders,
      fees: c.fees,
      totalPaid: c.totalPaid,
      lastOrderAt: c.lastOrderAt,
      route: c.route,
      lastPaid: c.lastPaid,
      bizSignal: c.bizSignal,
    };
    return row;
  });
}

/** Tab filters over the customer rows / raw orders. */
export function tabRows(orders: BizOrder[], tab: BusinessTab): CustomerRow[] {
  const customers = customersFrom(orders);
  if (tab === "repeats") {
    return customers.filter((c) => c.orders >= 2).sort((a, b) => b.fees - a.fees);
  }
  if (tab === "b2b") {
    return customers.filter((c) => c.bizSignal !== null).sort((a, b) => b.fees - a.fees);
  }
  // snowbirds: customers with ≥1 order leaving FL/AZ for elsewhere. Route/
  // Paid columns show that qualifying order (most recent if several).
  const snowKeys = new Map<string, BizOrder>();
  for (const o of orders) {
    if (!(SOUTH.has(o.originState) && !SOUTH.has(o.destState))) continue;
    const key = o.email || `${o.firstName} ${o.lastName}`.trim().toLowerCase();
    const prev = snowKeys.get(key);
    if (!prev || (o.orderCreatedAt?.getTime() ?? 0) > (prev.orderCreatedAt?.getTime() ?? 0)) {
      snowKeys.set(key, o);
    }
  }
  const byKey = new Map(
    customers.map((c) => [c.email || c.name.toLowerCase(), c] as const),
  );
  const out: CustomerRow[] = [];
  for (const [key, o] of snowKeys) {
    const c = byKey.get(key);
    if (!c) continue;
    out.push({
      ...c,
      route: `${o.originState} → ${o.destState}`,
      lastPaid: o.price,
    });
  }
  return out.sort((a, b) => b.lastPaid - a.lastPaid);
}

/** Snowbird count in ORDERS (Card A chip parity), vs tabRows which is customers. */
export function snowbirdOrderCount(orders: BizOrder[]): number {
  return orders.filter((o) => SOUTH.has(o.originState) && !SOUTH.has(o.destState)).length;
}

const CSV_HEADERS: Record<BusinessTab, string[]> = {
  repeats: ["name", "email", "phone", "orders", "fees_usd", "last_order", "last_route"],
  snowbirds: ["name", "email", "phone", "route", "paid_usd", "orders_total", "last_order"],
  b2b: ["name", "company_signal", "email", "phone", "orders", "fees_usd", "last_order"],
};

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

/** CSV for the active tab — same rows the on-screen table shows. */
export function tabCsv(orders: BizOrder[], tab: BusinessTab): string {
  const rows = tabRows(orders, tab);
  const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  const lines: string[][] = rows.map((c) => {
    if (tab === "repeats")
      return [c.name, c.email, c.phone, String(c.orders), String(Math.round(c.fees)), day(c.lastOrderAt), c.route];
    if (tab === "snowbirds")
      return [c.name, c.email, c.phone, c.route, String(Math.round(c.lastPaid)), String(c.orders), day(c.lastOrderAt)];
    return [c.name, c.bizSignal ?? "", c.email, c.phone, String(c.orders), String(Math.round(c.fees)), day(c.lastOrderAt)];
  });
  return [CSV_HEADERS[tab], ...lines].map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";
}
