/**
 * Blog article registry. Static-imports each article module and exposes
 * locale-aware lookups.
 */
import "server-only";
import type {
  Article,
  ArticleSummary,
  ArticleLanguage,
  BlogCluster,
} from "./types";

import { article as whyQuotesGoUp } from "@/content/blog/why-quotes-go-up";
import { article as depositBeforeDriver } from "@/content/blog/deposit-before-driver";
import { article as brokerVsCarrier } from "@/content/blog/broker-vs-carrier";
import { article as porQueSubioCotizacion } from "@/content/blog/por-que-subio-cotizacion-envio-auto";
import { article as depositoAntesDeConductor } from "@/content/blog/pagar-deposito-envio-auto-conductor";

const ALL_ARTICLES: ReadonlyArray<Article> = [
  whyQuotesGoUp,
  depositBeforeDriver,
  brokerVsCarrier,
  porQueSubioCotizacion,
  depositoAntesDeConductor,
];

const BY_SLUG: ReadonlyMap<string, Article> = new Map(
  ALL_ARTICLES.map((a) => [a.slug, a] as const),
);

/** Slugs in a single locale. Drives generateStaticParams per [locale]. */
export function getAllArticleSlugs(language: ArticleLanguage): ReadonlyArray<string> {
  return ALL_ARTICLES.filter((a) => a.language === language).map((a) => a.slug);
}

/** Every slug across all locales. Used by the sitemap (which handles
 *  locale alternates itself). */
export function getAllArticleSlugsAcrossLocales(): ReadonlyArray<string> {
  return ALL_ARTICLES.map((a) => a.slug);
}

/** Article by slug. Slugs are unique across all locales. */
export function getArticleBySlug(slug: string): Article | null {
  return BY_SLUG.get(slug) ?? null;
}

/** All article summaries in a given locale. */
export function getAllArticleSummaries(
  language: ArticleLanguage,
): ReadonlyArray<ArticleSummary> {
  return ALL_ARTICLES.filter((a) => a.language === language).map((a) => ({
    slug: a.slug,
    language: a.language,
    title: a.title,
    subtitle: a.subtitle,
    publishedAt: a.publishedAt,
    readMinutes: a.readMinutes,
    category: a.category,
    cluster: a.cluster,
  }));
}

/** Summaries grouped by topical cluster, filtered to one locale. */
export function getArticlesByCluster(
  language: ArticleLanguage,
): Record<BlogCluster, ReadonlyArray<ArticleSummary>> {
  const grouped: Record<BlogCluster, ArticleSummary[]> = {
    "avoiding-scams": [],
    "understanding-industry": [],
    "planning-shipment": [],
  };
  for (const a of getAllArticleSummaries(language)) {
    grouped[a.cluster].push(a);
  }
  return grouped;
}

/** Cluster spokes shown on /anti-scam in a given locale. */
export function getAntiScamClusterArticles(
  language: ArticleLanguage,
): ReadonlyArray<ArticleSummary> {
  return getAllArticleSummaries(language);
}
