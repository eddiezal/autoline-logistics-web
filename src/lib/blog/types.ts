/**
 * Blog content types. Articles are structured TypeScript objects (not MDX)
 * for v1, which keeps us off any new dependencies and lets us colocate
 * EN/ES content with the article shell.
 */

export type ArticleSection =
  | { kind: "p"; text: string }
  | { kind: "pp"; texts: ReadonlyArray<string> }
  | { kind: "h2"; text: string; id?: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: ReadonlyArray<string> }
  | { kind: "ol"; items: ReadonlyArray<string> }
  | { kind: "quote"; text: string; source?: string }
  | { kind: "checklist"; items: ReadonlyArray<{ label: string; tone: "warn" | "ok" }> }
  | { kind: "callout"; tone: "brand" | "info" | "warn"; title: string; body: string }
  | { kind: "cta"; title: string; body: string; href: string; label: string };

export interface RelatedArticleLink {
  slug: string;
  title: string;
  blurb: string;
}

/** Topical cluster the article lives under on the /blog index. */
export type BlogCluster =
  | "avoiding-scams"
  | "understanding-industry"
  | "planning-shipment";

export interface Article {
  slug: string;
  title: string;
  subtitle: string;
  metaDescription: string;
  publishedAt: string;
  updatedAt: string;
  author: string;
  readMinutes: number;
  category: string;
  cluster: BlogCluster;
  hubLink?: { label: string; href: string };
  sections: ReadonlyArray<ArticleSection>;
  related: ReadonlyArray<RelatedArticleLink>;
  primaryCta: {
    eyebrow: string;
    title: string;
    body: string;
    href: string;
    label: string;
  };
  /** Optional Q&A pairs. When present, the route emits FAQPage JSON-LD
   *  schema so Google can render rich snippets for the questions. */
  faq?: ReadonlyArray<{ q: string; a: string }>;
}

export interface ArticleSummary {
  slug: string;
  title: string;
  subtitle: string;
  publishedAt: string;
  readMinutes: number;
  category: string;
  cluster: BlogCluster;
}
