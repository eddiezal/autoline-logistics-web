import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { content as contentEn } from "@/content/legal/privacy-policy";
import { content as contentEs } from "@/content/legal/privacy-policy.es";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const content = locale === "es" ? contentEs : contentEn;
  return {
    title: `${content.title} — Auto Line Logistics`,
    description: content.metaDescription,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEs = locale === "es";
  return (
    <LegalPage content={isEs ? contentEs : contentEn} locale={isEs ? "es" : "en"} />
  );
}
