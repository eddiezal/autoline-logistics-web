/**
 * Super Dispatch — Shipper API OAuth2 client (SERVER ONLY).
 *
 * Distinct from `pricing.ts`, which uses a static X-API-Key for the Pricing
 * Insights API. The Shipper API uses OAuth2 client_credentials:
 *
 *   1. POST https://api.shipper.superdispatch.com/oauth/token
 *      ?grant_type=client_credentials
 *      with HTTP Basic auth (ClientID:ClientSecret)
 *   2. Returns a JWT bearer token, expires_in ~864000 seconds (~10 days)
 *   3. Use as `Authorization: Bearer <access_token>` on data endpoints
 *
 * Token cache strategy:
 *   - In-memory Map keyed by env (sandbox vs production)
 *   - Refresh ~24h before expiry to avoid edge cases
 *   - Cache survives only the warm Vercel function instance — cold starts
 *     re-fetch, which is fine (~80ms one-time cost)
 *
 * Memory ref: [[autoline_sd_shipper_api]]
 */

import "server-only";

export type ShipperEnv = "sandbox" | "production";

const SHIPPER_BASE_URL = "https://api.shipper.superdispatch.com";

interface TokenCacheEntry {
  accessToken: string;
  /** Epoch ms when this token must be refreshed (24h before SD's expiry). */
  refreshAfter: number;
}

const tokenCache = new Map<ShipperEnv, TokenCacheEntry>();

function getCredentials(env: ShipperEnv): { clientId: string; clientSecret: string } {
  const prefix = env === "sandbox" ? "SD_SHIPPER_SANDBOX" : "SD_SHIPPER_PROD";
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim() ?? "";
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim() ?? "";
  return { clientId, clientSecret };
}

/**
 * Returns true when both ClientID and ClientSecret env vars are set for the
 * specified environment. Used by the repository to decide whether SD reads
 * are viable; routes can short-circuit with a clearer error when false.
 */
export function isShipperConfigured(env: ShipperEnv): boolean {
  const { clientId, clientSecret } = getCredentials(env);
  return Boolean(clientId && clientSecret);
}

/** Returns the active environment per env var, defaulting to sandbox. */
export function getActiveShipperEnv(): ShipperEnv {
  return process.env.SD_SHIPPER_ENV?.trim() === "production"
    ? "production"
    : "sandbox";
}

/**
 * Returns a valid bearer token for the given environment, fetching a fresh
 * one if the cache is empty or stale. Throws if credentials aren't set or
 * the token endpoint refuses (typically AUTH_ERROR with bad ClientID/Secret).
 */
export async function getShipperAccessToken(env: ShipperEnv): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(env);
  if (cached && cached.refreshAfter > now) {
    return cached.accessToken;
  }

  const { clientId, clientSecret } = getCredentials(env);
  if (!clientId || !clientSecret) {
    throw new Error(
      `SD Shipper ${env} credentials missing. Set SD_SHIPPER_${env === "sandbox" ? "SANDBOX" : "PROD"}_CLIENT_ID + _CLIENT_SECRET in .env.local.`,
    );
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenUrl = `${SHIPPER_BASE_URL}/oauth/token?grant_type=client_credentials`;

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
    },
    // No body — SD only reads the Basic header + the query-string grant_type.
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `SD Shipper token request failed (${res.status}): ${text || res.statusText}`,
    );
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!json.access_token || typeof json.expires_in !== "number") {
    throw new Error(
      "SD Shipper token response missing access_token or expires_in.",
    );
  }

  // Refresh 24h before SD's stated expiry. SD currently issues ~10-day tokens,
  // so we'll typically refresh ~9 days in.
  const refreshAfter = now + (json.expires_in - 24 * 60 * 60) * 1000;
  tokenCache.set(env, { accessToken: json.access_token, refreshAfter });

  return json.access_token;
}

/** Force-purge cached tokens — call from tests or after credential rotation. */
export function clearShipperTokenCache(): void {
  tokenCache.clear();
}

/** Base URL for Shipper API requests (data endpoints under /v1/public/...). */
export function getShipperBaseUrl(): string {
  return SHIPPER_BASE_URL;
}
