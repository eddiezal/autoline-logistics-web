import { defineRouting } from "next-intl/routing";

/**
 * i18n routing config.
 *
 * - `en` is the default — served from `/` (no prefix)
 * - `es` is served from `/es/...`
 *
 * Locale switching: `localePrefix: "as-needed"` keeps the EN URLs clean
 * (no `/en/` prefix) while ES gets the `/es/` prefix. This matches the
 * production cutover plan where autolinelogistics.com serves EN by default
 * and Spanish is a discoverable alternate, not a forced choice.
 */
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});
