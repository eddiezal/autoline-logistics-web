/**
 * /admin/analysis/[slug] — one study, fully written up.
 *
 * Sections: the question · how we answered it · findings · honest caveats ·
 * what it changed. Interactive charts render in an iframe served from inside
 * the /admin auth boundary (never /public). Registry: analysisLibrary.ts.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudy, STUDIES, type DeepSection } from "@/lib/admin/analysisLibrary";

export const runtime = "nodejs";

const GREEN = "#128A3A";
const INK = "#1a1a1a";
const MUTED = "var(--color-text-muted)";

export function generateStaticParams() {
  return STUDIES.map((s) => ({ slug: s.slug }));
}

function DeepDive({ sec }: { sec: DeepSection }) {
  return (
    <Section title={sec.title}>
      {sec.body && (
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "#3f3f3f" }}>{sec.body}</p>
      )}
      {sec.bullets && (
        <ul style={{ margin: sec.body ? "10px 0 0" : 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          {sec.bullets.map((b, i) => (
            <li key={i} style={{ fontSize: 14, lineHeight: 1.6, color: "#3f3f3f" }}>{b}</li>
          ))}
        </ul>
      )}
      {sec.table && (
        <div style={{ overflowX: "auto", marginTop: sec.body || sec.bullets ? 10 : 0 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", background: "var(--color-surface)", border: "1px solid var(--color-gray-200)", borderRadius: 10, fontSize: 13.5 }}>
            <thead>
              <tr>
                {sec.table.headers.map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", borderBottom: "2px solid var(--color-gray-200)", color: MUTED, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sec.table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: "8px 12px", borderBottom: i < sec.table!.rows.length - 1 ? "1px solid var(--color-gray-200)" : "none", color: j === 0 ? "#1a1a1a" : "#3f3f3f", fontWeight: j === 0 ? 600 : 400 }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sec.note && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: MUTED, lineHeight: 1.55 }}>{sec.note}</p>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: MUTED, fontWeight: 700, margin: "0 0 8px" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function StudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = getStudy(slug);
  if (!s) notFound();

  const maxBar = s.bars ? Math.max(...s.bars.map((b) => b.value)) : 0;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 80px" }}>
      <p style={{ margin: "0 0 14px" }}>
        <Link href="/admin/analysis" style={{ color: GREEN, fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
          ← Analysis Library
        </Link>
      </p>

      <header style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: MUTED, fontSize: 12.5 }}>
            {new Date(s.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          <span style={{ color: GREEN, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {s.status}
          </span>
        </div>
        <h1 style={{ fontSize: 28, margin: "4px 0 8px", fontWeight: 800, color: INK }}>{s.title}</h1>
        <p style={{ margin: 0, fontSize: 15.5, color: "#3f3f3f", lineHeight: 1.55, fontWeight: 600 }}>{s.headline}</p>
      </header>

      <Section title="The question">
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "#3f3f3f" }}>{s.question}</p>
      </Section>

      <Section title="How we answered it">
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "#3f3f3f" }}>{s.method}</p>
      </Section>

      <Section title="What the data said">
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
          {s.findings.map((f, i) => (
            <li key={i} style={{ fontSize: 14.5, lineHeight: 1.6, color: "#3f3f3f" }}>{f}</li>
          ))}
        </ul>
      </Section>

      {s.bars && (
        <Section title="The pattern">
          <div style={{ display: "grid", gap: 8, background: "var(--color-surface)", border: "1px solid var(--color-gray-200)", borderRadius: 12, padding: "18px 20px" }}>
            {s.bars.map((b) => (
              <div key={b.label} style={{ display: "grid", gridTemplateColumns: "130px 1fr 60px", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12.5, color: MUTED, textAlign: "right" }}>{b.label}</span>
                <div style={{ background: "var(--color-gray-100)", borderRadius: 4, height: 16 }}>
                  <div style={{ width: `${Math.round((b.value / maxBar) * 100)}%`, background: GREEN, height: 16, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{b.display}</span>
              </div>
            ))}
            {s.barCaption && (
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{s.barCaption}</p>
            )}
          </div>
        </Section>
      )}

      {s.chartHref && (
        <Section title="The chart">
          <iframe
            src={s.chartHref}
            title={`${s.title} — interactive chart`}
            style={{ width: "100%", height: 720, border: "1px solid var(--color-gray-200)", borderRadius: 12, background: "#fff" }}
          />
        </Section>
      )}

      {s.sections?.map((sec) => (
        <DeepDive key={sec.title} sec={sec} />
      ))}

      {s.caveats.length > 0 && (
        <Section title="Honest caveats">
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
            {s.caveats.map((c, i) => (
              <li key={i} style={{ fontSize: 13.5, lineHeight: 1.55, color: MUTED }}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="What it changed">
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
          {s.informed.map((d, i) => (
            <li key={i} style={{ fontSize: 14.5, lineHeight: 1.6, color: "#3f3f3f", fontWeight: 500 }}>{d}</li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
