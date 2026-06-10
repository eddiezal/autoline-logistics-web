import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResourceArticle, type Section } from "@/components/ResourceArticle";
import { getShipmentByOrderNumber } from "@/lib/shipments/repository";

/**
 * /resources/inspection-photos — "How inspection photos work"
 *
 * Reached primarily from the IN-TRANSIT portal Helpful Resources card.
 * Explains the 12-photo standard, milestone cadence, retention, and
 * the protective math of pickup-vs-delivery photo comparison.
 */

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "resources.articles.inspectionPhotos.metadata",
  });
  return {
    title: t("title"),
    description: t("description"),
  };
}

const SECTION_KEYS = ["standard", "milestones", "where", "protect", "after"] as const;

export default async function InspectionPhotosPage({ searchParams }: Props) {
  const { order } = await searchParams;
  const shipment = order ? await getShipmentByOrderNumber(order) : null;

  const t = await getTranslations("resources.articles.inspectionPhotos");
  const c = await getTranslations("resources.common");

  const sections: Section[] = SECTION_KEYS.map((k) => ({
    title: t(`sections.${k}.title`),
    body: t(`sections.${k}.body`),
    bullets: t.raw(`sections.${k}.bullets`) as string[],
  }));

  return (
    <ResourceArticle
      eyebrow={c("eyebrow")}
      title={t("title")}
      subtitle={t("subtitle")}
      sections={sections}
      coordinator={shipment?.coordinator}
      orderNumber={shipment?.orderNumber}
      ctaText={c("cta")}
      ctaFallbackText={c("ctaFallback")}
      backLabel={c("back")}
      backToShipmentLabel={c("backToShipment")}
    />
  );
}
