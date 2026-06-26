/**
 * StructuredData — renders one or more schema.org JSON-LD blobs.
 *
 * Use:
 *   <StructuredData data={[organizationSchema(), webSiteSchema(locale)]} />
 *
 * Each entry becomes its own <script type="application/ld+json"> tag.
 * Google reads all of them and stitches the linked-entity graph via the
 * @id fields the schemas declare.
 *
 * Why not put schemas directly inline at the page level? Centralizing
 * the rendering through this component lets us:
 *   - Update the script tag attributes once (e.g. add nonces later)
 *   - Validate output shape in one place
 *   - Type-check the array form so missing closing braces fail at build
 *
 * Added 2026-06-26.
 */
import "server-only";

type SchemaObject = Record<string, unknown>;

export interface StructuredDataProps {
  /** One schema object, or an array of them. */
  data: SchemaObject | SchemaObject[];
}

export function StructuredData({ data }: StructuredDataProps) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((schema, index) => (
        <script
          // Each schema gets its own script tag; React needs a key for the list.
          // Index is fine because the array order is stable per render.
          key={index}
          type="application/ld+json"
          // JSON.stringify escapes characters Google's validator needs.
          // dangerouslySetInnerHTML is the canonical way to render JSON-LD
          // in React; the content is OUR data, not user input.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
