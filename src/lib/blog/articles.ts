/**
 * Blog article registry. Static-imports each article module so they're
 * tree-shaken and tracked at build time. Add new articles by:
 *   1. Creating src/content/blog/{slug}.ts that exports `article: Article`
 *   2. Importing + adding it to the ALL_ARTICLES tuple below
 *
 * Keep the tuple in REVERSE-CHRONOLOGICAL order (newest first). The blog
 * index page renders from this tuple directly.
 */
import "server-only";
import type { Article, ArticleSummary } from "./types";

import { article as whyQuotesGoUp } from "@/content/blog/why-quotes-go-up";
import { article as depositBeforeDriver } from "@/content/blog/deposit-before-driver";
import { article as brokerVsCarrier } from "@/content/blog/broker-vs-carrier";

/** All published articles, newest first. */
const ALL_ARTICLES: ReadonlyArray<Article> = [
  whyQuotesGoUp,
  depositBeforeDriver,
  brokerVsCarrier,
];

/** Map for O(1) slug lookup. Built once at module load. */
const BY_SLUG: ReadonlyMap<string, Article> = new Map(
  ALL_ARTICLES.map((a) => [a.slug, a] as const),
);

/** Slugs of all articles. Used by generateStaticParams for the route. */
export function getAllArticleSlugs(): ReadonlyArray<string> {
  return ALL_ARTICLES.map((a) => a.slug);
}

/** Full article by slug. Returns null if missing. */
export function getArticleBySlug(slug: string): Article | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Lightweight summaries for the blog index. */
export function getAllArticleSummaries(): ReadonlyArray<ArticleSummary> {
  return ALL_ARTICLES.map((a) => ({
    slug: a.slug,
    title: a.title,
    subtitle: a.subtitle,
    publishedAt: a.publishedAt,
    readMinutes: a.readMinutes,
    category: a.category,
  }));
}

/**
 * Summaries for cluster-mate articles, used by /anti-scam to surface the
 * blog cluster spokes. Pure passthrough today; could be filtered by tag
 * later if we add multiple clusters.
 */
export function getAntiScamClusterArticles(): ReadonlyArray<ArticleSummary> {
  return getAllArticleSummaries();
}
