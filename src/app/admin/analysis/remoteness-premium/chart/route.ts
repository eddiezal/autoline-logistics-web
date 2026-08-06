/**
 * Serves the interactive remoteness-premium chart INSIDE the /admin
 * Basic-auth boundary (src/proxy.ts gates all /admin paths). The study page
 * iframes this route. Do not move the HTML to /public — it would become
 * publicly reachable.
 */
import { REMOTENESS_CHART_B64 } from "@/lib/admin/remotenessChartHtml";

export const runtime = "nodejs";

export function GET() {
  const html = Buffer.from(REMOTENESS_CHART_B64, "base64").toString("utf-8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
