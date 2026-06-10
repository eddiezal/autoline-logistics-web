/**
 * Super Dispatch — Shipper API order endpoints (SERVER ONLY).
 *
 * Critical SD constraint: there is NO list-all-orders endpoint. Orders are
 * accessed by GUID (offer_guid, order guid, lot_number, or VIN). For the
 * portal flow this means:
 *
 *   1. ALL stores `sdOrderGuid` on each Shipment in Firestore
 *   2. Portal fetches the order from SD by guid when a customer views it
 *   3. SD webhooks push status changes → ALL updates the Firestore record
 *
 * See [[autoline_sd_shipper_api]] for the architecture rationale.
 */

import "server-only";
import {
  getActiveShipperEnv,
  getShipperAccessToken,
  getShipperBaseUrl,
  isShipperConfigured,
} from "./shipper-auth";
import type {
  SDAttachment,
  SDBolUrlResponse,
  SDListResponse,
  SDObjectResponse,
  SDOrder,
} from "./shipper-types";

/** Throws if env var creds aren't set; returns the chosen environment. */
function activeEnvOrThrow() {
  const env = getActiveShipperEnv();
  if (!isShipperConfigured(env)) {
    throw new Error(
      `SD Shipper ${env} not configured. Set SD_SHIPPER_${env === "sandbox" ? "SANDBOX" : "PROD"}_CLIENT_ID + _CLIENT_SECRET in .env.local.`,
    );
  }
  return env;
}

/**
 * GET /v1/public/orders/{guid} — fetch a single order by its GUID.
 * Returns null on 404 (order doesn't exist or was archived/deleted).
 * Throws on any other non-2xx (network/auth/server errors).
 */
export async function getShipperOrderByGuid(
  guid: string,
): Promise<SDOrder | null> {
  const env = activeEnvOrThrow();
  const token = await getShipperAccessToken(env);

  const url = `${getShipperBaseUrl()}/v1/public/orders/${encodeURIComponent(guid)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    // Re-fetch on every portal page load. SD enforces ~50 req/s so this is
    // safe at our scale; revisit with stale-while-revalidate cache later.
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `SD Shipper order fetch failed (${res.status}): ${text || res.statusText}`,
    );
  }

  const json = (await res.json()) as SDObjectResponse<SDOrder>;
  if (json.status !== "success" || !json.data?.object) {
    throw new Error("SD Shipper order response malformed.");
  }
  return json.data.object;
}

/**
 * GET /v1/public/orders/search?vin=... — search for orders matching a VIN.
 * Returns an empty array if no matches. VIN search is the most useful lookup
 * for customer support flows (customer reads the VIN off the dashboard).
 */
export async function searchShipperOrdersByVin(
  vin: string,
): Promise<SDOrder[]> {
  const env = activeEnvOrThrow();
  const token = await getShipperAccessToken(env);

  const url =
    `${getShipperBaseUrl()}/v1/public/orders/search?vin=` +
    encodeURIComponent(vin);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `SD Shipper VIN search failed (${res.status}): ${text || res.statusText}`,
    );
  }

  const json = (await res.json()) as SDListResponse<SDOrder>;
  if (json.status !== "success") {
    throw new Error("SD Shipper VIN search response malformed.");
  }
  return json.data?.objects ?? [];
}

/**
 * GET /v1/public/orders/{guid}/attachments — photos + BOL/POD PDFs.
 * Returns empty array if the order has no attachments yet (common
 * pre-pickup).
 */
export async function getShipperOrderAttachments(
  orderGuid: string,
): Promise<SDAttachment[]> {
  const env = activeEnvOrThrow();
  const token = await getShipperAccessToken(env);

  const url =
    `${getShipperBaseUrl()}/v1/public/orders/` +
    encodeURIComponent(orderGuid) +
    `/attachments`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (res.status === 404) return [];
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `SD Shipper attachments fetch failed (${res.status}): ${text || res.statusText}`,
    );
  }

  const json = (await res.json()) as SDListResponse<SDAttachment>;
  if (json.status !== "success") {
    throw new Error("SD Shipper attachments response malformed.");
  }
  return json.data?.objects ?? [];
}

/**
 * GET /v1/public/orders/{guid}/bol — fetch the BOL PDF URL.
 * Returns null if the BOL isn't available yet (pre-pickup).
 */
export async function getShipperOrderBolUrl(
  orderGuid: string,
): Promise<string | null> {
  const env = activeEnvOrThrow();
  const token = await getShipperAccessToken(env);

  const url =
    `${getShipperBaseUrl()}/v1/public/orders/` +
    encodeURIComponent(orderGuid) +
    `/bol`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `SD Shipper BOL fetch failed (${res.status}): ${text || res.statusText}`,
    );
  }

  const json = (await res.json()) as SDBolUrlResponse;
  if (json.status !== "success" || !json.data?.object?.url) {
    return null;
  }
  return json.data.object.url;
}
