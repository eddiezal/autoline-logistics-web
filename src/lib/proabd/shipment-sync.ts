/**
 * ProABD webhook events → `shipments` collection (SERVER ONLY).
 *
 * The missing link between the CRM and the customer portal (Amendment 3,
 * Item E — portal activation). The webhook receiver persists every Superflo
 * Export API event into `proabd_webhook_events` with parsed:false; this
 * module sweeps those events and materializes/updates portal `Shipment`
 * docs for every record that reaches ORDER stage (the booked signal).
 *
 * Design:
 *  - Idempotent + re-runnable. Shipments are found by proabdAbdId (or
 *    created keyed by the website leadRef when the record originated on
 *    the site, else "ALL-<ABD_Id>"). Reprocessing the same events merges
 *    to the same doc.
 *  - Events are processed in received_at order; within a sweep the LAST
 *    event per ABD_Id decides the current status (reassignments and
 *    status changes arrive as update events).
 *  - Lead/quote-stage events are marked parsed without producing a
 *    shipment — portal lifecycle starts at "booked". (They remain in the
 *    events collection for the admin funnel dashboards, unchanged.)
 *  - Poison-pill safe: a record that throws is marked parsed with a
 *    parse_error note so the backlog keeps draining; the raw event is
 *    retained for reprocessing after a code fix.
 *  - Field tolerance: Shipper/Transport subfield names on EXPORT events
 *    are only partially confirmed (createLead request shape + the fields
 *    the data dictionary verified). Every extraction goes through pick()
 *    with candidate paths; anything missing degrades to undefined and is
 *    reported in parse_note so we learn the real shape from production
 *    (see scripts/inspect-webhook-shapes.mjs for the offline version).
 *  - NOT yet feeding the `orders` (admin baseline) collection: Kacy's CSV
 *    order_id has not been confirmed identical to ABD_Id. Wire that up
 *    only after comparing one row, or the baseline card double-counts.
 *
 * Status mapping (canonical map from Brian, statuses.ts):
 *   14 New / 15 In Processing / 16 Posted / 17 Hold-Carrier / 24 Hold-Cust
 *     → "booked"
 *   18 Dispatched → "prep"    (driver assigned, awaiting pickup)
 *   19 In Transit → "inTransit"
 *   20 Delivered  → "delivered"
 *   21 Accounting / 22 Order Complete → "completed"
 *   23 Canceled   → "claimed" (escape-valve, same convention as SD mapper)
 */

import "server-only";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { PROABD_STATUS } from "@/lib/proabd/statuses";
import { AGENTS } from "@/lib/leads/agents";
import { searchShipperOrdersByVin } from "@/lib/superdispatch/shipper-orders";
import type {
  Coordinator,
  ISODate,
  Milestone,
  Shipment,
  ShipmentStatus,
} from "@/lib/types/shipment";

/* ============================================================
 * Tolerant field extraction
 * ============================================================ */

type Raw = Record<string, unknown>;

/** Walk a dot-path into a raw object; undefined on any miss. */
function at(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Raw)[key];
  }
  return cur;
}

/** First non-empty string among candidate paths, length-capped. */
function pick(item: Raw, paths: string[], cap = 300): string | undefined {
  for (const p of paths) {
    const v = at(item, p);
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, cap);
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

/** First finite number among candidate paths (accepts "1,234.50"). */
function pickNum(item: Raw, paths: string[]): number | undefined {
  for (const p of paths) {
    const v = at(item, p);
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseFloat(v.replace(/[$,]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

/** First vehicle entry from whichever shape the export uses. */
function firstVehicle(item: Raw): Raw | undefined {
  for (const p of ["Transport.Vehicles", "Vehicles", "Transport.Vehicle"]) {
    const v = at(item, p);
    if (Array.isArray(v) && v.length && typeof v[0] === "object") {
      return v[0] as Raw;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Raw;
  }
  return undefined;
}

/**
 * ProABD datetimes are Pacific local with no offset (same convention as
 * the CSV export / scripts/import-orders.mjs). Store as ISO with a fixed
 * -07:00 — good enough for lifecycle display; SD overlay provides the
 * authoritative operational timestamps when linked.
 */
function ptToIso(s: string | undefined): ISODate | undefined {
  if (!s) return undefined;
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(
    /Z|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}-07:00`,
  );
  return Number.isNaN(d.getTime()) ? undefined : (d.toISOString() as ISODate);
}

/* ============================================================
 * Status mapping
 * ============================================================ */

const ORDER_STATUS_TO_SHIPMENT: Record<string, ShipmentStatus> = {
  "14": "booked",
  "15": "booked",
  "16": "booked",
  "17": "booked",
  "24": "booked",
  "18": "prep",
  "19": "inTransit",
  "20": "delivered",
  "21": "completed",
  "22": "completed",
  "23": "claimed",
};

function isOrderStage(entityType: string | null, statusId: string | undefined): boolean {
  if (entityType === "order") return true;
  if (statusId && PROABD_STATUS[statusId]?.type === 3) return true;
  return false;
}

/* ============================================================
 * Coordinator from the ProABD-assigned agent
 * ============================================================ */

/** Company main line shown as the coordinator callback number. Set
 *  COMPANY_PHONE in Vercel (E.164, e.g. +18005551234); empty hides the
 *  phone row in the portal coordinator card until configured. */
const MAIN_LINE = process.env.COMPANY_PHONE ?? "";

function coordinatorFromAgent(userName: string | undefined): Coordinator | undefined {
  if (!userName) return undefined;
  const first = userName.split(/\s+/)[0] ?? userName;
  const roster = AGENTS.find(
    (a) => a.firstName.toLowerCase() === first.toLowerCase(),
  );
  return {
    name: userName,
    phone: MAIN_LINE,
    email: roster?.email ?? "",
    // Nelson + Renee cover Spanish; default everyone to EN and let the
    // component render what it has.
    languages: ["nelson", "renee"].includes(first.toLowerCase())
      ? ["en", "es"]
      : ["en"],
    hours: { start: "07:00", end: "19:00", timezone: "America/Los_Angeles" },
  };
}

/* ============================================================
 * Sweep
 * ============================================================ */

interface EventDoc {
  id: string;
  entityType: string | null;
  entityId: string | null;
  receivedAtIso: ISODate;
  raw: Raw;
}

export interface SweepResult {
  scanned: number;
  recordsSeen: number;
  shipmentsUpserted: number;
  skippedPreOrder: number;
  errors: number;
  /** true when the backlog likely has more unparsed events. */
  more: boolean;
}

export async function sweepShipmentSync(
  opts: { limit?: number } = {},
): Promise<SweepResult> {
  const limit = Math.min(Math.max(opts.limit ?? 300, 1), 500);
  const db = getAdminDb();

  const snap = await db
    .collection("proabd_webhook_events")
    .where("parsed", "==", false)
    .orderBy("received_at", "asc")
    .limit(limit)
    .get();

  const result: SweepResult = {
    scanned: snap.size,
    recordsSeen: 0,
    shipmentsUpserted: 0,
    skippedPreOrder: 0,
    errors: 0,
    more: snap.size === limit,
  };
  if (snap.empty) return result;

  // Group chronologically-ordered events by ABD_Id.
  const byRecord = new Map<string, EventDoc[]>();
  const noEntity: EventDoc[] = [];
  for (const d of snap.docs) {
    const raw = (d.get("raw_item") ?? {}) as Raw;
    const ev: EventDoc = {
      id: d.id,
      entityType: (d.get("entity_type") as string | null) ?? null,
      entityId: (d.get("entity_id") as string | null) ?? null,
      receivedAtIso:
        (d.get("received_at")?.toDate?.()?.toISOString() as ISODate) ??
        (new Date().toISOString() as ISODate),
      raw,
    };
    if (!ev.entityId) {
      noEntity.push(ev);
      continue;
    }
    const list = byRecord.get(ev.entityId) ?? [];
    list.push(ev);
    byRecord.set(ev.entityId, list);
  }
  result.recordsSeen = byRecord.size;

  const parsedMarks = db.batch();
  const now = FieldValue.serverTimestamp();
  const eventsCol = db.collection("proabd_webhook_events");

  // Events with no ABD_Id can never join anywhere — mark and move on.
  for (const ev of noEntity) {
    parsedMarks.update(eventsCol.doc(ev.id), {
      parsed: true,
      parsed_at: now,
      parse_note: "no-entity-id",
    });
  }

  for (const [abdId, events] of byRecord) {
    const latest = events[events.length - 1]!;
    const statusId = pick(latest.raw, ["Status_Id"], 20);
    const reachedOrder = events.some((e) =>
      isOrderStage(e.entityType, pick(e.raw, ["Status_Id"], 20)),
    );

    let note = "pre-order";
    try {
      if (reachedOrder) {
        const orderNumber = await upsertShipment(db, abdId, events, latest, statusId);
        note = `shipment:${orderNumber}`;
        result.shipmentsUpserted++;
      } else {
        result.skippedPreOrder++;
      }
    } catch (err) {
      result.errors++;
      note = `error:${err instanceof Error ? err.message.slice(0, 200) : "unknown"}`;
      console.error(`[shipment-sync] record ${abdId} failed:`, err);
    }

    for (const ev of events) {
      parsedMarks.update(eventsCol.doc(ev.id), {
        parsed: true,
        parsed_at: now,
        parse_note: note,
      });
    }
  }

  await parsedMarks.commit();
  return result;
}

/* ============================================================
 * Upsert one shipment from one record's events
 * ============================================================ */

async function upsertShipment(
  db: Firestore,
  abdId: string,
  events: EventDoc[],
  latest: EventDoc,
  statusId: string | undefined,
): Promise<string> {
  const raw = latest.raw;

  // ── Join the website lead (if this record originated on the site) ────
  const leadSnap = await db
    .collection("leads")
    .where("proabdAbdId", "==", abdId)
    .limit(1)
    .get();
  const lead = leadSnap.empty ? null : leadSnap.docs[0]!.data();

  // ── Find or name the shipment doc ────────────────────────────────────
  const existingSnap = await db
    .collection("shipments")
    .where("proabdAbdId", "==", abdId)
    .limit(1)
    .get();
  const existing = existingSnap.empty ? null : existingSnap.docs[0]!;
  const orderNumber =
    existing?.id ??
    (typeof lead?.leadRef === "string" && lead.leadRef
      ? lead.leadRef
      : `ALL-${abdId}`);
  const ref = existing?.ref ?? db.collection("shipments").doc(orderNumber);
  const prior = (existing?.data() ?? null) as (Shipment & Raw) | null;

  // ── Extract fields (tolerant paths; export shape partially confirmed) ─
  const firstName =
    pick(raw, ["Shipper.First_Name", "First_Name"], 100) ??
    (lead?.contact?.firstName as string | undefined);
  const lastName =
    pick(raw, ["Shipper.Last_Name", "Last_Name"], 100) ??
    (lead?.contact?.lastName as string | undefined);
  const email = (
    pick(raw, ["Shipper.Email", "Email"], 200) ??
    (lead?.contact?.email as string | undefined) ??
    ""
  ).toLowerCase();
  const phone =
    pick(raw, ["Shipper.Phone_1", "Shipper.Phone", "Phone_1", "Phone"], 40) ??
    (lead?.contact?.phone as string | undefined) ??
    "";

  const veh = firstVehicle(raw) ?? {};
  const vYear =
    pickNum(veh as Raw, ["v_year", "Year", "year"]) ??
    (lead?.vehicle?.year ? Number(lead.vehicle.year) : undefined);
  const vMake =
    pick(veh as Raw, ["v_make", "Make", "make"], 60) ??
    (lead?.vehicle?.make as string | undefined);
  const vModel =
    pick(veh as Raw, ["v_model", "Model", "model"], 60) ??
    (lead?.vehicle?.model as string | undefined);
  const vVin = pick(veh as Raw, ["v_vin", "VIN", "Vin", "vin"], 30);
  const vOp = pick(veh as Raw, ["veh_op", "Operable", "operable"], 10);

  const originCity =
    pick(raw, ["Transport.Origin.City", "Origin.City", "Origin_City"], 100) ?? "";
  const originState =
    pick(raw, ["Transport.Origin.State", "Origin.State", "Origin_State"], 10) ??
    (lead?.origin?.state as string | undefined) ??
    "";
  const originZip =
    pick(raw, ["Transport.Origin.Zipcode", "Origin.Zipcode", "Origin_Zip"], 12) ??
    (lead?.origin?.zip as string | undefined) ??
    "";
  const destCity =
    pick(raw, ["Transport.Destination.City", "Destination.City", "Destination_City"], 100) ?? "";
  const destState =
    pick(raw, ["Transport.Destination.State", "Destination.State", "Destination_State"], 10) ??
    (lead?.destination?.state as string | undefined) ??
    "";
  const destZip =
    pick(raw, ["Transport.Destination.Zipcode", "Destination.Zipcode", "Destination_Zip"], 12) ??
    (lead?.destination?.zip as string | undefined) ??
    "";

  // Price: export subfield names unverified — candidates cover ProABD's
  // CSV-export vocabulary. Falls back to the website quote, then 0.
  const priceDollars =
    pickNum(raw, [
      "Transport.Total_Price",
      "Transport.Price",
      "Total_Price",
      "Price",
      "Total_Tariff",
      "Tariff",
    ]) ?? (typeof lead?.estimate?.price === "number" ? lead.estimate.price : undefined);

  const bookedAt =
    ptToIso(pick(raw, ["Booked_Date"], 40)) ??
    prior?.bookedAt ??
    // First order-stage event's arrival is a solid booked-time floor.
    events.find((e) => isOrderStage(e.entityType, pick(e.raw, ["Status_Id"], 20)))
      ?.receivedAtIso;
  const createdAt =
    prior?.createdAt ??
    ptToIso(pick(raw, ["Create_Date"], 40)) ??
    events[0]!.receivedAtIso;

  const status: ShipmentStatus =
    (statusId && ORDER_STATUS_TO_SHIPMENT[statusId]) || prior?.status || "booked";

  // Transition stamps: first time we observe the state, not before.
  const pickedUpAt =
    prior?.pickedUpAt ??
    (status === "inTransit" || status === "delivered" || status === "completed"
      ? latest.receivedAtIso
      : undefined);
  const deliveredAt =
    prior?.deliveredAt ??
    (status === "delivered" || status === "completed"
      ? latest.receivedAtIso
      : undefined);

  const coordinator =
    coordinatorFromAgent(pick(raw, ["UserName"], 100)) ?? prior?.coordinator;

  // ── Super Dispatch auto-link (best-effort) ───────────────────────────
  // Once ops enters the VIN in ProABD and the order is dispatched via SD,
  // a VIN search finds the SD order → sdOrderGuid unlocks the live SD
  // overlay (driver photos, authoritative pickup/delivery times) via
  // SD_SHIPPER_ENRICH in the repository. Only attempted when enrichment
  // is on, and only when exactly ONE SD order matches (ambiguity = skip;
  // a re-shipped VIN would match twice and we must not guess).
  let sdOrderGuid = prior?.sdOrderGuid;
  if (!sdOrderGuid && vVin && process.env.SD_SHIPPER_ENRICH === "true") {
    try {
      const matches = await searchShipperOrdersByVin(vVin);
      if (matches.length === 1 && matches[0]?.guid) {
        sdOrderGuid = matches[0].guid;
        console.log(
          `[shipment-sync] linked ${orderNumber} → SD order ${sdOrderGuid} via VIN`,
        );
      }
    } catch (err) {
      console.warn(
        `[shipment-sync] SD VIN lookup failed for ${orderNumber} (non-fatal):`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // ── Milestones: rebuilt idempotently from the timestamps we hold ─────
  const milestones: Milestone[] = [];
  if (bookedAt) {
    milestones.push({ id: `${orderNumber}-booked`, type: "booked", at: bookedAt });
  }
  if (pickedUpAt) {
    milestones.push({ id: `${orderNumber}-pickedUp`, type: "pickedUp", at: pickedUpAt });
  }
  if (deliveredAt) {
    milestones.push({ id: `${orderNumber}-delivered`, type: "delivered", at: deliveredAt });
  }

  const doc: Shipment & {
    proabdAbdId: string;
    proabdStatusId?: string;
    proabdStatusText?: string;
    updatedFromProabdAt?: unknown;
  } = {
    id: orderNumber,
    orderNumber,
    status,
    sdOrderGuid,
    customer: {
      id: abdId,
      email,
      phone,
      name: { first: firstName ?? "", last: lastName ?? "" },
      locale: (lead?.attribution?.locale === "es" ? "es" : "en"),
      preferredChannel: "email",
    },
    vehicle: {
      year: vYear ?? 0,
      make: vMake ?? "Unknown",
      model: vModel ?? "Unknown",
      vin: vVin ?? prior?.vehicle?.vin,
      condition: vOp === "2" || vOp === "0" ? "inoperable" : "operable",
      enclosedRequired: prior?.vehicle?.enclosedRequired ?? false,
    },
    origin: { zip: originZip, city: originCity, state: originState },
    destination: { zip: destZip, city: destCity, state: destState },
    tier: prior?.tier ?? (lead?.tier as Shipment["tier"] | undefined) ?? "standby",
    priceLockedCents:
      prior?.priceLockedCents && prior.priceLockedCents > 0
        ? prior.priceLockedCents
        : Math.round((priceDollars ?? 0) * 100),
    createdAt,
    bookedAt,
    coordinator,
    scheduledPickup: prior?.scheduledPickup,
    driver: prior?.driver,
    carrier: prior?.carrier,
    prepChecklist: prior?.prepChecklist,
    customerPrepPhotos: prior?.customerPrepPhotos,
    pickedUpAt,
    pickupPhotos: prior?.pickupPhotos,
    currentLocation: prior?.currentLocation,
    eta: prior?.eta,
    transitPhotos: prior?.transitPhotos,
    deliveredAt,
    deliveryPhotos: prior?.deliveryPhotos,
    milestones: milestones.length ? milestones : prior?.milestones ?? [],
    payments: prior?.payments ?? [],
    // ── Sync bookkeeping (extra fields; portal ignores them) ──────────
    proabdAbdId: abdId,
    proabdStatusId: statusId,
    proabdStatusText: statusId ? PROABD_STATUS[statusId]?.text : undefined,
    updatedFromProabdAt: FieldValue.serverTimestamp(),
  };

  // Firestore rejects undefined values — strip them.
  await ref.set(stripUndefined(doc), { merge: true });
  return orderNumber;
}

/** Deep-remove undefined values (Firestore rejects them). */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as unknown as T;
  }
  if (value !== null && typeof value === "object" && value.constructor === Object) {
    const out: Raw = {};
    for (const [k, v] of Object.entries(value as Raw)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}
