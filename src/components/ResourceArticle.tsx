import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import { Link } from "@/i18n/navigation";
import type { Coordinator } from "@/lib/types/shipment";

/**
 * <ResourceArticle> — shared layout for the portal-linked help articles
 * (/resources/delivery-day, /resources/inspection-photos,
 * /resources/reach-coordinator, /resources/eta-changes).
 *
 * Each page composes a small JSON-ish content tree (sections of title +
 * body + optional bullets) and the article renders the consistent
 * marketing chrome around it: page header, breadcrumb-style back link,
 * H1 + subtitle, ordered sections, dynamic coordinator CTA strip, footer.
 *
 * The CTA strip is dynamic when an order param flows in from the portal
 * link: the customer's actual coordinator's name + tel: link surface,
 * making the "still have a question?" affordance feel personal. When the
 * page is reached without shipment context (direct URL, /resources/...
 * index click), the CTA falls back to a generic "talk to a coordinator"
 * link to /quote.
 */

export type Section = {
  /** H2 of the section. */
  title: string;
  /** Body paragraph(s). Pass an array for multi-paragraph sections. */
  body: string | string[];
  /** Optional short bullet list under the body. */
  bullets?: string[];
};

export function ResourceArticle({
  eyebrow,
  title,
  subtitle,
  sections,
  coordinator,
  orderNumber,
  ctaText,
  ctaFallbackText,
  backLabel,
  backToShipmentLabel,
}: {
  /** Small label above the H1 — typically "Helpful resource" or stage-specific. */
  eyebrow: string;
  title: string;
  subtitle: string;
  sections: Section[];
  /** Dynamic coordinator pulled from the shipment, when available. */
  coordinator?: Coordinator;
  /** Order number for the back-to-shipment link. */
  orderNumber?: string;
  /** CTA verb when a coordinator is present, e.g. "Call". */
  ctaText: string;
  /** CTA when no coordinator — e.g. "Talk to a coordinator". */
  ctaFallbackText: string;
  /** Back link label when no shipment context (links to /resources). */
  backLabel: string;
  /** Back link label when shipment context exists (links to portal). */
  backToShipmentLabel: string;
}) {
  const hasShipment = Boolean(orderNumber);
  const backHref = hasShipment ? `/portal/${orderNumber}` : "/resources";
  const backText = hasShipment ? backToShipmentLabel : backLabel;

  return (
    <>
      <Header />

      <main className="flex-1 bg-white">
        <Container>
          <article className="max-w-2xl mx-auto py-10 md:py-16">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-charcoal transition-colors mb-8"
            >
              <span aria-hidden>←</span>
              {backText}
            </Link>

            <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
              {eyebrow}
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-charcoal leading-tight tracking-tight">
              {title}
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mt-4 leading-relaxed">
              {subtitle}
            </p>

            <div className="mt-12 space-y-12">
              {sections.map((s, i) => (
                <SectionBlock key={i} section={s} />
              ))}
            </div>

            <CoordinatorCTA
              coordinator={coordinator}
              ctaText={ctaText}
              ctaFallbackText={ctaFallbackText}
            />
          </article>
        </Container>
      </main>

      <Footer />
    </>
  );
}

function SectionBlock({ section }: { section: Section }) {
  const bodyParas = Array.isArray(section.body) ? section.body : [section.body];
  return (
    <section>
      <h2 className="text-xl md:text-2xl font-bold text-charcoal mb-4 tracking-tight">
        {section.title}
      </h2>
      <div className="space-y-4 text-gray-700 leading-relaxed">
        {bodyParas.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {section.bullets && section.bullets.length > 0 && (
        <ul className="mt-5 space-y-2">
          {section.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-gray-700">
              <span
                aria-hidden
                className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-orange"
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CoordinatorCTA({
  coordinator,
  ctaText,
  ctaFallbackText,
}: {
  coordinator?: Coordinator;
  ctaText: string;
  ctaFallbackText: string;
}): ReactNode {
  // Dynamic: shipment has a coordinator → tel: link with first name.
  if (coordinator) {
    const firstName = coordinator.name.split(" ")[0];
    return (
      <div className="mt-16 rounded-2xl bg-gray-50 border border-gray-200 p-6 md:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-1">
            {ctaText.split("|")[0]}
          </p>
          <p className="text-lg font-bold text-charcoal">
            {coordinator.name} · {coordinator.languages.map((l) => l.toUpperCase()).join("/")}
          </p>
        </div>
        <a
          href={`tel:${coordinator.phone}`}
          className="inline-flex items-center justify-center gap-1.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold px-6 py-3 rounded-full transition whitespace-nowrap"
        >
          {ctaText.split("|")[1]?.replace("{firstName}", firstName) ?? `Call ${firstName}`}
          <span aria-hidden>→</span>
        </a>
      </div>
    );
  }

  // Fallback: no shipment context → generic CTA to quote/contact page.
  return (
    <div className="mt-16 rounded-2xl bg-gray-50 border border-gray-200 p-6 md:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <p className="text-lg font-bold text-charcoal">{ctaFallbackText}</p>
      <Link
        href="/quote"
        className="inline-flex items-center justify-center gap-1.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-accent-ink font-bold px-6 py-3 rounded-full transition whitespace-nowrap"
      >
        Get in touch
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
