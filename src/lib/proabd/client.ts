/**
 * ProABD (Superflo) API client.
 *
 * Thin wrapper around POST /createLead. Called from /api/lead/route.ts
 * after the Firestore write so every website quote form submission also
 * lands in Renee/Ginger/Nelson's ProABD queue as a fresh lead.
 *
 * Request format — confirmed EMPIRICALLY 2026-07-14 via a 4-variant test
 * matrix (see claude/proabd-createlead-integration-notes.md in the
 * AutoExpress project, test lead ABD_Id 37256124):
 *   - Body: a single bare JSON object. NOT an array (despite Brian's
 *     2026-07-13 email saying "json array" — array-wrapped bodies fail
 *     with "Shipper - First_Name needs a value"), NOT form-encoded.
 *   - Content-Type: application/json
 *   - Auth: HTTP Basic via PROABD_API_KEY + PROABD_API_PIN. The header is
 *     REQUIRED — body-only auth returns 2099 "Company Token is invalid".
 *     api_key/api_pin ride along in the body as empty strings per Brian
 *     (Superflo is removing them from the docs).
 *
 * Response format (also confirmed live): HTTP status is 200 even on
 * failure, so the real success signal is body.Status === 1001:
 *   success: {Status: 1001, Message: "Lead Created",
 *             Results: {ABD_Id, CustomQuoteID, mileage}}
 *   validation failure: {Status: 2098, Message, Errors: [...]}
 *   auth failure: {Error_Code: 2099, Error_Message}
 * ABD_Id is the permanent record id and the join key to Export API
 * webhook events (proabd_webhook_events.raw_item.ABD_Id). mileage is
 * null at create time and computed downstream.
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
  /** Visitor language ("es" | "en"). Spanish routes via the Website
   *  Spanish referrer (PROABD_REFERRER_ID_ES) so ProABD's rules can
   *  assign Spanish-speaking agents. Added 2026-07-22 per Brian. */
  language?: string;
  /** ISO date string (YYYY-MM-DD). Optional; ProABD accepts blank. */
  availableDate?: string;
}

export interface CreateLeadResponse {
  ok: boolean;
  /** ProABD's permanent record id (Results.ABD_Id). Stable across the
   *  lead → quote → order lifecycle; join key to Export API webhook
   *  events (proabd_webhook_events.raw_item.ABD_Id). */
  abdId?: string;
  /** Echo of our Custom_Id (Results.CustomQuoteID / CustomQuoteId).
   *  Was empty until Brian added Custom_Id passthrough to createLead
   *  2026-07-14; abdId remains the primary join key regardless. */
  customQuoteId?: string;
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
  // Referrer routing (Brian, 2026-07-22): ProABD referrers can be assigned
  // to agent GROUPS, so language routing rides on the referrer ID. Spanish
  // web leads send PROABD_REFERRER_ID_ES ("Website Spanish" referrer, to be
  // created in ProABD) when set; everything else uses the default Website
  // referrer. Until the ES env var exists, Spanish leads fall through to
  // the default — no behavior change on deploy.
  const defaultReferrerId = process.env.PROABD_REFERRER_ID ?? "8";
  const referrerId =
    input.language === "es"
      ? (process.env.PROABD_REFERRER_ID_ES ?? defaultReferrerId)
      : defaultReferrerId;
  const url = baseUrl + "/createLead/";

  // Payload: single bare JSON object (see file header for the empirical
  // confirmation). All values sent as strings, matching Export API payload
  // conventions. api_key/api_pin are intentionally EMPTY — real auth is
  // the Basic header; sending real values in the body changes nothing
  // (tested), and Superflo is dropping these fields from the docs.
  const payload = {
    api_key: "",
    api_pin: "",
    Referrer_Id: referrerId,
    Custom_Id: input.leadRef,
    gclid: input.gclid ?? "",
    Note: input.notes ?? "",
    Shipper: {
      First_Name: input.firstName,
      Last_Name: input.lastName ?? "",
      Email: input.email,
      Phone_1: input.phone,
    },
    Transport: {
      Origin: {
        City: input.origin.city ?? "",
        State: input.origin.state,
        Zipcode: input.origin.zip,
      },
      Destination: {
        City: input.destination.city ?? "",
        State: input.destination.state,
        Zipcode: input.destination.zip,
      },
      // Single vehicle for now. Multi-vehicle support (Task #135) will
      // map additional entries here.
      Vehicles: [
        {
          v_year: input.vehicle.year,
          v_make: input.vehicle.make,
          v_model: input.vehicle.model,
          veh_op: input.vehicle.operable ? "1" : "0",
        },
      ],
      Available_Date: input.availableDate ?? "",
    },
  };

  // Debug log: top-level field names only (no values; payload contains PII).
  console.log(
    "[proabd] createLead sending fields:",
    Object.keys(payload).join(", "),
  );

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

    // Parse the body as JSON regardless of the Content-Type header.
    // ProABD returns its JSON with a non-JSON content type, which made a
    // header-gated res.json() silently fall back to text and read a
    // successful create as "unknown response" (caught live 2026-07-14,
    // lead AL-260715-PVB5C1 / ABD_Id 37257179: lead created, stamp skipped).
    let raw: unknown;
    try {
      const text = await res.text();
      try {
        raw = JSON.parse(text);
      } catch {
        raw = text; // genuinely non-JSON; keep for debugging
      }
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

    const rawObj =
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

    // ProABD returns HTTP 200 even on failure — res.ok is NOT a success
    // signal. The real signal is body.Status === 1001 ("Lead Created").
    // Failures: {Status: 2098, Message, Errors: []} for validation,
    // {Error_Code: 2099, Error_Message} for auth.
    const statusCode =
      typeof rawObj.Status === "number"
        ? rawObj.Status
        : typeof rawObj.Error_Code === "number"
          ? rawObj.Error_Code
          : undefined;

    if (statusCode !== 1001) {
      const errors = Array.isArray(rawObj.Errors)
        ? rawObj.Errors.join("; ")
        : "";
      const message =
        String(rawObj.Message ?? rawObj.Error_Message ?? "unknown response") +
        (errors ? " — " + errors : "");
      console.error(
        "[proabd] createLead rejected (Status " +
          String(statusCode ?? "?") +
          "): " +
          message,
      );
      return { ok: false, error: message, status: statusCode, raw };
    }

    console.log("[proabd] createLead ok:", JSON.stringify(raw));

    const results =
      rawObj.Results && typeof rawObj.Results === "object"
        ? (rawObj.Results as Record<string, unknown>)
        : {};

    return {
      ok: true,
      abdId:
        typeof results.ABD_Id === "number" || typeof results.ABD_Id === "string"
          ? String(results.ABD_Id)
          : undefined,
      // Casing is uncertain: live response 2026-07-14 says "CustomQuoteID",
      // Brian's 2026-07-14 email says "CustomQuoteId". Accept both.
      customQuoteId:
        typeof results.CustomQuoteID === "string" && results.CustomQuoteID
          ? results.CustomQuoteID
          : typeof results.CustomQuoteId === "string" && results.CustomQuoteId
            ? results.CustomQuoteId
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
