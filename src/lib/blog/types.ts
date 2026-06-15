/**
 * Blog content types. Articles are structured TypeScript objects (not MDX)
 * for v1, which keeps us off any new dependencies and lets us colocate
 * EN/ES content with the article shell. Migration to MDX later is a
 * straightforward swap if we want it.
 *
 * Each article is a TypeScript module under src/content/blog/{slug}.ts
 * exporting `article: Article`. The registry at src/lib/blog/articles.ts
 * static-imports all of them so they're tree-shaken into a single bundle
 * and tracked at build time.
 */

/** A discrete block of article content. Renderer maps each variant to JSX. */
export type ArticleSection =
  /** Single paragraph of prose. */
  | { kind: "p"; text: string }
  /** Multi-paragraph block. Use this instead of repeating { kind: "p" } */
  | { kind: "pp"; texts: ReadonlyArray<string> }
  /** H2 section heading. Triggers a TOC entry. */
  | { kind: "h2"; text: string; id?: string }
  /** H3 section heading. Does not appear in TOC. */
  | { kind: "h3"; text: string }
  /** Plain bullet list (no semantic tone). */
  | { kind: "ul"; items: ReadonlyArray<string> }
  /** Numbered list. */
  | { kind: "ol"; items: ReadonlyArray<string> }
  /** Pull-quote style block — used for verbatim customer language. */
  | { kind: "quote"; text: string; source?: string }
  /** Red-flag / green-flag checklist used for "warning signs" sections. */
  | { kind: "checklist"; items: ReadonlyArray<{ label: string; tone: "warn" | "ok" }> }
  /** Tinted callout box for "How Auto Line does this differently" sections. */
  | { kind: "callout"; tone: "brand" | "info" | "warn"; title: string; body: string }
  /** Inline CTA card with primary link. */
  | { kind: "cta"; title: string; body: string; href: string; label: string };

/** A pointer to a sibling article for the related-articles strip at the bottom. */
export interface RelatedArticleLink {
  slug: string;
  title: string;
  blurb: string;
}

/** Top-level article. Metadata + content + related. */
export interface Article {
  /** URL slug under /blog/{slug}. */
  slug: string;
  /** Page H1. */
  title: string;
  /** Subhead displayed under the H1. */
  subtitle: string;
  /** <meta name="description"> for SEO. ~140-160 chars. */
  metaDescription: string;
  /** ISO date string YYYY-MM-DD. Drives schema datePublished. */
  publishedAt: string;
  /** ISO date string. Schema dateModified. */
  updatedAt: string;
  /** Author display name. Schema author. */
  author: string;
  /** Estimated read time in minutes. Eyebrow label uses this. */
  readMinutes: number;
  /** Eyebrow label for the article header (e.g. "Buyer guide"). */
  category: string;
  /** Cluster hub the article links back to (e.g. /anti-scam). Optional. */
  hubLink?: { label: string; href: string };
  /** The article body sections, rendered in order. */
  sections: ReadonlyArray<ArticleSection>;
  /** 2-3 related articles for the bottom strip. */
  related: ReadonlyArray<RelatedArticleLink>;
  /** Primary CTA card rendered above the related strip. */
  primaryCta: {
    eyebrow: string;
    title: string;
    body: string;
    href: string;
    label: string;
  };
}

/** Light index-card shape for the blog index page. */
export interface ArticleSummary {
  slug: string;
  title: string;
  subtitle: string;
  publishedAt: string;
  readMinutes: number;
  category: string;
}
