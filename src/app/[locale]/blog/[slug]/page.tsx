import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BlogArticle } from "@/components/BlogArticle";
import {
  getAllArticleSlugs,
  getAllArticleSlugsAcrossLocales,
  getArticleBySlug,
} from "@/lib/blog/articles";

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
  // 404 if the article was authored in a different locale than the URL.
  // EN slugs only render under /en, ES slugs only render under /es.
  const expectedLang = locale === "es" ? "es" : "en";
  if (article.language !== expectedLang) notFound();

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

  // Optional FAQPage schema. When the article exposes a faq array, we emit
  // FAQPage JSON-LD so Google can render rich snippets (each Q can show as
  // its own search result tile). Schema content mirrors what's rendered in
  // the article body so Google validates the markup.
  const faqSchema = article.faq && article.faq.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: article.faq.map((pair) => ({
          "@type": "Question",
          name: pair.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: pair.a,
          },
        })),
      }
    : null;

  return (
    <>
      {/* JSON-LD article schema. Goes in <body> as a script tag, not <head>. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
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
