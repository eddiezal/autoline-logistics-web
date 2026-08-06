/**
 * /admin/changes — the Work Log.
 *
 * A running, client-readable record of everything shipped on the website
 * and the marketing machine. v1.1 design (2026-08-06 critique pass):
 *  - ONE organizing system: merged month summary + category filter pills
 *  - Outcomes elevated above activity counts (impact notes surface in the
 *    month summary, not just inside entries)
 *  - Date-grouped rows with dividers, not card-per-entry (scan rhythm)
 *  - Color rules: GREEN is reserved for outcomes + active state; categories
 *    use a restrained fixed palette
 *  - Scope-item chips (Item A–E) are INTERNAL-ONLY (?all=1) — they read as
 *    database values to a client; they exist for our obligations tracking
 *
 * Ben sees this live. Entries are written for his eyes; internal entries
 * (visibility:"internal") render only with ?all=1.
 *
 * Data: Firestore `site_changes` (src/lib/admin/siteChanges.ts). Entries
 * added via scripts/add-site-change.mjs or the weekly curation pass.
 *
 * Query params:  ?m=YYYY-MM (summary month) · ?cat= filter · ?all=1 internal
 * Auth: /admin Basic-auth gate in src/proxy.ts.
 */
import Link from "next/link";
import {
  getSiteChanges,
  CATEGORY_LABELS,
  SCOPE_LABELS,
  type ChangeCategory,
  type SiteChange,
} from "@/lib/admin/siteChanges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PT = "America/Los_Angeles";
const GREEN = "#128A3A"; // outcomes + active state ONLY
const INK = "#1a1a1a";
const MUTED = "var(--color-text-muted)";

// Restrained category palette: blue = content/product, orange = paid media,
// purple = engineering/improvements, teal = analytics, rose = local presence,
// gray = general/infra. Green deliberately absent (reserved for outcomes).
const CATEGORY_COLORS: Record<ChangeCategory, string> = {
  "new-page": "#2563EB",
  "content-update": "#2563EB",
  improvement: "#7C3AED",
  fix: "#7C3AED",
  ads: "#C2410C",
  tracking: "#0E7490",
  "local-gbp": "#9D174D",
  infra: "#4B5563",
};

function currentMonthPT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: PT, year: "numeric", month: "2-digit" });
}
function monthLabelLong(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

export default async function ChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; cat?: string; all?: string }>;
}) {
  const sp = await searchParams;
  const showInternal = sp.all === "1";
  const focusMonth = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : currentMonthPT();
  const catFilter = (sp.cat ?? "") as ChangeCategory | "";

  const all = await getSiteChanges();
  const visible = all.filter((c) => showInternal || c.visibility === "client");

  // Category counts across the whole visible feed (pills filter the feed)
  const catCounts = new Map<ChangeCategory, number>();
  for (const c of visible) catCounts.set(c.category, (catCounts.get(c.category) ?? 0) + 1);

  // Focus-month outcomes + scope tally (scope = internal view only)
  const monthEntries = visible.filter((c) => c.date.startsWith(focusMonth));
  const monthOutcomes = monthEntries.filter((c) => c.impactNote).map((c) => c.impactNote!);
  const scopeCounts = new Map<string, number>();
  for (const c of monthEntries) {
    if (c.scopeItem !== "-") scopeCounts.set(c.scopeItem, (scopeCounts.get(c.scopeItem) ?? 0) + 1);
  }

  // Feed: filter, group by month, then by date inside the month
  const feed = catFilter ? visible.filter((c) => c.category === catFilter) : visible;
  const byMonth = new Map<string, Map<string, SiteChange[]>>();
  for (const c of feed) {
    const mk = c.date.slice(0, 7);
    if (!byMonth.has(mk)) byMonth.set(mk, new Map());
    const days = byMonth.get(mk)!;
    if (!days.has(c.date)) days.set(c.date, []);
    days.get(c.date)!.push(c);
  }

  const pillLink = (cat: ChangeCategory | "") => {
    const params = new URLSearchParams();
    if (cat) params.set("cat", cat);
    if (showInternal) params.set("all", "1");
    if (sp.m) params.set("m", sp.m);
    const qs = params.toString();
    return `/admin/changes${qs ? `?${qs}` : ""}`;
  };

  const pillStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: "5px 13px",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    border: active ? `1px solid ${GREEN}` : "1px solid var(--color-gray-200)",
    background: active ? GREEN : "var(--color-surface)",
    color: active ? "#fff" : "#3f3f3f",
  });

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 80px" }}>
      <header style={{ marginBottom: 20 }}>
        <p style={{ color: GREEN, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
          Auto Line Logistics
        </p>
        <h1 style={{ fontSize: 30, margin: "4px 0 6px", fontWeight: 800 }}>Work Log</h1>
        <p style={{ color: MUTED, margin: 0, fontSize: 15, lineHeight: 1.5 }}>
          What we shipped, what changed, and how it improved the business.
        </p>
      </header>

      {/* ── Month summary: one line + outcomes ── */}
      <section style={{ marginBottom: 18 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: INK }}>
          {monthLabelLong(focusMonth)} · {monthEntries.length}{" "}
          {monthEntries.length === 1 ? "update" : "updates"} shipped
        </p>
        {monthOutcomes.length > 0 && (
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
            {monthOutcomes.slice(0, 4).map((note, i) => (
              <li key={i} style={{ color: GREEN, fontSize: 13.5, fontWeight: 600 }}>
                ✓ {note}
              </li>
            ))}
          </ul>
        )}
        {showInternal && scopeCounts.size > 0 && (
          <p style={{ margin: "8px 0 0", color: MUTED, fontSize: 12.5 }}>
            Scope:{" "}
            {[...scopeCounts.entries()]
              .sort()
              .map(([s, n]) => `${SCOPE_LABELS[s as keyof typeof SCOPE_LABELS]} ×${n}`)
              .join(" · ")}
          </p>
        )}
      </section>

      {/* ── Single filter row: pills with counts ── */}
      <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 26 }}>
        <Link href={pillLink("")} style={pillStyle(catFilter === "")}>
          All {visible.length}
        </Link>
        {(Object.keys(CATEGORY_LABELS) as ChangeCategory[])
          .filter((cat) => (catCounts.get(cat) ?? 0) > 0)
          .map((cat) => {
            const active = catFilter === cat;
            return (
              <Link key={cat} href={pillLink(cat)} style={pillStyle(active)}>
                {!active && (
                  <span
                    aria-hidden
                    style={{ width: 7, height: 7, borderRadius: 999, background: CATEGORY_COLORS[cat], display: "inline-block" }}
                  />
                )}
                {CATEGORY_LABELS[cat]} {catCounts.get(cat)}
              </Link>
            );
          })}
      </nav>

      {/* ── Feed: month sections → date groups → divider rows ── */}
      {[...byMonth.entries()].map(([month, days]) => {
        const monthTotal = [...days.values()].reduce((n, arr) => n + arr.length, 0);
        return (
          <section key={month} style={{ marginBottom: 34 }}>
            <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1.2, color: MUTED, fontWeight: 700, margin: "0 0 4px" }}>
              {monthLabelLong(month)} · {monthTotal}
            </h2>
            {[...days.entries()].map(([date, entries]) => (
              <div key={date} style={{ borderTop: "1px solid var(--color-gray-200)", padding: "12px 0 4px" }}>
                <p style={{ margin: "0 0 2px", fontSize: 11.5, fontWeight: 700, letterSpacing: 0.8, color: MUTED }}>
                  {dayLabel(date)}
                </p>
                {entries.map((c, i) => (
                  <article key={c.id} style={{ padding: "8px 0 10px", borderTop: i > 0 ? "1px dashed var(--color-gray-200)" : "none", opacity: c.visibility === "internal" ? 0.65 : 1 }}>
                    <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: CATEGORY_COLORS[c.category] }}>
                      {CATEGORY_LABELS[c.category]}
                      {showInternal && c.scopeItem !== "-" && (
                        <span style={{ color: MUTED, fontWeight: 600, marginLeft: 8, letterSpacing: 0.3, textTransform: "none" }}>
                          {SCOPE_LABELS[c.scopeItem]}
                        </span>
                      )}
                      {c.visibility === "internal" && (
                        <span style={{ color: "#B45309", marginLeft: 8 }}>INTERNAL</span>
                      )}
                    </p>
                    <h3 style={{ margin: "3px 0 0", fontSize: 16.5, fontWeight: 700, color: INK, lineHeight: 1.35 }}>
                      {c.link ? (
                        <a href={c.link} style={{ color: "inherit" }}>
                          {c.title}
                        </a>
                      ) : (
                        c.title
                      )}
                    </h3>
                    {c.detail && (
                      <p style={{ margin: "4px 0 0", color: "#52525b", fontSize: 13.5, lineHeight: 1.55, maxWidth: 680 }}>
                        {c.detail}
                      </p>
                    )}
                    {c.impactNote && (
                      <p style={{ margin: "5px 0 0", color: GREEN, fontSize: 13, fontWeight: 600 }}>
                        ✓ {c.impactNote}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ))}
          </section>
        );
      })}

      {feed.length === 0 && (
        <p style={{ color: MUTED }}>No entries yet. Seed with scripts/seed-site-changes.mjs.</p>
      )}
    </main>
  );
}
