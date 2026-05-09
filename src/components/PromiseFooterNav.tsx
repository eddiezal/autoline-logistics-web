import Link from "next/link";

/**
 * Cross-link nav at the bottom of every Promise page.
 * Pass the slug of the CURRENT promise to hide it from the nav.
 */
export function PromiseFooterNav({ current }: { current: "price" | "damage" | "people" }) {
  const all = [
    {
      slug: "price",
      href: "/price-promise",
      label: "Price Promise",
      sub: "Lock the price at booking. No surcharges, ever.",
    },
    {
      slug: "damage",
      href: "/damage-promise",
      label: "Damage Promise",
      sub: "Coverage beyond the carrier. We handle claims.",
    },
    {
      slug: "people",
      href: "/people-promise",
      label: "People Promise",
      sub: "Named coordinator. Real people, by name.",
    },
  ];

  const others = all.filter((p) => p.slug !== current);

  return (
    <section className="py-16 bg-gray-100 border-t border-gray-200">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
          The other two promises
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {others.map((p) => (
            <Link
              key={p.slug}
              href={p.href}
              className="block bg-white border border-gray-200 hover:border-orange hover:shadow-md rounded-2xl p-6 transition group"
            >
              <p className="text-2xl font-bold text-charcoal group-hover:text-orange transition">
                {p.label} →
              </p>
              <p className="text-gray-700 mt-2 text-sm">{p.sub}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
