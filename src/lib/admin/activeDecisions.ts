/**
 * Live exposure computation for the Decision Registry — the trust layer.
 *
 * The Overview band shows "74 / 200 starts · ~126 remaining" and flips cards
 * to REVIEW DUE. Those numbers MUST be derived, not hand-stamped: the moment
 * one of them requires someone to remember to update it, the whole band
 * becomes dashboard decoration (external review, 2026-08-19). This module
 * computes them from site_events on every render.
 *
 * What is computed live:
 *   · R1 exposure + completion — sessions (vid|sid) with a form_started
 *     stamped fv="quote-r1-20260812"; completion numerator = those sessions
 *     that also carry lead_persisted. NOTE: this is the client-confirmed
 *     definition, slightly different from the study's leads-collection join;
 *     the difference is documented, not hidden — the band labels it.
 *   · PC handoff exposure — sessions with a route-checker estimate_shown
 *     since the first full post-fix day (Aug 14); continuation = a later
 *     page_view on /quote (locale-stripped). The Aug 18 internal
 *     verification visit sits in this count; the registry note carries the
 *     discount, the computation stays raw.
 *   · Call-page weeks — pure date math from the Aug 10 webhook fix.
 *
 * Failure posture: any error returns null for that block; the band renders
 * the registry's hand-stamped fallback WITH its asOf date visible. Live
 * numbers replace stale ones; they never silently invent zeros (the 8/7
 * false-zero lesson).
 */
import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";

const R1_FV = "quote-r1-20260812";
/** R1 shipped 2026-08-12; exposure counts from ship. */
const R1_SHIP = new Date("2026-08-12T00:00:00-07:00");
/** First full PT day with the PC handoff fix + lock-price block live. */
const PC_POST = new Date("2026-08-14T00:00:00-07:00");
/** Call-page capture working since the Aug 10 webhook fix. */
const CALL_START = new Date("2026-08-10T00:00:00-07:00");

export interface R1Live {
  starts: number;
  completed: number;
  /** 0–100, null until there is at least one start. */
  completionPct: number | null;
}
export interface PcLive {
  estimateSessions: number;
  toQuote: number;
  /** 0–100, null until there is at least one estimate session. */
  handoffPct: number | null;
}
export interface DecisionsLive {
  r1: R1Live | null;
  pc: PcLive | null;
  callWeeks: number;
  computedAt: Date;
}

const stripLocale = (p: string) => p.replace(/^\/es(?=\/|$)/, "") || "/";
const isQuotePath = (p: string) => /^\/quote(\/|$)/.test(stripLocale(p));

export async function computeDecisionsLive(): Promise<DecisionsLive> {
  const now = new Date();
  const callWeeks = Math.min(6, (now.getTime() - CALL_START.getTime()) / (7 * 864e5));

  let r1: R1Live | null = null;
  let pc: PcLive | null = null;

  try {
    // One bounded query covers both blocks (R1_SHIP < PC_POST is not true —
    // R1_SHIP is earlier, so it is the window start). Fields kept minimal.
    const snap = await getAdminDb()
      .collection("site_events")
      .where("ts", ">=", R1_SHIP)
      .select("vid", "sid", "type", "path", "ts", "meta.fv", "meta.tool")
      .get();

    interface Ev { vid: string; sid: string | null; type: string; path: string; at: Date; fv: string | null; tool: string | null }
    const events: Ev[] = [];
    for (const doc of snap.docs) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const e: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const at = e.ts?.toDate?.();
      if (!at || !e.vid) continue;
      events.push({
        vid: String(e.vid), sid: e.sid ? String(e.sid) : null,
        type: String(e.type ?? ""), path: String(e.path ?? ""),
        at, fv: e.meta?.fv ? String(e.meta.fv) : null,
        tool: e.meta?.tool ? String(e.meta.tool) : null,
      });
    }
    events.sort((a, b) => a.at.getTime() - b.at.getTime());

    const sessions = new Map<string, Ev[]>();
    for (const e of events) {
      const key = `${e.vid}|${e.sid ?? "nosid"}`;
      const arr = sessions.get(key);
      if (arr) arr.push(e); else sessions.set(key, [e]);
    }

    let starts = 0, completed = 0, pcSessions = 0, pcToQuote = 0;
    for (const evs of sessions.values()) {
      if (evs.some((e) => e.type === "form_started" && e.fv === R1_FV)) {
        starts++;
        if (evs.some((e) => e.type === "lead_persisted")) completed++;
      }
      const firstEst = evs.find(
        (e) => e.type === "estimate_shown" && e.tool === "route-checker" && e.at >= PC_POST,
      );
      if (firstEst) {
        pcSessions++;
        if (evs.some((e) => e.at > firstEst.at && e.type === "page_view" && isQuotePath(e.path))) {
          pcToQuote++;
        }
      }
    }

    r1 = { starts, completed, completionPct: starts ? (100 * completed) / starts : null };
    pc = { estimateSessions: pcSessions, toQuote: pcToQuote, handoffPct: pcSessions ? (100 * pcToQuote) / pcSessions : null };
  } catch (err) {
    console.error("[activeDecisions] site_events computation failed", err);
    // r1/pc stay null — the band falls back to hand-stamped registry values.
  }

  return { r1, pc, callWeeks, computedAt: now };
}

/* ── Review-due detection for the "Needs a decision" queue ──────────────────
 * One canonical action surface (2026-08-19 review): a gate-crossed experiment
 * does NOT get its own alert widget — it joins the existing rule-derived
 * queue on the Overview. Live counts win; if live computation failed, the
 * registry's hand-stamped exposure decides (stale data may under-trigger,
 * never over-trigger — acceptable failure direction). */

export interface ReviewDue {
  slug: string;
  title: string;
  current: number;
  gate: number;
  unit: string;
}

export function reviewDueEntries(
  live: DecisionsLive | null,
  registry: { slug: string; title: string; status: string; exposure?: { current: number; gate: number; unit: string } }[],
): ReviewDue[] {
  const out: ReviewDue[] = [];
  for (const e of registry) {
    if (e.status === "decided" || !e.exposure) continue;
    let current = e.exposure.current;
    if (live) {
      if (e.slug === "quote-form-r1" && live.r1) current = live.r1.starts;
      if (e.slug === "pc-estimate-moment" && live.pc) current = live.pc.estimateSessions;
      if (e.slug === "call-landing-read") current = live.callWeeks;
    }
    if (current >= e.exposure.gate) {
      out.push({ slug: e.slug, title: e.title, current, gate: e.exposure.gate, unit: e.exposure.unit });
    }
  }
  return out;
}
