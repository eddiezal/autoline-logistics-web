/**
 * Inline chart documents for Analysis Library study pages.
 *
 * WHY srcdoc instead of iframe src: the site ships strict anti-clickjacking
 * headers (X-Frame-Options: DENY + CSP frame-ancestors 'none') on every
 * route. A srcdoc iframe embeds the document inline — no HTTP fetch, so
 * those response headers never apply. The /admin/analysis/[slug]/chart
 * route remains for full-screen viewing (top-level navigation is never
 * affected by framing headers).
 *
 * The chart runs inside the parent page's CSP, which allows inline
 * script/style ('unsafe-inline') — exactly what the self-contained chart
 * needs. Server-only: the decoded HTML is rendered into the page.
 */
import "server-only";
import { REMOTENESS_CHART_B64 } from "@/lib/admin/remotenessChartHtml";

export function getChartSrcdoc(slug: string): string | null {
  if (slug === "remoteness-premium") {
    return Buffer.from(REMOTENESS_CHART_B64, "base64").toString("utf-8");
  }
  return null;
}
