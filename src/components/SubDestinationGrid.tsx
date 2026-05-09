import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { SubDestination } from "@/lib/corridors";

/**
 * Grid of sub-destination cards for a corridor page.
 *
 * The corridors.ts catalog still holds inline EN strings for sub-destination
 * fields (name, routing, timeline, note, customers). This component looks up
 * a translated version from the i18n catalog using `corridorKey + dest.slug`,
 * and falls back to the inline EN if the key is missing.
 *
 * `corridorKey` examples: "californiaHawaii", "californiaAlaska"
 */
export function SubDestinationGrid({
  destinations,
  fromCode,
  toCode,
  corridorKey,
}: {
  destinations: SubDestination[];
  fromCode: string;
  toCode: string;
  corridorKey?: string;
}) {
  const t = useTranslations();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {destinations.map((dest) => {
        const subKey = slugToCatalogKey(dest.slug);
        const base = corridorKey
          ? `corridors.catalog.${corridorKey}.subDestinations.${subKey}`
          : null;

        const name = base ? safeT(t, `${base}.name`) || dest.name : dest.name;
        const timeline = base
          ? safeT(t, `${base}.timeline`) || dest.timeline
          : dest.timeline;
        const routing = base
          ? safeT(t, `${base}.routing`) || dest.routing
          : dest.routing;
        const note = base ? safeT(t, `${base}.note`) || dest.note : dest.note;
        const customers = base
          ? safeT(t, `${base}.customers`) || dest.customers
          : dest.customers;

        return (
          <article
            key={dest.slug}
            className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-orange transition group"
          >
            <h3 className="text-xl font-bold text-charcoal">{name}</h3>
            <p className="text-orange font-semibold text-sm mt-1">{timeline}</p>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-charcoal font-semibold uppercase tracking-wider text-xs mb-1">
                  {t("common.labels.routing")}
                </dt>
                <dd className="text-gray-700 leading-relaxed">{routing}</dd>
              </div>
              <div>
                <dt className="text-charcoal font-semibold uppercase tracking-wider text-xs mb-1">
                  {t("common.labels.notes")}
                </dt>
                <dd className="text-gray-700 leading-relaxed">{note}</dd>
              </div>
              <div>
                <dt className="text-charcoal font-semibold uppercase tracking-wider text-xs mb-1">
                  {t("common.labels.commonCustomers")}
                </dt>
                <dd className="text-gray-700 leading-relaxed italic">{customers}</dd>
              </div>
            </dl>

            <Link
              href={{
                pathname: "/quote",
                query: { from: fromCode, to: toCode, dest: dest.slug },
              }}
              className="inline-block mt-5 text-orange font-semibold text-sm group-hover:text-orange-dark transition"
            >
              {t("common.labels.getQuoteFor")} {name.split(" — ")[0]} →
            </Link>
          </article>
        );
      })}
    </div>
  );
}

// Convert sub-destination slug ("big-island", "mat-su-valley", "southeast-alaska")
// to catalog camelCase key. The catalog uses shorter forms for some entries.
function slugToCatalogKey(slug: string): string {
  const SHORT_FORMS: Record<string, string> = {
    "big-island": "bigIsland",
    "mat-su-valley": "matSu",
    "southeast-alaska": "southeast",
  };
  if (SHORT_FORMS[slug]) return SHORT_FORMS[slug];
  return slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// safeT — try to read a key, fall back to empty string if missing.
function safeT(t: ReturnType<typeof useTranslations>, key: string): string {
  try {
    return t(key);
  } catch {
    return "";
  }
}
