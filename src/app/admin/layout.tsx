/**
 * /admin layout — standalone shell OUTSIDE the [locale] tree.
 *
 * The root layout is a pass-through (html/body live in [locale]/layout so
 * the lang attribute can match the active locale), so this layout must
 * provide its own html/body. English-only by design: it's the internal
 * reporting surface, not a customer page.
 *
 * Auth: src/proxy.ts gates every /admin path with HTTP Basic auth against
 * ADMIN_DASH_PASSWORD before the request ever reaches this tree.
 */
import "../globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Auto Line Logistics — Lead Report",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "var(--color-brand-paper)",
          color: "var(--color-text-default)",
          fontFamily:
            "Inter, 'Segoe UI', Roboto, -apple-system, sans-serif",
          margin: 0,
        }}
      >
        {children}
      </body>
    </html>
  );
}
