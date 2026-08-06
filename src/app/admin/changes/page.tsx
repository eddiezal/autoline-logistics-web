/**
 * /admin/changes — the Work Log.
 *
 * A running, client-readable record of everything shipped on the website
 * and the marketing machine: new pages, content updates, fixes, ads
 * management, tracking, and local work. Each entry is tagged to the
 * retainer scope item it fulfills, so this page doubles as the
 * obligations tracker ("Item E this month: 3 entries").
 *
 * Ben sees this live. Entries are written in plain English for him;
 * internal-only entries (visibility:"internal") render only with ?all=1.
 *
 * Data: Firestore `site_changes` (see src/lib/admin/siteChanges.ts).
 * Entries are added via scripts/add-site-change.mjs or the weekly
 * curation pass — no write UI by design.
 *
 * Query params:
 *   ?m=2026-08      focus month for the rollup tiles (default: current PT month)
 *   ?cat=new-page   filter the feed to one category
 *   ?all=1          include internal entries (greyed, tagged)
 *
 * Auth: /admin Basic-auth gate in src/proxy.ts.
 */
import Link from "next/link";
import {
  getSiteChanges,
  CATEGORY_LABELS,
  SCOPE_LABELS,
  type ChangeCategory,
  type ScopeItem,
  type SiteChange,
} from "@/lib/admin/siteChanges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PT = "America/Los_Angeles";
const GREEN = "#128A3A";
const MUTED = "var(--color-text-muted)";
const CARD: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-gray-200)",
  borderRadius: 12,
  padding: "18px 20px",
};

function currentMonthPT(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: PT,
    year: "numeric",
    month: "2-digit",
  });
}

function monthLabelLong(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const CATEGORY_COLORS: Record<ChangeCategory, string> = {
  "new-page": GREEN,
  "content-update": "#2563EB",
  improvement: "#7C3AED",
  fix: "#B45309",
  ads: "#C2410C",
  tracking: "#0E7490",
  "local-gbp": "#BE185D",
  infra: "#4B5563",
};

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

  // ── Focus-month rollup ─────────────────────────────────────────
  const monthEntries = visible.filter((c) => c.date.startsWith(focusMonth));
  const catCounts = new Map<ChangeCategory, number>();
  const scopeCounts = new Map<ScopeItem, number>();
  for (const c of monthEntries) {
    catCounts.set(c.category, (catCounts.get(c.category) ?? 0) + 1);
    scopeCounts.set(c.scopeItem, (scopeCounts.get(c.scopeItem) ?? 0) + 1);
  }

  // ── Feed grouped by month ──────────────────────────────────────
  const feed = catFilter
    ? visible.filter((c) => c.category === catFilter)
    : visible;
  const byMonth = new Map<string, SiteChange[]>();
  for (const c of feed) {
    const key = c.date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(c);
  }

  const catLink = (cat: ChangeCategory | "") => {
    const params = new URLSearchParams();
    if (cat) params.set("cat", cat);
    if (showInternal) params.set("all", "1");
    if (sp.m) params.set("m", sp.m);
    const qs = params.toString();
    return `/admin/changes${qs ? `?${qs}` : ""}`;
  };

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px 80px" }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ color: GREEN, fontWeight: 700, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
          Auto Line Logistics
        </p>
        <h1 style={{ fontSize: 30, margin: "4px 0 6px", fontWeight: 800 }}>Work Log</h1>
        <p style={{ color: MUTED, margin: 0, fontSize: 15, lineHeight: 1.5 }}>
          Everything shipped on the website and the marketing machine, newest
          first. Each entry is tagged to the work area it fulfills.
        </p>
      </header>

      {/* ── Month rollup ── */}
      <section style={{ ...CARD, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 12px", color: MUTED, fontWeight: 600 }}>
          {monthLabelLong(focusMonth)} — {monthEntries.length}{" "}
          {monthEntries.length === 1 ? "entry" : "entries"}
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {[...catCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([cat, n]) => (
              <span
                key={cat}
                style={{
                  border: `1px solid ${CATEGORY_COLORS[cat]}33`,
                  color: CATEGORY_COLORS[cat],
                  background: `${CATEGORY_COLORS[cat]}0d`,
                  borderRadius: 999,
                  padding: "4px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {n} {CATEGORY_LABELS[cat]}
              </span>
            ))}
          {monthEntries.length === 0 && (
            <span style={{ color: MUTED, fontSize: 14 }}>
              Nothing logged yet this month.
            </span>
          )}
        </div>
        {scopeCounts.size > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[...scopeCounts.entries()]
              .sort()
              .map(([scope, n]) => (
                <span key={scope} style={{ color: MUTED, fontSize: 12.5, border: "1px solid var(--color-gray-200)", borderRadius: 6, padding: "3px 8px" }}>
                  {SCOPE_LABELS[scope]}: {n}
                </span>
              ))}
          </div>
        )}
      </section>

      {/* ── Category filter ── */}
      <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20, fontSize: 13 }}>
        <Link
          href={catLink("")}
          style={{ fontWeight: catFilter === "" ? 700 : 400, color: catFilter === "" ? GREEN : MUTED, textDecoration: "none" }}
        >
          All
        </Link>
        {(Object.keys(CATEGORY_LABELS) as ChangeCategory[]).map((cat) => (
          <Link
            key={cat}
            href={catLink(cat)}
            style={{ fontWeight: catFilter === cat ? 700 : 400, color: catFilter === cat ? CATEGORY_COLORS[cat] : MUTED, textDecoration: "none" }}
          >
            {CATEGORY_LABELS[cat]}
          </Link>
        ))}
      </nav>

      {/* ── Feed ── */}
      {[...byMonth.entries()].map(([month, entries]) => (
        <section key={month} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: MUTED, borderBottom: "1px solid var(--color-gray-200)", paddingBottom: 6, marginBottom: 12 }}>
            {monthLabelLong(month)}
          </h2>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {entries.map((c) => (
              <li
                key={c.id}
                style={{
                  ...CARD,
                  padding: "14px 16px",
                  opacity: c.visibility === "internal" ? 0.6 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ color: MUTED, fontSize: 12.5, minWidth: 46 }}>{dayLabel(c.date)}</span>
                  <span
                    style={{
                      color: CATEGORY_COLORS[c.category],
                      fontSize: 11.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {CATEGORY_LABELS[c.category]}
                  </span>
                  {c.scopeItem !== "-" && (
                    <span style={{ color: MUTED, fontSize: 11.5 }}>{SCOPE_LABELS[c.scopeItem]}</span>
                  )}
                  {c.visibility === "internal" && (
                    <span style={{ color: "#B45309", fontSize: 11.5, fontWeight: 700 }}>INTERNAL</span>
                  )}
                </div>
                <p style={{ margin: "6px 0 0", fontWeight: 600, fontSize: 15 }}>
                  {c.link ? (
                    <a href={c.link} style={{ color: "inherit" }}>
                      {c.title}
                    </a>
                  ) : (
                    c.title
                  )}
                </p>
                {c.detail && (
                  <p style={{ margin: "4px 0 0", color: "#3f3f3f", fontSize: 13.5, lineHeight: 1.5 }}>{c.detail}</p>
                )}
                {c.impactNote && (
                  <p style={{ margin: "6px 0 0", color: GREEN, fontSize: 12.5, fontWeight: 600 }}>→ {c.impactNote}</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}

      {feed.length === 0 && (
        <p style={{ color: MUTED }}>No entries yet. Seed with scripts/seed-site-changes.mjs.</p>
      )}
    </main>
  );
}
