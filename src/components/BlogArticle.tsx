/**
 * <BlogArticle> — renders a structured Article object into a polished
 * long-form page. Server component, zero client JS.
 *
 * Visual hierarchy:
 *   - Eyebrow strip (category + read time)
 *   - H1 + subtitle
 *   - Optional "back to hub" link (e.g. /anti-scam)
 *   - Section body (p / pp / h2 / h3 / ul / ol / quote / checklist / 
 *     callout / cta variants)
 *   - Primary CTA card
 *   - Related articles strip
 *
 * Article + breadcrumb schema markup is injected as JSON-LD by the
 * caller (the /blog/[slug] route) so this component stays clean.
 */
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Header } from "@/components/Header";
import { BlogReadTracker } from "@/components/BlogReadTracker";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import type { Article, ArticleSection } from "@/lib/blog/types";

function formatDate(iso: string): string {
  // Plain "Month D, YYYY" for header display. ISO date drives schema; this is humans.
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

function renderSection(s: ArticleSection, key: number): ReactNode {
  switch (s.kind) {
    case "p":
      return (
        <p key={key} className="text-gray-800 text-base md:text-lg leading-relaxed">
          {s.text}
        </p>
      );
    case "pp":
      return (
        <div key={key} className="space-y-4">
          {s.texts.map((t, i) => (
            <p key={i} className="text-gray-800 text-base md:text-lg leading-relaxed">
              {t}
            </p>
          ))}
        </div>
      );
    case "h2":
      return (
        <h2
          key={key}
          id={s.id}
          className="text-2xl md:text-3xl font-bold text-charcoal mt-10 mb-4 leading-tight tracking-tight"
        >
          {s.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={key} className="text-lg md:text-xl font-bold text-charcoal mt-6 mb-3">
          {s.text}
        </h3>
      );
    case "ul":
      return (
        <ul key={key} className="list-disc pl-6 space-y-2 text-gray-800 text-base md:text-lg">
          {s.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="list-decimal pl-6 space-y-2 text-gray-800 text-base md:text-lg">
          {s.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote
          key={key}
          className="border-l-4 border-orange/60 bg-orange-tint/40 pl-5 pr-4 py-4 my-4 rounded-r-lg"
        >
          <p className="text-charcoal text-base md:text-lg italic leading-relaxed">
            &ldquo;{s.text}&rdquo;
          </p>
          {s.source && (
            <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider mt-2">
              {s.source}
            </p>
          )}
        </blockquote>
      );
    case "checklist":
      return (
        <ul key={key} className="space-y-2 my-4">
          {s.items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-gray-800 text-base md:text-lg leading-relaxed"
            >
              <span
                className={
                  item.tone === "warn"
                    ? "flex-shrink-0 mt-1 w-5 h-5 rounded-full bg-red-50 text-red-600 grid place-items-center text-[12px] font-bold"
                    : "flex-shrink-0 mt-1 w-5 h-5 rounded-full bg-green-50 text-green-700 grid place-items-center text-[12px] font-bold"
                }
                aria-hidden
              >
                {item.tone === "warn" ? "!" : "✓"}
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      );
    case "callout": {
      const toneClass =
        s.tone === "brand"
          ? "bg-orange-tint border-orange/30"
          : s.tone === "warn"
            ? "bg-red-50 border-red-200"
            : "bg-gray-50 border-gray-200";
      return (
        <aside
          key={key}
          className={`border ${toneClass} rounded-2xl p-5 md:p-6 my-6`}
        >
          <h3 className="text-charcoal font-bold text-lg mb-2">{s.title}</h3>
          <p className="text-gray-800 text-base leading-relaxed">{s.body}</p>
        </aside>
      );
    }
    case "cta":
      return (
        <aside
          key={key}
          className="border border-gray-200 bg-white rounded-2xl p-6 my-6 shadow-sm"
        >
          <h3 className="text-charcoal font-bold text-lg mb-2">{s.title}</h3>
          <p className="text-gray-800 text-base leading-relaxed mb-4">{s.body}</p>
          <Link
            href={s.href as "/quote"}
            className="inline-block bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold text-sm px-5 py-2.5 rounded-lg transition"
          >
            {s.label}
          </Link>
        </aside>
      );
  }
}

export function BlogArticle({
  article,
  publishedDateLabel,
  readMinutesLabel,
  backToHubLabel,
  relatedHeading,
}: {
  article: Article;
  publishedDateLabel: string;
  readMinutesLabel: string;
  backToHubLabel: string;
  relatedHeading: string;
}) {
  return (
    <>
      <Header />
      <BlogReadTracker slug={article.slug} cluster={article.cluster} />

      <main className="flex-1 bg-white">
        <Container>
          <article className="max-w-3xl mx-auto py-10 md:py-16">
            {/* Eyebrow: category + read time */}
            <p className="text-orange text-xs font-bold uppercase tracking-[0.12em] mb-3">
              {article.category} · {article.readMinutes} {readMinutesLabel}
            </p>

            {/* H1 + subtitle */}
            <h1 className="text-3xl md:text-5xl font-extrabold text-charcoal leading-tight tracking-tight mb-4">
              {article.title}
            </h1>
            <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-6">
              {article.subtitle}
            </p>

            {/* Author + date row */}
            <div className="flex items-center justify-between border-t border-b border-gray-200 py-3 mb-10">
              <span className="text-gray-700 text-sm">
                <strong className="text-charcoal">{article.author}</strong>
              </span>
              <span className="text-gray-500 text-sm">
                {publishedDateLabel} {formatDate(article.publishedAt)}
              </span>
            </div>

            {/* Body sections */}
            <div className="space-y-5">
              {article.sections.map((s, i) => renderSection(s, i))}
            </div>

            {/* Primary CTA card */}
            <aside className="mt-12 bg-charcoal text-white rounded-2xl p-6 md:p-8">
              <p className="text-orange text-[11px] font-bold uppercase tracking-wider mb-2">
                {article.primaryCta.eyebrow}
              </p>
              <h3 className="text-white font-bold text-xl md:text-2xl leading-tight mb-3">
                {article.primaryCta.title}
              </h3>
              <p className="text-gray-300 text-base leading-relaxed mb-5">
                {article.primaryCta.body}
              </p>
              <Link
                href={article.primaryCta.href as "/quote"}
                className="inline-block bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold text-sm px-6 py-3 rounded-lg transition"
              >
                {article.primaryCta.label} &rarr;
              </Link>
            </aside>

            {/* Back to hub */}
            {article.hubLink && (
              <div className="mt-10 text-center">
                <Link
                  href={article.hubLink.href as "/anti-scam"}
                  className="inline-flex items-center gap-2 text-gray-700 hover:text-charcoal text-sm font-semibold"
                >
                  <span aria-hidden>&larr;</span>
                  {backToHubLabel}: {article.hubLink.label}
                </Link>
              </div>
            )}
          </article>
        </Container>

        {/* Related articles strip */}
        {article.related.length > 0 && (
          <section className="bg-gray-50 py-12 md:py-16 border-t border-gray-200">
            <Container>
              <div className="max-w-5xl mx-auto">
                <h2 className="text-charcoal font-bold text-xl md:text-2xl mb-6">
                  {relatedHeading}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {article.related.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/blog/${r.slug}` as "/blog/why-car-shipping-quotes-go-up"}
                      className="block bg-white border border-gray-200 hover:border-orange rounded-2xl p-5 transition group"
                    >
                      <h3 className="text-charcoal font-bold text-base mb-2 group-hover:text-orange transition">
                        {r.title}
                      </h3>
                      <p className="text-gray-700 text-sm leading-relaxed">{r.blurb}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </Container>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
