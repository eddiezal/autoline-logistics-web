import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Analytics } from "@/components/Analytics";
import { AttributionCapture } from "@/components/AttributionCapture";
import { BehaviorTracker } from "@/components/BehaviorTracker";
import { CallRailSnippet } from "@/components/CallRailSnippet";
import { StructuredData } from "@/components/StructuredData";
import { organizationSchema, webSiteSchema } from "@/lib/seo/schemas";
import "../globals.css";

// Single-font system: Inter handles BOTH body and display (Stripe/Linear playbook).
// May 17, 2026 — moved from Newsreader (serif) → Manrope (sans) → Inter (single-font)
// after Eddie compared all 7 options at hero scale. Inter 900 (Black) carries the
// hero headline; Inter 400-700 handles body + smaller headings.
// See: brand-explorations/hero-font-comparison.html
//
// 2026-08-11: switched from next/font/google (build-time download) to a
// runtime stylesheet <link>. Google's font CDN started 404ing the Inter
// file URLs pinned inside Next 16.2.6's font metadata, which HARD-FAILED
// every production build that recompiled this layout (42 Turbopack errors)
// — during an active GA4 outage fix, no less. The runtime css2 API always
// serves current URLs, so builds no longer depend on Google's CDN at all.
// Trade-off: marginally later font paint vs next/font's self-hosting;
// preconnect hints below claw most of that back. The --font-inter CSS
// variable (referenced by globals.css) is now set inline on <html>.
// If reverting to next/font someday, verify the pinned URLs resolve first.
const INTER_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap";

export const metadata: Metadata = {
  title: {
    default: "Auto Line Logistics — Nationwide Vehicle Shipping",
    template: "%s | Auto Line Logistics",
  },
  description:
    "Locked-price auto transport with real-time tracking, photo evidence, and a coordinator who picks up the phone. Built for individual customers who deserve more than a quote and a hope.",
  metadataBase: new URL("https://www.autolinelogistics.com"),
  // DO NOT add `alternates` here. A hardcoded layout-level canonical ("/")
  // shipped Jun 21 -> Aug 6 and made every page declare itself a duplicate of
  // the EN homepage (verified live 2026-08-06; suppressed indexation sitewide).
  // Every indexable page sets its own self-referencing canonical + hreflang
  // via localeAlternates() in src/lib/seo/alternates.ts.
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Auto Line Logistics",
    url: "https://www.autolinelogistics.com",
    images: [
      {
        url: "/photography/og-image.webp",
        width: 1200,
        height: 630,
        alt: "Auto Line car-hauler trucks loaded with vehicles, mountain backdrop",
        type: "image/webp",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/photography/og-image.webp"],
  },
  // Block search-engine indexing on Vercel preview URLs (autoline-logistics-web.vercel.app)
  // and any non-production deploy. Only the real production domain should be indexed.
  // Flip this once `autolinelogistics.com` is connected to Vercel as the production domain.
  robots: {
    index: process.env.VERCEL_ENV === "production",
    follow: true,
  },
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
};

// themeColor lives on viewport export in Next 14+ (split out from Metadata)
export const viewport: Viewport = {
  themeColor: "#128A3A",
  width: "device-width",
  initialScale: 1,
};

/**
 * Pre-render both locale segments at build time. Without this, requests for
 * unknown locales would 404 only at runtime instead of via static generation.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate the URL locale segment against our routing config; 404 if unknown.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Make the locale available to RSC `getTranslations()` calls in this tree.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className="h-full antialiased"
      style={{ ["--font-inter" as string]: "'Inter', system-ui, sans-serif" }}
    >
      {/* React 19 hoists these to <head>. Preconnects keep the runtime font
          fetch fast; see the INTER_CSS_URL comment for why not next/font. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={INTER_CSS_URL} />
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <Analytics />
        <AttributionCapture />
        <BehaviorTracker />
        <CallRailSnippet />
        {/* Sitewide structured data. Per-page schemas (LocalBusiness, Service,
            FAQPage, BreadcrumbList) get mounted from their own page files. */}
        <StructuredData
          data={[
            organizationSchema(),
            webSiteSchema(locale === "es" ? "es" : "en"),
          ]}
        />
      </body>
    </html>
  );
}
