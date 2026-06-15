/**
 * Blog article registry. Static-imports each article module so they're
 * tree-shaken and tracked at build time.
 */
import "server-only";
import type { Article, ArticleSummary, BlogCluster } from "./types";

import { article as whyQuotesGoUp } from "@/content/blog/why-quotes-go-up";
import { article as depositBeforeDriver } from "@/content/blog/deposit-before-driver";
import { article as brokerVsCarrier } from "@/content/blog/broker-vs-carrier";

const ALL_ARTICLES: ReadonlyArray<Article> = [
  whyQuotesGoUp,
  depositBeforeDriver,
  brokerVsCarrier,
];

const BY_SLUG: ReadonlyMap<string, Article> = new Map(
  ALL_ARTICLES.map((a) => [a.slug, a] as const),
);

export function getAllArticleSlugs(): ReadonlyArray<string> {
  return ALL_ARTICLES.map((a) => a.slug);
}

export function getArticleBySlug(slug: string): Article | null {
  return BY_SLUG.get(slug) ?? null;
}

export function getAllArticleSummaries(): ReadonlyArray<ArticleSummary> {
  return ALL_ARTICLES.map((a) => ({
    slug: a.slug,
    title: a.title,
    subtitle: a.subtitle,
    publishedAt: a.publishedAt,
    readMinutes: a.readMinutes,
    category: a.category,
    cluster: a.cluster,
  }));
}

/** Summaries grouped by topical cluster. Drives the /blog section layout. */
export function getArticlesByCluster(): Record<
  BlogCluster,
  ReadonlyArray<ArticleSummary>
> {
  const grouped: Record<BlogCluster, ArticleSummary[]> = {
    "avoiding-scams": [],
    "understanding-industry": [],
    "planning-shipment": [],
  };
  for (const a of getAllArticleSummaries()) {
    grouped[a.cluster].push(a);
  }
  return grouped;
}

export function getAntiScamClusterArticles(): ReadonlyArray<ArticleSummary> {
  return getAllArticleSummaries();
}
