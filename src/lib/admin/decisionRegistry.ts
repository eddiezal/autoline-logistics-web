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

export type RegistryType =
  "experiment" | "measurement" | "observational" | "instrumentation";

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
  marks: {
    value: number;
    label: string;
    kind: "revert" | "keep" | "baseline" | "target";
  }[];
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
  line: "72% of quote-page visitors never start the form · R1 decided (iterate via R2) · PC handoff 100/150 · R2 build authorized",
} as const;

export const DECISION_REGISTRY: RegistryEntry[] = [
  {
    slug: "quote-form-r1",
    title: "Quote form, Release 1",
    change:
      "Removed the last-name field and plan-selection step, corrected the price copy, added field-level drop-off telemetry.",
    type: "experiment",
    shipped: "2026-08-12",
    owner: "Zaldivar Labs",
    metric: "Form completion (leads ÷ form starts)",
    baseline: "24.4% (55 of 225 concurrent unstamped starts)",
    current: "24.2% (70 of 289 R1-stamped starts)",
    exposure: {
      current: 289,
      gate: 200,
      unit: "new-form starts",
      asOf: "2026-09-01",
    },
    decisionRule:
      "Review at 200 new-form starts. KEEP if completion ≥ 24.4% (no worse than baseline). REVERT only if < 20%. Either way, ITERATE on the top-3 observed abandonment concentrations from the field telemetry (currently: vehicle-type step, ZIP validation errors, captcha expiry).",
    status: "decided",
    verdict: {
      outcome: "iterated",
      date: "2026-09-01",
      decision:
        "Form kept in place (revert bar not tripped; point estimate a hair under the keep bar, CIs overlapping — no detectable completion effect vs the concurrent control). Iteration proceeds as Release 2, which inherits the measured targets: remove vehicle_type from the input path (52 abandonments, #1 field), forgiving ZIP resolution (77 combined abandonments + 12 validation errors), notes-field deletion candidate (62.8% focus-to-complete). Captcha deprioritized (5 events).",
      evidence:
        "R1-stamped 289 starts, 70 completed = 24.2% (CI 19.6-29.5) vs concurrent pre-R1 unstamped 225/55 = 24.4% (CI 19.3-30.5). Version-stamp comparison, window-independent; internal tests excluded; POST-window reconciliation clean. Run: behavior-journey-early-read.mjs 2026-09-01 15:48 PT, fv=quote-r1-20260812. R1 delivered honest copy + instrumentation, not completion lift — completion is R2's job.",
    },
    notes:
      "NOTE 2026-09-28: a re-read at 750 R1 starts shows 33.1% completion, but the first 289 completed at 24.2% and the next 461 at 38.6% (p about 0.00005). That jump coincides with the Sep 14 and Sep 21 moves of S5, S3 and Brand to lead-based bidding, which optimizes for form completers. The 9/1 verdict (iterated) stands. The late increase coincides with those changes and cannot be attributed to R1; traffic-mix change is the leading explanation, not an established cause. Do not read the later figure as R1 working late. This is the reason R2 is randomized.",
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
    change:
      "Fixed the handoff links (they had sent visitors to an empty form since launch) and added a lock-this-price block under every estimate, with route and vehicle carried over.",
    type: "experiment",
    shipped: "2026-08-13",
    owner: "Zaldivar Labs",
    metric: "Estimate-viewing visits that continue to the quote page",
    baseline: "3.1% (5 of 162 — measured WITH the broken handoff)",
    current: "8.7% (17 of 195 post-fix estimate visits)",
    exposure: {
      current: 195,
      gate: 150,
      unit: "estimate visits",
      asOf: "2026-09-28",
    },
    decisionRule:
      "Review at 150 post-fix estimate visits (~mid-September at current volume). ≥ 6.2% (2× baseline) VALIDATES the estimate moment and greenlights the same pattern on the quote form's own price moment in Release 2. Between 3.1% and 6.2%: HOLD further estimate-moment work until the call-landing reading arrives. Below 3.1%: reopen the plumbing investigation.",
    status: "decided",
    verdict: {
      outcome: "kept",
      date: "2026-09-28",
      decision:
        "VALIDATED. 8.7% clears the 6.2% bar (2.8x the 3.1% baseline). The estimate-moment pattern (price shown, lock-this-price block with route and vehicle carried over) is greenlit for the quote form's own price moment in Release 2. Caveat carried into R2: the Wilson CI (5.5-13.5%) is wide and its lower bound sits inside the hold band, so R2's price-moment entry gets its own gate rather than inheriting this one as settled.",
      evidence:
        "POST window 2026-08-14 to 2026-09-28 (45.4d): 195 estimate sessions, 17 continued to the quote page = 8.7% (CI 5.5-13.5), 11 started the form = 5.6%. PRE window 2026-07-14 to 2026-08-14: 162 sessions, 5 continued = 3.1% (CI 1.3-7.0). Aug 18 internal verification session excluded mechanically (1 of 1 listed). Run: behavior-journey-early-read.mjs --split 2026-08-14, 2026-09-28 10:07 PT. Sessions still ending on the estimate: 87.2% vs ~87.0% baseline, i.e. the fix moved the handoff, not the share who stop at the estimate.",
    },
    studySlug: "behavioral-journey",
    notes:
      "AMENDED 2026-08-19: the Aug 18 internal verification visit (Claude browser walk of the prefill, 08:47 PT, session 640dd30b…|751954f9…) is now EXCLUDED MECHANICALLY from both the live meter (activeDecisions.ts) and the early-read script — no mental discounting needed. Fingerprint audit of all handoff sessions (5 pre, 1 post) found no other internal traffic. ADDED CHECKPOINT: at 50 estimate-sessions, if handoffs remain ~0, run an early instrumentation/UX review (does not change the 150-session decision gate).",
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
    change:
      "Call records now capture which page the caller was on (webhook field-name bug fixed Aug 10).",
    type: "measurement",
    shipped: "2026-08-10",
    owner: "Zaldivar Labs",
    metric:
      "Do estimate-viewers call instead of exiting? (does the price cliff survive phone calls)",
    exposure: {
      current: 1,
      gate: 5,
      unit: "weeks of call-page data",
      asOf: "2026-08-18",
    },
    decisionRule:
      "Read after 4–6 weeks of call-page data (~mid-September). If estimate-viewers turn out to be heavy callers, the price cliff shrinks and estimate-moment priority shifts from rescuing those visits to easing the call path. Either answer redirects the roadmap; neither is a failure.",
    status: "accruing",
    studySlug: "behavioral-journey",
  },
  {
    slug: "corridor-pages",
    title: "Corridor pages after the search fixes",
    change:
      "Search-ranking fixes shipped Aug 10; corridor pages started registering traffic afterward. No further intervention of ours to credit — we are watching.",
    type: "observational",
    shipped: "2026-08-10",
    owner: "Zaldivar Labs",
    metric: "Corridor-page entries and their conversion rate",
    baseline: "13 tracked visits/month",
    current:
      "27 tracked visits/month, converting at rates comparable to the quote page (small sample)",
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
    baseline:
      "$588/conv on the PC-landing keywords; $620/conv campaign-wide pre-pause (both measured with the broken landing configuration)",
    decisionRule:
      "Fund only after the Aug 27 ceiling recompute, and only if budget envelope remains after the S5 raise — proven levers get the next dollar before hypotheses. Review at $250 spend or 14 days, whichever comes SECOND. KEEP AND SCALE if cost/conv ≤ $150. KILL if > $200. Between $150–200: one more $250 tranche, then a hard verdict either way. Standing constraint: no paid traffic points at the price checker again unless the estimate-moment experiment first clears its 6.2% bar.",
    status: "specified",
    studySlug: "behavioral-journey",
    notes:
      "Honest framing: the audit proves S1 was worse than it needed to be, not that it works when fixed — its /quote-pointed keywords also converted ~nothing on modest spend, and research-intent queries stay cold regardless of landing page.",
  },
  {
    slug: "quote-path-r2a",
    title: "Quote path, Release 2A: form simplification",
    change:
      "Forgiving route entry (city or state accepted, resolved server-side), vehicle type derived from make and model instead of asked, notes field removed. Price display excluded (that is R2B).",
    type: "experiment",
    owner: "Zaldivar Labs",
    metric:
      "Completed quote leads per eligible quote-page exposure, computed directly. Exposure unit: ONE eligible quote-page exposure per first-party session; reloads, repeat views and back-navigation within a session do not add exposures. Internal, QA and bot sessions excluded. Assignment happens before the first eligible render and is stable for the experiment.",
    baseline:
      "Concurrent control arm. Historical R1-era figure of 10.7% (241 of 2,258 arrivals, Aug 14 to Sep 28) is descriptive only and is NOT the experimental control.",
    decisionRule:
      "Persistent 50/50 random assignment (first-party cookie, assigned before render, variant stamped on every session, form, and lead event, with campaign, language, device, source, landing route and assignment date). Sample-ratio-mismatch check runs before any rate is read; a split materially off 50/50 (chi-square p < 0.001) blocks the read until explained. Review gate: at least 300 starts per variant AND at least 28 calendar days; hard maximum 42 days. Beta-binomial on each arm, prior Beta(1, 1), frozen here. SHIP if the posterior median relative lift is at least +10% AND P(R2A > control) >= 0.90 AND the immediate quality guardrail passes. REVERT if the posterior median relative lift is at most -10% AND P(R2A < control) >= 0.90, or on an immediate guardrail failure. Otherwise HOLD to the maximum gate, then record INCONCLUSIVE. Power statement: at about 1,000 exposures per arm over 42 days this test resolves roughly a 40% relative lift at 80% power. It is NOT powered for 10% or 15%; a HOLD is not a near miss. Subgroups (campaign, language, device) are for balance checks and spotting large heterogeneity only; no subgroup is required to reach significance. IMMEDIATE quality guardrail (decides with the primary): quoteable-at-submit rate, a deterministic flag at /api/lead (required fields present and valid, route resolvable, vehicle resolvable), must not fall more than 5 percentage points below control. DELAYED business read (reported, does not decide): matured priced share and priced leads per exposure, read only on leads past the frozen maturation window (historical 95th percentile of submit-to-priced latency, measured before launch), with treatment and control matured counts printed explicitly. At roughly 110 completions per arm in 42 days the priced-share difference has a standard error near 6.6 points, so this read can only show large quality damage; it is a harm signal, not evidence of noninferiority.",
    status: "specified",
    studySlug: "behavioral-journey",
    notes:
      "REDESIGNED 2026-09-28 after two rounds of external review of the original quote-path-r2 entry. Original was before/after with a 300-start gate and a 15% ship bar against the pre-R1 6.7% baseline: underpowered (about 25% power), used a stale baseline, and repeated R1's identification problem. R1's own data showed why: first 289 R1 starts completed at 24.2%, the next 461 at 38.6% (p about 0.00005). The late increase coincides with the Sep 14 and Sep 21 moves to lead-based bidding and cannot be attributed to R1; traffic-mix change is the leading explanation. A version stamp records what someone saw; it does not create a counterfactual. Randomization is the fix, and it also absorbs the Oct 3 S5 switch to Target CPA, which hits both arms concurrently. Second-round fixes: exposure unit defined, SRM check added, Bayesian rule made explicit (posterior median AND probability), prior frozen, and the matured-completion guardrail replaced because 150 matured completions per arm is unreachable inside 42 days at current traffic. Pre-launch build: cookie assignment in middleware; quoteable-at-submit flag; route resolution success/ambiguity/correction/latency; vehicle-type inference confidence and later agent disagreement; field dwell and refocus counts; unpriceable reason codes; exposure unit, prior, SRM test and decision formulas frozen in code with tests.",
  },
  {
    slug: "quote-path-r2b",
    title: "Quote path, Release 2B: in-form price moment",
    change:
      "After route and vehicle are known, show an estimate inside the quote form with a lock-this-price step, carrying the pattern validated on the price checker into the main form.",
    type: "experiment",
    owner: "Zaldivar Labs",
    metric:
      "Three levels, all per price-eligible exposure (one per session, same exclusions and stability rules as R2A). Behavioral diagnostic: continued past the price moment. Quality outcome: quoteable-at-submit leads (immediate) and matured priced leads (delayed). Business outcome: matured bookings, later contribution margin. The lock-this-price click is behavior, not success.",
    baseline: "Concurrent control arm: price-eligible starters who continue through the ordinary form with no price shown.",
    decisionRule:
      "Randomize at price eligibility (the moment route and vehicle are known), 50/50, persistent per visitor, SRM-checked. Runs only after R2A is decided, on the stabilized form. Review gate: at least 150 price-eligible exposures per arm and at least 28 days; maximum 42 days. The deciding metric is the QUALITY outcome, quoteable-at-submit leads per eligible exposure, not form completion: a shown price may lower completion while raising the share worth an agent's time, and judging on completion would kill the better treatment. Same Bayesian structure as R2A (Beta(1, 1); SHIP at posterior median >= +10% with P >= 0.90; REVERT symmetric; INCONCLUSIVE at the maximum gate). Continuation past the price and abandonment immediately before vs after the price are reported as diagnostics. Matured priced leads and bookings per eligible exposure are reported with explicit matured counts and can veto a SHIP on clear harm; they cannot prove noninferiority at this sample size. Funnel instrumented end to end: price shown, lock click, submit, quoteable, priced, booked.",
    status: "specified",
    studySlug: "behavioral-journey",
    notes:
      "ADDED 2026-09-28, revised same day after second review. The price checker experiment (pc-estimate-moment, validated 9/28 at 8.7% vs 6.2% bar, CI 5.5 to 13.5) proved something narrower than this: fixing the handoff after an estimate on a side tool moved continuation. It did not establish that a price in the middle of the main conversion form helps; 87% of estimate viewers still stopped at the price. In-form pricing is a new hypothesis with its own gate, not an inherited win. Blocked by: quote-path-r2a verdict.",
  },
  {
    slug: "pricing-phase0-observation",
    title: "Pricing readiness — agent observation (Phase 0)",
    change:
      "Before the pricing tool writes any real price, we observe how agents actually quote (Nelson first) to resolve the facts the automation depends on: which ProABD field is the total customer price vs deposit vs carrier balance, when the price is committed relative to telling the customer, and whether operability and open/enclosed are real selections or silent defaults. Time-boxed field worksheet; operations runs it and signs off.",
    type: "measurement",
    owner: "Zaldivar Labs / Eddie",
    metric: "Phase-0 blocking facts resolved (price-field semantics · commitment moment · defaults-vs-selected)",
    exposure: {
      current: 0,
      gate: 1,
      unit: "signed agent-observation runs",
      asOf: "2026-09-07",
    },
    decisionRule:
      "Run the observation worksheet with an agent and have operations sign off. GATE: no live pricing intervention — the PR4 worker touching real ProABD price fields, or in-card below-floor warnings — ships until sign-off confirms (1) which field is the total customer price, (2) an observable commitment event OR a written 'set and check the price in ProABD before communicating it' fallback, and (3) whether operability and transport are selected or silently defaulted. If no commitment event is observable, the operating procedure becomes the control. Resolves the offline discovery half of Phase 0; the historical review-volume replay resolves the rest.",
    status: "specified",
    studySlug: "pricing-sd-accuracy",
    notes:
      "Blocks pricing-auto-gate and the PR4 worker from touching real price fields until signed. The offline engine (assessment.ts PR1 + policy.ts PR2, both built and tested) does NOT depend on this — only the live intervention does. First run: Eddie observes Nelson. Worksheet: pricing-observation-worksheet-pr3.md (project doc). Internal ops readiness — keep this card at readiness level, not per-agent detail.",
  },
  {
    slug: "pricing-auto-gate",
    title: "Automated pricing gate (input integrity + distance)",
    change:
      "Built the input-integrity gate: a shipment is auto-priced only when every material field (vehicle class, operability, open/enclosed, route) maps losslessly into the SuperDispatch request — otherwise it is NEEDS_INPUT or SPECIALTY_REVIEW. Distance over ~1,299 mi is a separate precautionary REVIEW boundary. Module + 16-case test matrix landed 2026-09-06; not yet wired to the live lead flow.",
    type: "measurement",
    owner: "Zaldivar Labs",
    metric: "Share of AUTO-eligible (standard-vehicle) orders whose settled margin clears the $150 floor",
    baseline:
      "Backtest, resolved-standard n=10: 8 cleared the $150 floor, 2 long-haul (>=2,500 mi) settled below carrier cost.",
    current: "AUTO 0% on 305 leads today — the form captures operability on 0/305 and open/enclosed on ~9% (the blocker). Backtest: 8/10 resolved-standard settled orders cleared the floor.",
    exposure: {
      current: 10,
      gate: 30,
      unit: "settled standard-vehicle orders",
      asOf: "2026-09-06",
    },
    decisionRule:
      "Review at 30 settled standard-vehicle AUTO-eligible orders. WIDEN auto (raise or drop the 1,299-mi boundary) only if >= 90% clear the $150 floor and no below-cost case appears in the widened band. HOLD at 80-90%. TIGHTEN / keep the distance REVIEW if < 80% or any below-cost case recurs. NOT up for review: the input-integrity rule itself — never sending SD a lossy shipment is a safety invariant, not a bet.",
    status: "specified",
    studySlug: "pricing-sd-accuracy",
    notes:
      "BLOCKER (9/6 retroactive read): AUTO 0% on today's 305 leads — the intake form never captures operability (0/305) or open/enclosed (~9%). The R2 form fix (add a transport toggle, derive class from make/model, keep operability) is the unlock for the CUSTOMER-WEBSITE auto-quote track only (a later phase); it does NOT gate the agent-side approved-pricing workflow, which is the priority and reads the same fields from ProABD orders that already exist. See pricing-form-requirements-2026-09-06.md and agent-pricing-portal-spec.md v3.5. Honest framing: n is tiny and directional. The distance boundary is precautionary, NOT a validated model — with the RV removed, distance barely correlates with margin (Spearman rho about -0.15). The one catastrophic miss (an RV priced as a sedan) was a deterministic input bug, now prevented by the integrity gate; it did not actually lose money (an agent re-quoted it). Forward accrual with correct vehicle classification is the real proof.",
  },
  {
    slug: "pricing-review-protocol",
    title: "What a pricing REVIEW must produce",
    change:
      "Open decision: when a lane is routed to SPECIALTY_REVIEW, must the reviewer produce something SD lacks (a soft carrier bid, a comparable lane, endpoint/timing knowledge) under a response SLA — or is it a glance at the same SD number? And does human review actually beat SD?",
    type: "measurement",
    owner: "Zaldivar Labs / Kacy",
    metric: "Reviewer estimate vs SD vs settled carrier pay (does the reviewer beat SD?)",
    decisionRule:
      "Instrument first: log the reviewer's estimate BEFORE settlement, whether they saw SD first, evidence consulted, and time spent. Read at 20 reviewed-and-settled orders. If reviewer estimates are not closer to settled carrier pay than SD alone, REVIEW is ceremony — collapse it toward an SD band + $150 floor. If they beat SD, define the minimum evidence + SLA and keep REVIEW. Anchoring caveat: if reviewers see SD first this measures SD+human, not an independent benchmark.",
    status: "specified",
    studySlug: "pricing-sd-accuracy",
    notes:
      "Phase it for a 3-agent shop: start with a senior-estimator glance that logs a pre-settlement number; add the evidence/SLA requirement only once volume and tooling justify it.",
  },
];

/** True once exposure has crossed its precommitted gate — the review is due. */
export function isReviewDue(e: RegistryEntry): boolean {
  return (
    !!e.exposure &&
    e.status !== "decided" &&
    e.exposure.current >= e.exposure.gate
  );
}

export function getRegistryEntry(slug: string): RegistryEntry | undefined {
  return DECISION_REGISTRY.find((e) => e.slug === slug);
}

export function entriesForStudy(studySlug: string): RegistryEntry[] {
  return DECISION_REGISTRY.filter((e) => e.studySlug === studySlug);
}
