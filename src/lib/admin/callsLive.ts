/**
 * Live unlogged-calls queue for the Sales workload view — I/O wrapper around
 * src/lib/admin/callQueue.mjs (objective rules only; the chase/service
 * metrics stay in scripts/call-crosscheck.mjs until their definitions freeze
 * ~Sep 2). Failure posture as everywhere: null on error, the section renders
 * an explicit note, never fake-empty.
 */
import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { isCallLabelKey, UNMATCHED_TAXONOMY_VERSION, type LatestCallLabel } from "@/lib/admin/callLabelTaxonomy";
// @ts-ignore — plain-JS shared module (no declarations by design).
import { phoneKey, unloggedCalls, CALLS_COVERAGE_START } from "@/lib/admin/callQueue.mjs";

export interface UnloggedCall {
  id: string;
  at: Date;
  durationSec: number;
  campaign: string | null;
  source: string | null;
  timelineUrl: string | null;
  /** Latest human label event, if Eddie has reviewed this call. Labels
   *  ANNOTATE — a labeled row never leaves `unlogged` (denominator rule). */
  latestLabel: LatestCallLabel | null;
}
export interface CallsLive {
  unlogged: UnloggedCall[];
  totalRealCalls: number;
  coverageStart: string;
  mirrorStart: string;
  /** true when the queue computed but the label fetch failed — the UI shows
   *  rows unlabeled with an explicit note, never silently label-free. */
  labelsUnavailable: boolean;
}

/** Latest label event per call from the append-only `call_label_events`
 *  collection (written by src/app/admin/labelActions.ts — see its header for
 *  why the store is flat). Latest labeledAt wins; older events remain as the
 *  audit trail and are simply skipped here. */
async function fetchLatestLabels(db: ReturnType<typeof getAdminDb>): Promise<Map<string, LatestCallLabel>> {
  const snap = await db.collection("call_label_events").orderBy("labeledAt", "asc").get();
  const latest = new Map<string, LatestCallLabel>();
  for (const doc of snap.docs) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const d: any = doc.data();
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (d.taxonomyVersion !== UNMATCHED_TAXONOMY_VERSION) continue;
    if (typeof d.callId !== "string" || !isCallLabelKey(d.label)) continue;
    const at = d.labeledAt?.toDate?.();
    latest.set(d.callId, {
      key: d.label,
      labeledBy: typeof d.labeledBy === "string" ? d.labeledBy : "?",
      labeledAtISO: at instanceof Date ? at.toISOString() : "",
      note: typeof d.note === "string" && d.note ? d.note : null,
      spanishNotServed: d.spanishNotServed === true,
      relatedRecordId: typeof d.relatedRecordId === "string" && d.relatedRecordId ? d.relatedRecordId : null,
    });
  }
  return latest;
}

const MIRROR_START = new Date("2026-07-08T00:00:00-07:00");

export async function computeCallsLive(): Promise<CallsLive | null> {
  const db = getAdminDb();
  const since = new Date(`${CALLS_COVERAGE_START}T00:00:00-07:00`);
  try {
    /* ---- calls from raw payloads (the call docs drop phone/duration — known bug) ---- */
    const crSnap = await db.collection("callrail_webhook_events")
      .orderBy("receivedAt", "asc") // camelCase in this collection
      .select("callId", "raw.customer_phone_number", "raw.callernum", "raw.duration",
              "raw.start_time", "raw.created_at", "raw.spam", "raw.campaign",
              "raw.source", "raw.timeline_url")
      .get();
    const calls: { id: string; at: Date; key: string | null; durationSec: number; spam: boolean; campaign: string | null; source: string | null; timelineUrl: string | null }[] = [];
    for (const doc of crSnap.docs) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const d: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const raw = d.raw ?? {};
      const at = raw.start_time ? new Date(raw.start_time) : raw.created_at ? new Date(raw.created_at) : null;
      if (!at || Number.isNaN(at.getTime()) || at < since) continue;
      calls.push({
        id: String(d.callId ?? doc.id),
        at,
        key: phoneKey(raw.customer_phone_number) ?? phoneKey(raw.callernum),
        durationSec: Number(raw.duration ?? 0) || 0,
        spam: raw.spam === true,
        campaign: raw.campaign ? String(raw.campaign) : null,
        source: raw.source ? String(raw.source) : null,
        timelineUrl: typeof raw.timeline_url === "string" && raw.timeline_url ? raw.timeline_url : null,
      });
    }

    /* ---- CRM phones (ProABD mirror) ---- */
    const evSnap = await db.collection("proabd_webhook_events")
      .where("received_at", ">=", MIRROR_START).orderBy("received_at", "asc")
      .select("raw_item.ABD_Id", "raw_item.Shipper.Phone_1", "raw_item.Create_Date")
      .get();
    const firstCreate = new Map<string, Date>(); // ABD -> earliest known create
    const phoneOf = new Map<string, string>();
    for (const doc of evSnap.docs) {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const item: any = doc.data().raw_item ?? {};
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const id = String(item.ABD_Id ?? "");
      if (!id) continue;
      const key = phoneKey(item.Shipper?.Phone_1);
      if (key && !phoneOf.has(id)) phoneOf.set(id, key);
      // Create_Date is Eastern wall clock; for prior/posterior bucketing at
      // ±hours precision a fixed -04:00 read is adequate here (the shared
      // Eastern parser lives in scripts/lib; avoid duplicating it — the 72h
      // window dwarfs any DST edge).
      const cd = item.Create_Date ? new Date(String(item.Create_Date).replace(" ", "T") + "-04:00") : null;
      if (cd && !Number.isNaN(cd.getTime()) && !firstCreate.has(id)) firstCreate.set(id, cd);
    }
    const crmByPhone = new Map<string, Date[]>();
    for (const [id, key] of phoneOf) {
      const at = firstCreate.get(id);
      if (!at) continue;
      if (!crmByPhone.has(key)) crmByPhone.set(key, []);
      crmByPhone.get(key)!.push(at);
    }

    /* ---- web-lead phones ---- */
    const leadSnap = await db.collection("leads")
      .where("createdAt", ">=", MIRROR_START).orderBy("createdAt", "asc").limit(8000).get();
    const webByPhone = new Map<string, Date[]>();
    for (const doc of leadSnap.docs) {
      if (doc.id.startsWith("call_")) continue;
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const d: any = doc.data();
      /* eslint-enable @typescript-eslint/no-explicit-any */
      const at = d.createdAt?.toDate?.();
      const key = phoneKey(d.contact?.phone);
      if (!at || !key) continue;
      if (!webByPhone.has(key)) webByPhone.set(key, []);
      webByPhone.get(key)!.push(at);
    }

    const rows = unloggedCalls({ calls, crmByPhone, webByPhone }) as Omit<UnloggedCall, "latestLabel">[];

    /* ---- human labels (annotate only; failure here never hides the queue) ---- */
    let labels = new Map<string, LatestCallLabel>();
    let labelsUnavailable = false;
    try {
      labels = await fetchLatestLabels(db);
    } catch (err) {
      console.error("[callsLive] label fetch failed — rendering unlabeled", err);
      labelsUnavailable = true;
    }
    const unlogged: UnloggedCall[] = rows.map((r) => ({ ...r, latestLabel: labels.get(r.id) ?? null }));

    const totalRealCalls = calls.filter((c) => !c.spam && c.durationSec >= 60).length;
    return { unlogged, totalRealCalls, coverageStart: CALLS_COVERAGE_START, mirrorStart: "2026-07-08", labelsUnavailable };
  } catch (err) {
    console.error("[callsLive] computation failed", err);
    return null;
  }
}
