/**
 * Auto Line Logistics — Brand spec (single source of truth for code).
 *
 * Brand color LOCKED May 22, 2026: Operator Green (Option A) from
 * brand-explorations/green-finalize-operator.html — deep green primary
 * + hi-vis lime accent (replaces orange on CTAs/numbers), pine ink, off-white.
 * Logo files in /AutoExpress/brand-assets/ still need recoloring to match.
 *
 * Keys keep their legacy "orange" names so imports don't break; VALUES are now
 * green. Brand = green + lime accent + neutral grays + black + white.
 */

export const BRAND = {
  colors: {
    orange: "#15803D",      // legacy key -- now Operator green (primary)
    orangeDark: "#166534",  // deeper green (hover)
    orangeLight: "#86EFAC", // light green
    orangeTint: "#DCFCE7",  // green tint
    accent: "#84CC16",      // hi-vis lime -- CTAs / numbers / highlights
    accentInk: "#0A1E14",   // dark text to sit on lime

    charcoal: "#2D2D2D",
    charcoalAlt: "#1F1F1F",

    gray900: "#1A1A1A",
    gray700: "#404040",
    gray500: "#6B6B6B",
    gray300: "#B0B0B0",
    gray200: "#E5E5E5",
    gray100: "#F5F5F5",

    white: "#FFFFFF",
  },

  voice: {
    // Voice C+D locked April 30, 2026
    primary: "Modern Trust Operator",
    editorial: "Anti-Scam Educator",
    tone: ["Modern", "Transparent", "Confident", "Evidence-driven", "Plainspoken"],
  },

  // Triple Promise — locked May 5, 2026
  // Note: "Ben handles escalations himself" was explicitly removed per Ben's request.
  promises: {
    price: {
      slug: "price-promise",
      title: "Price Promise",
      headline: "You pick the speed, we lock the price.",
    },
    damage: {
      slug: "damage-promise",
      title: "Damage Promise",
      headline: "Your car is covered beyond the carrier's insurance.",
    },
    people: {
      slug: "people-promise",
      title: "People Promise",
      headline: "You'll always talk to a real person, by name.",
    },
  },
} as const;

export type PromiseSlug = keyof typeof BRAND.promises;
