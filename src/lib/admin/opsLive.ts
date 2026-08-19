/**
 * Sales-view operations blocks — OBJECTIVE facts only (2026-08-19).
 *
 * Three work queues/loads, all judgment-free by design. The chase/service
 * DEFINITIONS freeze ~Sep 2; until then nothing here flags, colors, or ranks
 * agents. What ships now:
 *
 *   HYGIENE   — records still "Active" past the booking horizon (21d; no
 *               booking in the book's history has landed past 20.3d). These
 *               are closed-in-reality, open-in-CRM; every one sits in the
 *               close-rate denominators that govern budget.
 *   CALLBACK  — open records where a customer called (≥60s, matched by
 *               phone) and NO CRM activity has followed. No threshold, no
 *               "chase" flag — a thresholdless list sorted longest-waiting
 *               first. The goal is that it's short.
 *   LOAD      — per-owner* workload counts: open records, calls landing on
 *               their records (7d), median staleness, second-call-before-
 *               any-CRM-activity count. Counts and denominators, no rates
 *               presented as quality, no colors (4–8 week ban stands).
 *
 * owner* = dominant change-author on the record's webhook events
 * (raw_item.UserName) — NOT the assigned agent; that field is a pending
 * vendor ask (Brian). Same convention as scripts/call-crosscheck.mjs.
 * "Touch"/"activity" = a webhook event on the record (CRM activity), NOT
 * customer contact — the touch≠contact distinction is deliberate.
 *
 * Failure posture: null on error → the section renders an explicit note.
 * PII: rows carry ABD ids, agent names, statuses, durations — never a
 * customer name/phone/address.
 */
import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
// @ts-ignore — plain-JS shared module (no declarations by design).
import { phoneKey } from "@/lib/admin/callQueue.mjs";

const MIRROR_START = new Date("2026-07-08T00:00:00-07:00");
const CALLS_START = new Date("2026-08-10T00:00:00-07:00"); // phone capture fix
/** Booking horizon: hard ceiling measured at 20.3d (source-comparison A2). */
export const HORIZON_DAYS = 21;
const LOST_STATUS_IDS = new Set(["5", "6", "12", "13", "25", "2581"]);
const CANCELED_ID = "23";
const DAY = 864e5;

export interface HygieneRow { abd: string; owner: string; ageDays: number; staleDays: number; status: string }
export interface CallbackRow { abd: string; owner: string; callAt: Date; durationSec: number; waitingDays: number; status: string }
export interface LoadRow {
  owner: string; openRecords: number; pastHorizon: number;
  calls7d: number; medianStaleDays: number | null; secondCallBeforeTouch: number;
}
export interface OpsLive {
  hygiene: { total: number; rows: HygieneRow[]; byOwner: { owner: string; count: number }[] };
  callbacks: CallbackRow[];
  load: LoadRow[];
  openTotal: number;
}

interface Rec {
  abd: string; created: Date | null; booked: boolean;
  lastStatusId: string; lastStatus: string; lastEventAt: Date | null;
  users: Map<string, number>; phone: string | null;
  events: Date[]; // asc webhook activity trail
}

const median = (xs: number[]): number | null => {
  const v = [...xs].sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export async function computeOpsLive(): Promise<OpsLive | null> {
  const db = getAdminDb();
  try {
    /* ---- ProABD mirror → per-record state + activity trail ---- */
    const evSnap = await db.collection("proabd_webhook_events")
      .where("received_at", ">=", MIRROR_START).orderBy("received_at", "asc")
      .select("entity_id", "raw_item.ABD_Id", "raw_item.UserName", "raw_item.Status_Id",
              "raw_item.Status", "raw_item.Create_Date", "raw_item.Booked_Date",
              "raw_item.Item_Type", "raw_item.Shipper.Phone_1", "received_at")
      .get();
    const recs = new Map<string, Rec>();
    for (const doc of evSnap.docs) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const d: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const item = d.raw_item ?? {};
      const abd = String(d.entity_id ?? item.ABD_Id ?? "");
      if (!abd) continue;
      let r = recs.get(abd);
      if (!r) {
        r = { abd, created: null, booked: false, lastStatusId: "", lastStatus: "", lastEventAt: null, users: new Map(), phone: null, events: [] };
        recs.set(abd, r);
      }
      const at: Date | null = d.received_at?.toDate?.() ?? null;
      if (at) { r.events.push(at); if (!r.lastEventAt || at > r.lastEventAt) r.lastEventAt = at; }
      // Create_Date is Eastern wall clock; fixed -04:00 is adequate at day precision (same note as callsLive).
      if (item.Create_Date) {
        const cd = new Date(String(item.Create_Date).replace(" ", "T") + "-04:00");
        if (!Number.isNaN(cd.getTime()) && (!r.created || cd < r.created)) r.created = cd;
      }
      if (String(item.Item_Type ?? "").toLowerCase() === "order" || item.Booked_Date) r.booked = true;
      const sid = item.Status_Id != null ? String(item.Status_Id) : "";
      if (sid) { r.lastStatusId = sid; r.lastStatus = String(item.Status ?? ""); }
      const u = item.UserName ? String(item.UserName) : null;
      if (u) r.users.set(u, (r.users.get(u) ?? 0) + 1);
      const pk = phoneKey(item.Shipper?.Phone_1);
      if (pk && !r.phone) r.phone = pk;
    }
    const ownerOf = (r: Rec): string => {
      let best = "(unattributed)", n = 0;
      for (const [u, c] of r.users) if (c > n) { best = u; n = c; }
      return best;
    };
    const isOpen = (r: Rec) =>
      !r.booked && !LOST_STATUS_IDS.has(r.lastStatusId) && r.lastStatusId !== CANCELED_ID;

    const now = Date.now();
    const open = [...recs.values()].filter((r) => isOpen(r) && r.created);

    /* ---- HYGIENE: open past the booking horizon ---- */
    const past = open
      .filter((r) => (now - r.created!.getTime()) / DAY > HORIZON_DAYS)
      .map((r) => ({
        abd: r.abd, owner: ownerOf(r),
        ageDays: Math.floor((now - r.created!.getTime()) / DAY),
        staleDays: r.lastEventAt ? Math.floor((now - r.lastEventAt.getTime()) / DAY) : 999,
        status: r.lastStatus || "?",
      }))
      .sort((a, b) => b.staleDays - a.staleDays);
    const hygByOwner = new Map<string, number>();
    for (const p of past) hygByOwner.set(p.owner, (hygByOwner.get(p.owner) ?? 0) + 1);

    /* ---- calls (raw payloads, same source as callsLive) ---- */
    const crSnap = await db.collection("callrail_webhook_events")
      .orderBy("receivedAt", "asc")
      .select("raw.customer_phone_number", "raw.callernum", "raw.duration", "raw.start_time", "raw.created_at", "raw.spam")
      .get();
    const calls: { at: Date; key: string | null; durationSec: number }[] = [];
    for (const doc of crSnap.docs) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const raw: any = doc.data().raw ?? {};
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const at = raw.start_time ? new Date(raw.start_time) : raw.created_at ? new Date(raw.created_at) : null;
      if (!at || Number.isNaN(at.getTime()) || at < CALLS_START) continue;
      if (raw.spam === true || (Number(raw.duration ?? 0) || 0) < 60) continue;
      calls.push({ at, key: phoneKey(raw.customer_phone_number) ?? phoneKey(raw.callernum), durationSec: Number(raw.duration) || 0 });
    }
    const byPhone = new Map<string, Rec[]>();
    for (const r of recs.values()) {
      if (!r.phone) continue;
      if (!byPhone.has(r.phone)) byPhone.set(r.phone, []);
      byPhone.get(r.phone)!.push(r);
    }
    // match call → most-recent record created before the call (crosscheck v4 convention)
    const matchRec = (key: string | null, at: Date): Rec | null => {
      if (!key) return null;
      const cands = (byPhone.get(key) ?? []).filter((r) => r.created && r.created.getTime() < at.getTime() + 5 * 60_000);
      if (!cands.length) return null;
      cands.sort((a, b) => b.created!.getTime() - a.created!.getTime());
      return cands[0];
    };

    /* ---- CALLBACK queue + per-owner call stats ---- */
    const grace = 5 * 60_000;
    const callbacks: CallbackRow[] = [];
    const callsPerOwner7d = new Map<string, number>();
    const callsPerRec = new Map<string, { rec: Rec; times: Date[] }>();
    for (const c of calls) {
      const rec = matchRec(c.key, c.at);
      if (!rec) continue;
      const e = callsPerRec.get(rec.abd) ?? { rec, times: [] };
      e.times.push(c.at);
      callsPerRec.set(rec.abd, e);
      const owner = ownerOf(rec);
      if (now - c.at.getTime() <= 7 * DAY) callsPerOwner7d.set(owner, (callsPerOwner7d.get(owner) ?? 0) + 1);
      if (!isOpen(rec)) continue;
      if (now - c.at.getTime() > 14 * DAY) continue;
      const touchedAfter = rec.events.some((ev) => ev.getTime() > c.at.getTime() + grace);
      if (touchedAfter) continue;
      callbacks.push({
        abd: rec.abd, owner, callAt: c.at, durationSec: c.durationSec,
        waitingDays: Math.round(((now - c.at.getTime()) / DAY) * 10) / 10,
        status: rec.lastStatus || "?",
      });
    }
    // one row per record (latest unanswered call), longest-waiting first
    const seen = new Map<string, CallbackRow>();
    for (const cb of callbacks) {
      const prev = seen.get(cb.abd);
      if (!prev || cb.callAt > prev.callAt) seen.set(cb.abd, cb);
    }
    const callbackRows = [...seen.values()].sort((a, b) => b.waitingDays - a.waitingDays);

    /* ---- second call before any CRM activity (objective event, per owner) ---- */
    const secondCall = new Map<string, number>();
    for (const { rec, times } of callsPerRec.values()) {
      times.sort((a, b) => a.getTime() - b.getTime());
      for (let i = 1; i < times.length; i++) {
        const between = rec.events.some((ev) =>
          ev.getTime() > times[i - 1].getTime() + grace && ev.getTime() < times[i].getTime());
        if (!between) { secondCall.set(ownerOf(rec), (secondCall.get(ownerOf(rec)) ?? 0) + 1); break; }
      }
    }

    /* ---- LOAD per owner ---- */
    const loadMap = new Map<string, { open: Rec[]; past: number }>();
    for (const r of open) {
      const o = ownerOf(r);
      const e = loadMap.get(o) ?? { open: [], past: 0 };
      e.open.push(r);
      if ((now - r.created!.getTime()) / DAY > HORIZON_DAYS) e.past++;
      loadMap.set(o, e);
    }
    const load: LoadRow[] = [...loadMap.entries()].map(([owner, e]) => ({
      owner,
      openRecords: e.open.length,
      pastHorizon: e.past,
      calls7d: callsPerOwner7d.get(owner) ?? 0,
      medianStaleDays: median(e.open.map((r) => r.lastEventAt ? (now - r.lastEventAt.getTime()) / DAY : 999)),
      secondCallBeforeTouch: secondCall.get(owner) ?? 0,
    })).sort((a, b) => b.openRecords - a.openRecords);

    return {
      hygiene: {
        total: past.length,
        rows: past.slice(0, 30),
        byOwner: [...hygByOwner.entries()].map(([owner, count]) => ({ owner, count })).sort((a, b) => b.count - a.count),
      },
      callbacks: callbackRows.slice(0, 20),
      load,
      openTotal: open.length,
    };
  } catch (err) {
    console.error("[opsLive] computation failed", err);
    return null;
  }
}
