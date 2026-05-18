/**
 * Shipment type definitions — single source of truth.
 *
 * Mirrors the data model documented in portal-design/architecture-v1.md
 * Section 3. All portal components, repository functions, and (eventually)
 * Firestore docs use these shapes.
 *
 * Design notes:
 * - Timestamps are ISO 8601 strings (JSON-safe, Firestore-friendly).
 *   Convert to Date only in components when formatting needs require it.
 * - Currency stored as integer cents on `*Cents` fields. Format on
 *   display via Intl.NumberFormat to avoid float math bugs.
 * - One Shipment interface (not status-discriminated unions). Stage-
 *   specific data is optional and present at the right lifecycle phase.
 *   Components gate UI with `if (shipment.driver) ...` style checks.
 * - `assertNever` at the bottom enforces exhaustive switch on
 *   `ShipmentStatus` at the type-check level.
 */

/* ============================================================
 * Primitives + aliases
 * ============================================================ */

/** ISO 8601 date-time string. e.g. "2026-05-17T14:30:00.000Z". */
export type ISODate = string;

export type Locale = "en" | "es";

export type Tier = "standby" | "priority" | "expedited";

/** Lifecycle status. See architecture doc Section 6 for state machine. */
export type ShipmentStatus =
  | "booked"
  | "prep"
  | "pickedUp"
  | "inTransit"
  | "atDelivery"
  | "delivered"
  | "completed"
  | "claimed";

/* ============================================================
 * Geography
 * ============================================================ */

export interface Address {
  zip: string;
  city: string;
  state: string;        // 'CA', 'TX', etc.
  street?: string;      // Often unknown at quote stage.
}

export interface Location {
  lat: number;
  lng: number;
  label: string;        // "Near Albuquerque, NM"
  lastUpdatedAt: ISODate;
}

/* ============================================================
 * People
 * ============================================================ */

export interface Customer {
  id: string;
  email: string;
  phone: string;        // E.164 format.
  name: { first: string; last: string };
  locale: Locale;
  preferredChannel: "email" | "sms";
}

export interface Driver {
  name: string;
  initials: string;     // "MR" — for avatar fallback.
  phone: string;
  photoUrl?: string;
  rating: number;       // 0–5
  yearsExperience: number;
  carrierName: string;  // Denormalized for UI (avoid a second lookup).
}

export interface Coordinator {
  name: string;
  phone: string;
  email: string;
  languages: Locale[];
  hours: {
    start: string;      // "07:00"
    end: string;        // "19:00"
    timezone: string;   // "America/Chicago"
  };
  photoUrl?: string;
}

/* ============================================================
 * Vehicle + Carrier
 * ============================================================ */

export interface Vehicle {
  year: number;
  make: string;
  model: string;
  vin?: string;
  condition: "operable" | "inoperable";
  enclosedRequired: boolean;
  existingDamageNotes?: string;
}

export interface Carrier {
  name: string;
  mcNumber: string;
  usdotNumber: string;
  rating: number;
  bmc84OnFile: boolean;
  source: "super_dispatch" | "central_dispatch" | "auto_line_express";
}

/* ============================================================
 * Lifecycle: pickup window, milestones
 * ============================================================ */

export interface PickupWindow {
  start: ISODate;
  end: ISODate;
  timezone: string;     // "America/Los_Angeles"
}

export type MilestoneType =
  | "booked"
  | "prepStarted"
  | "driverAssigned"
  | "pickedUp"
  | "atWaypoint"
  | "atDestinationRegion"
  | "delivered"
  | "documentsComplete";

export interface Milestone {
  id: string;
  type: MilestoneType;
  at: ISODate;
  location?: { lat: number; lng: number; label: string };
  notes?: string;
}

/* ============================================================
 * Photos
 * ============================================================ */

export type PhotoAngle =
  | "front"
  | "rear"
  | "driverSide"
  | "passengerSide"
  | "dashboard"
  | "damage"
  | "waypoint"
  | "delivery";

export interface Photo {
  id: string;
  url: string;
  thumbUrl?: string;
  capturedAt: ISODate;
  capturedBy: "customer" | "driver" | "system";
  angle: PhotoAngle;
  caption?: string;
}

/* ============================================================
 * Tracking + ETA
 * ============================================================ */

export interface ETAEstimate {
  at: ISODate;
  confidenceScore: number;   // 0–1
  computedAt: ISODate;
}

/* ============================================================
 * Payments
 * ============================================================ */

export type PaymentMethod =
  | "card"
  | "paypal"
  | "apple_pay"
  | "google_pay"
  | "ach";

export type PaymentType = "deposit" | "balance" | "refund";

export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "refunded";

export interface Payment {
  id: string;
  type: PaymentType;
  amountCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  processedAt: ISODate;
  authorizeNetTransactionId?: string;
}

/* ============================================================
 * Prep checklist
 * ============================================================ */

export type ChecklistKey =
  | "removePersonalItems"
  | "removeAccessories"
  | "reduceFuel"
  | "disableAlarm"
  | "noteExistingDamage"
  | "batteryAndTires"
  | "wash"
  | "leaveKeys";

export interface ChecklistItem {
  key: ChecklistKey;
  completedAt?: ISODate;
}

/* ============================================================
 * The main shipment shape
 * ============================================================ */

export interface Shipment {
  id: string;
  orderNumber: string;          // "ALL-2026-04830" — used in URLs.
  status: ShipmentStatus;

  // ── Always present ─────────────────────────────────────────
  customer: Customer;
  vehicle: Vehicle;
  origin: Address;
  destination: Address;
  tier: Tier;
  priceLockedCents: number;
  createdAt: ISODate;
  bookedAt?: ISODate;

  // ── Assigned at PREP onward ────────────────────────────────
  driver?: Driver;
  carrier?: Carrier;
  coordinator?: Coordinator;    // Can be assigned earlier; usually is.
  scheduledPickup?: PickupWindow;

  // ── PREP-specific ──────────────────────────────────────────
  prepChecklist?: ChecklistItem[];
  customerPrepPhotos?: Photo[];

  // ── After pickup ───────────────────────────────────────────
  pickedUpAt?: ISODate;
  pickupPhotos?: Photo[];

  // ── In transit ─────────────────────────────────────────────
  currentLocation?: Location;
  eta?: ETAEstimate;
  transitPhotos?: Photo[];

  // ── Delivery ───────────────────────────────────────────────
  deliveredAt?: ISODate;
  deliveryPhotos?: Photo[];

  // ── Always present (empty array is fine) ───────────────────
  milestones: Milestone[];
  payments: Payment[];
}

/* ============================================================
 * Helpers
 * ============================================================ */

/**
 * Compile-time exhaustiveness check for switch statements on union
 * types like ShipmentStatus. If a new status is added to the enum
 * and not handled in the switch, TypeScript will error here.
 *
 * Usage:
 *   switch (shipment.status) {
 *     case 'booked': return <BookedStage ... />;
 *     // ...all cases...
 *     default: return assertNever(shipment.status);
 *   }
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled shipment status: ${JSON.stringify(x)}`);
}
