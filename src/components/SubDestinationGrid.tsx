import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { subDestCatalogKey, type SubDestination } from "@/lib/corridors";

/**
 * Grid of sub-destination cards for a corridor page.
 *
 * All copy comes from the i18n catalog. The corridor data file only holds
 * structural slugs; the readable text (name, routing, timeline, note,
 * customers) lives in `messages/{en,es}.json` under
 * `corridors.catalog.{corridorKey}.subDestinations.{subKey}.{field}`.
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
  corridorKey: string;
}) {
  const t = useTranslations();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {destinations.map((dest) => {
        const subKey = subDestCatalogKey(dest.slug);
        const base = `corridors.catalog.${corridorKey}.subDestinations.${subKey}`;

        const name = t(`${base}.name`);
        const timeline = t(`${base}.timeline`);
        const routing = t(`${base}.routing`);
        const note = t(`${base}.note`);
        const customers = t(`${base}.customers`);

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
