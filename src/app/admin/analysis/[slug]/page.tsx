/**
 * /admin/analysis/[slug] — one study, fully written up.
 *
 * Sections: the question · how we answered it · findings · honest caveats ·
 * what it changed. Interactive charts render in an iframe served from inside
 * the /admin auth boundary (never /public). Registry: analysisLibrary.ts.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudy, STUDIES, type DeepSection, type Funnel } from "@/lib/admin/analysisLibrary";
import { getRegistryEntry } from "@/lib/admin/decisionRegistry";
import { getChartSrcdoc } from "@/lib/admin/chartSrcdoc";

export const runtime = "nodejs";

const GREEN = "#128A3A";
const INK = "#1a1a1a";
const MUTED = "var(--color-text-muted)";
const LEAK_RED = "#C0392B";

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

/**
 * Waterfall drop-off funnel. Geometry rule: every bar shares stage[0]'s scale,
 * and each leak bar spans exactly the width REMOVED between one stage and the
 * next (left edge = next stage's width), so the subtraction is drawn, not
 * implied. Data contract: stages[i].count = stages[i+1].count + leaks[i].count.
 */
function FunnelBlock({ funnel }: { funnel: Funnel }) {
  const full = funnel.stages[0].count;
  const rows: React.ReactNode[] = [];

  funnel.stages.forEach((st, i) => {
    const w = (st.count / full) * 100;
    rows.push(
      <div key={`s${i}`} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: MUTED, textAlign: "right" }}>{st.label}</span>
        <div style={{ position: "relative", height: 22 }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: 22, width: `${w}%`, background: GREEN, borderRadius: "0 4px 4px 0" }} />
          <span style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", whiteSpace: "nowrap", fontSize: 12.5, color: INK, ...(w > 55 ? { right: `${100 - w + 1.2}%`, color: "#fff" } : { left: `calc(${w}% + 8px)` }) }}>
            <strong>{st.count.toLocaleString()}</strong>{st.detail ? ` · ${st.detail}` : ""}
          </span>
        </div>
      </div>,
    );

    const leak = funnel.leaks[i];
    if (!leak) return;
    const next = funnel.stages[i + 1];
    const leftPct = (next.count / full) * 100;
    const widthPct = ((st.count - next.count) / full) * 100;
    const reg = leak.registrySlug ? getRegistryEntry(leak.registrySlug) : undefined;
    rows.push(
      <div key={`l${i}`} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, padding: "2px 0 10px" }}>
        <span />
        <div>
          <div style={{ position: "relative", height: 13 }}>
            <div style={{ position: "absolute", left: `${leftPct}%`, top: 0, height: 13, width: `${widthPct}%`, background: LEAK_RED, opacity: 0.85, borderRadius: "0 3px 3px 0" }} />
          </div>
          <p style={{ margin: "5px 0 0", fontSize: 12.5 }}>
            <strong style={{ color: LEAK_RED, letterSpacing: 0.4 }}>{leak.code}</strong>
            <span style={{ color: INK }}> · {leak.count.toLocaleString()} visits · {leak.share}</span>
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
            {leak.note}
            {reg && (
              <>
                {" "}
                <Link href={`/admin/analysis#registry-${reg.slug}`} style={{ color: GREEN, fontWeight: 600 }}>
                  Decision rule: {reg.title} →
                </Link>
              </>
            )}
          </p>
        </div>
      </div>,
    );
  });

  const feeder = funnel.feeder;
  const feederReg = feeder?.registrySlug ? getRegistryEntry(feeder.registrySlug) : undefined;
  const feederColor = (kind: string) => (kind === "continues" ? GREEN : kind === "other" ? "#9ca3af" : LEAK_RED);

  return (
    <Section title="Where the visits go">
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-gray-200)", borderRadius: 12, padding: "18px 20px" }}>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>{funnel.subtitle}</p>
        <div style={{ display: "grid", gap: 8 }}>{rows}</div>

        {feeder && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--color-gray-200)", paddingTop: 14 }}>
            <p style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 700, color: INK }}>
              {feeder.label} · {feeder.total.toLocaleString()} visits saw a price
            </p>
            <div style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", gap: 2 }}>
              {feeder.classes.map((c) => (
                <div key={c.label} style={{ flexGrow: c.count, flexBasis: 0, background: feederColor(c.kind) }} title={`${c.label}: ${c.count} of ${feeder.total}`} />
              ))}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#3f3f3f" }}>
              {feeder.classes.map((c, i) => (
                <span key={c.label}>
                  {i > 0 && " · "}
                  <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: feederColor(c.kind), marginRight: 5, verticalAlign: "-1px" }} />
                  <strong>{c.count}</strong> {c.label}
                </span>
              ))}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: MUTED, lineHeight: 1.5 }}>
              {feeder.note}
              {feederReg && (
                <>
                  {" "}
                  <Link href={`/admin/analysis#registry-${feederReg.slug}`} style={{ color: GREEN, fontWeight: 600 }}>
                    Decision rule: {feederReg.title} →
                  </Link>
                </>
              )}
            </p>
          </div>
        )}
      </div>
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
      <p style={{ margin: "0 0 14px", display: "flex", gap: 14 }}>
        <Link href="/admin/analysis" style={{ color: GREEN, fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
          ← Analysis Library
        </Link>
        <Link href="/admin" style={{ color: "var(--color-text-muted)", fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
          Dashboard
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

      {s.funnel && <FunnelBlock funnel={s.funnel} />}

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
          {/* srcdoc embed: immune to the site's anti-framing headers (no
              HTTP fetch). The route stays available for full-screen view. */}
          <iframe
            srcDoc={getChartSrcdoc(s.slug) ?? undefined}
            src={getChartSrcdoc(s.slug) ? undefined : s.chartHref}
            title={`${s.title} — interactive chart`}
            style={{ width: "100%", height: 720, border: "1px solid var(--color-gray-200)", borderRadius: 12, background: "#fff" }}
          />
          <p style={{ margin: "8px 0 0", fontSize: 12.5 }}>
            <a href={s.chartHref} target="_blank" rel="noreferrer" style={{ color: GREEN, fontWeight: 600 }}>
              Open chart full screen →
            </a>
          </p>
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
