/**
 * AntiScamCard — question-led card used by the dedicated /anti-scam page's
 * "Featured questions" section. Each card shows:
 *   - A numbered chip (1, 2, 3) anchoring the question's order
 *   - The question itself (bold, prominent — this is what the consumer
 *     should literally ask any broker)
 *   - "Why ask it" block — the scam pattern this question exposes
 *   - "Honest answer sounds like" block — emerald-tinted callout showing
 *     what a trustworthy broker would say in response
 *
 * History (May 17, 2026): Previously duplicated as inline functions in
 * BOTH src/app/[locale]/page.tsx AND src/app/[locale]/anti-scam/page.tsx —
 * a known duplication acknowledged in code comments. Extracted to this
 * shared component when the homepage's full anti-scam section was
 * removed (the teaser replaced it), leaving an unused copy on the home
 * page. Now lives here as the single source of truth for both contexts
 * even though only /anti-scam currently consumes it.
 */
export function AntiScamCard({
  num,
  question,
  whyAskLabel,
  whyAsk,
  honestAnswerLabel,
  honestAnswer,
}: {
  num: 1 | 2 | 3;
  question: string;
  whyAskLabel: string;
  whyAsk: string;
  honestAnswerLabel: string;
  honestAnswer: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col">
      <div className="w-8 h-8 rounded-full bg-orange text-white text-sm font-bold flex items-center justify-center mb-4">
        {num}
      </div>
      <p className="text-charcoal font-bold text-base md:text-lg leading-snug mb-4">
        {question}
      </p>
      <div className="border-t border-dashed border-gray-300 my-1" />
      <div className="mt-3 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          {whyAskLabel}
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">{whyAsk}</p>
      </div>
      <div className="bg-emerald-50 border-l-[3px] border-emerald-700 rounded-r-lg px-3 py-2.5 mt-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
          {honestAnswerLabel}
        </p>
        <p className="text-sm text-charcoal font-semibold leading-relaxed">
          {honestAnswer}
        </p>
      </div>
    </div>
  );
}
