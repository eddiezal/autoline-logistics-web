/**
 * Targets & phase plan — metric-contract.md §10 (v1.2, set 2026-07-29).
 *
 * Law 8: targets are DECLARED, not implied. Every target carries its
 * population, clock, set-date, and basis. A metric whose phase hasn't
 * activated renders no efficiency judgment — Phase-1 metrics wear
 * "learning" labels, never red.
 *
 * The account phase is DECLARED here (contract governance: it changes at
 * monthly report time, logged in §10.5). Gate PROGRESS is computed live on
 * the dashboard; the flip itself is a human decision made when the gates
 * read met.
 */

/** Account-level phase. Flip at gate per contract §10.2 — logged change. */
export const ACCOUNT_PHASE: 1 | 2 | 3 = 1;

export interface PhaseDef {
  n: 1 | 2 | 3;
  title: string;
  optimize: string;
  judgedOn: string;
  bidding: string;
}

export const PHASES: PhaseDef[] = [
  {
    n: 1,
    title: "Learn",
    optimize: "clicks + data",
    judgedOn: "data-collection goals only — CPL/CVR are explicit non-goals",
    bidding: "Manual CPC / Max Clicks",
  },
  {
    n: 2,
    title: "Qualified leads",
    optimize: "unique serviceable paid leads",
    judgedOn: "CPL vs the affordability ceiling; click→lead vs own baseline",
    bidding: "Max Conversions",
  },
  {
    n: 3,
    title: "Revenue",
    optimize: "booked broker fee per $ spend",
    judgedOn: "cost per booking; fee per $",
    bidding: "Value-based (fee as conversion value)",
  },
];

/** Gate 1→2, per campaign: Google's floor for Max Conversions to bid on. */
export const GATE_ACTIONS_30D = 30;

/**
 * Affordability CEILING (not a goal to spend up to) — activates Phase 2.
 * basis: median booked broker fee $245 (P9 book, 336 orders Mar–Jul)
 * × assumed 10% paid lead→book rate. Scenario curve: 5%→$12.25 ·
 * 10%→$24.50 · 15%→$36.75. The assumption is replaced by the measured
 * rate at first mature paid cohort (contract §9.10, Aug 27+).
 */
export const CPL_CEILING = {
  value: 25,
  unit: "$ per unique serviceable paid lead (P4∩P5∩P6)",
  clock: "B (mature cohorts only)",
  activatesInPhase: 2 as const,
  setDate: "2026-07-29",
  basis: "$245 median booked broker fee × 10% assumed close",
};

/** Measured reference baselines — NOT targets (contract §10.3b). */
export const BASELINES = {
  costPerClick: 2.94,
  costPerSignal: 9.96,
  note: "S1, Jul 20–27, pre bid-cap experiment",
};

/** Reserved slots — contract BANS inventing these before Aug 27 (§10.3c). */
export const RESERVED_TARGETS = [
  "click→lead rate",
  "lead→book rate",
  "CPL goal (vs ceiling)",
  "cost per booking",
  "fee per $ spend",
];

/**
 * S5 bidding upgrade is THRESHOLD-gated, not date-gated (changed 7/31;
 * the old note scheduled it for Aug 3 while S5 sat at 9/30 trailing
 * actions — caught by Eddie. Gates, not dates.)
 */
export const PHASE2_PILOT_NOTE =
  "S5 moves to Max Conversions when it banks ~15+ primary actions in a trailing 30 days (Google's learning floor) AND the Spanish phone menu is live — no calendar date. The full 30-action gate remains the formal Phase-2 flip.";

/** One plain-English line for the Phase card and the monthly report. */
export const PHASE_NARRATIVE: Record<1 | 2 | 3, string> = {
  1: "We are optimizing for clicks on purpose: buying the data that lets us optimize for qualified leads next, then revenue. Judging CPL this early would be judging noise.",
  2: "We optimize for qualified leads: Max Conversions on primary actions, judged against the affordability ceiling on mature cohorts.",
  3: "We optimize for revenue: booked broker fee flows back as conversion value and bidding follows the money.",
};
