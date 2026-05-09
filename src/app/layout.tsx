/**
 * Root layout — pass-through.
 *
 * The real layout (html, body, fonts, NextIntlClientProvider) lives in
 * `src/app/[locale]/layout.tsx` so the html `lang` attribute can match the
 * active locale. Next.js requires SOME root layout file to exist; this one
 * is intentionally minimal.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
