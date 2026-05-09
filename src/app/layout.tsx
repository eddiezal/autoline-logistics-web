import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

// Body sans-serif: Inter (clean, professional, neutral — pairs with serif headings)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Heading serif: Newsreader (editorial-trust, matches the modern-trust voice).
// Eddie note: Ben's truck-signage font is still pending identification (open Action Item).
// When confirmed, swap or augment here.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Auto Line Logistics",
  },
  robots: {
    index: true,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
