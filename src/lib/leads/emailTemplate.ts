/**
 * Lead notification email builder.
 *
 * Renders the HTML + plain-text body the assigned agent receives when a
 * new /quote lead lands. Subject pattern is designed to scan at a glance
 * in a busy inbox.
 */

import "server-only";

export interface BuildLeadEmailInput {
  leadRef: string;
  agentFirstName: string;
  customer: {
    firstName: string;
    lastName?: string | null;
    email: string;
    phone: string;
    notes?: string;
  };
  origin: { city: string; state: string; zip: string };
  destination: { city: string; state: string; zip: string };
  vehicle: { year: string; make: string; model: string; type: string };
  tier: "standby" | "priority" | "expedited";
  estimate: {
    source: "sd" | "unavailable";
    price?: number;
    low?: number;
    high?: number;
    confidence?: number;
  } | null;
  attribution: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    variant?: string;
    referrer?: string;
  };
  submittedAt: string;
}

export interface BuiltLeadEmail {
  subject: string;
  text: string;
  html: string;
}

function locLabel(loc: { city: string; state: string; zip: string }): string {
  if (loc.city.trim().length > 0) return loc.city + ", " + loc.state;
  return loc.state + " " + loc.zip;
}

function tierLabel(tier: "standby" | "priority" | "expedited"): string {
  if (tier === "standby") return "Standby";
  if (tier === "expedited") return "Expedited";
  return "Priority";
}

function priceLabel(estimate: BuildLeadEmailInput["estimate"]): string {
  if (estimate?.source === "sd" && typeof estimate.price === "number") {
    return "$" + estimate.price.toLocaleString("en-US");
  }
  return "estimate pending";
}

/** "Market range $1,400 to $1,700" or null when low/high not available. */
function rangeLabel(estimate: BuildLeadEmailInput["estimate"]): string | null {
  if (
    estimate?.source === "sd" &&
    typeof estimate.low === "number" &&
    typeof estimate.high === "number" &&
    estimate.low < estimate.high
  ) {
    return (
      "Market range $" +
      estimate.low.toLocaleString("en-US") +
      " to $" +
      estimate.high.toLocaleString("en-US")
    );
  }
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Google Ads campaign ID -> friendly name.
 * The account-level tracking suffix sets utm_campaign={campaignid}, so ad
 * clicks arrive with the numeric ID. Map it to something agents can read.
 * Keep in sync with the Google Ads account (851-980-8841).
 */
const ADS_CAMPAIGN_NAMES: Record<string, string> = {
  "24034601745": "S1 Cost & Quotes",
  "24034601748": "S2 Near Me LA",
  "24034601751": "S3 State + Corridors",
  "24034601754": "S4 Segments",
  "24034601757": "Brand Defense",
  "24034984545": "S5 Español",
};

/**
 * One-line, plain-English lead source for agents.
 *
 *   "Google Ads - S5 Español"   paid click (utm_source=google&utm_medium=cpc
 *                                from the account tracking suffix)
 *   "Google (organic)"          google referrer, no utm tags
 *   "Bing (organic)"            etc.
 *   "Referral - <host>"         any other referrer
 *   "Direct / unknown"          nothing to go on
 */
function deriveLeadSource(a: BuildLeadEmailInput["attribution"]): string {
  const src = a.utmSource?.trim().toLowerCase();
  const med = a.utmMedium?.trim().toLowerCase();

  if (src === "google" && (med === "cpc" || med === "ppc" || med === "paid")) {
    const name = a.utmCampaign ? ADS_CAMPAIGN_NAMES[a.utmCampaign.trim()] : undefined;
    return "Google Ads - " + (name ?? (a.utmCampaign?.trim() || "unknown campaign"));
  }
  if (src) {
    // Some other tagged source (newsletter, facebook, etc.)
    return src.charAt(0).toUpperCase() + src.slice(1) + (med ? " (" + med + ")" : "");
  }

  const ref = a.referrer?.trim().toLowerCase() ?? "";
  if (ref) {
    let host = "";
    try {
      host = new URL(ref).hostname.replace(/^www\./, "");
    } catch {
      host = ref;
    }
    if (host.includes("google.")) return "Google (organic)";
    if (host.includes("bing.")) return "Bing (organic)";
    if (host.includes("duckduckgo.")) return "DuckDuckGo (organic)";
    if (host.includes("yahoo.")) return "Yahoo (organic)";
    if (host.includes("autolinelogistics.com")) return "Direct (internal nav)";
    return "Referral - " + host;
  }

  return "Direct / unknown";
}

export function buildLeadEmail(input: BuildLeadEmailInput): BuiltLeadEmail {
  const o = locLabel(input.origin);
  const d = locLabel(input.destination);
  const vehicle = input.vehicle.year + " " + input.vehicle.make + " " + input.vehicle.model;
  const price = priceLabel(input.estimate);
  const tier = tierLabel(input.tier);

  const subject = "[Lead] " + o + " -> " + d + " . " + vehicle + " . " + price;

  const fullName =
    input.customer.firstName +
    (input.customer.lastName ? " " + input.customer.lastName : "");

  const textLines: string[] = [
    "New lead routed to you (" + input.leadRef + ").",
    "",
    "Customer: " + fullName + " . " + input.customer.email + " . " + input.customer.phone,
    "Route: " + o + " -> " + d,
    "Vehicle: " + vehicle + " (" + input.vehicle.type + ")",
    "Tier: " + tier,
    "Source: " + deriveLeadSource(input.attribution),
    "Estimate: " + price,
  ];
  const range = rangeLabel(input.estimate);
  if (range) textLines.push(range);
  if (input.customer.notes) textLines.push("Notes: " + input.customer.notes);
  textLines.push("");
  textLines.push("Submitted: " + input.submittedAt);
  textLines.push("Reply to this email to reach the customer directly.");
  const text = textLines.join("\n");

  const html = renderHtml(input, o, d, vehicle, price, tier);

  return { subject, text, html };
}

function renderHtml(
  input: BuildLeadEmailInput,
  o: string,
  d: string,
  vehicle: string,
  price: string,
  tier: string,
): string {
  const PINE = "#052e1a";
  const ACCENT = "#16a34a";
  const GRAY = "#374151";

  const notesRow = input.customer.notes
    ? '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;">Notes</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(input.customer.notes) + '</td></tr>'
    : "";

  const attribution = renderAttribution(input.attribution);

  return '<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Roboto,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;"><tr><td align="center">'
    + '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">'
    + '<tr><td style="background:' + PINE + ';color:#fff;padding:20px 24px;">'
    + '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.85;">New lead . ' + escapeHtml(tier) + '</div>'
    + '<div style="font-size:22px;font-weight:700;margin-top:6px;">' + escapeHtml(o) + ' -> ' + escapeHtml(d) + '</div>'
    + '<div style="font-size:14px;opacity:0.85;margin-top:4px;">' + escapeHtml(vehicle) + ' . ' + escapeHtml(input.vehicle.type) + '</div>'
    + '</td></tr><tr><td style="padding:24px;">'
    + '<div style="background:#f0faf3;border-left:3px solid ' + ACCENT + ';padding:16px 18px;border-radius:0 8px 8px 0;margin-bottom:20px;">'
    + '<div style="font-size:11px;color:' + ACCENT + ';font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Estimated quote shown to customer</div>'
    + '<div style="font-size:28px;font-weight:800;color:#052e1a;margin-top:4px;">' + escapeHtml(price) + '</div>'
    + (rangeLabel(input.estimate)
        ? '<div style="font-size:13px;color:' + GRAY + ';margin-top:6px;">' + escapeHtml(rangeLabel(input.estimate) ?? "") + '</div>'
        : "")
    + '</div>'
    + '<h3 style="margin:0 0 8px;font-size:14px;color:' + PINE + ';text-transform:uppercase;letter-spacing:0.05em;">Customer</h3>'
    + '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;width:90px;">Name</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(input.customer.firstName + (input.customer.lastName ? " " + input.customer.lastName : "")) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;">Email</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(input.customer.email) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;">Phone</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(input.customer.phone) + '</td></tr>'
    + notesRow
    + '</table>'
    + '<h3 style="margin:24px 0 8px;font-size:14px;color:' + PINE + ';text-transform:uppercase;letter-spacing:0.05em;">Shipment</h3>'
    + '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;width:90px;">Origin</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(input.origin.state) + ' ' + escapeHtml(input.origin.zip) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;">Destination</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(input.destination.state) + ' ' + escapeHtml(input.destination.zip) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;">Vehicle</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(vehicle) + ' . ' + escapeHtml(input.vehicle.type) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;">Tier</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(tier) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;">Source</td><td style="padding:6px 0;color:' + PINE + ';font-size:14px;font-weight:700;">' + escapeHtml(deriveLeadSource(input.attribution)) + '</td></tr>'
    + '</table>'
    + attribution
    + '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:' + GRAY + ';">'
    + 'Ref: ' + escapeHtml(input.leadRef) + ' . Submitted ' + escapeHtml(input.submittedAt) + '<br>'
    + 'Reply to this email to reach the customer directly.'
    + '</div></td></tr></table></td></tr></table></body></html>';
}

function renderAttribution(a: BuildLeadEmailInput["attribution"]): string {
  const rows: string[] = [];
  const add = (label: string, val: string | undefined) => {
    if (val) rows.push('<tr><td style="padding:4px 0;color:#374151;font-size:12px;width:90px;">' + label + '</td><td style="padding:4px 0;color:#111;font-size:12px;word-break:break-all;">' + escapeHtml(val) + '</td></tr>');
  };
  add("utm_source", a.utmSource);
  add("utm_medium", a.utmMedium);
  add("utm_campaign", a.utmCampaign);
  add("utm_content", a.utmContent);
  add("variant", a.variant);
  add("referrer", a.referrer);
  if (rows.length === 0) return "";
  return '<h3 style="margin:24px 0 8px;font-size:14px;color:#052e1a;text-transform:uppercase;letter-spacing:0.05em;">Attribution</h3><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">' + rows.join("") + '</table>';
}

/* ============================================================
 * Customer-facing confirmation email
 * ============================================================
 *
 * Sent after the agent notification. Confirms the form submission, sets
 * the expectation for the coordinator callback, and warms our domain in
 * the recipient's inbox so the agent's later email doesn't land in spam.
 *
 * Phase 1 scope:
 *   - EN only (bilingual deferred)
 *   - No estimate displayed (we don't lock a price before the agent quotes)
 *   - No named agent (avoids agent-availability dependency)
 *   - Single transactional email, no sequence
 *
 * Phase 2+:
 *   - locale-aware (capture ES on form submit, branch template here)
 *   - personalized agent name + direct line
 *   - Day 2 / Day 5 nudges if no booking yet
 */

// TODO: confirm with the team (Nelson follow-up sent 2026-06-29) which
// number/area code shows on the customer's caller ID. Update both constants
// at once when the answer comes back.
const CUSTOMER_SUPPORT_PHONE = "657-551-2307";
const CUSTOMER_CALL_AREA_CODE = "657";

export interface BuildCustomerEmailInput {
  leadRef: string;
  origin: { city: string; state: string; zip: string };
  destination: { city: string; state: string; zip: string };
  vehicle: { year: string; make: string; model: string };
  tier: "standby" | "priority" | "expedited";
}

export function buildCustomerEmail(
  input: BuildCustomerEmailInput,
): BuiltLeadEmail {
  const o = locLabel(input.origin);
  const d = locLabel(input.destination);
  const vehicle =
    input.vehicle.year + " " + input.vehicle.make + " " + input.vehicle.model;
  const tier = tierLabel(input.tier);

  const subject = "We've got your request. Confirmation " + input.leadRef;

  const text = [
    "Hi there,",
    "",
    "Got your shipping request. A coordinator will call you within 1 business hour from a " +
      CUSTOMER_CALL_AREA_CODE +
      " area code.",
    "",
    "Here's what we have on file:",
    "- Route: " + o + " to " + d,
    "- Vehicle: " + vehicle,
    "- Service tier: " + tier,
    "",
    "If you need to reach us before the call, reply to this email or phone " +
      CUSTOMER_SUPPORT_PHONE +
      ".",
    "",
    "Your confirmation number: " + input.leadRef,
    "",
    "Talk soon,",
    "Auto Line Logistics",
    "",
    "---",
    "Auto Line Logistics, Inc.",
    "10073 Valley View St, Ste 120, Cypress, CA 90630",
    "MC 1477788 / USDOT 3961864",
    "Family-owned auto transport since 2011",
  ].join("\n");

  const html = renderCustomerHtml(input, o, d, vehicle, tier);

  return { subject, text, html };
}

function renderCustomerHtml(
  input: BuildCustomerEmailInput,
  o: string,
  d: string,
  vehicle: string,
  tier: string,
): string {
  const PINE = "#052e1a";
  const ACCENT = "#16a34a";
  const GRAY = "#374151";
  const GRAY_LIGHT = "#6b7280";

  return (
    '<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Segoe UI,Roboto,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;"><tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">' +
    // Header
    '<tr><td style="background:' +
    PINE +
    ';color:#fff;padding:20px 24px;">' +
    '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.85;">Request received</div>' +
    '<div style="font-size:22px;font-weight:700;margin-top:6px;">Thanks. We\'re on it.</div>' +
    "</td></tr>" +
    // Body
    '<tr><td style="padding:24px;color:#111;">' +
    '<p style="margin:0 0 14px;font-size:15px;line-height:1.5;">Hi there,</p>' +
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Got your shipping request. A coordinator will call you within <strong>1 business hour</strong> from a <strong>' +
    escapeHtml(CUSTOMER_CALL_AREA_CODE) +
    "</strong> area code.</p>" +
    // Confirmation box
    '<div style="background:#f0faf3;border-left:3px solid ' +
    ACCENT +
    ';padding:14px 16px;border-radius:0 8px 8px 0;margin:18px 0;">' +
    '<div style="font-size:11px;color:' +
    ACCENT +
    ';font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Your confirmation number</div>' +
    '<div style="font-size:20px;font-weight:800;color:' +
    PINE +
    ';margin-top:4px;font-family:Menlo,Consolas,monospace;">' +
    escapeHtml(input.leadRef) +
    "</div>" +
    "</div>" +
    // Details
    '<h3 style="margin:20px 0 8px;font-size:13px;color:' +
    PINE +
    ';text-transform:uppercase;letter-spacing:0.05em;">Here\'s what we have on file</h3>' +
    '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">' +
    '<tr><td style="padding:6px 0;color:' +
    GRAY +
    ';font-size:13px;width:120px;">Route</td><td style="padding:6px 0;color:#111;font-size:14px;">' +
    escapeHtml(o) +
    " to " +
    escapeHtml(d) +
    "</td></tr>" +
    '<tr><td style="padding:6px 0;color:' +
    GRAY +
    ';font-size:13px;">Vehicle</td><td style="padding:6px 0;color:#111;font-size:14px;">' +
    escapeHtml(vehicle) +
    "</td></tr>" +
    '<tr><td style="padding:6px 0;color:' +
    GRAY +
    ';font-size:13px;">Service tier</td><td style="padding:6px 0;color:#111;font-size:14px;">' +
    escapeHtml(tier) +
    "</td></tr>" +
    "</table>" +
    // Contact line
    '<p style="margin:20px 0 0;font-size:14px;line-height:1.55;color:' +
    GRAY +
    ';">If you need to reach us before the call, reply to this email or phone ' +
    '<a href="tel:' +
    CUSTOMER_SUPPORT_PHONE.replace(/[^0-9+]/g, "") +
    '" style="color:' +
    PINE +
    ';font-weight:600;">' +
    escapeHtml(CUSTOMER_SUPPORT_PHONE) +
    "</a>.</p>" +
    "</td></tr>" +
    // Footer
    '<tr><td style="background:#fafaf7;padding:18px 24px;border-top:1px solid #e5e7eb;font-size:12px;color:' +
    GRAY_LIGHT +
    ';line-height:1.6;">' +
    "<strong>Auto Line Logistics, Inc.</strong><br>" +
    "10073 Valley View St, Ste 120, Cypress, CA 90630<br>" +
    "MC 1477788 / USDOT 3961864<br>" +
    "Family-owned auto transport since 2011" +
    "</td></tr>" +
    "</table></td></tr></table></body></html>"
  );
}

