/**
 * /admin/analysis — the Analysis Library index.
 *
 * Every statistical study behind a business decision, in one place: what we
 * asked, how we answered it, and what changed because of it. Registry:
 * src/lib/admin/analysisLibrary.ts. Auth: /admin Basic-auth gate (proxy).
 */
import Link from "next/link";
import { STUDIES } from "@/lib/admin/analysisLibrary";

export const runtime = "nodejs";

const GREEN = "#128A3A";
const INK = "#1a1a1a";
const MUTED = "var(--color-text-muted)";

export default function AnalysisIndex() {
  const studies = [...STUDIES].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 80px" }}>
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
