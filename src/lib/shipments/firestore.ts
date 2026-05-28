/**
 * Firestore-backed shipment reads (SERVER ONLY).
 *
 * Used by the repository when SHIPMENTS_SOURCE=firestore. Docs live in the
 * `shipments` collection, keyed by the human-readable orderNumber (same id
 * used in portal URLs), and stored in the exact `Shipment` shape — so reads
 * are a straight cast with no mapping layer.
 */

import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Shipment } from "@/lib/types/shipment";

const COLLECTION = "shipments";

export async function getShipmentByOrderNumberFs(
  orderNumber: string,
): Promise<Shipment | null> {
  const snap = await getAdminDb().collection(COLLECTION).doc(orderNumber).get();
  if (!snap.exists) return null;
  return snap.data() as Shipment;
}

export async function listShipmentsForCustomerFs(
  customerId: string,
): Promise<Shipment[]> {
  const q = await getAdminDb()
    .collection(COLLECTION)
    .where("customer.id", "==", customerId)
    .get();
  return q.docs.map((d) => d.data() as Shipment);
}

export async function listShipmentsForCustomerByEmailFs(
  email: string,
): Promise<Shipment[]> {
  const q = await getAdminDb()
    .collection(COLLECTION)
    .where("customer.email", "==", email)
    .get();
  return q.docs.map((d) => d.data() as Shipment);
}
