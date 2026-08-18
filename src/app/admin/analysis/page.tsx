/**
 * /admin/analysis — the Analysis Library index.
 *
 * Every statistical study behind a business decision, in one place: what we
 * asked, how we answered it, and what changed because of it. Registry:
 * src/lib/admin/analysisLibrary.ts. Auth: /admin Basic-auth gate (proxy).
 *
 * 2026-08-18: added the Decision Registry above the studies — every live bet
 * with its decision rule written at ship time (see decisionRegistry.ts for
 * the doctrine). Review-due state is computed here from exposure vs gate, so
 * the page nags on schedule instead of relying on anyone's memory.
 */
import Link from "next/link";
import { STUDIES } from "@/lib/admin/analysisLibrary";
import { DECISION_REGISTRY, isReviewDue, type RegistryEntry } from "@/lib/admin/decisionRegistry";

export const runtime = "nodejs";

const GREEN = "#128A3A";
const INK = "#1a1a1a";
const MUTED = "var(--color-text-muted)";
const RED = "#C0392B";

const TYPE_LABEL: Record<RegistryEntry["type"], string> = {
  experiment: "EXPERIMENT",
  measurement: "MEASUREMENT",
  observational: "OBSERVATIONAL",
  instrumentation: "INSTRUMENTATION",
};

function statusChip(e: RegistryEntry) {
  if (e.status === "decided" && e.verdict) {
    return { text: e.verdict.outcome.toUpperCase(), bg: "var(--color-gray-100)", color: INK };
  }
  if (isReviewDue(e)) return { text: "REVIEW DUE", bg: RED, color: "#fff" };
  if (e.status === "specified") return { text: "SPECIFIED", bg: "transparent", color: MUTED };
  return { text: e.status.toUpperCase(), bg: "var(--color-gray-100)", color: INK };
}

function RegistryCard({ e }: { e: RegistryEntry }) {
  const chip = statusChip(e);
  const due = isReviewDue(e);
  return (
    <div
      id={`registry-${e.slug}`}
      style={{
        background: "var(--color-surface)",
        border: `1px solid ${due ? RED : "var(--color-gray-200)"}`,
        borderRadius: 12,
        padding: "14px 16px",
        scrollMarginTop: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ color: MUTED, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, border: "1px solid var(--color-gray-200)", borderRadius: 999, padding: "1px 8px" }}>
          {TYPE_LABEL[e.type]}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, borderRadius: 999, padding: "2px 9px", background: chip.bg, color: chip.color, border: chip.bg === "transparent" ? "1px dashed var(--color-gray-200)" : "none" }}>
          {chip.text}
        </span>
        {e.shipped && (
          <span style={{ color: MUTED, fontSize: 12 }}>
            shipped {new Date(e.shipped + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>

      <h3 style={{ margin: "7px 0 2px", fontSize: 15.5, fontWeight: 700, color: INK }}>{e.title}</h3>
      <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "#52525b", lineHeight: 1.5 }}>{e.change}</p>

      <div style={{ display: "grid", gap: 3, fontSize: 12.5, color: "#3f3f3f" }}>
        <p style={{ margin: 0 }}>
          <strong style={{ color: INK }}>Metric:</strong> {e.metric}
          {e.baseline && <> · <strong style={{ color: INK }}>baseline</strong> {e.baseline}</>}
          {e.current && <> · <strong style={{ color: INK }}>now</strong> {e.current}</>}
        </p>
      </div>

      {e.exposure && (
        <div style={{ margin: "9px 0 0" }}>
          <div style={{ background: "var(--color-gray-100)", borderRadius: 4, height: 8, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, Math.round((e.exposure.current / e.exposure.gate) * 100))}%`,
                background: due ? RED : GREEN,
                height: 8,
              }}
            />
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>
            {e.exposure.current.toLocaleString()} / {e.exposure.gate.toLocaleString()} {e.exposure.unit}
            {" · "}
            {due
              ? "gate crossed — review is due"
              : `${(e.exposure.gate - e.exposure.current).toLocaleString()} ${e.exposure.unit} until review`}
            {" · as of "}
            {new Date(e.exposure.asOf + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
      )}

      <p style={{ margin: "9px 0 0", fontSize: 12.5, color: "#3f3f3f", lineHeight: 1.55 }}>
        <strong style={{ color: INK }}>Decision rule (precommitted):</strong> {e.decisionRule}
      </p>

      {e.notes && (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>⚠ {e.notes}</p>
      )}

      {e.verdict && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#3f3f3f", lineHeight: 1.55, borderTop: "1px solid var(--color-gray-200)", paddingTop: 8 }}>
          <strong style={{ color: INK }}>Verdict ({e.verdict.date}):</strong> {e.verdict.decision}{" "}
          <span style={{ color: MUTED }}>Evidence: {e.verdict.evidence}</span>
        </p>
      )}

      <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>
        Owner: {e.owner}
        {e.studySlug && (
          <>
            {" · "}
            <Link href={`/admin/analysis/${e.studySlug}`} style={{ color: GREEN, fontWeight: 600 }}>
              full study →
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

const STATUS_ORDER: Record<string, number> = { accruing: 1, reading: 1, specified: 2, decided: 3 };

export default function AnalysisIndex() {
  const studies = [...STUDIES].sort((a, b) => (a.date < b.date ? 1 : -1));
  const registry = [...DECISION_REGISTRY].sort((a, b) => {
    const dueA = isReviewDue(a) ? 0 : STATUS_ORDER[a.status] ?? 2;
    const dueB = isReviewDue(b) ? 0 : STATUS_ORDER[b.status] ?? 2;
    return dueA - dueB || (a.shipped ?? "9999") .localeCompare(b.shipped ?? "9999");
  });

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 80px" }}>
      <p style={{ margin: "0 0 14px" }}>
        <Link href="/admin" style={{ color: GREEN, fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
          ← Dashboard
        </Link>
      </p>
      <header style={{ marginBottom: 24 }}>
        <p style={{ color: GREEN, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
          Auto Line Logistics
        </p>
        <h1 style={{ fontSize: 30, margin: "4px 0 6px", fontWeight: 800 }}>Analysis Library</h1>
        <p style={{ color: MUTED, margin: 0, fontSize: 15, lineHeight: 1.5 }}>
          The studies behind the decisions: what we asked, what the data said,
          and what changed because of it. Built from our own booked orders and
          account data.
        </p>
      </header>

      <section style={{ marginBottom: 34 }}>
        <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: MUTED, fontWeight: 700, margin: "0 0 4px" }}>
          Decision Registry
        </h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
          Every live bet, its decision rule written when it shipped — so the
          verdict comes on a schedule, not on whichever read looks best later.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {registry.map((e) => (
            <RegistryCard key={e.slug} e={e} />
          ))}
        </div>
      </section>

      <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: MUTED, fontWeight: 700, margin: "0 0 12px" }}>
        Studies
      </h2>
      <div style={{ display: "grid", gap: 12 }}>
        {studies.map((s) => (
          <Link
            key={s.slug}
            href={`/admin/analysis/${s.slug}`}
            style={{
              display: "block",
              textDecoration: "none",
              color: "inherit",
              background: "var(--color-surface)",
              border: "1px solid var(--color-gray-200)",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <span style={{ color: MUTED, fontSize: 12.5 }}>
                {new Date(s.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
              <span style={{ color: GREEN, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {s.status}
              </span>
              {s.chartHref && (
                <span style={{ color: MUTED, fontSize: 11.5 }}>interactive chart</span>
              )}
            </div>
            <h2 style={{ margin: "5px 0 4px", fontSize: 18, fontWeight: 700, color: INK }}>{s.title}</h2>
            <p style={{ margin: 0, color: "#52525b", fontSize: 13.5, lineHeight: 1.55 }}>{s.headline}</p>
          </Link>
        ))}
      </div>

      <p style={{ marginTop: 28, color: MUTED, fontSize: 12.5 }}>
        See also: <Link href="/admin/changes" style={{ color: GREEN }}>Work Log</Link> ·{" "}
        <Link href="/admin/report" style={{ color: GREEN }}>Monthly report</Link>
      </p>
    </main>
  );
}
