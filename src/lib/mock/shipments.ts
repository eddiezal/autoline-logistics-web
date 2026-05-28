/**
 * Mock shipment fixtures — for portal development before Firestore lands.
 *
 * Two seed shipments at different lifecycle stages:
 * - ALL-2026-04830 (PREP)      — Sarah Chen, LA → Austin, Tesla Model 3
 * - ALL-2026-04831 (IN_TRANSIT) — Mike Johnson, Phoenix → Denver, F-150
 *
 * Consumed via src/lib/shipments/repository.ts only — DO NOT import
 * MOCK_SHIPMENTS directly into components. The repository layer abstracts
 * the swap to Firestore so callers don't change.
 *
 * Add a third shipment (DELIVERED, ES locale) when DeliveredStage gets
 * built. Add more stages as those components come online.
 */

import type {
  Coordinator,
  Driver,
  Shipment,
} from "@/lib/types/shipment";

/* ============================================================
 * Shared fixtures (reused across shipments)
 * ============================================================ */

const COORDINATOR_DANIELLE: Coordinator = {
  name: "Danielle Kim",
  phone: "+18005551001",
  email: "danielle@autolinelogistics.com",
  languages: ["en", "es"],
  hours: { start: "07:00", end: "19:00", timezone: "America/Chicago" },
};

const DRIVER_MARCUS: Driver = {
  name: "Marcus Rodriguez",
  initials: "MR",
  phone: "+15205550199",
  rating: 4.9,
  yearsExperience: 8,
  carrierName: "Desert Express",
};

/* ============================================================
 * Shipment 1 — PREP stage (the rich demo)
 * Sarah Chen, Beverly Hills → Austin, 2023 Tesla Model 3
 * ============================================================ */

const SARAH_SHIPMENT: Shipment = {
  id: "ship_001",
  orderNumber: "ALL-2026-04830",
  status: "prep",

  customer: {
    id: "cust_sarah",
    email: "eddie@zaldivarlabs.com",
    phone: "+13105551234",
    name: { first: "Sarah", last: "Chen" },
    locale: "en",
    preferredChannel: "email",
  },

  vehicle: {
    year: 2023,
    make: "Tesla",
    model: "Model 3",
    condition: "operable",
    enclosedRequired: false,
  },

  origin: { zip: "90210", city: "Beverly Hills", state: "CA" },
  destination: { zip: "78701", city: "Austin", state: "TX" },

  tier: "priority",
  priceLockedCents: 142000,  // $1,420.00

  createdAt: "2026-05-12T15:30:00.000Z",
  bookedAt: "2026-05-12T15:45:00.000Z",

  driver: DRIVER_MARCUS,
  coordinator: COORDINATOR_DANIELLE,

  scheduledPickup: {
    // Bumped to today so the demo reads "today" instead of a stale date.
    // For a true live demo we'd compute this relative to "now"; hardcoded is fine for fixtures.
    start: "2026-05-28T17:00:00.000Z",   // 10:00 AM PDT (today)
    end: "2026-05-28T21:00:00.000Z",     // 2:00 PM PDT
    timezone: "America/Los_Angeles",
  },

  prepChecklist: [
    { key: "removePersonalItems", required: true,  completedAt: "2026-05-13T16:14:00.000Z" },
    { key: "removeAccessories",   required: true,  completedAt: "2026-05-13T16:18:00.000Z" },
    { key: "reduceFuel",          required: true,  completedAt: "2026-05-14T15:02:00.000Z" },
    { key: "disableAlarm",        required: true,  completedAt: "2026-05-14T15:05:00.000Z" },
    { key: "noteExistingDamage",  required: true,  completedAt: "2026-05-14T15:20:00.000Z" },
    { key: "batteryAndTires",     required: true,  completedAt: "2026-05-14T15:25:00.000Z" },
    { key: "wash",                required: false }, // recommended — improves photo clarity, not blocking
    { key: "leaveKeys",           required: true  }, // mandatory — driver can't take the vehicle without them
  ],

  customerPrepPhotos: [
    {
      id: "ph_001",
      url: "/photography/placeholder-vehicle.webp",
      capturedAt: "2026-05-14T15:31:00.000Z",
      capturedBy: "customer",
      angle: "front",
    },
    {
      id: "ph_002",
      url: "/photography/placeholder-vehicle.webp",
      capturedAt: "2026-05-14T15:32:00.000Z",
      capturedBy: "customer",
      angle: "rear",
    },
    {
      id: "ph_003",
      url: "/photography/placeholder-vehicle.webp",
      capturedAt: "2026-05-14T15:33:00.000Z",
      capturedBy: "customer",
      angle: "driverSide",
    },
    {
      id: "ph_004",
      url: "/photography/placeholder-vehicle.webp",
      capturedAt: "2026-05-14T15:34:00.000Z",
      capturedBy: "customer",
      angle: "passengerSide",
    },
    // Dashboard + damage angles still pending
  ],

  milestones: [
    {
      id: "ms_001",
      type: "booked",
      at: "2026-05-12T15:45:00.000Z",
      notes: "Order locked at $1,420 (Priority tier)",
    },
    {
      id: "ms_002",
      type: "driverAssigned",
      at: "2026-05-15T11:20:00.000Z",
      notes: "Marcus Rodriguez (Desert Express) assigned",
    },
    {
      id: "ms_003",
      type: "prepStarted",
      at: "2026-05-13T16:00:00.000Z",
    },
  ],

  payments: [
    {
      id: "pay_001",
      type: "deposit",
      amountCents: 22000,   // $220 (15% of $1,420)
      method: "card",
      status: "succeeded",
      processedAt: "2026-05-12T15:46:00.000Z",
    },
    // Balance pending
  ],
};

/* ============================================================
 * Shipment 2 — IN_TRANSIT stage
 * Mike Johnson, Phoenix → Denver, 2022 Ford F-150
 * ============================================================ */

const MIKE_SHIPMENT: Shipment = {
  id: "ship_002",
  orderNumber: "ALL-2026-04831",
  status: "inTransit",

  customer: {
    id: "cust_mike",
    email: "eddie@zaldivarlabs.com",
    phone: "+14805559876",
    name: { first: "Mike", last: "Johnson" },
    locale: "en",
    preferredChannel: "sms",
  },

  vehicle: {
    year: 2022,
    make: "Ford",
    model: "F-150",
    condition: "operable",
    enclosedRequired: false,
  },

  origin: { zip: "85001", city: "Phoenix", state: "AZ" },
  destination: { zip: "80202", city: "Denver", state: "CO" },

  tier: "expedited",
  priceLockedCents: 189000,  // $1,890.00

  createdAt: "2026-05-25T19:10:00.000Z",
  bookedAt: "2026-05-25T19:25:00.000Z",

  driver: DRIVER_MARCUS,
  coordinator: COORDINATOR_DANIELLE,

  scheduledPickup: {
    start: "2026-05-26T14:00:00.000Z",
    end: "2026-05-26T18:00:00.000Z",
    timezone: "America/Phoenix",
  },

  pickedUpAt: "2026-05-26T15:12:00.000Z",

  // Pickup photos (12 standard)
  pickupPhotos: Array.from({ length: 12 }, (_, i) => ({
    id: `ph_pickup_${i + 1}`,
    url: "/photography/placeholder-vehicle.webp",
    capturedAt: "2026-05-26T15:18:00.000Z",
    capturedBy: "driver" as const,
    angle: (
      [
        "front", "rear", "driverSide", "passengerSide",
        "front", "rear", "driverSide", "passengerSide",
        "dashboard", "dashboard", "front", "rear",
      ] as const
    )[i],
  })),

  // Two transit photos so far
  transitPhotos: [
    {
      id: "ph_transit_1",
      url: "/photography/placeholder-vehicle.webp",
      capturedAt: "2026-05-26T22:30:00.000Z",
      capturedBy: "driver",
      angle: "waypoint",
      caption: "Phoenix departure",
    },
    {
      id: "ph_transit_2",
      url: "/photography/placeholder-vehicle.webp",
      capturedAt: "2026-05-27T18:45:00.000Z",
      capturedBy: "driver",
      angle: "waypoint",
      caption: "Tucson check-in",
    },
  ],

  currentLocation: {
    lat: 35.0844,
    lng: -106.6504,
    label: "Near Albuquerque, NM",
    lastUpdatedAt: "2026-05-28T13:42:00.000Z",
  },

  eta: {
    at: "2026-05-29T14:00:00.000Z",     // 8:00 AM MT
    confidenceScore: 0.85,
    computedAt: "2026-05-28T13:42:00.000Z",
  },

  milestones: [
    {
      id: "ms_101",
      type: "booked",
      at: "2026-05-25T19:25:00.000Z",
    },
    {
      id: "ms_102",
      type: "driverAssigned",
      at: "2026-05-25T22:00:00.000Z",
    },
    {
      id: "ms_103",
      type: "pickedUp",
      at: "2026-05-26T15:12:00.000Z",
      location: { lat: 33.4484, lng: -112.0740, label: "Phoenix, AZ" },
    },
    {
      id: "ms_104",
      type: "atWaypoint",
      at: "2026-05-27T18:45:00.000Z",
      location: { lat: 32.2226, lng: -110.9747, label: "Tucson, AZ" },
    },
  ],

  payments: [
    {
      id: "pay_101",
      type: "deposit",
      amountCents: 28350,   // $283.50 (15% of $1,890)
      method: "card",
      status: "succeeded",
      processedAt: "2026-05-25T19:26:00.000Z",
    },
    {
      id: "pay_102",
      type: "balance",
      amountCents: 160650,  // $1,606.50
      method: "card",
      status: "succeeded",
      processedAt: "2026-05-25T22:30:00.000Z",
    },
  ],
};

/* ============================================================
 * Export
 * ============================================================ */

export const MOCK_SHIPMENTS: Shipment[] = [SARAH_SHIPMENT, MIKE_SHIPMENT];
