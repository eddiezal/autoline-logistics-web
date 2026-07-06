/**
 * ProABD (Superflo) API client.
 *
 * Thin wrapper around POST /createLead. Called from /api/lead/route.ts
 * after the Firestore write so every website quote form submission also
 * lands in Renee/Ginger/Nelson's ProABD queue as a fresh lead.
 *
 * Auth: HTTP Basic via PROABD_API_KEY + PROABD_API_PIN (from env). Also
 * passes Api_key + Api_pin in body as belt-and-suspenders since Superflo
 * supports both patterns.
 *
 * Field naming mirrors the JSON Export Structure Cheli sent 2026-07-06.
 * Confirmed fields include Shipper (First_Name, Last_Name, Email,
 * Phone_1), Origin/Destination (City, State, Zipcode), Vehicles
 * (v_year, v_make, v_model, veh_op). The /createLead request format
 * isn't formally documented; this uses a flat structure that matches
 * the createLead endpoint pattern. If Superflo returns a validation
 * error we adjust based on the actual response.
 *
 * Failures are logged verbosely and returned as {ok: false, ...}. Caller
 * should NEVER block the lead flow on this call. Treat it as best-effort
 * CRM sync, not a critical write.
 */

import "server-only";

const PROABD_TIMEOUT_MS = 8000;

export interface CreateLeadInput {
  /** Our internal lead reference, sent as Custom_Id for join-back. */
  leadRef: string;
  /** Shipper (customer) first name. Required per Renee 2026-07-06 form fix. */
  firstName: string;
  /** Shipper last name. Optional to keep form friction low. */
  lastName?: string;
  email: string;
  phone: string;
  /** Pickup location. City optional if we don't have it. */
  origin: { city?: string; state: string; zip: string };
  /** Delivery location. */
  destination: { city?: string; state: string; zip: string };
  /** Vehicle. Multi-vehicle support (Task #135) will change this to an array. */
  vehicle: {
    year: string;
    make: string;
    model: string;
    /** true = operable, false = inoperable. */
    operable: boolean;
  };
  /** Google Ads click ID for OCI attribution round-trip. */
  gclid?: string;
  /** Free-text notes from the customer. */
  notes?: string;
  /** ISO date string (YYYY-MM-DD). Optional; ProABD accepts blank. */
  availableDate?: string;
}

export interface CreateLeadResponse {
  ok: boolean;
  /** Raw internal ID. Not URL-safe. */
  quote_id?: string;
  /** URL-safe, used for /getQuoteOrderDetail lookups. */
  encrypted_quote_id?: string;
  /** Superflo-provided company identifier. */
  encrypted_company_id?: string;
  /** Full raw response for debugging / migration. */
  raw?: unknown;
  error?: string;
  status?: number;
}

function isConfigured(): boolean {
  return Boolean(
    process.env.PROABD_API_KEY &&
      process.env.PROABD_API_PIN &&
      process.env.PROABD_API_BASE_URL,
  );
}

function buildAuthHeader(): string {
  const key = process.env.PROABD_API_KEY as string;
  const pin = process.env.PROABD_API_PIN as string;
  const encoded = Buffer.from(key + ":" + pin).toString("base64");
  return "Basic " + encoded;
}

/**
 * Create a lead in ProABD. Best-effort. Never throws.
 */
export async function createLead(
  input: CreateLeadInput,
): Promise<CreateLeadResponse> {
  if (!isConfigured()) {
    console.warn(
      "[proabd] createLead skipped: PROABD_API_KEY / PROABD_API_PIN / PROABD_API_BASE_URL not set",
    );
    return { ok: false, error: "not_configured" };
  }

  const baseUrl = (process.env.PROABD_API_BASE_URL as string).replace(/\/$/, "");
  const referrerId = process.env.PROABD_REFERRER_ID ?? "8";
  const url = baseUrl + "/createLead";

  // Payload structure. Flat field naming mirrors what we observed in the
  // JSON Export Structure PDF (Cheli 2026-07-06). Api_key + Api_pin in body
  // as a fallback in case Basic auth header doesn't parse on their side.
  const payload = {
    Api_key: process.env.PROABD_API_KEY,
    Api_pin: process.env.PROABD_API_PIN,
    Referrer_Id: referrerId,
    Custom_Id: input.leadRef,
    // Shipper
    First_Name: input.firstName,
    Last_Name: input.lastName ?? "",
    Email: input.email,
    Phone_1: input.phone,
    // Origin
    Origin_City: input.origin.city ?? "",
    Origin_State: input.origin.state,
    Origin_Zipcode: input.origin.zip,
    // Destination
    Destination_City: input.destination.city ?? "",
    Destination_State: input.destination.state,
    Destination_Zipcode: input.destination.zip,
    // Vehicle (single for now; multi-vehicle refactor tracked as Task #135)
    Vehicle_Year: input.vehicle.year,
    Vehicle_Make: input.vehicle.make,
    Vehicle_Model: input.vehicle.model,
    Vehicle_Op: input.vehicle.operable ? "1" : "0",
    // Extras
    Available_Date: input.availableDate ?? "",
    Note: input.notes ?? "",
    // Google Ads attribution
    gclid: input.gclid ?? "",
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROABD_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthHeader(),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = res.headers.get("content-type") ?? "";
    let raw: unknown;
    try {
      raw = contentType.includes("application/json")
        ? await res.json()
        : await res.text();
    } catch {
      raw = null;
    }

    if (!res.ok) {
      console.error("[proabd] createLead HTTP " + res.status + ":", raw);
      return {
        ok: false,
        error: "HTTP " + res.status,
        status: res.status,
        raw,
      };
    }

    // Log raw response on success so we learn the actual return shape
    // and can tighten typing on the next iteration.
    console.log("[proabd] createLead ok:", JSON.stringify(raw));

    const rawObj =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

    return {
      ok: true,
      quote_id:
        typeof rawObj.quote_id === "string" ? rawObj.quote_id : undefined,
      encrypted_quote_id:
        typeof rawObj.encrypted_quote_id === "string"
          ? rawObj.encrypted_quote_id
          : undefined,
      encrypted_company_id:
        typeof rawObj.encrypted_company_id === "string"
          ? rawObj.encrypted_company_id
          : undefined,
      raw,
    };
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[proabd] createLead network/timeout error:", msg);
    return { ok: false, error: msg };
  }
}
