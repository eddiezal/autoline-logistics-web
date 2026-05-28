/**
 * Shipment repository — the layer between portal server components and the
 * data store. Backend is toggled by the SHIPMENTS_SOURCE env var:
 *   - "firestore" → live reads via firebase-admin (see ./firestore.ts)
 *   - anything else (default) → in-memory mock fixtures
 *
 * Keep mock as the default so the portal renders even before Firestore is
 * seeded; flip to "firestore" in .env.local once `/api/admin/seed` has run.
 *
 * Server-only: the Firestore path pulls in firebase-admin. No client component
 * imports this module (portal components receive shipments as props).
 *
 * Async signatures throughout so the mock↔Firestore swap is invisible to callers.
 */

import "server-only";
import { MOCK_SHIPMENTS } from "@/lib/mock/shipments";
import type { Shipment } from "@/lib/types/shipment";
import {
  getShipmentByOrderNumberFs,
  listShipmentsForCustomerFs,
  listShipmentsForCustomerByEmailFs,
} from "./firestore";

const useFirestore = process.env.SHIPMENTS_SOURCE === "firestore";

/** Fetch a single shipment by its human-readable order number. */
export async function getShipmentByOrderNumber(
  orderNumber: string,
): Promise<Shipment | null> {
  if (useFirestore) return getShipmentByOrderNumberFs(orderNumber);
  return MOCK_SHIPMENTS.find((s) => s.orderNumber === orderNumber) ?? null;
}

/** List all shipments belonging to a customer id (future: keyed by Firebase uid). */
export async function listShipmentsForCustomer(
  customerId: string,
): Promise<Shipment[]> {
  if (useFirestore) return listShipmentsForCustomerFs(customerId);
  return MOCK_SHIPMENTS.filter((s) => s.customer.id === customerId);
}

/**
 * List shipments by customer email — the dashboard's query, since magic-link
 * auth identifies customers by email. Email is unique per customer.
 */
export async function listShipmentsForCustomerByEmail(
  email: string,
): Promise<Shipment[]> {
  const normalized = email.trim().toLowerCase();
  if (useFirestore) return listShipmentsForCustomerByEmailFs(normalized);
  return MOCK_SHIPMENTS.filter(
    (s) => s.customer.email.trim().toLowerCase() === normalized,
  );
}

/* ------------------------------------------------------------
 * Coming soon (when needed):
 * - subscribeToShipment(orderNumber, callback): real-time Firestore
 *   listener for client components needing live updates (map position,
 *   milestone arrivals, photo arrivals).
 * ------------------------------------------------------------ */
