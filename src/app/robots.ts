import type { MetadataRoute } from "next";

/**
 * /robots.txt generation.
 *
 * Mirrors the meta-tag gate in `[locale]/layout.tsx`: until the production
 * domain (autolinelogistics.com) is connected AND `NEXT_PUBLIC_SITE_URL` is
 * set in Vercel Production env vars, we disallow all crawling.
 */
export default function robots(): MetadataRoute.Robots {
  const isProductionDomain =
    process.env.VERCEL_ENV === "production" &&
    process.env.NEXT_PUBLIC_SITE_URL === "https://autolinelogistics.com";

  if (!isProductionDomain) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Block any private/admin paths once those exist
        disallow: ["/api/", "/_next/"],
      },
    ],
    sitemap: "https://autolinelogistics.com/sitemap.xml",
    host: "https://autolinelogistics.com",
  };
}
