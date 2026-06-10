/**
 * Super Dispatch — SD Order → portal Shipment mapper (SERVER ONLY).
 *
 * SD's order schema overlaps with our Shipment but isn't 1:1. This mapper
 * handles the impedance mismatch and leaves fields undefined where SD has
 * no concept (prepChecklist, customerPrepPhotos, tier, coordinator). Those
 * are Auto Line-specific and should be merged in from a Firestore overlay
 * (see repository.ts) if present.
 *
 * Currency note: SD returns prices as decimal strings ("650.00"); we store
 * cents as integers, so multiply by 100 and round.
 *
 * Status machine: SD's lifecycle and ours overlap but use different labels.
 * See `mapSDStatusToShipmentStatus` for the translation.
 */

import "server-only";
import type {
  SDAttachment,
  SDAttachmentType,
  SDOrder,
  SDOrderStatus,
  SDPickupOrDelivery,
  SDVehicle,
  SDVenue,
} from "./shipper-types";
import type {
  Address,
  ISODate,
  Photo,
  PhotoAngle,
  Shipment,
  ShipmentStatus,
  Vehicle,
} from "@/lib/types/shipment";

/* ============================================================
 * Status mapping
 * ============================================================ */

export function mapSDStatusToShipmentStatus(
  sd: SDOrderStatus,
): ShipmentStatus {
  switch (sd) {
    case "new":
    case "pending":
      return "booked";
    case "accepted":
      return "prep";
    case "picked_up":
      return "inTransit";
    case "delivered":
      return "delivered";
    case "invoiced":
    case "paid":
      return "completed";
    case "canceled":
    case "archived":
      // No "canceled" in our model; closest is "claimed" (escape valve).
      return "claimed";
    default:
      // SD might add new statuses; default to "booked" rather than throwing.
      return "booked";
  }
}

/* ============================================================
 * Currency
 * ============================================================ */

export function dollarsStringToCents(value: string | undefined): number {
  if (!value) return 0;
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

/* ============================================================
 * Vehicle
 * ============================================================ */

function mapVehicle(sd: SDVehicle | undefined): Vehicle {
  return {
    year: sd?.year ?? 0,
    make: sd?.make ?? "Unknown",
    model: sd?.model ?? "Unknown",
    vin: sd?.vin,
    condition: sd?.is_inoperable ? "inoperable" : "operable",
    enclosedRequired: false, // SD stores trailer_type at the order level, not vehicle
  };
}

/* ============================================================
 * Address (Venue → portal Address)
 * ============================================================ */

function mapVenueToAddress(v: SDVenue | undefined): Address {
  return {
    zip: v?.zip ?? "",
    city: v?.city ?? "",
    state: v?.state ?? "",
    street: v?.address,
  };
}

/* ============================================================
 * Pickup window
 * ============================================================ */

function mapPickupWindow(p: SDPickupOrDelivery | undefined) {
  if (!p?.scheduled_at) return undefined;
  return {
    start: p.scheduled_at as ISODate,
    end: (p.scheduled_ends_at ?? p.scheduled_at) as ISODate,
    // SD doesn't return a timezone — fall back to a sensible default. The
    // mapper caller should override with the destination timezone if known.
    timezone: "America/Los_Angeles",
  };
}

/* ============================================================
 * Photos (SD attachments → portal Photo[])
 *
 * SD attachments come with a type label (pickup_photo, transit_photo, etc.)
 * but no specific angle (front/rear/etc.). We bucket by attachment type and
 * synthesize PhotoAngle as "waypoint" for transit + the type-specific label
 * for pickup/delivery so the portal grid still renders cleanly.
 * ============================================================ */

function photoAngleForType(type: SDAttachmentType): PhotoAngle {
  switch (type) {
    case "pickup_photo":
      return "front"; // fallback — the portal grid groups by angle; pickup buckets render under "Pickup" tab
    case "transit_photo":
      return "waypoint";
    case "delivery_photo":
      return "delivery";
    default:
      return "front";
  }
}

function mapAttachmentsToPhotos(
  attachments: SDAttachment[] | undefined,
  filterType: SDAttachmentType,
): Photo[] {
  if (!attachments) return [];
  return attachments
    .filter((a) => a.type === filterType)
    .map((a) => ({
      id: a.guid,
      url: a.url,
      thumbUrl: a.thumbnail_url,
      capturedAt: (a.created_at ?? new Date().toISOString()) as ISODate,
      capturedBy: "driver", // SD attachments are always driver-uploaded
      angle: photoAngleForType(a.type),
      caption: a.caption,
    }));
}

/* ============================================================
 * Main mapper
 *
 * Returns a Shipment built entirely from SD data. Fields that have no SD
 * equivalent (coordinator, prepChecklist, customerPrepPhotos, tier) are
 * left undefined; callers should merge in Auto Line overlay from Firestore
 * if present.
 * ============================================================ */

export interface MapSDOrderOptions {
  /** Force a specific Auto Line order number — defaults to SD's order.number */
  orderNumber?: string;
  /** SD attachments fetched in parallel — keeps mapper synchronous. */
  attachments?: SDAttachment[];
}

export function mapSDOrderToShipment(
  sd: SDOrder,
  opts: MapSDOrderOptions = {},
): Shipment {
  const attachments = opts.attachments ?? [];
  const orderNumber = opts.orderNumber ?? sd.number;

  return {
    id: sd.guid,
    orderNumber,
    status: mapSDStatusToShipmentStatus(sd.status),

    customer: {
      id: sd.customer?.guid ?? sd.guid,
      email: sd.customer?.email ?? "",
      phone: sd.customer?.phone ?? "",
      name: splitCustomerName(sd.customer?.name ?? sd.customer?.contact_name),
      locale: "en", // SD doesn't track locale; portal defaults to EN
      preferredChannel: "email",
    },

    vehicle: mapVehicle(sd.vehicles?.[0]),
    origin: mapVenueToAddress(sd.pickup?.venue),
    destination: mapVenueToAddress(sd.delivery?.venue),
    tier: "standby", // SD has no tier; placeholder until merged from overlay
    priceLockedCents: dollarsStringToCents(sd.price),

    createdAt: (sd.created_at ?? new Date().toISOString()) as ISODate,
    bookedAt: sd.created_at as ISODate | undefined,

    scheduledPickup: mapPickupWindow(sd.pickup),

    pickedUpAt: sd.picked_up_at as ISODate | null | undefined ?? undefined,
    pickupPhotos: mapAttachmentsToPhotos(attachments, "pickup_photo"),

    transitPhotos: mapAttachmentsToPhotos(attachments, "transit_photo"),

    deliveredAt: sd.delivered_at as ISODate | null | undefined ?? undefined,
    deliveryPhotos: mapAttachmentsToPhotos(attachments, "delivery_photo"),

    // SD doesn't track these — leave for Firestore overlay to provide.
    driver: undefined,
    carrier: undefined,
    coordinator: undefined,
    prepChecklist: undefined,
    customerPrepPhotos: undefined,
    currentLocation: undefined,
    eta: undefined,

    milestones: [], // Built from SD activities endpoint in a follow-up
    payments: [],   // SD payment terms don't map cleanly to portal Payment[]; defer
  };
}

/* ============================================================
 * Helpers
 * ============================================================ */

function splitCustomerName(full: string | undefined): {
  first: string;
  last: string;
} {
  if (!full) return { first: "", last: "" };
  const trimmed = full.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return {
    first: parts[0],
    last: parts.slice(1).join(" "),
  };
}
