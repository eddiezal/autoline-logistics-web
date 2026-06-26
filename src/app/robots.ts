import type { MetadataRoute } from "next";

/**
 * /robots.txt generation.
 *
 * Mirrors the meta-tag gate in `[locale]/layout.tsx`: until the production
 * domain (autolinelogistics.com) is connected AND `NEXT_PUBLIC_SITE_URL` is
 * set in Vercel Production env vars, we disallow all crawling.
 */
export default function robots(): MetadataRoute.Robots {
  // VERCEL_ENV is the source of truth for production vs preview.
  // Previous logic also required NEXT_PUBLIC_SITE_URL to equal the non-www
  // URL string, which silently disallowed all crawling when the env var
  // was unset or set to the www version. Caused a 4-day SEO outage from
  // the 2026-06-22 DNS cutover. Simplified 2026-06-26.
  const isProduction = process.env.VERCEL_ENV === "production";

  if (!isProduction) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Block any private/admin paths
        disallow: ["/api/", "/_next/", "/portal/"],
      },
    ],
    sitemap: "https://www.autolinelogistics.com/sitemap.xml",
    host: "https://www.autolinelogistics.com",
  };
}
