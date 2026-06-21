import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";
import type { LegalPageContent, LegalSection } from "@/content/legal/types";

/**
 * Shared layout for legal pages (Terms, Privacy, Accessibility).
 * Renders a structured content object with intro paragraphs + sections.
 * Section headings get anchor IDs for deep-linking from external refs.
 */
export function LegalPage({ content }: { content: LegalPageContent }) {
  return (
    <>
      <Header />
      <main className="flex-1 bg-white">
        <Container>
          <article className="max-w-3xl mx-auto py-10 md:py-16">
            <h1 className="text-3xl md:text-5xl font-extrabold text-charcoal leading-tight tracking-tight mb-3">
              {content.title}
            </h1>
            <p className="text-sm text-gray-500 mb-8">
              Effective {content.effectiveDate}
            </p>

            <div className="space-y-4 text-gray-800 leading-relaxed mb-10">
              {content.intro.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            {content.sections.map((section, sIdx) => (
              <section key={sIdx} className="mb-8">
                {section.heading && (
                  <h2
                    id={slugify(section.heading)}
                    className="text-xl md:text-2xl font-bold text-charcoal mb-3 scroll-mt-24"
                  >
                    {section.heading}
                  </h2>
                )}
                <div className="space-y-3 text-gray-800 leading-relaxed">
                  {section.body.map((block, bIdx) => (
                    <SectionBlock key={bIdx} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </article>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function SectionBlock({ block }: { block: LegalSection }) {
  switch (block.type) {
    case "p":
      return <p>{block.text}</p>;
    case "h2":
      return (
        <h2
          id={block.id ?? slugify(block.text)}
          className="text-xl md:text-2xl font-bold text-charcoal mt-6 mb-3 scroll-mt-24"
        >
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 className="text-lg font-semibold text-charcoal mt-4 mb-2">
          {block.text}
        </h3>
      );
    case "ul":
      return (
        <ul className="list-disc pl-6 space-y-2">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="list-decimal pl-6 space-y-2">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <div className="bg-orange-tint border-l-4 border-orange p-4 rounded-r-lg">
          <p>{block.text}</p>
        </div>
      );
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
