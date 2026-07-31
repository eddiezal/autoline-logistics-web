/**
 * /admin/report — the monthly report for Ben (D2/D3 hybrid, July 2026 spec).
 *
 * Top: SCORECARD — strict numbers, this month vs last vs the baseline peak
 * month, with deltas. Fully automated from Firestore `orders` + the Google
 * Ads cost join; comparable month over month with zero assembly work.
 *
 * Below: THE MEMO — three short sections in Eddie's voice ("The short
 * version" / "The book" / "Next month"). The ONLY hand-written part of the
 * report: stored in Firestore `report_notes/{YYYY-MM}` and edited right on
 * this page (form hidden in print). Ten minutes of writing on top of an
 * auto-filled page.
 *
 * Print this page for the meeting — nav, form, and edit chrome disappear
 * via the print stylesheet.
 *
 * Auth: same /admin Basic-auth gate in src/proxy.ts (path matches /admin/*).
 */
import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebase/admin";
import { fetchAdsStats } from "@/lib/googleAds/client";
import { ACCOUNT_PHASE, PHASES, PHASE_NARRATIVE } from "@/lib/admin/targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PT = "America/Los_Angeles";

const GREEN = "#128A3A";
const INK = "var(--color-brand-ink)";
const MUTED = "var(--color-text-muted)";
const CARD: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-gray-200)",
  borderRadius: 12,
  padding: "18px 20px",
};
const TH: React.CSSProperties = {
  padding: "6px 12px 6px 0",
  fontWeight: 600,
  textAlign: "right",
  color: MUTED,
  whiteSpace: "nowrap",
};
const TD: React.CSSProperties = { padding: "8px 12px 8px 0", color: "#1a1a1a", textAlign: "right" };

/* ── PT month helpers ────────────────────────────────────────── */

/** "2026-07" in PT for any instant. */
function monthKeyPT(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: PT, year: "numeric", month: "2-digit" });
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", { month: "short" });
}
function monthLabelLong(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, "0")}`;
}
/** First instant of the PT month containing `d`, expressed as a UTC Date. */
function monthStartPT(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  // PT is UTC-7 in summer, UTC-8 in winter; use -07:00 for the current use
  // case (reports run monthly; an hour of slack at the boundary is fine for
  // ad-spend and lead counts).
  return new Date(`${key}-01T00:00:00-07:00`);
}
function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  return { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
}

/* ── Memo persistence (server action) ────────────────────────── */

async function saveMemo(formData: FormData): Promise<void> {
  "use server";
  const key = String(formData.get("monthKey") ?? "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(key)) return;
  const clip = (v: FormDataEntryValue | null) => String(v ?? "").slice(0, 4000);
  await getAdminDb()
    .collection("report_notes")
    .doc(key)
    .set(
      {
        p1: clip(formData.get("p1")),
        p2: clip(formData.get("p2")),
        p3: clip(formData.get("p3")),
        updatedAt: new Date(),
      },
      { merge: true },
    );
  revalidatePath("/admin/report");
}

/* ── Page ────────────────────────────────────────────────────── */

/**
 * Memo text renderer: blank-line-separated paragraphs; consecutive lines
 * starting with "- " become a real bulleted list. Keeps the editor a plain
 * textarea while the printed page reads like a document.
 */
function MemoText({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
  const bodyStyle = { fontSize: 13.5, lineHeight: 1.55, color: "#1a1a1a" } as const;
  return (
    <div>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim().length > 0);
        const isList = lines.length > 0 && lines.every((l) => l.trim().startsWith("- "));
        if (isList) {
          return (
            <ul key={i} style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              {lines.map((l, j) => (
                <li key={j} style={{ ...bodyStyle, marginBottom: 3 }}>
                  {l.trim().slice(2)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} style={{ ...bodyStyle, margin: i === 0 ? 0 : "8px 0 0", whiteSpace: "pre-wrap" }}>
            {block}
          </p>
        );
      })}
    </div>
  );
}

export default async function MonthlyReportPage() {
  const now = new Date();
  const curKey = monthKeyPT(now);
  const prevKey = prevMonthKey(curKey);

  /* Orders → per-month bookings/fees/avg */
  interface MonthAgg {
    bookings: number;
    fees: number;
  }
  const byMonth = new Map<string, MonthAgg>();
  let ordersLoaded = true;
  try {
    const snap = await getAdminDb().collection("orders").select("orderCreatedAt", "deposit").get();
    for (const doc of snap.docs) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const d: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const at: Date | null = d.orderCreatedAt?.toDate?.() ?? null;
      if (!at) continue;
      const k = monthKeyPT(at);
      const m = byMonth.get(k) ?? { bookings: 0, fees: 0 };
      m.bookings++;
      m.fees += Number(d.deposit) || 0;
      byMonth.set(k, m);
    }
  } catch {
    ordersLoaded = false;
  }

  const cur = byMonth.get(curKey) ?? { bookings: 0, fees: 0 };
  const prev = byMonth.get(prevKey) ?? { bookings: 0, fees: 0 };

  // Baseline = the highest-fee COMPLETE month before the current one (May
  // today; recomputes itself as the book grows).
  let baseKey: string | null = null;
  for (const [k, v] of byMonth) {
    if (k >= curKey) continue;
    if (baseKey === null || v.fees > (byMonth.get(baseKey)?.fees ?? 0)) baseKey = k;
  }
  const base = baseKey ? byMonth.get(baseKey)! : null;

  /* Ads spend + ad-tracked leads, current month */
  const monthStart = monthStartPT(curKey);
  const ads = await fetchAdsStats(monthStart);
  const adSpend =
    ads.state === "ok" ? ads.stats.campaigns.reduce((s, c) => s + c.costDollars, 0) : null;

  let adLeads: number | null = null;
  try {
    const snap = await getAdminDb()
      .collection("leads")
      .where("createdAt", ">=", monthStart)
      .select("attribution.gclid", "attribution.utmSource", "attribution.utmMedium", "contact.email")
      .get();
    let n = 0;
    for (const doc of snap.docs) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const d: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const email = String(d.contact?.email ?? "");
      if (/eddiezal28@gmail\.com|zaldivarlabs\.com/i.test(email)) continue;
      const a = d.attribution ?? {};
      const paid =
        (typeof a.gclid === "string" && a.gclid.trim() !== "") ||
        (String(a.utmSource ?? "").toLowerCase() === "google" &&
          ["cpc", "ppc", "paid"].includes(String(a.utmMedium ?? "").toLowerCase()));
      if (paid) n++;
    }
    adLeads = n;
  } catch {
    /* leads unavailable — row shows em dash */
  }

  /* Memo */
  let memo: { p1: string; p2: string; p3: string } = { p1: "", p2: "", p3: "" };
  try {
    const doc = await getAdminDb().collection("report_notes").doc(curKey).get();
    if (doc.exists) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const d: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
      memo = { p1: String(d.p1 ?? ""), p2: String(d.p2 ?? ""), p3: String(d.p3 ?? "") };
    }
  } catch {
    /* renders empty */
  }

  const dayOfMonth = Number(
    now.toLocaleDateString("en-US", { timeZone: PT, day: "numeric" }),
  );
  const partial = dayOfMonth < daysInMonth(curKey);
  const star = partial ? "*" : "";

  const delta = (curV: number, prevV: number): string => {
    if (prevV === 0) return curV > 0 ? "new" : "—";
    const d = Math.round(((curV - prevV) / prevV) * 100);
    return (d > 0 ? "+" : "") + d + "%" + star;
  };

  interface Row {
    label: string;
    cur: string;
    prev: string;
    base: string;
    delta: string;
  }
  const rows: Row[] = [
    {
      label: "Bookings",
      cur: String(cur.bookings) + star,
      prev: String(prev.bookings),
      base: base ? String(base.bookings) : "—",
      delta: delta(cur.bookings, prev.bookings),
    },
    {
      label: "Fees",
      cur: money(cur.fees) + star,
      prev: money(prev.fees),
      base: base ? money(base.fees) : "—",
      delta: delta(cur.fees, prev.fees),
    },
    {
      label: "Avg fee / order",
      cur: cur.bookings ? money(cur.fees / cur.bookings) : "—",
      prev: prev.bookings ? money(prev.fees / prev.bookings) : "—",
      base: base && base.bookings ? money(base.fees / base.bookings) : "—",
      delta:
        cur.bookings && prev.bookings
          ? delta(cur.fees / cur.bookings, prev.fees / prev.bookings)
          : "—",
    },
    {
      label: "Ad spend",
      cur: adSpend !== null ? money(adSpend) + star : "—",
      prev: "—",
      base: "—",
      delta: adSpend !== null && adSpend > 0 ? "new" : "—",
    },
    {
      label: "Ad-tracked leads",
      cur: adLeads !== null ? String(adLeads) + star : "—",
      prev: "—",
      base: "—",
      delta: adLeads !== null && adLeads > 0 ? "new" : "—",
    },
  ];

  const memoSections: { heading: string; field: "p1" | "p2" | "p3"; text: string; hint: string }[] = [
    {
      heading: "The short version",
      field: "p1",
      text: memo.p1,
      hint: "Two sentences: the one thing that changed this month, and why it matters to Ben.",
    },
    {
      heading: "The book",
      field: "p2",
      text: memo.p2,
      hint: "What the bookings/fees numbers mean in context — seasonality, mix, anything the scorecard can't say alone.",
    },
    {
      heading: "Next month",
      field: "p3",
      text: memo.p3,
      hint: "What's teed up: campaigns, features, outreach lists. Concrete, dated where possible.",
    },
  ];

  const updatedAt = now.toLocaleString("en-US", {
    timeZone: PT,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 64px" }}>
      {/* Print stylesheet: the report prints as the deliverable — no chrome. */}
      <style>{`@media print {
        .no-print { display: none !important; }
        main { padding: 0 !important; }
        body { background: #fff !important; }
      }`}</style>

      <div className="no-print" style={{ marginBottom: 14 }}>
        <a href="/admin" style={{ fontSize: 13, fontWeight: 600, color: GREEN, textDecoration: "none" }}>
          ← Dashboard
        </a>
      </div>

      <header style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: GREEN }}>
          Auto Line Logistics · monthly note · Zaldivar Labs → Ben
        </div>
        <h1 style={{ margin: "4px 0 2px", fontSize: 26, letterSpacing: "-0.02em", color: INK }}>
          {monthLabelLong(curKey)}
          {partial ? ` · through the ${dayOfMonth}${ordinal(dayOfMonth)}` : ""}
        </h1>
        <div style={{ fontSize: 12, color: MUTED }}>Prepared {updatedAt} PT · numbers live from ProABD orders + Google Ads</div>
        <div
          style={{
            marginTop: 8,
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "#1a1a1a",
            border: "1px solid var(--color-gray-200)",
            borderLeft: `4px solid ${GREEN}`,
            borderRadius: 8,
            padding: "8px 12px",
            background: "var(--color-surface)",
          }}
        >
          <strong>Paid search is in Phase {ACCOUNT_PHASE} of 3 ({PHASES[ACCOUNT_PHASE - 1].title.toLowerCase()}):</strong>{" "}
          {PHASE_NARRATIVE[ACCOUNT_PHASE]}{" "}
          {ACCOUNT_PHASE === 1 &&
            "This month's paid goals are data goals — click volume, instrumentation coverage, and progress toward the 30-actions-per-campaign gate — not cost per lead."}
        </div>
      </header>

      {/* ── Scorecard (D3) ── */}
      <section style={{ ...CARD, marginBottom: 16 }}>
        {!ordersLoaded && (
          <div style={{ fontSize: 12.5, color: "#92400e", marginBottom: 10 }}>
            Orders collection unavailable — scorecard is incomplete.
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: "left" }} />
              <th style={{ ...TH, color: INK }}>
                {monthLabel(curKey)}
                {partial ? ` (thru ${dayOfMonth})` : ""}
              </th>
              <th style={TH}>{monthLabel(prevKey)}</th>
              <th style={TH}>{baseKey ? `${monthLabel(baseKey)} (peak)` : "Peak"}</th>
              <th style={TH}>Δ vs {monthLabel(prevKey)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} style={{ borderTop: "1px solid var(--color-gray-100)" }}>
                <td style={{ ...TD, textAlign: "left", fontWeight: 700 }}>{r.label}</td>
                <td style={{ ...TD, fontWeight: 800, color: INK }}>{r.cur}</td>
                <td style={TD}>{r.prev}</td>
                <td style={{ ...TD, color: MUTED }}>{r.base}</td>
                <td style={{ ...TD, color: r.delta.startsWith("+") ? "#065f46" : r.delta.startsWith("-") ? "#92400e" : MUTED, fontWeight: 700 }}>
                  {r.delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {partial && (
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 10 }}>
            *Partial month — {dayOfMonth} of {daysInMonth(curKey)} days. Full-month comparison
            lands in the final report. Fees are booking deposits (Auto Line revenue), not
            customer gross.
          </div>
        )}
      </section>

      {/* ── The memo (D2) ── */}
      <section style={{ ...CARD, marginBottom: 16 }}>
        {memoSections.map((s) => (
          <div key={s.field} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginBottom: 3 }}>{s.heading}</div>
            {s.text ? (
              <MemoText text={s.text} />
            ) : (
              <p className="no-print" style={{ margin: 0, fontSize: 12.5, fontStyle: "italic", color: MUTED }}>
                Not written yet — use the editor below. ({s.hint})
              </p>
            )}
          </div>
        ))}
        <div style={{ fontSize: 11.5, color: MUTED }}>— Eddie, Zaldivar Labs</div>
      </section>

      {/* ── Editor (screen only) ── */}
      <details className="no-print" style={{ ...CARD }}>
        <summary style={{ fontSize: 13, fontWeight: 700, color: INK, cursor: "pointer" }}>
          Edit this month&apos;s memo
        </summary>
        <form action={saveMemo} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="hidden" name="monthKey" value={curKey} />
          {memoSections.map((s) => (
            <label key={s.field} style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>
              {s.heading}
              <div style={{ fontSize: 11.5, fontWeight: 400, color: MUTED, margin: "2px 0 4px" }}>{s.hint}</div>
              <textarea
                name={s.field}
                defaultValue={s.text}
                rows={4}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontSize: 13,
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                  padding: "8px 10px",
                  border: "1px solid var(--color-gray-200)",
                  borderRadius: 8,
                  resize: "vertical",
                }}
              />
            </label>
          ))}
          <button
            type="submit"
            style={{
              alignSelf: "flex-start",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              background: GREEN,
              border: "none",
              borderRadius: 999,
              padding: "8px 18px",
              cursor: "pointer",
            }}
          >
            Save memo
          </button>
          <div style={{ fontSize: 11.5, color: MUTED }}>
            Saved to Firestore per month ({curKey}) — next month starts blank while this month&apos;s
            stays on record. Print the page (Ctrl/Cmd-P) for the meeting; this editor and the nav
            disappear in print.
          </div>
        </form>
      </details>
    </main>
  );
}
