/**
 * Accessible FAQ accordion using native <details>/<summary> for zero-JS interaction.
 * Pass an array of {q, a} pairs.
 */
export interface FAQItem {
  q: string;
  a: React.ReactNode;
}

export function FAQ({ items, title = "Frequently asked" }: { items: FAQItem[]; title?: string }) {
  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6">{title}</h2>
      <div className="divide-y divide-gray-200 border-t border-b border-gray-200">
        {items.map((item, i) => (
          <details key={i} className="group py-5 cursor-pointer">
            <summary className="flex items-start justify-between gap-4 list-none font-semibold text-charcoal hover:text-orange transition">
              <span>{item.q}</span>
              <span
                aria-hidden
                className="text-orange text-2xl leading-none transition group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="text-gray-700 leading-relaxed mt-3 text-[0.95rem]">{item.a}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
