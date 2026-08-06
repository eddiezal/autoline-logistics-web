import { singleLocaleCanonical } from "@/lib/seo/alternates";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BlogArticle } from "@/components/BlogArticle";
import {
  getAllArticleSlugs,
  getAllArticleSlugsAcrossLocales,
  getArticleBySlug,
} from "@/lib/blog/articles";
import { StructuredData } from "@/components/StructuredData";
import {
  articleSchema as articleSchemaGen,
  faqPageSchema,
  breadcrumbSchema,
  SITE_URL,
} from "@/lib/seo/schemas";

// Statically generate every known article slug at build time. Slugs are
// unique across locales (EN slugs are English, ES slugs are Spanish), and
// the parent [locale] segment generates all locale prefixes per slug,
// so unused locale x slug pairs would 404 on render unless we gate them.
// For v1 simplicity, generate all slugs unfiltered by locale — Next.js
// will produce {en, es} for each slug; the wrong-locale combinations
// still load the right article (slugs are unique). Acceptable trade-off
// vs setting up per-locale static params.
export async function generateStaticParams() {
  return getAllArticleSlugsAcrossLocales().map((slug) => ({ slug }));
}

export const dynamicParams = false;
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const a = getArticleBySlug(slug);
  if (!a) return { title: "Article not found" };
  return {
    title: a.title,
    description: a.metaDescription,
    // Articles exist in exactly ONE locale — self-canonical, no hreflang pair.
    alternates: singleLocaleCanonical(locale, `/blog/${a.slug}`),
    openGraph: {
      title: a.title,
      description: a.metaDescription,
      type: "article",
      publishedTime: a.publishedAt,
      modifiedTime: a.updatedAt,
      authors: [a.author],
    },
  };
}

export default async function BlogArticleRoute({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();
  // 404 if the article was authored in a different locale than the URL.
  // EN slugs only render under /en, ES slugs only render under /es.
  const expectedLang = locale === "es" ? "es" : "en";
  if (article.language !== expectedLang) notFound();

  const t = await getTranslations({ locale });

  // Centralized structured data (uses www canonical URL via SITE_URL).
  const localePath = locale === "es" ? "/es" : "";
  const canonicalUrl = `${SITE_URL}${localePath}/blog/${article.slug}`;
  const blogStructuredData: Record<string, unknown>[] = [
    breadcrumbSchema([
      { name: "Home", url: `${SITE_URL}${localePath}/` },
      { name: "Blog", url: `${SITE_URL}${localePath}/blog` },
      { name: article.title, url: canonicalUrl },
    ]),
    articleSchemaGen({
      url: canonicalUrl,
      headline: article.title,
      description: article.metaDescription,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      author: article.author,
    }),
  ];
  if (article.faq && article.faq.length > 0) {
    blogStructuredData.push(faqPageSchema(article.faq));
  }

  return (
    <>
      <StructuredData data={blogStructuredData} />
      <BlogArticle
        article={article}
        publishedDateLabel={t("blog.article.publishedDateLabel")}
        readMinutesLabel={t("blog.minRead")}
        backToHubLabel={t("blog.article.backToHubLabel")}
        relatedHeading={t("blog.article.relatedHeading")}
      />
    </>
  );
}
