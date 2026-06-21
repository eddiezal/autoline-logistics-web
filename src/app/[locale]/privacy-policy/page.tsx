import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { content } from "@/content/legal/privacy-policy";

export const metadata: Metadata = {
  title: `${content.title} — Auto Line Logistics`,
  description: content.metaDescription,
};

export default function Page() {
  return <LegalPage content={content} />;
}
