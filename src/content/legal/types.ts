/**
 * Legal page content types. Pattern mirrors blog articles: structured
 * TypeScript data, rendered by a shared component.
 */

export type LegalSection =
  | { type: "p"; text: string }
  | { type: "h2"; id?: string; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "callout"; text: string };

export interface LegalPageContent {
  slug: string;
  title: string;
  metaDescription: string;
  effectiveDate: string;
  intro: string[];
  sections: Array<{
    heading?: string;
    body: LegalSection[];
  }>;
}
