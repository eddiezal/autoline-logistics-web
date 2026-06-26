/**
 * Centralized schema.org JSON-LD generators for the site.
 *
 * Each function returns a plain object that gets stringified and rendered
 * inside a `<script type="application/ld+json">` tag via the
 * `<StructuredData>` component.
 *
 * Design choices:
 *
 * 1. **Single source of truth for business data.** Address, phone, MC/DOT
 *    numbers live here in BUSINESS, used by every schema that needs them.
 *    Update once, propagates everywhere.
 *
 * 2. **Organization gets a stable @id.** Every other schema references
 *    that @id via `publisher` / `provider` / `parentOrganization`. Google
 *    correlates the entity across all rich results, building a coherent
 *    knowledge-graph entry for Auto Line Logistics.
 *
 * 3. **Absolute URLs only.** No relative paths in structured data.
 *    Google's validator rejects relative URLs in schema.
 *
 * 4. **No fabrication.** If we don't have aggregate review counts or
 *    real customer ratings yet, we don't emit fake numbers. Better to
 *    omit a property than to lie in schema.
 *
 * Added 2026-06-26 as part of the SEO improvement pass.
 */

export const SITE_URL = "https://www.autolinelogistics.com";

/** Single source of truth for ALL's business data. */
const BUSINESS = {
  name: "Auto Line Logistics",
  legalName: "Auto Line Logistics, Inc.",
  url: SITE_URL,
  logo: `${SITE_URL}/brand/wordmark-dark.png`,
  image: `${SITE_URL}/photography/og-image.webp`,
  email: "admin@autolinelogistics.com",
  telephone: "+1-714-660-7558",
  foundingDate: "2011",
  address: {
    "@type": "PostalAddress",
    streetAddress: "10073 Valley View St, Ste 120",
    addressLocality: "Cypress",
    addressRegion: "CA",
    postalCode: "90630",
    addressCountry: "US",
  },
  // FMCSA credentials. These appear as identifiers on the Organization
  // schema, which Google uses to verify the entity's regulatory status.
  identifiers: {
    usdot: "3961864",
    mc: "1477788",
    bondAmount: "75000",
    cargoCoverage: "500000",
  },
  // Service area: nationwide US auto transport.
  serviceArea: "US",
  // Languages supported by the front-line team.
  availableLanguages: ["English", "Spanish"],
} as const;

/** Stable @id for cross-schema entity correlation. */
const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;
const LOCAL_BUSINESS_ID = `${SITE_URL}/#localbusiness`;

/* ============================================================
 * Organization — sitewide
 * ============================================================ */

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: BUSINESS.name,
    legalName: BUSINESS.legalName,
    url: BUSINESS.url,
    logo: BUSINESS.logo,
    image: BUSINESS.image,
    email: BUSINESS.email,
    telephone: BUSINESS.telephone,
    foundingDate: BUSINESS.foundingDate,
    address: BUSINESS.address,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: BUSINESS.telephone,
      contactType: "customer service",
      email: BUSINESS.email,
      areaServed: BUSINESS.serviceArea,
      availableLanguage: BUSINESS.availableLanguages,
    },
    // FMCSA regulatory identifiers, exposed as Schema.org identifiers
    // with valueRequired/propertyID semantics so Google can recognize
    // them as regulatory authority numbers.
    identifier: [
      {
        "@type": "PropertyValue",
        propertyID: "USDOT",
        value: BUSINESS.identifiers.usdot,
      },
      {
        "@type": "PropertyValue",
        propertyID: "MC",
        value: BUSINESS.identifiers.mc,
      },
    ],
    knowsAbout: [
      "Auto Transport",
      "Vehicle Shipping",
      "Car Shipping",
      "Cross-Country Auto Transport",
      "Hawaii Auto Transport",
      "Alaska Auto Transport",
      "Enclosed Auto Transport",
    ],
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
  };
}

/* ============================================================
 * LocalBusiness — adds geo + opening hours for the office
 * ============================================================ */

export function localBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "MovingCompany"],
    "@id": LOCAL_BUSINESS_ID,
    name: BUSINESS.name,
    image: BUSINESS.image,
    url: BUSINESS.url,
    telephone: BUSINESS.telephone,
    email: BUSINESS.email,
    address: BUSINESS.address,
    // Cypress, CA coordinates (10073 Valley View St area).
    geo: {
      "@type": "GeoCoordinates",
      latitude: 33.8169,
      longitude: -118.0376,
    },
    priceRange: "$$",
    // Office hours. M-F 9-5 PT is the assumption; agents take calls
    // outside these hours via RingCentral hunt-group, but the OFFICE
    // hours per schema are what's displayed in Maps.
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Saturday"],
        opens: "09:00",
        closes: "14:00",
      },
    ],
    parentOrganization: { "@id": ORG_ID },
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
  };
}

/* ============================================================
 * WebSite — adds sitelinks search box eligibility
 * ============================================================ */

export function webSiteSchema(locale: "en" | "es" = "en") {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    url: BUSINESS.url,
    name: BUSINESS.name,
    description:
      locale === "es"
        ? "Transporte de autos a precio fijo con seguimiento en tiempo real."
        : "Locked-price auto transport with real-time tracking.",
    publisher: { "@id": ORG_ID },
    inLanguage: locale === "es" ? "es-US" : "en-US",
  };
}

/* ============================================================
 * BreadcrumbList — per-page navigation hierarchy
 * ============================================================ */

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

/* ============================================================
 * FAQPage — for any page with a FAQ section
 * ============================================================ */

export interface FaqItem {
  q: string;
  a: string;
}

export function faqPageSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((pair) => ({
      "@type": "Question",
      name: pair.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: pair.a,
      },
    })),
  };
}

/* ============================================================
 * Service — corridor pages, service tier pages
 * ============================================================ */

export interface ServiceSchemaInput {
  /** Canonical URL of the service page. */
  url: string;
  /** Display name, e.g. "Auto Transport from California to Texas". */
  name: string;
  /** Description shown in search results. */
  description: string;
  /** Service type slug, e.g. "AutoTransport". */
  serviceType?: string;
  /** Geographic origin and destination of the service. */
  areaServed?: { origin: string; destination: string };
}

export function serviceSchema(input: ServiceSchemaInput) {
  const areaServed = input.areaServed
    ? [
        { "@type": "State", name: input.areaServed.origin },
        { "@type": "State", name: input.areaServed.destination },
      ]
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    serviceType: input.serviceType ?? "Auto Transport",
    url: input.url,
    provider: { "@id": ORG_ID },
    ...(areaServed && { areaServed }),
    // Pricing on a Service schema is a deliberate omission. We have
    // dynamic pricing (varies per route, per vehicle, per day) that
    // would be misleading as a static number. Google doesn't require
    // it and we'd rather not lock a number that's quote-only.
  };
}

/* ============================================================
 * BlogPosting / Article — blog content
 * ============================================================ */

export interface ArticleSchemaInput {
  url: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  image?: string;
}

export function articleSchema(input: ArticleSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: {
      "@type": "Organization",
      "@id": ORG_ID,
      name: input.author ?? BUSINESS.name,
    },
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.url,
    },
    image: input.image ?? BUSINESS.image,
  };
}
