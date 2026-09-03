/**
 * Active Decisions strip — the compact "what are we learning" band on the
 * /admin Overview (v3 design, 2026-08-19).
 *
 * Deliberately ~one KPI-row tall: experiments deserve persistent AWARENESS,
 * not persistent dominance. The four-surface grammar this belongs to:
 *   charts = how are we doing · THIS STRIP = what are we learning ·
 *   Needs-a-decision queue = what requires action · /admin/analysis = why we
 *   believe it.
 *
 * Behavior:
 *  · Micro-cards sorted by NEXT EXPECTED DECISION — leftmost crosses its
 *    evidence gate first (ETA projected from live accrual rate).
 *  · Color grammar (registry MeterSpec doc): gray = accumulating (n below
 *    unlockN) · green = clears the keep/validate mark · amber = between
 *    marks · red = below the failure mark. Color states the value's relation
 *    to a PRECOMMITTED rule, never judgment.
 *  · A gate-crossed card hides its live metric (no procrastination-watching)
 *    and points at the Needs-a-decision queue, where reviewDueEntries() has
 *    already pushed the action item.
 *  · A DECIDED entry renders its verdict in green and sorts last — finished
 *    experiments trail, pending decisions lead. (First exercised by
 *    quote-form-r1, 2026-09-01.)
 *  · Live numbers from computeDecisionsLive(); on failure the registry's
 *    hand-stamped exposure renders WITH its asOf date, so staleness is
 *    visible rather than disguised.
 */
import Link from "next/link";
import { DECISION_REGISTRY, FOCUS, type RegistryEntry } from "@/lib/admin/decisionRegistry";
import type { DecisionsLive } from "@/lib/admin/activeDecisions";

const GREEN = "#128A3A";
const INK = "#1a1a1a";
const MUTED = "var(--color-text-muted)";
const RED = "#C0392B";
const AMBER = "#b45309";
const GRAY_BAR = "#9ca3af";
const GOOD_TEXT = "#006300";

const R1_SHIP = new Date("2026-08-12T00:00:00-07:00");
const PC_POST = new Date("2026-08-14T00:00:00-07:00");
const CALL_READ = new Date("2026-09-14T00:00:00-07:00"); // Aug 10 + 5 weeks

interface CardModel {
  slug: string;
  name: string;
  /** Human name for the heartbeat line. */
  display: string;
  /** Sort key: projected gate-cross time (ms). Crossed gates sort first. */
  etaMs: number;
  etaLabel: string | null;
  numMain: string;
  numSub: string | null;
  /** ↑ rendered in success-text green when the direction is favorable. */
  up: boolean;
  early: boolean;
  crossed: boolean;
  /** Verdict display for a decided entry — replaces both live metric and alarm. */
  decided: { outcome: string; dateLabel: string } | null;
  meter: { valuePct: number; scaleMax: number; color: string; marks: { left: number }[] } | null;
  /** Plain progress fraction 0–1 when there is no threshold meter. */
  progress: number | null;
  gateLine: React.ReactNode;
  hover: string;
}

function eta(nowMs: number, shipMs: number, current: number, gate: number): { ms: number; label: string | null } {
  if (current >= gate) return { ms: 0, label: "gate crossed" };
  const days = (nowMs - shipMs) / 864e5;
  const rate = days > 0 ? current / days : 0;
  if (rate <= 0) return { ms: Number.MAX_SAFE_INTEGER / 2, label: null };
  const ms = nowMs + ((gate - current) / rate) * 864e5;
  const label = "~" + new Date(ms).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" });
  return { ms, label };
}

function meterColor(value: number, spec: NonNullable<RegistryEntry["meter"]>, n: number): string {
  if (n < spec.unlockN) return GRAY_BAR;
  const fail = spec.marks.find((m) => m.kind === "revert" || m.kind === "baseline")?.value ?? 0;
  const win = spec.marks.find((m) => m.kind === "keep" || m.kind === "target")?.value ?? Infinity;
  if (value >= win) return GREEN;
  if (value < fail) return RED;
  return AMBER;
}

export function ActiveDecisionsStrip({ live }: { live: DecisionsLive | null }) {
  const nowMs = (live?.computedAt ?? new Date()).getTime();
  const bySlug = new Map(DECISION_REGISTRY.map((e) => [e.slug, e]));
  const cards: CardModel[] = [];

  /* ── Form R1 ── */
  {
    const reg = bySlug.get("quote-form-r1");
    if (reg?.exposure) {
      const starts = live?.r1?.starts ?? reg.exposure.current;
      const pct = live?.r1?.completionPct ?? null;
      const liveOk = !!live?.r1;
      const e = eta(nowMs, R1_SHIP.getTime(), starts, reg.exposure.gate);
      const verdict =
        reg.status === "decided" && reg.verdict
          ? {
              outcome: reg.verdict.outcome.toUpperCase(),
              dateLabel: new Date(reg.verdict.date + "T12:00:00-07:00").toLocaleDateString("en-US", {
                timeZone: "America/Los_Angeles", month: "short", day: "numeric",
              }),
            }
          : null;
      const crossed = !verdict && starts >= reg.exposure.gate;
      cards.push({
        slug: reg.slug,
        name: "FORM R1", display: "Form R1",
        etaMs: verdict ? Number.MAX_SAFE_INTEGER : e.ms,
        etaLabel: verdict ? null : e.label,
        numMain: pct !== null ? `${pct.toFixed(1)}%` : "—",
        numSub: "vs 24.4% bar",
        up: pct !== null && pct >= 24.4,
        early: false, crossed, decided: verdict,
        meter: reg.meter && pct !== null
          ? {
              valuePct: Math.min(100, (pct / reg.meter.scaleMax) * 100),
              scaleMax: reg.meter.scaleMax,
              color: meterColor(pct, reg.meter, starts),
              marks: reg.meter.marks.map((m) => ({ left: (m.value / reg.meter!.scaleMax) * 100 })),
            }
          : null,
        progress: null,
        gateLine: (
          <>
            <b style={{ color: INK }}>{starts} / {reg.exposure.gate}</b> starts
            {!liveOk && <> · as of {reg.exposure.asOf.slice(5)}</>}
          </>
        ),
        hover: verdict && reg.verdict
          ? `Decided ${reg.verdict.date}: ${reg.verdict.decision}`
          : `Quote form Release 1 — completion (client-confirmed lead_persisted ÷ stamped starts). Rule: keep ≥24.4%, revert <20%, review at 200 starts. Full rule in the Decision Registry.`,
      });
    }
  }

  /* ── PC handoff ── */
  {
    const reg = bySlug.get("pc-estimate-moment");
    if (reg?.exposure) {
      const n = live?.pc?.estimateSessions ?? reg.exposure.current;
      const k = live?.pc?.toQuote ?? 0;
      const liveOk = !!live?.pc;
      const pct = n > 0 ? (100 * k) / n : 0;
      const e = eta(nowMs, PC_POST.getTime(), n, reg.exposure.gate);
      const crossed = n >= reg.exposure.gate;
      const early = n < (reg.meter?.unlockN ?? 50);
      cards.push({
        slug: reg.slug,
        name: "PC HANDOFF", display: "PC handoff",
        etaMs: e.ms, etaLabel: e.label,
        numMain: `${k} / ${n}`,
        numSub: early ? null : `${pct.toFixed(1)}%`,
        up: false, early, crossed, decided: null,
        meter: reg.meter
          ? {
              valuePct: Math.min(100, (pct / reg.meter.scaleMax) * 100),
              scaleMax: reg.meter.scaleMax,
              color: meterColor(pct, reg.meter, n),
              marks: reg.meter.marks.map((m) => ({ left: (m.value / reg.meter!.scaleMax) * 100 })),
            }
          : null,
        progress: null,
        gateLine: (
          <>
            <b style={{ color: INK }}>{n} / {reg.exposure.gate}</b> visits
            {!liveOk && <> · as of {reg.exposure.asOf.slice(5)}</>}
          </>
        ),
        hover: "Price-checker → quote handoff since the Aug 13 fix. Color unlocks at n=50. Rule: ≥6.2% validates; 3.1–6.2% hold; <3.1% reopen plumbing. Discount one Aug 18 internal verification visit at review.",
      });
    }
  }

  /* ── Call-page capture ── */
  {
    const reg = bySlug.get("call-landing-read");
    if (reg?.exposure) {
      const weeks = live?.callWeeks ?? reg.exposure.current;
      cards.push({
        slug: reg.slug,
        name: "CALL-PAGE CAPTURE", display: "Call-page capture",
        etaMs: CALL_READ.getTime(),
        etaLabel: "~Sep 14",
        numMain: "reading pending",
        numSub: null, up: false, early: false,
        crossed: weeks >= reg.exposure.gate,
        decided: null,
        meter: null,
        progress: Math.min(1, weeks / reg.exposure.gate),
        gateLine: <><b style={{ color: INK }}>{weeks.toFixed(1)} / {reg.exposure.gate}</b> weeks</>,
        hover: "Which page callers call from — does the price cliff survive phone calls? Read after 4–6 weeks of call-page data (~mid-September).",
      });
    }
  }

  /* ── Corridor pages ── */
  {
    const reg = bySlug.get("corridor-pages");
    if (reg) {
      cards.push({
        slug: reg.slug,
        name: "CORRIDOR PAGES", display: "Corridor pages",
        etaMs: new Date("2026-09-13T00:00:00-07:00").getTime(),
        etaLabel: "monthly",
        numMain: "27",
        numSub: "vs 13 /mo",
        up: true, early: false, crossed: false, decided: null,
        meter: null,
        progress: 0.54,
        gateLine: <>next <b style={{ color: INK }}>monthly</b> read</>,
        hover: "Observational — corridor-page traffic since the Aug 10 search fixes. Invest in more corridors only if conversion holds at ≥20 visits.",
      });
    }
  }

  cards.sort((a, b) => a.etaMs - b.etaMs);
  const next = cards.find((c) => !c.crossed && c.etaLabel && c.etaLabel !== "monthly");

  const mcStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-gray-200)",
    borderRadius: 10,
    padding: "9px 12px 8px",
    textDecoration: "none",
    color: "inherit",
    display: "block",
  };

  return (
    <div style={{ margin: "4px 0 16px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", fontSize: 12.5, margin: "0 2px 7px" }}>
        <span>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".8px", color: MUTED }}>FOCUS</span>{" "}
          <b style={{ color: INK }}>{FOCUS.title}</b>
        </span>
        {next && (
          <>
            <span style={{ color: "var(--color-gray-200)" }}>·</span>
            <span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".8px", color: MUTED }}>NEXT DECISION</span>{" "}
              <b style={{ color: INK }}>{next.display} · {next.etaLabel}</b>
            </span>
          </>
        )}
        <span style={{ marginLeft: "auto" }}>
          <Link href="/admin/analysis" style={{ color: GREEN, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            Decision Registry →
          </Link>
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {cards.map((c) => (
          <Link key={c.slug} href={`/admin/analysis#registry-${c.slug}`} style={mcStyle} title={c.hover}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".7px", color: MUTED }}>{c.name}</div>
            {c.decided ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 800, color: GREEN, marginTop: 3 }}>
                  DECIDED · {c.decided.outcome}
                </div>
                <div style={{ fontSize: 10.5, color: MUTED, marginTop: 5 }}>
                  {c.decided.dateLabel} · full verdict in the <b>Decision Registry</b>
                </div>
              </>
            ) : c.crossed ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 800, color: RED, marginTop: 3 }}>REVIEW DUE</div>
                <div style={{ fontSize: 10.5, color: MUTED, marginTop: 5 }}>
                  gate crossed · see <b>Needs a decision</b>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 1, whiteSpace: "nowrap", color: INK }}>
                  {c.numMain}
                  {c.up && <span style={{ color: GOOD_TEXT, fontSize: 11, fontWeight: 700 }}> ↑</span>}
                  {c.numSub && <span style={{ fontSize: 10.5, fontWeight: 600, color: MUTED }}> {c.numSub}</span>}
                  {c.early && (
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".5px", color: MUTED, background: "var(--color-gray-100)", borderRadius: 999, padding: "1px 6px", verticalAlign: 2, marginLeft: 4 }}>
                      EARLY
                    </span>
                  )}
                </div>
                <div style={{ position: "relative", height: 8, background: "var(--color-gray-100)", borderRadius: 3, marginTop: 6 }}>
                  {c.meter ? (
                    <>
                      <div style={{ position: "absolute", left: 0, top: 2, height: 4, width: `${Math.max(c.meter.valuePct, 1)}%`, background: c.meter.color, borderRadius: "0 2px 2px 0" }} />
                      {c.meter.marks.map((m, i) => (
                        <div key={i} style={{ position: "absolute", left: `${m.left}%`, top: -2, width: 1.5, height: 12, background: INK, opacity: 0.45 }} />
                      ))}
                    </>
                  ) : (
                    <div style={{ position: "absolute", left: 0, top: 2, height: 4, width: `${Math.max((c.progress ?? 0) * 100, 1)}%`, background: GRAY_BAR, borderRadius: "0 2px 2px 0" }} />
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: MUTED, marginTop: 5 }}>{c.gateLine}</div>
              </>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
