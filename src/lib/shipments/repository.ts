/**
 * Shipment repository — the layer between portal server components and the
 * data store.
 *
 * Two env vars control the data path:
 *
 *   SHIPMENTS_SOURCE  Primary store for the Shipment record itself.
 *     - "firestore" → live reads via firebase-admin (see ./firestore.ts)
 *     - anything else (default) → in-memory mock fixtures
 *
 *   SD_SHIPPER_ENRICH=true  Optional Super Dispatch overlay.
 *     - When ON, any Shipment with a `sdOrderGuid` field gets its
 *       SD-authoritative fields refreshed from the Shipper API on every
 *       fetch (status, pickup/transit/delivery photos, picked_up_at,
 *       delivered_at). Auto Line-only fields (tier, coordinator,
 *       prepChecklist, customer identity) keep the Firestore value.
 *     - When OFF, the Firestore/mock data is returned as-is.
 *
 * Architecture rationale: SD has no "list by customer email" endpoint, so
 * Firestore stays the index. SD becomes the authority for live operational
 * data (status, photos, location). See [[autoline_sd_shipper_api]].
 *
 * Server-only: the Firestore path pulls in firebase-admin and the SD path
 * pulls in the OAuth client. No client component imports this module
 * (portal components receive shipments as props).
 *
 * Async signatures throughout so backend swaps stay invisible to callers.
 */

import "server-only";
import { MOCK_SHIPMENTS } from "@/lib/mock/shipments";
import type { Shipment } from "@/lib/types/shipment";
import {
  getShipperOrderAttachments,
  getShipperOrderByGuid,
} from "@/lib/superdispatch/shipper-orders";
import { mapSDOrderToShipment } from "@/lib/superdispatch/shipper-mapper";
import {
  getShipmentByOrderNumberFs,
  listShipmentsForCustomerFs,
  listShipmentsForCustomerByEmailFs,
} from "./firestore";

const useFirestore = process.env.SHIPMENTS_SOURCE === "firestore";
const enrichFromSD = process.env.SD_SHIPPER_ENRICH === "true";

/* ============================================================
 * SD overlay merger
 *
 * Given an authoritative Shipment from Firestore/mock + an SD order pulled
 * fresh from the Shipper API, returns a Shipment with SD's fields overlaid
 * on the Auto Line base. The list of overlaid fields is deliberately
 * narrow — SD knows operational state (where the car is, what was
 * photographed) but not Auto Line identity (who the coordinator is, what
 * the customer's prep checklist says, what tier they paid for).
 * ============================================================ */

async function maybeEnrichWithSD(base: Shipment): Promise<Shipment> {
  if (!enrichFromSD || !base.sdOrderGuid) return base;

  try {
    const [sdOrder, sdAttachments] = await Promise.all([
      getShipperOrderByGuid(base.sdOrderGuid),
      getShipperOrderAttachments(base.sdOrderGuid),
    ]);
    if (!sdOrder) return base;

    const sdMapped = mapSDOrderToShipment(sdOrder, {
      orderNumber: base.orderNumber,
      attachments: sdAttachments,
    });

    return {
      ...base,
      // SD-authoritative fields:
      status: sdMapped.status,
      pickedUpAt: sdMapped.pickedUpAt ?? base.pickedUpAt,
      deliveredAt: sdMapped.deliveredAt ?? base.deliveredAt,
      pickupPhotos: sdMapped.pickupPhotos?.length
        ? sdMapped.pickupPhotos
        : base.pickupPhotos,
      transitPhotos: sdMapped.transitPhotos?.length
        ? sdMapped.transitPhotos
        : base.transitPhotos,
      deliveryPhotos: sdMapped.deliveryPhotos?.length
        ? sdMapped.deliveryPhotos
        : base.deliveryPhotos,
    };
  } catch (err) {
    // SD enrichment is best-effort — if SD is down or auth fails, fall back
    // to the base Shipment so the portal still renders. Log so devs notice.
    console.warn(
      `[repository] SD enrichment failed for sdOrderGuid=${base.sdOrderGuid}:`,
      err,
    );
    return base;
  }
}

/* ============================================================
 * Public API
 * ============================================================ */

/** Fetch a single shipment by its human-readable order number. */
export async function getShipmentByOrderNumber(
  orderNumber: string,
): Promise<Shipment | null> {
  const base = useFirestore
    ? await getShipmentByOrderNumberFs(orderNumber)
    : MOCK_SHIPMENTS.find((s) => s.orderNumber === orderNumber) ?? null;
  if (!base) return null;
  return maybeEnrichWithSD(base);
}

/** List all shipments belonging to a customer id (future: keyed by Firebase uid). */
export async function listShipmentsForCustomer(
  customerId: string,
): Promise<Shipment[]> {
  const list = useFirestore
    ? await listShipmentsForCustomerFs(customerId)
    : MOCK_SHIPMENTS.filter((s) => s.customer.id === customerId);
  return Promise.all(list.map(maybeEnrichWithSD));
}

/**
 * List shipments by customer email — the dashboard's query, since magic-link
 * auth identifies customers by email. Email is unique per customer.
 */
export async function listShipmentsForCustomerByEmail(
  email: string,
): Promise<Shipment[]> {
  const normalized = email.trim().toLowerCase();
  const list = useFirestore
    ? await listShipmentsForCustomerByEmailFs(normalized)
    : MOCK_SHIPMENTS.filter(
        (s) => s.customer.email.trim().toLowerCase() === normalized,
      );
  return Promise.all(list.map(maybeEnrichWithSD));
}

/**
 * Fetch a Shipment built entirely from a Super Dispatch order GUID. Useful
 * for smoke-testing the SD integration end-to-end without needing a
 * Firestore record. Returns null if the SD order doesn't exist.
 *
 * Note: the returned Shipment lacks Auto Line-only fields (coordinator,
 * tier, prepChecklist). For production use, prefer the enriched-Firestore
 * path via getShipmentByOrderNumber + sdOrderGuid.
 */
export async function getShipmentFromSDOrderGuid(
  sdOrderGuid: string,
  orderNumber?: string,
): Promise<Shipment | null> {
  const [sdOrder, sdAttachments] = await Promise.all([
    getShipperOrderByGuid(sdOrderGuid),
    getShipperOrderAttachments(sdOrderGuid),
  ]);
  if (!sdOrder) return null;
  return mapSDOrderToShipment(sdOrder, {
    orderNumber,
    attachments: sdAttachments,
  });
}

/* ------------------------------------------------------------
 * Coming soon (when needed):
 * - subscribeToShipment(orderNumber, callback): real-time Firestore
 *   listener for client components needing live updates (map position,
 *   milestone arrivals, photo arrivals).
 * - SD webhook receiver at /api/sd-shipper/webhook → Firestore update,
 *   so customers don't have to refresh to see status changes.
 * ------------------------------------------------------------ */
