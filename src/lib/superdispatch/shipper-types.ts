/**
 * Super Dispatch — Shipper API response shapes (SERVER ONLY).
 *
 * Modeled from SD's documented schemas:
 *   - https://developer.superdispatch.com/shipper/docs/quickstart  (creation example)
 *   - https://developer.superdispatch.com/shipper/reference/get-order-details
 *
 * Fields marked as best-guess are refined as we observe live responses; SD's
 * docs hide some response examples behind JS-rendered widgets. If a field
 * comes back as null when expected, drop it to optional here.
 */

import "server-only";

/* ============================================================
 * Common wrapper — every list endpoint returns this shape.
 * Single-object endpoints wrap inside `data.object` instead.
 * ============================================================ */

export interface SDListResponse<T> {
  status: "success" | "fail";
  data: {
    objects: T[];
    pagination: SDPagination;
  };
}

export interface SDObjectResponse<T> {
  status: "success" | "fail";
  data: {
    object: T;
  };
}

export interface SDPagination {
  total_pages: number;
  total_objects: number;
  limit: number;
  page: number;
}

/* ============================================================
 * Order — the central entity
 * ============================================================ */

export type SDOrderStatus =
  | "new"
  | "pending"
  | "accepted"
  | "picked_up"
  | "delivered"
  | "invoiced"
  | "paid"
  | "canceled"
  | "archived";

export type SDTransportType = "OPEN" | "ENCLOSED";

export interface SDVenue {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  latitude?: number;
  longitude?: number;
}

export interface SDPickupOrDelivery {
  venue: SDVenue;
  date_type?: "estimated" | "scheduled";
  scheduled_at?: string;
  scheduled_ends_at?: string;
  adjusted_date?: string | null;
  completed_at?: string | null;
  notes?: string;
}

export interface SDVehicle {
  guid?: string;
  vin?: string;
  lot_number?: string;
  year?: number;
  make?: string;
  model?: string;
  type?: string;        // 'sedan' | 'suv' | 'truck' | etc.
  color?: string;
  is_inoperable?: boolean;
  curb_weight?: number;
  curb_weight_unit?: "lbs" | "kg";
  price?: number | string;
  tariff?: string;
  inspection_type?: "standard" | "advanced";
}

export interface SDCustomer {
  guid?: string;
  name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string | number;
  notes?: string;
}

export interface SDPayment {
  terms?: string;        // '5_days', 'net_30', etc.
  amount?: string;
  method?: "cash" | "ach" | "check" | "wire" | "comchek" | string;
  notes?: string | null;
  reference_number?: string;
  sent_date?: string;
}

export interface SDOrder {
  guid: string;
  number: string;        // human-readable order number, e.g. "ORDER-4532"
  status: SDOrderStatus;
  transport_type?: SDTransportType;
  inspection_type?: "standard" | "advanced";
  instructions?: string;
  loadboard_instructions?: string;
  dispatcher_name?: string;
  sales_representative?: string;
  broker_fee?: string;
  price?: string;
  created_at?: string;
  updated_at?: string;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  carrier_guid?: string | null;
  customer?: SDCustomer;
  pickup?: SDPickupOrDelivery;
  delivery?: SDPickupOrDelivery;
  vehicles?: SDVehicle[];
  payment?: SDPayment;
}

/* ============================================================
 * Attachments — photos + BOL/POD PDFs
 * ============================================================ */

export type SDAttachmentType =
  | "pickup_photo"
  | "delivery_photo"
  | "transit_photo"
  | "bol"
  | "pod"
  | "invoice"
  | "other";

export interface SDAttachment {
  guid: string;
  type: SDAttachmentType;
  url: string;
  thumbnail_url?: string;
  caption?: string;
  created_at?: string;
  created_by?: string;
}

/* ============================================================
 * BOL URL response (a special-case single-object endpoint)
 * ============================================================ */

export interface SDBolUrlResponse {
  status: "success" | "fail";
  data: {
    object: {
      url: string;
    };
  };
}

/* ============================================================
 * Customers list — for the early smoke test we ran
 * ============================================================ */

export interface SDCustomerListed {
  guid: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  created_at?: string;
  updated_at?: string;
}
