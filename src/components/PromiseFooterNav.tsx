import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Cross-link nav at the bottom of every Promise page.
 * Pass the slug of the CURRENT promise to hide it from the nav.
 */
export function PromiseFooterNav({ current }: { current: "price" | "damage" | "people" }) {
  const t = useTranslations();

  const all = [
    {
      slug: "price" as const,
      href: "/price-promise" as const,
      label: t("footer.promises.price"),
      sub: t("home.triplePromise.cards.price.headline"),
    },
    {
      slug: "damage" as const,
      href: "/damage-promise" as const,
      label: t("footer.promises.damage"),
      sub: t("home.triplePromise.cards.damage.headline"),
    },
    {
      slug: "people" as const,
      href: "/people-promise" as const,
      label: t("footer.promises.people"),
      sub: t("home.triplePromise.cards.people.headline"),
    },
  ];

  const others = all.filter((p) => p.slug !== current);

  return (
    <section className="py-16 bg-gray-100 border-t border-gray-200">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-orange text-sm font-semibold uppercase tracking-wider mb-3">
          {t("common.labels.otherPromises")}
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
