import Link from "next/link";
import type { SubDestination } from "@/lib/corridors";

/**
 * Grid of sub-destination cards for a corridor page.
 * Each card includes routing, timeline, customer notes, and a quote CTA
 * pre-filled with the corridor + sub-destination context.
 */
export function SubDestinationGrid({
  destinations,
  fromCode,
  toCode,
}: {
  destinations: SubDestination[];
  fromCode: string;
  toCode: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {destinations.map((dest) => (
        <article
          key={dest.slug}
          className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-orange transition group"
        >
          <h3 className="text-xl font-bold text-charcoal">{dest.name}</h3>
          <p className="text-orange font-semibold text-sm mt-1">{dest.timeline}</p>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-charcoal font-semibold uppercase tracking-wider text-xs mb-1">
                Routing
              </dt>
              <dd className="text-gray-700 leading-relaxed">{dest.routing}</dd>
            </div>
            <div>
              <dt className="text-charcoal font-semibold uppercase tracking-wider text-xs mb-1">
                Notes
              </dt>
              <dd className="text-gray-700 leading-relaxed">{dest.note}</dd>
            </div>
            <div>
              <dt className="text-charcoal font-semibold uppercase tracking-wider text-xs mb-1">
                Common customers
              </dt>
              <dd className="text-gray-700 leading-relaxed italic">
                {dest.customers}
              </dd>
            </div>
          </dl>

          <Link
            href={`/quote?from=${fromCode}&to=${toCode}&dest=${dest.slug}`}
            className="inline-block mt-5 text-orange font-semibold text-sm group-hover:text-orange-dark transition"
          >
            Get a quote for {dest.name.split(" — ")[0]} →
          </Link>
        </article>
      ))}
    </div>
  );
}
