/**
 * Shipment repository — the layer between portal components and the
 * data store. Today it reads from mock fixtures. When Ben provisions
 * GCP and we wire Firestore (~Mon May 18+), the internals of this file
 * change but the function signatures stay identical so callers don't.
 *
 * Async signatures from day one: today they resolve synchronously, but
 * Firestore's `getDoc`/`getDocs` are async — matching now means the
 * swap is mechanical.
 */

import { MOCK_SHIPMENTS } from "@/lib/mock/shipments";
import type { Shipment } from "@/lib/types/shipment";

/**
 * Fetch a single shipment by its human-readable order number.
 *
 * Today: linear scan over MOCK_SHIPMENTS.
 * Monday: replace internals with:
 *   const snap = await getDoc(doc(db, 'shipments', orderNumber));
 *   if (!snap.exists()) return null;
 *   // Verify auth.uid matches snap.data().customer.id (access control)
 *   return snap.data() as Shipment;
 */
export async function getShipmentByOrderNumber(
  orderNumber: string,
): Promise<Shipment | null> {
  const shipment = MOCK_SHIPMENTS.find(
    (s) => s.orderNumber === orderNumber,
  );
  return shipment ?? null;
}

/* ------------------------------------------------------------
 * Coming soon (when needed):
 *
 * - listShipmentsForCustomer(customerId): for the dashboard list
 *   view when we have a customer with multiple shipments.
 * - subscribeToShipment(orderNumber, callback): for real-time
 *   Firestore listener, used in client components that need live
 *   updates (map position, milestone arrivals, photo arrivals).
 * ------------------------------------------------------------ */
