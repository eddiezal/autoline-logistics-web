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
  line: "Required \"Does it run?\" live on /quote since Oct 26 (completion read at 200 starts, ~Nov 9) · after-save step (Release C) waiting on the ProABD path · R2A paused through Nov 8, resumes on the revised metric",
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
      current: 7,
      gate: 5,
      unit: "weeks of call-page data",
      asOf: "2026-09-30",
    },
    decisionRule:
      "Read after 4–6 weeks of call-page data (~mid-September). If estimate-viewers turn out to be heavy callers, the price cliff shrinks and estimate-moment priority shifts from rescuing those visits to easing the call path. Either answer redirects the roadmap; neither is a failure.",
    status: "decided",
    verdict: {
      outcome: "kept",
      date: "2026-09-30",
      decision:
        "CLIFF STANDS. Estimate viewers are not calling instead of exiting: the route-price-checker page accounts for 3.5% of calls against ~28% of sessions. Calls skew home and quote pages like general traffic. The 87% stop-at-estimate share in behavior-journey is real, not a phone artifact. R2B's price-moment priority holds; no call-path work is pulled forward on this evidence.",
      evidence:
        "call-landing.mjs --days 45, run 2026-09-30 ~3:40 PM PT: 113 call leads (Aug 16 to Sep 30). Page when dialed: home 41 (36%), /es/quote 25 (22%), /quote 9 (8%), /es/people-promise 9 (8%), /es/price-promise 7 (6%), /tools/route-price-checker 4 (4%), /price-promise 4 (4%), everything else 13, one unrecorded. Quote pages together 30%, price checker 3.5%. 75 of 113 calls were 60s+. Spanish pages produced 37% of calls. Read is 7 weeks past the Aug 10 ship, gate was 5. Cosmetic: the script labels every row OTHER because stored landing pages now carry the host; the per-page tally is unaffected.",
    },
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
      "REDESIGNED 2026-09-28 after two rounds of external review of the original quote-path-r2 entry. Original was before/after with a 300-start gate and a 15% ship bar against the pre-R1 6.7% baseline: underpowered (about 25% power), used a stale baseline, and repeated R1's identification problem. R1's own data showed why: first 289 R1 starts completed at 24.2%, the next 461 at 38.6% (p about 0.00005). The late increase coincides with the Sep 14 and Sep 21 moves to lead-based bidding and cannot be attributed to R1; traffic-mix change is the leading explanation. A version stamp records what someone saw; it does not create a counterfactual. Randomization is the fix, and it also absorbs the Oct 3 S5 switch to Target CPA, which hits both arms concurrently. Second-round fixes: exposure unit defined, SRM check added, Bayesian rule made explicit (posterior median AND probability), prior frozen, and the matured-completion guardrail replaced because 150 matured completions per arm is unreachable inside 42 days at current traffic. Pre-launch build: cookie assignment in middleware; quoteable-at-submit flag; route resolution success/ambiguity/correction/latency; vehicle-type inference confidence and later agent disagreement; field dwell and refocus counts; unpriceable reason codes; exposure unit, prior, SRM test and decision formulas frozen in code with tests. PAUSED 2026-10-15 through 2026-11-08 (second-opinion reconciliation on the four qualifying questions): the Oct 26 form change ships as an unrandomized after-save step (see quote-step-after-save), not as this test's control. When R2A resumes it resumes with a REVISED primary metric: leads priced within one business day WITH the four usable facts recorded (runs, earliest available date, open or enclosed, belongings), per eligible quote-page exposure. 'Quoteable at submit' is withdrawn as the guardrail; it was written for a pre-submit design and does not apply to an after-save step. Exposure unit, cookie assignment, SRM check, Beta(1, 1) prior and the SHIP/REVERT formulas stand unchanged. Decision point 2026-11-09: retain the after-save step, or test moving operability and availability before submit (that test is R2A under the revised metric). MATURATION WINDOW FROZEN 2026-11-02 from 511 website leads submitted Sep 1 to Oct 23 (Oct 30 export; first CRM price timestamp via the ProABD mirror): 62% ever priced; of those, median 0.2 h, p90 12.3 h, p95 14.1 h, max 62 h after submit; 99% within 24 h, 100% within 72 h. Business-hours submits (Mon to Fri 8 AM to 5 PM ET) p95 1.1 h; off-hours submits p95 16.7 h (next-morning pricing). Window = 3 calendar days (72 h) from submit; a lead not priced by then counts as unpriced for the delayed read. The first CRM price is often provisional (agents price before the four facts are known, field-defaults findings Sep 9), which is why the revised metric requires the facts recorded, not just a price.",
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
      "ADDED 2026-09-28, revised same day after second review. The price checker experiment (pc-estimate-moment, validated 9/28 at 8.7% vs 6.2% bar, CI 5.5 to 13.5) proved something narrower than this: fixing the handoff after an estimate on a side tool moved continuation. It did not establish that a price in the middle of the main conversion form helps; 87% of estimate viewers still stopped at the price. In-form pricing is a new hypothesis with its own gate, not an inherited win. Blocked by: quote-path-r2a verdict. UNBLOCKED AND BUILT 2026-11-13 (Eddie): run R2B now, ahead of R2A. Reason: the Oct 15 to Nov 13 form diagnosis (claude/quote-form-diagnosis-2026-11-13.md; 1,186 quote-page sessions, 484 starts, 249 leads) found completion of starts at 51.4% and stable for four weeks, and located the loss at the contact section: of 235 abandoned starts, 75 finished the vehicle and never touched a contact field and 69 started contact and stopped; only 8 pressed Submit without a lead. The fields R2A would change are not where people stop (vehicle type: 42 of 47 last-touch sessions had completed it), so R2A is not a precondition for this test; R2A stays specified and paused. IMPLEMENTATION: src/lib/experiments/r2b.ts. Assignment is a first-party cookie (alv_ab_r2b), 50/50, set client-side when the quote form first mounts (not middleware: both arms render identically until the price moment, so nothing differs before assignment). Price moment = both ZIPs valid, a vehicle model entered, and Does it run answered. At that moment BOTH arms call /api/pricing and record one ab_exposure event (variant, priced 0 or 1, price); only the treatment arm displays the number (one estimate figure, labelled as an estimate, coordinator confirms the final price; no lock-this-price button in this version). A price-eligible exposure is ab_exposure with priced = 1, so non-running, classic and unpriceable routes are excluded from both arms the same way. Variant is stamped on every site event (ab.r2b) and on the lead doc (experiment.r2b, experiment.shownPrice). Switch: NEXT_PUBLIC_R2B_SPLIT=on opens the split; anything else closes it and is the rollback. Supervised tests use ?r2b=t or ?r2b=c (session only, marked forced, excluded from reads). DECIDING METRIC REVISED 2026-11-13: matured priced leads (first CRM price within the 72 h window frozen 2026-11-02) per price-eligible exposure, deduplicated to one exposure per visitor. Quoteable-at-submit was withdrawn on 2026-10-15 and is not used. Leads per eligible exposure and completion after the price moment are diagnostics. Gate, Beta(1, 1) prior, SHIP/REVERT/INCONCLUSIVE formulas and the SRM check stand as written above. The price shown is the live flatfee-v1 site number; on the Nov 5 fee study agents paid carriers a median 10 to 11% under the SD estimate, so held orders booked at a median 95% of the site price and all agent quotes at 92%. Shown price vs agent first price is recorded per lead. Do not change the S5 target during the test. Ben: summary in the November monthly report, no separate heads-up (Eddie). Split not yet open as of this note; status moves to accruing on the day it opens.",
  },
  {
    slug: "quote-r2-operability",
    title: "Quote form, Release 2: required \"Does it run?\"",
    change:
      "/quote asks \"Does it run?\" (EN and ES) as a required question on every path where the homepage did not already ask it. Shipped with the instant-price gate: no site price for RVs, trailers, commercial trucks, classics and non-running vehicles; those leads go to an agent with \"Quote this one by hand\". FORM_VERSION quote-r2-20261026. Form version is stamped on every form event and lead.",
    type: "measurement",
    shipped: "2026-10-26",
    owner: "Zaldivar Labs",
    metric:
      "Form completion (client-confirmed lead_persisted ÷ stamped form_started) on quote-r2-20261026 sessions, against the same form's completion in the 14 days before the change (quote-r1-20260812 sessions, Oct 12 to Oct 25). Also watched: website lead volume per serving day before and after.",
    baseline:
      "Pre-change completion, computed live from the Oct 12 to Oct 25 R1-stamped sessions (the band shows it). Not a randomized control: S5 traffic mix is the known confounder, same as the R1 note.",
    exposure: {
      current: 0,
      gate: 200,
      unit: "R2 form starts",
      asOf: "2026-11-02",
    },
    decisionRule:
      "Pricing-integrity fix, so the question stays in some form; the read decides WHERE it is asked. Review at 200 R2-stamped starts AND at least 14 calendar days after Oct 26 (about Nov 9). Color unlocks at 50 starts. KEEP as a required pre-submit question if completion is within 5 points of the pre-change rate. MOVE the question after the save (the quote-step-after-save design) if completion is more than 5 points below the pre-change rate; do not remove it. Either way, record the share of leads answering \"no\" and the share routed to an agent by the instant-price gate, so the after-save step and R2A start from measured numbers. Thresholds proposed 2026-11-02; Eddie ratifies.",
    status: "accruing",
    studySlug: "behavioral-journey",
    notes:
      "Shipped Oct 26 about 10 PM PT (commit d5ddaa8), from the Oct 26 quote-vs-recommended study: the site price covered the carrier on 84% of booked orders and the misses were non-standard and non-running vehicles. This is one of the four qualifying questions from the Oct 15 reconciliation, shipped early and pre-submit because the pricing gate needed it. Before/after only; the Oct 15 rule that unknowns are never defaulted applies (no preselected answer).",
    primary: true,
    meter: {
      scaleMax: 50,
      unlockN: 50,
      marks: [
        { value: 25, label: "move after save (pre minus 5)", kind: "revert" },
        { value: 30, label: "pre-change rate", kind: "keep" },
      ],
    },
  },
  {
    slug: "quote-step-after-save",
    title: "Quote path, after-save step: four qualifying questions (Release C)",
    change:
      "After the quote form saves the lead, a skippable step asks four questions agents need before a reliable quote: does the vehicle run (observable definition), earliest available pickup date (with \"I don't know yet\"), open or enclosed (with \"help me choose\"), and belongings (none / some / unsure). Spanish includes \"Prefiero hablar con un coordinador\". No preselected answers; unknown is stored as unknown. The original form, its submit event and the Google Ads conversion are unchanged; the lead saves and counts before the step appears. Unrandomized, behind a rollback flag.",
    type: "measurement",
    owner: "Zaldivar Labs",
    metric:
      "Per-question usable-answer coverage among leads that saw the step (an answer, including an explicit unknown, that an agent can act on without re-asking), and leads priced within one business day with all four facts recorded, per eligible quote-page exposure. Diagnostics: step shown, step completed vs skipped, time on step, pricing delay and unpriced reasons by agent.",
    baseline:
      "Pre-step: none of the four facts is asked on the website path (79% of leads, Oct 15 read); agents price from defaults and correct later (field-defaults findings, Sep 9: CRM 'open' on 296 classic/exotic-shaped records; late-set inoperable on booked orders). Submit-to-first-price p95 14 h, 62% ever priced (Sep 1 to Oct 23).",
    decisionRule:
      "Operational fix, not a conversion experiment: the form before the save is untouched, so completion cannot fall and Google's bidding signal is undisturbed. Monitors from day one: first 10 records hand-checked against the CRM; usable-answer coverage target 40 of the first 50 fully usable, treated as the trigger to inspect the weakest question, not as pass/fail; pricing delay and unpriced reasons by agent watched for agents skipping leads that answered. Release gates: nightly import reconciliation green, no pricing backlog, end-to-end test of the CRM write on a supervised test lead. Rollback flag off returns the site to the pre-step behavior with no deploy. Read 2026-11-09: RETAIN if the step is answered by a usable share of leads and agents report fewer re-asks; otherwise MOVE operability and availability before submit and test that move as quote-path-r2a under its revised metric.",
    status: "specified",
    studySlug: "behavioral-journey",
    notes:
      "ADOPTED 2026-10-15 from the second-opinion reconciliation of the four qualifying questions (Kacy's Q7: runs, first available date, open or enclosed, plus her empty-or-loaded add). Planned release Oct 26. PARTLY SHIPPED: operability went live Oct 26 as a required pre-submit question on /quote (see quote-r2-operability), not as an after-save step. The other three questions (earliest available date, open or enclosed, belongings) and the after-save step itself are NOT BUILT as of Nov 2. Open dependency: ProABD has no lead-update endpoint, so the after-save answers need one of (a) a Superflo-provided update endpoint or createLead fields for carrier type and belongings, (b) a short server-side hold on the ProABD push (lead saved and conversion fired immediately; createLead sent when the customer finishes or skips, or after about 3 minutes; needs Renee's OK and a sweep for unpushed leads), or (c) answers in the agent lead email only. Belongings has no ProABD field under any path except (a). Asks to Superflo and Renee sent Nov 2. Build cannot start until the path is chosen.",
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
  {
    slug: "s5-keyword-batch-nov5",
    title: "Spanish campaign: small keyword batch after the priced-lead switch",
    change:
      "Applied 2026-11-05 7:07 PM PT via the Ads API (scripts/_tmp-s5-keyword-batch-nov5.mjs). Added three exact keywords that were already converting as search terms: [compañia de transporte de vehiculos] to Empresas y Servicio, [transporte de autos en usa] to Transporte de Vehículos, [transporte de carro para outro estado] (Portuguese) to Envío y Traslado. Paused four keywords: the accented duplicates 'transporte de autos en camión' and 'traslado de vehículos precio', 'traslado de vehiculos precio', and 'flete de carros' (QS 3). Added two campaign negatives: [auto transport] exact and \"como\" phrase (how-to queries). Target, budget, ad groups and ads unchanged.",
    type: "observational",
    owner: "Zaldivar Labs",
    metric:
      "S5 cost per priced lead and priced-lead count, Nov 6 to Nov 22, vs Oct 19 to Nov 4 ($33.50, 124 priced on $4,152). Secondary: whether the three added terms now land in their intended ad group, and spend on 'como' queries (was about $55 for 0.5 conv in 17 days).",
    baseline:
      "Oct 19 to Nov 4: $4,152, 124 priced leads, $33.50 each; visible search terms 16% of spend. The four paused keywords spent $108 for 0 priced leads; the three added terms spent $108 for 6 priced leads.",
    decisionRule:
      "Written 2026-11-05 before applying. This is hygiene, not a lever: every item is under $60 of spend over 17 days, so no item is a performance verdict on its own; the pauses are justified as duplicates, the adds as routing. Read on Nov 23 with the target review. KEEP if cost per priced lead stays within 10% of $33.50 and the 'como' negative shows no converting query blocked (search terms report). REVERT the 'como' negative alone if a how-to query with a conversion appears excluded. Nothing here changes the Nov 23 question, which is now 'did hold rate and value per priced lead move', not 'raise the target'.",
    shipped: "2026-11-05",
    status: "accruing",
    notes:
      "Recon: claude/ledger-2026-11-05-scorecard-correction-ads-schedule.md and scripts/_tmp-s5-keyword-recon.mjs. Same day: ad schedule extended to Mon to Fri 5 AM to 7 PM PT and Saturday 6 AM to 2 PM PT (separate entries). Bigger levers identified and parked: price-intent landing page for the Precio group (CVR 19% vs 22 to 28%), held-order count as a secondary Google conversion, Portuguese micro test, 'en usa' copy test. Value-based bidding stays off until the fee varies with the move (fee study, Nov 13 block).",
  },
  {
    slug: "evening-coverage-trial",
    title: "Evening and Saturday coverage: one agent on every ad hour",
    change:
      "Approved by Ben on the Nov 2 call, revised Nov 3 to Nelson Mon to Thu 3 to 11 PM Eastern plus Saturday 9 to 5 Eastern (40 hours, Friday off), then put ON HOLD by Ben on Nov 5 (text, 9:24 AM PT): Renee and Ginger say they are answering after hours; no schedule change. What did ship Nov 5: the Spanish campaign ad schedule extended to Mon to Fri 5 AM to 7 PM PT (8 AM to 10 PM Eastern) and Saturday 6 AM to 2 PM PT (9 AM to 5 PM Eastern), target $36 and November ceiling $10,000 unchanged; Nelson covers Saturday 9 to 5 Eastern; weekday evenings stay informal (Renee, Ginger). A weekly evening-response report goes to Ben Mondays Nov 9 to Dec 7 (leads 5 to 10 PM Eastern and Saturday: median minutes to first price, share inside 15 minutes, share next morning, held orders, by agent).",
    type: "experiment",
    owner: "Auto Line (staffing) / Zaldivar Labs (ads and read)",
    metric:
      "Hold rate (order still an order today, the commission definition adopted Nov 5) of Spanish-campaign leads submitted 5 to 10 PM Eastern on weekdays and Saturday 9 to 5 Eastern, matured 7 days. Secondary: first-price wait for the same cohort by agent; cost per priced lead in the new hours (9 to 10 PM Eastern weekdays, Saturday) vs the existing weekday hours; deposits per $100 of spend for the month.",
    baseline:
      "October, before the change, on the old booking definition: leads arriving after 5 PM Eastern were 35% of Spanish-campaign leads and booked 11% of priced vs 25% for leads arriving while the team was on; first price took 35 to 85 minutes vs 7 to 13. On the held-order definition, October Spanish website leads held at 14% overall (31 of 221). Saturday, ads off, 120 days: 31 organic leads over 17 Saturdays, 0 held.",
    exposure: { current: 0, gate: 60, unit: "priced leads 5 to 10 PM ET weekdays + Saturday", asOf: "2026-11-05" },
    decisionRule:
      "Written 2026-11-02, revised 2026-11-05 after the hold. Read on Dec 7 on leads submitted Nov 6 to Dec 4, matured 7 days, at least 60 priced after-hours leads. The question is no longer whether Nelson takes the evening shift; it is whether informal coverage holds. KEEP the extended ad hours if the after-hours hold rate is at least 12% (within 2 points of daytime on the held definition) AND median first-price wait after 5 PM Eastern is under 20 minutes AND cost per priced lead in the new hours is no more than 1.5 times the existing weekday hours. ITERATE (reopen the dedicated-owner schedule with Ben, with the weekly reports as the record) if the hold rate is between 8% and 12% or the median wait is over 30 minutes. REVERT the 9 to 10 PM Eastern hour and Saturday if the hold rate is under 8% at 60 or more priced leads, or if either block misses the cost bar for three consecutive weeks. Interim Nov 23: target review only. Power: at 60 to 80 priced leads the standard error on the hold rate is about 4 points.",
    shipped: "2026-11-05",
    status: "accruing",
    notes:
      "Shipped Nov 5 as the ads-schedule half only; the staffing half is on hold. Two decisions that only work together: the hours Google has never served are bought only because a person is on them, and the evening leads already being bought are only worth more if someone prices them inside the hour. Confounders to discount at the read: Thanksgiving week (Nov 23 to 27) runs soft; the Nov 9 schedule change restarts Google's learning on the campaign, so week one cost per priced lead is a read, not a forecast; Saturday has no history at all. Pay for the evening shift and Saturdays is Ben's decision and is not part of this read. Fee split and pricing pilot are a separate decision (not in this registry until the mechanics are settled).",
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
