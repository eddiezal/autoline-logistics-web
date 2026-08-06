import type { Metadata } from "next";

/**
 * Locale-aware canonical + hreflang for every indexable page.
 *
 * WHY THIS EXISTS (2026-08-06): from launch (Jun 21) to Aug 6, the [locale]
 * layout hardcoded `alternates: { canonical: "/" }`, which every page
 * inherited — so nearly the whole site told Google "I am a duplicate of the
 * English homepage." Verified live on /es, /about, all Promise pages, and
 * every corridor. Only /quote overrode it. Likely cause of the position-25
 * stall, ~90% brand-only clicks, and 43-of-78 indexation.
 *
 * RULES:
 * 1. Every indexable page calls this from its generateMetadata and passes
 *    its own UNPREFIXED path ("/services", "" for home). Locale prefixing
 *    is handled here (EN unprefixed per localePrefix "as-needed"; ES = /es).
 * 2. The layout must NEVER set a canonical again.
 * 3. hreflang set: en-US + es-US + x-default (x-default → EN).
 * 4. Single-locale pages (blog articles) should NOT use this helper for
 *    languages — they set `canonical` only. Pairing non-equivalent content
 *    is worse than no hreflang.
 *
 * Relative URLs resolve against metadataBase (set in [locale]/layout.tsx).
 */
export function localeAlternates(
  locale: string,
  path: string,
): NonNullable<Metadata["alternates"]> {
  const clean = path === "/" ? "" : path;
  const en = clean === "" ? "/" : clean;
  const es = clean === "" ? "/es" : `/es${clean}`;
  return {
    canonical: locale === "es" ? es : en,
    languages: {
      "en-US": en,
      "es-US": es,
      "x-default": en,
    },
  };
}

/** Self-canonical for pages that exist in exactly one locale (blog articles). */
export function singleLocaleCanonical(
  locale: string,
  path: string,
): NonNullable<Metadata["alternates"]> {
  return { canonical: locale === "es" ? `/es${path}` : path };
}
