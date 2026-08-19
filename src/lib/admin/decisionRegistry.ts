/**
 * Decision Registry — every live bet, its decision rule written at ship time.
 *
 * The operating doctrine (adopted 2026-08-18, external review of the
 * behavioral-journey mockups): the decision rule is encoded WHEN the
 * experiment ships, so nobody — including us — gets to pick the flattering
 * read after the results are in. Thresholds below were ratified by Eddie on
 * 2026-08-18; changing one after exposure has begun requires a dated note in
 * the entry, never a silent edit.
 *
 * Taxonomy (so the registry never implies causal identification where there
 * is none):
 *   experiment       we changed something and precommitted to a success bar
 *   measurement      new instrumentation whose READING decides a question
 *   observational    we watch a number move; no intervention of ours to credit
 *   instrumentation  plumbing that enables a future reading
 *
 * Lifecycle: specified → accruing → reading → review-due → decided.
 * "review-due" is computed in the UI when exposure crosses its gate — the
 * registry itself never claims a verdict early. A decided entry keeps its
 * verdict (kept / iterated / reverted / inconclusive), the verdict date, the
 * decision taken, and an evidence snapshot: six months from now, "why is the
 * quote flow ZIP-first?" gets a dated answer instead of a recollection.
 *
 * Rendered on /admin/analysis (client-visible — Ben reads this). Entries are
 * curated to quarterly-deck disclosure level; internal-only work stays in the
 * intervention ledger, not here.
 */

export type RegistryType = "experiment" | "measurement" | "observational" | "instrumentation";

export type RegistryStatus = "specified" | "accruing" | "reading" | "decided";

export interface Exposure {
  /** How much evidence has accrued, in the entry's own unit. */
  current: number;
  /** The precommitted review gate: crossing it makes the review DUE. */
  gate: number;
  unit: string;
  /** When the current figure was last refreshed (YYYY-MM-DD). */
  asOf: string;
}

export interface Verdict {
  outcome: "kept" | "iterated" | "reverted" | "inconclusive";
  date: string;
  /** The decision actually taken, in one sentence. */
  decision: string;
  /** The numbers that decided it, frozen at verdict time. */
  evidence: string;
}

/**
 * Threshold meter configuration for the Overview band. The color grammar is a
 * dashboard-wide rule (adopted 2026-08-19): color describes the CURRENT VALUE'S
 * RELATIONSHIP TO THE PRECOMMITTED RULE, never anyone's judgment —
 *   gray  = accumulating evidence (n below unlockN)
 *   green = currently clears the keep/validate mark
 *   amber = between the failure and success marks (inconclusive region)
 *   red   = currently below the failure mark
 * The bar always shows the actual position; only its COLOR is withheld until
 * the sample can carry a verdict.
 */
export interface MeterSpec {
  /** Axis maximum, in the metric's own percent units. */
  scaleMax: number;
  /** Sample size below which the fill stays gray. */
  unlockN: number;
  marks: { value: number; label: string; kind: "revert" | "keep" | "baseline" | "target" }[];
}

export interface RegistryEntry {
  slug: string;
  title: string;
  /** One line: what actually changed (or what is being watched). */
  change: string;
  type: RegistryType;
  /** YYYY-MM-DD the change went live; absent while specified. */
  shipped?: string;
  owner: string;
  metric: string;
  baseline?: string;
  current?: string;
  exposure?: Exposure;
  /**
   * The precommitted rule: gate, thresholds, and what each outcome triggers.
   * Written before results exist. Ratified 2026-08-18.
   */
  decisionRule: string;
  status: RegistryStatus;
  verdict?: Verdict;
  /** Slug of the study this entry belongs to, for cross-linking. */
  studySlug?: string;
  /** Anything the reader must discount when the review runs. */
  notes?: string;
  /** Overview band: primary cards get the full four-question treatment. */
  primary?: boolean;
  /** Overview band: threshold meter, when the rule is numeric. */
  meter?: MeterSpec;
}

/**
 * CURRENT FOCUS — exactly one at a time, on purpose. If a new optimization is
 * proposed, the dashboard itself makes the tradeoff visible: is it important
 * enough to displace this? (Adopted 2026-08-19.)
 */
export const FOCUS = {
  title: "Quote-path conversion",
  line: "72% of quote-page visitors never start the form · R1 accruing · PC handoff accruing · R2 queued",
} as const;

export const DECISION_REGISTRY: RegistryEntry[] = [
  {
    slug: "quote-form-r1",
    title: "Quote form, Release 1",
    change: "Removed the last-name field and plan-selection step, corrected the price copy, added field-level drop-off telemetry.",
    type: "experiment",
    shipped: "2026-08-12",
    owner: "Zaldivar Labs",
    metric: "Form completion (leads ÷ form starts)",
    baseline: "24.4% (55 of 225 starts, old form)",
    current: "27.0% (20 of 74 starts)",
    exposure: { current: 74, gate: 200, unit: "new-form starts", asOf: "2026-08-18" },
    decisionRule:
      "Review at 200 new-form starts. KEEP if completion ≥ 24.4% (no worse than baseline). REVERT only if < 20%. Either way, ITERATE on the top-3 observed abandonment concentrations from the field telemetry (currently: vehicle-type step, ZIP validation errors, captcha expiry).",
    status: "accruing",
    studySlug: "behavioral-journey",
    primary: true,
    meter: {
      scaleMax: 35,
      unlockN: 50,
      marks: [
        { value: 20, label: "revert 20%", kind: "revert" },
        { value: 24.4, label: "keep 24.4%", kind: "keep" },
      ],
    },
  },
  {
    slug: "pc-estimate-moment",
    title: "Price-checker estimate moment",
    change: "Fixed the handoff links (they had sent visitors to an empty form since launch) and added a lock-this-price block under every estimate, with route and vehicle carried over.",
    type: "experiment",
    shipped: "2026-08-13",
    owner: "Zaldivar Labs",
    metric: "Estimate-viewing visits that continue to the quote page",
    baseline: "3.1% (5 of 162 — measured WITH the broken handoff)",
    current: "0 of 18 — far too early to read",
    exposure: { current: 18, gate: 150, unit: "estimate visits", asOf: "2026-08-18" },
    decisionRule:
      "Review at 150 post-fix estimate visits (~mid-September at current volume). ≥ 6.2% (2× baseline) VALIDATES the estimate moment and greenlights the same pattern on the quote form's own price moment in Release 2. Between 3.1% and 6.2%: HOLD further estimate-moment work until the call-landing reading arrives. Below 3.1%: reopen the plumbing investigation.",
    status: "accruing",
    studySlug: "behavioral-journey",
    notes: "AMENDED 2026-08-19: the Aug 18 internal verification visit (Claude browser walk of the prefill, 08:47 PT, session 640dd30b…|751954f9…) is now EXCLUDED MECHANICALLY from both the live meter (activeDecisions.ts) and the early-read script — no mental discounting needed. Fingerprint audit of all handoff sessions (5 pre, 1 post) found no other internal traffic. ADDED CHECKPOINT: at 50 estimate-sessions, if handoffs remain ~0, run an early instrumentation/UX review (does not change the 150-session decision gate).",
    primary: true,
    meter: {
      scaleMax: 10,
      unlockN: 50,
      marks: [
        { value: 3.1, label: "baseline 3.1%", kind: "baseline" },
        { value: 6.2, label: "validate ≥6.2%", kind: "target" },
      ],
    },
  },
  {
    slug: "call-landing-read",
    title: "Call-page capture",
    change: "Call records now capture which page the caller was on (webhook field-name bug fixed Aug 10).",
    type: "measurement",
    shipped: "2026-08-10",
    owner: "Zaldivar Labs",
    metric: "Do estimate-viewers call instead of exiting? (does the price cliff survive phone calls)",
    exposure: { current: 1, gate: 5, unit: "weeks of call-page data", asOf: "2026-08-18" },
    decisionRule:
      "Read after 4–6 weeks of call-page data (~mid-September). If estimate-viewers turn out to be heavy callers, the price cliff shrinks and estimate-moment priority shifts from rescuing those visits to easing the call path. Either answer redirects the roadmap; neither is a failure.",
    status: "accruing",
    studySlug: "behavioral-journey",
  },
  {
    slug: "corridor-pages",
    title: "Corridor pages after the search fixes",
    change: "Search-ranking fixes shipped Aug 10; corridor pages started registering traffic afterward. No further intervention of ours to credit — we are watching.",
    type: "observational",
    shipped: "2026-08-10",
    owner: "Zaldivar Labs",
    metric: "Corridor-page entries and their conversion rate",
    baseline: "13 tracked visits/month",
    current: "27 tracked visits/month, converting at rates comparable to the quote page (small sample)",
    decisionRule:
      "Proper read at the next monthly study refresh. Invest in additional corridor pages only if conversion holds at volume — at least 20 visits at a rate comparable to the quote page.",
    status: "accruing",
    studySlug: "behavioral-journey",
  },
  {
    slug: "s1-relaunch-probe",
    title: "S1 relaunch probe (paused campaign, corrected landing pages)",
    change:
      "The 2026-08-19 keyword audit found S1's price-checker-pointed keywords spent $1,177 for 2 conversions ($588 each) vs $179/conv for quote-page traffic in the same window — most of the campaign's failure was the front door, not only the keywords. The probe: relaunch S1 with ALL final URLs → /quote, primary conversions only, capped ~$15–20/day.",
    type: "experiment",
    owner: "Zaldivar Labs",
    metric: "Cost per primary conversion",
    baseline: "$588/conv on the PC-landing keywords; $620/conv campaign-wide pre-pause (both measured with the broken landing configuration)",
    decisionRule:
      "Fund only after the Aug 27 ceiling recompute, and only if budget envelope remains after the S5 raise — proven levers get the next dollar before hypotheses. Review at $250 spend or 14 days, whichever comes SECOND. KEEP AND SCALE if cost/conv ≤ $150. KILL if > $200. Between $150–200: one more $250 tranche, then a hard verdict either way. Standing constraint: no paid traffic points at the price checker again unless the estimate-moment experiment first clears its 6.2% bar.",
    status: "specified",
    studySlug: "behavioral-journey",
    notes: "Honest framing: the audit proves S1 was worse than it needed to be, not that it works when fixed — its /quote-pointed keywords also converted ~nothing on modest spend, and research-intent queries stay cold regardless of landing page.",
  },
  {
    slug: "quote-path-r2",
    title: "Quote path, Release 2",
    change: "Redesigned quote flow: ZIP-first steps, delivery timing asked before a price is shown, tiers presented as priced output.",
    type: "experiment",
    owner: "Zaldivar Labs",
    metric: "Reach × Completion (arrivals who start × starters who finish)",
    baseline: "28.1% reach × 24.0% completion = 6.7% end-to-end",
    decisionRule:
      "Five-week A/B once the Release-1 baseline settles. SHIP if Reach × Completion improves ≥ 15% relative, with a lead-quality guardrail: ProABD acceptance rate holds and no rise in junk or duplicate submissions. Otherwise iterate or revert — a pretty flow that doesn't move the compound rate does not ship.",
    status: "specified",
    studySlug: "behavioral-journey",
  },
];

/** True once exposure has crossed its precommitted gate — the review is due. */
export function isReviewDue(e: RegistryEntry): boolean {
  return !!e.exposure && e.status !== "decided" && e.exposure.current >= e.exposure.gate;
}

export function getRegistryEntry(slug: string): RegistryEntry | undefined {
  return DECISION_REGISTRY.find((e) => e.slug === slug);
}

export function entriesForStudy(studySlug: string): RegistryEntry[] {
  return DECISION_REGISTRY.filter((e) => e.studySlug === studySlug);
}
