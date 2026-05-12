import type { MetadataRoute } from "next";
import { getLiveCorridors } from "@/lib/corridors";
import { routing } from "@/i18n/routing";

/**
 * Dynamic sitemap generation.
 *
 * Lists EN + ES alternates for every static route. Next.js will surface
 * this at /sitemap.xml so search engines find both language versions.
 *
 * Once production cuts over to autolinelogistics.com and the noindex gate
 * lifts, this sitemap becomes the canonical map of indexable URLs.
 */

const BASE_URL = "https://autolinelogistics.com";

// Static page paths (under [locale]/). Locale prefixes are added below.
const STATIC_PATHS = [
  "", // home
  "/about",
  "/quote",
  "/price-promise",
  "/damage-promise",
  "/people-promise",
  "/corridors",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const entries: MetadataRoute.Sitemap = [];

  // Static pages — emit one entry per locale, with alternates pointing across
  for (const path of STATIC_PATHS) {
    for (const locale of routing.locales) {
      const url = buildUrl(locale, path);
      entries.push({
        url,
        lastModified,
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1.0 : 0.7,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((l) => [l, buildUrl(l, path)])
          ),
        },
      });
    }
  }

  // Live corridor pages
  for (const corridor of getLiveCorridors()) {
    const path = `/corridors/${corridor.slug}`;
    for (const locale of routing.locales) {
      entries.push({
        url: buildUrl(locale, path),
        lastModified,
        changeFrequency: "monthly",
        priority: 0.8,
        alternates: {
          languages: Object.fromEntries(
            routing.locales.map((l) => [l, buildUrl(l, path)])
          ),
        },
      });
    }
  }

  // Coming-soon corridors aren't indexable (no dedicated pages); search
  // engines will find them via the /corridors index page crawl.

  return entries;
}

/**
 * Build a full URL for a given locale + path, honoring the
 * `localePrefix: "as-needed"` routing config — EN is unprefixed, ES gets `/es`.
 */
function buildUrl(locale: string, path: string): string {
  if (locale === routing.defaultLocale) {
    return `${BASE_URL}${path}`;
  }
  return `${BASE_URL}/${locale}${path}`;
}
