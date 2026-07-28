/**
 * P4 "unique lead" identity resolution — metric-contract.md §3/§7.1,
 * ratified 2026-07-28.
 *
 * Rule: lead records sharing a normalized phone OR email within a 30-day
 * window collapse into one lead entity. The earliest record is the origin;
 * every touch keeps its own channel. Dedup happens at READ time — nothing
 * in Firestore is merged or destroyed.
 *
 * Identity is transitive (union-find): if record B shares a phone with A
 * and an email with C, then A, B, C are one entity — this is exactly the
 * "form first, calls later" and "typo'd email on the second try" reality
 * of lead flow.
 *
 * The 30-day collapse window is ROLLING per key: each new touch on a key
 * extends that key's window. A customer returning 40+ quiet days later is
 * a NEW lead entity (repeat customers are a Business-view concept, not a
 * lead-dedup concept).
 */

/** US phone → 10-digit key. Strips punctuation and a leading country 1. */
export function normalizePhoneKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits.length === 10 ? digits : null;
}

/** Email → lowercase-trimmed key; rejects non-email shapes. */
export function normalizeEmailKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export interface IdentityTouch {
  phoneKey: string | null;
  emailKey: string | null;
  /** Record creation time. */
  t: Date;
}

export interface LeadEntity<T> {
  /** Earliest touch — owns the entity's channel-of-origin. */
  origin: T;
  /** All touches, ascending by time (origin first). */
  touches: T[];
}

const DEFAULT_WINDOW_MS = 30 * 86_400_000;

/**
 * Collapse lead records into unique lead entities (P4).
 * O(n log n); safe on thousands of records at request time.
 */
export function dedupeLeads<T extends IdentityTouch>(
  rows: T[],
  collapseWindowMs: number = DEFAULT_WINDOW_MS,
): LeadEntity<T>[] {
  const sorted = rows
    .slice()
    .sort((a, b) => a.t.getTime() - b.t.getTime());

  // Union-find over row indices.
  const parent = sorted.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    // path compression
    let c = i;
    while (parent[c] !== c) {
      const next = parent[c];
      parent[c] = r;
      c = next;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  // key → { idx of last touch carrying this key, lastAt } (rolling window)
  const lastByKey = new Map<string, { idx: number; lastAt: number }>();
  sorted.forEach((row, i) => {
    const at = row.t.getTime();
    for (const key of [
      row.phoneKey !== null ? "p:" + row.phoneKey : null,
      row.emailKey !== null ? "e:" + row.emailKey : null,
    ]) {
      if (key === null) continue;
      const prev = lastByKey.get(key);
      if (prev && at - prev.lastAt <= collapseWindowMs) union(prev.idx, i);
      lastByKey.set(key, { idx: i, lastAt: at });
    }
  });

  const groups = new Map<number, T[]>();
  sorted.forEach((row, i) => {
    const root = find(i);
    const g = groups.get(root) ?? [];
    g.push(row); // ascending order preserved
    groups.set(root, g);
  });

  return [...groups.values()].map((touches) => ({ origin: touches[0], touches }));
}
