/**
 * Auto Line Logistics — Brand spec (single source of truth for code).
 *
 * Confirmed May 6, 2026. Hex extracted directly from Ben's vector logo.
 * Logo files: see /workspace/brand-assets/zaldivar-labs/ (Zaldivar Labs)
 * and /AutoExpress/brand-assets/ (Auto Line Logistics — orange/black + white/black .eps).
 *
 * If you find yourself adding a blue or purple color, stop. Brand is
 * orange + neutral grays + black + white. Period.
 */

export const BRAND = {
  colors: {
    orange: "#FF6600",
    orangeDark: "#E55C00",
    orangeLight: "#FFB380",
    orangeTint: "#FFE4CC",

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
