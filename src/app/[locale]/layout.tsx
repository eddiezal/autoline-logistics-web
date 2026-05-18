import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Single-font system: Inter handles BOTH body and display (Stripe/Linear playbook).
// May 17, 2026 — moved from Newsreader (serif) → Manrope (sans) → Inter (single-font)
// after Eddie compared all 7 options at hero scale. Inter 900 (Black) carries the
// hero headline; Inter 400-700 handles body + smaller headings. One HTTP request,
// one typographic system, max minimalism.
// See: brand-explorations/hero-font-comparison.html
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Auto Line Logistics — Nationwide Vehicle Shipping",
    template: "%s | Auto Line Logistics",
  },
  description:
    "Locked-price auto transport with real-time tracking, photo evidence, and a coordinator who picks up the phone. Built for individual customers who deserve more than a quote and a hope.",
  metadataBase: new URL("https://autolinelogistics.com"),
  // Tell search engines the real domain is canonical, regardless of which URL
  // they crawl (staging, preview, etc.). Per-page metadata can override this.
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      es: "/es",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Auto Line Logistics",
    url: "https://autolinelogistics.com",
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
    index:
      process.env.VERCEL_ENV === "production" &&
      process.env.NEXT_PUBLIC_SITE_URL === "https://autolinelogistics.com",
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
  themeColor: "#FF6600",
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
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
