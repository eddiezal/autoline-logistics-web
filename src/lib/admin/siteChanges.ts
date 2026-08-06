/**
 * Work Ledger data layer — Firestore `site_changes` collection.
 *
 * The ledger is the proof-of-work surface for /admin/changes: every website
 * change, content update, and account optimization becomes a plain-English
 * entry tagged to the retainer scope item it fulfills. Spec:
 * claude/work-ledger-and-freshness-spec.md (project docs, 2026-08-06).
 *
 * VISIBILITY RULE (exhibit rule, Eddie 8/4): Ben sees /admin live. Entries
 * default to client-visible and are written for his eyes. Internal entries
 * (errors we created and fixed, config cleanup) carry visibility:"internal"
 * and only render with ?all=1.
 *
 * Writes happen via scripts (scripts/add-site-change.mjs, seed script) or a
 * weekly curation pass — there is deliberately no write UI in v1.
 */
import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";

export type ChangeCategory =
  | "new-page"
  | "content-update"
  | "improvement"
  | "fix"
  | "ads"
  | "tracking"
  | "local-gbp"
  | "infra";

export type ScopeItem = "A" | "B" | "C" | "D" | "E" | "Lab" | "-";

export interface SiteChange {
  id: string;
  /** PT calendar date, "YYYY-MM-DD" — sorting key. */
  date: string;
  title: string;
  detail?: string;
  category: ChangeCategory;
  scopeItem: ScopeItem;
  /** Site-relative link to the thing that changed, when it has a URL. */
  link?: string;
  /** Added later, honestly: "indexed in 4 days", "post-deploy check 69/69". */
  impactNote?: string;
  visibility: "client" | "internal";
}

export const CATEGORY_LABELS: Record<ChangeCategory, string> = {
  "new-page": "New page",
  "content-update": "Content update",
  improvement: "Improvement",
  fix: "Fix",
  ads: "Ads management",
  tracking: "Tracking & analytics",
  "local-gbp": "Local & Business Profile",
  infra: "Infrastructure",
};

// Scope labels: A/B/E wording is from the Amendment No. 3 drafts; C/D stay
// generic until Eddie confirms the signed wording. "-" = general/pre-retainer.
export const SCOPE_LABELS: Record<ScopeItem, string> = {
  A: "Item A — Customer status texts",
  B: "Item B — Phone system",
  C: "Item C",
  D: "Item D",
  E: "Item E — Customer portal",
  Lab: "Conversion Lab",
  "-": "General",
};

export async function getSiteChanges(max = 500): Promise<SiteChange[]> {
  const db = getAdminDb();
  const snap = await db
    .collection("site_changes")
    .orderBy("date", "desc")
    .limit(max)
    .get();
  return snap.docs.map((d) => {
    const raw = d.data();
    return {
      id: d.id,
      date: String(raw.date ?? ""),
      title: String(raw.title ?? ""),
      detail: raw.detail ? String(raw.detail) : undefined,
      category: (raw.category ?? "improvement") as ChangeCategory,
      scopeItem: (raw.scopeItem ?? "-") as ScopeItem,
      link: raw.link ? String(raw.link) : undefined,
      impactNote: raw.impactNote ? String(raw.impactNote) : undefined,
      visibility: raw.visibility === "internal" ? "internal" : "client",
    };
  });
}
