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
  customer: { email: string; phone: string; notes?: string };
  origin: { city: string; state: string; zip: string };
  destination: { city: string; state: string; zip: string };
  vehicle: { year: string; make: string; model: string; type: string };
  tier: "standby" | "priority" | "expedited";
  estimate: { source: "sd" | "unavailable"; price?: number; confidence?: number } | null;
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildLeadEmail(input: BuildLeadEmailInput): BuiltLeadEmail {
  const o = locLabel(input.origin);
  const d = locLabel(input.destination);
  const vehicle = input.vehicle.year + " " + input.vehicle.make + " " + input.vehicle.model;
  const price = priceLabel(input.estimate);
  const tier = tierLabel(input.tier);

  const subject = "[Lead] " + o + " -> " + d + " . " + vehicle + " . " + price;

  const textLines: string[] = [
    "New lead routed to you (" + input.leadRef + ").",
    "",
    "Customer: " + input.customer.email + " . " + input.customer.phone,
    "Route: " + o + " -> " + d,
    "Vehicle: " + vehicle + " (" + input.vehicle.type + ")",
    "Tier: " + tier,
    "Estimate: " + price + (input.estimate?.confidence ? " (confidence " + input.estimate.confidence + "%)" : ""),
  ];
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

  const confidenceRow = input.estimate?.confidence
    ? '<div style="font-size:12px;color:' + GRAY + ';margin-top:2px;">Confidence ' + input.estimate.confidence + '%</div>'
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
    + confidenceRow
    + '</div>'
    + '<h3 style="margin:0 0 8px;font-size:14px;color:' + PINE + ';text-transform:uppercase;letter-spacing:0.05em;">Customer</h3>'
    + '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;width:90px;">Email</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(input.customer.email) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;">Phone</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(input.customer.phone) + '</td></tr>'
    + notesRow
    + '</table>'
    + '<h3 style="margin:24px 0 8px;font-size:14px;color:' + PINE + ';text-transform:uppercase;letter-spacing:0.05em;">Shipment</h3>'
    + '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;width:90px;">Origin</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(input.origin.state) + ' ' + escapeHtml(input.origin.zip) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;">Destination</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(input.destination.state) + ' ' + escapeHtml(input.destination.zip) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;">Vehicle</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(vehicle) + ' . ' + escapeHtml(input.vehicle.type) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:' + GRAY + ';font-size:13px;">Tier</td><td style="padding:6px 0;color:#111;font-size:14px;">' + escapeHtml(tier) + '</td></tr>'
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
