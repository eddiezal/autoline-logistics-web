import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BlogArticle } from "@/components/BlogArticle";
import { getAllArticleSlugs, getArticleBySlug } from "@/lib/blog/articles";

// Statically generate all known article slugs at build time. The blog
// catalog is small (3 today, ~8 at full Phase A+B). Pre-rendering is
// strictly better than dynamic for SEO and LCP.
export async function generateStaticParams() {
  const slugs = getAllArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export const dynamicParams = false;
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticleBySlug(slug);
  if (!a) return { title: "Article not found" };
  return {
    title: a.title,
    description: a.metaDescription,
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

  const t = await getTranslations({ locale });

  // Article schema (BlogPosting) for SEO. Rendered as JSON-LD inline.
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.metaDescription,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      "@type": "Organization",
      name: article.author,
    },
    publisher: {
      "@type": "Organization",
      name: "Auto Line Logistics",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://autolinelogistics.com/${locale}/blog/${article.slug}`,
    },
  };

  return (
    <>
      {/* JSON-LD article schema. Goes in <body> as a script tag, not <head>. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
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
