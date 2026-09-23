import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { localeAlternates } from "@/lib/seo/alternates";
import { permanentRedirect } from "next/navigation";

/**
 * /resources/eta-changes — "What if my ETA changes?"
 *
 * Reached primarily from the IN-TRANSIT portal Helpful Resources card.
 * Explains the ETA confidence model, what shifts the ETA, how the
 * customer is notified about changes, and what options they have.
 */

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "resources.articles.etaChanges.metadata",
  });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates(locale, "/resources/eta-changes"),
    robots: { index: false, follow: false },
  };
}

export default async function EtaChangesPage({ params }: Props) {
  const { locale } = await params;
  // Unpublished 2026-09-23: described a tracking module that is not live. Redirect keeps old links working.
  permanentRedirect(`/${locale}/resources`);
}
