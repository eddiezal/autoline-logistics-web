/**
 * Authorize.Net — payments client (SERVER ONLY).
 * Imported only by /api/payments/* route handlers — never a client component —
 * so the API Login ID / Transaction Key / Signature Key never reach the browser.
 * Do NOT add "use client".
 *
 * Integration model (PCI-friendly):
 *   - Card data is tokenized IN THE BROWSER by Accept.js -> opaqueData token.
 *   - This server only ever sees the opaque token, never a PAN.
 *
 * Transaction API (JSON):
 *   sandbox  POST https://apitest.authorize.net/xml/v1/request.api
 *   prod     POST https://api.authorize.net/xml/v1/request.api
 *   Auth is in-body via merchantAuthentication { name, transactionKey }.
 *   NOTE: Auth.net prefixes JSON responses with a UTF-8 BOM — must strip
 *   before JSON.parse (handled in callApi()).
 *
 * Webhooks:
 *   Auth.net signs notifications with the Signature Key as
 *   X-ANET-Signature: "sha512=<HEX>", HMAC-SHA512 over the raw request body.
 *   verifyWebhookSignature() recomputes and timing-safe compares.
 *
 * Env (add to .env.local — see bottom of file for the list):
 *   AUTHNET_API_LOGIN_ID, AUTHNET_TRANSACTION_KEY, AUTHNET_SIGNATURE_KEY,
 *   AUTHNET_ENV ("sandbox" | "production", defaults to "sandbox")
 */

import "server-only";
import crypto from "node:crypto";

const SANDBOX_URL = "https://apitest.authorize.net/xml/v1/request.api";
const PRODUCTION_URL = "https://api.authorize.net/xml/v1/request.api";

// Accept.js opaque-data descriptor for in-app/in-browser tokenized cards.
const OPAQUE_DESCRIPTOR = "COMMON.ACCEPT.INAPP.PAYMENT";

const env = {
  apiLoginId: process.env.AUTHNET_API_LOGIN_ID?.trim() || "",
  transactionKey: process.env.AUTHNET_TRANSACTION_KEY?.trim() || "",
  signatureKey: process.env.AUTHNET_SIGNATURE_KEY?.trim() || "",
  mode: (process.env.AUTHNET_ENV?.trim() || "sandbox").toLowerCase(),
};

function endpoint(): string {
  return env.mode === "production" ? PRODUCTION_URL : SANDBOX_URL;
}

export function isConfigured(): boolean {
  return Boolean(env.apiLoginId && env.transactionKey);
}

/* ─────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────── */

export interface OpaqueData {
  dataDescriptor: string; // usually OPAQUE_DESCRIPTOR
  dataValue: string; // the Accept.js nonce
}

export interface ChargeInput {
  amountCents: number; // integer cents — we convert to the dollar string AN wants
  opaque: OpaqueData;
  /** Short ref echoed back on the transaction (<= 20 chars), e.g. order number. */
  refId?: string;
  invoiceNumber?: string;
  description?: string;
  customerEmail?: string;
}

export type ChargeResult =
  | {
      ok: true;
      approved: boolean; // responseCode === "1"
      responseCode: string; // 1 approved, 2 declined, 3 error, 4 held for review
      transactionId: string;
      authCode: string;
      accountLast4: string | null;
      message: string;
    }
  | {
      ok: false;
      error: string;
      // surfaced for logging/debugging, not for the customer
      code?: string;
    };

/* ─────────────────────────────────────────────────────────────
 * Low-level API call — strips the BOM, returns parsed JSON or null.
 * ──────────────────────────────────────────────────────────── */

async function callApi(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`Auth.net call failed: ${res.status} ${res.statusText}`);
      return null;
    }
    // Auth.net responses begin with a UTF-8 BOM (U+FEFF) — strip before parse.
    const text = (await res.text()).replace(/^﻿/, "").trim();
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    console.warn("Auth.net request error:", err);
    return null;
  }
}

function amountToDollars(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}

/* ─────────────────────────────────────────────────────────────
 * Charge — auth + capture in one step using an Accept.js token.
 * ──────────────────────────────────────────────────────────── */

export async function chargeWithOpaqueData(
  input: ChargeInput,
): Promise<ChargeResult> {
  if (!isConfigured()) {
    return { ok: false, error: "Auth.net is not configured on the server." };
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "Invalid amount." };
  }
  if (!input.opaque?.dataValue) {
    return { ok: false, error: "Missing payment token." };
  }

  const payload = {
    createTransactionRequest: {
      merchantAuthentication: {
        name: env.apiLoginId,
        transactionKey: env.transactionKey,
      },
      ...(input.refId ? { refId: input.refId.slice(0, 20) } : {}),
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: amountToDollars(input.amountCents),
        payment: {
          opaqueData: {
            dataDescriptor: input.opaque.dataDescriptor || OPAQUE_DESCRIPTOR,
            dataValue: input.opaque.dataValue,
          },
        },
        ...(input.invoiceNumber || input.description
          ? {
              order: {
                ...(input.invoiceNumber
                  ? { invoiceNumber: input.invoiceNumber.slice(0, 20) }
                  : {}),
                ...(input.description
                  ? { description: input.description.slice(0, 255) }
                  : {}),
              },
            }
          : {}),
        ...(input.customerEmail
          ? { customer: { email: input.customerEmail } }
          : {}),
      },
    },
  };

  const json = await callApi(payload);
  if (!json) {
    return { ok: false, error: "Payment gateway unreachable." };
  }

  const messages = json.messages as
    | { resultCode?: string; message?: Array<{ code?: string; text?: string }> }
    | undefined;
  const tx = json.transactionResponse as
    | {
        responseCode?: string;
        transId?: string;
        authCode?: string;
        accountNumber?: string; // masked, e.g. "XXXX1111"
        messages?: Array<{ code?: string; description?: string }>;
        errors?: Array<{ errorCode?: string; errorText?: string }>;
      }
    | undefined;

  // Top-level Error usually means a request/auth problem (bad keys, malformed).
  if (messages?.resultCode === "Error" && !tx) {
    const m = messages.message?.[0];
    return {
      ok: false,
      error: m?.text || "Transaction rejected by gateway.",
      code: m?.code,
    };
  }

  if (!tx) {
    return { ok: false, error: "No transaction response from gateway." };
  }

  const responseCode = tx.responseCode || "";
  const approved = responseCode === "1";
  const last4 = tx.accountNumber
    ? tx.accountNumber.replace(/[^0-9]/g, "").slice(-4) || null
    : null;

  // Declines / errors / held carry their reason in transactionResponse.errors.
  const declineMsg =
    tx.errors?.[0]?.errorText ||
    tx.messages?.[0]?.description ||
    (approved ? "Approved" : "Transaction not approved.");

  return {
    ok: true,
    approved,
    responseCode,
    transactionId: tx.transId || "",
    authCode: tx.authCode || "",
    accountLast4: last4,
    message: declineMsg,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Webhook signature verification.
 *
 * Header:  X-ANET-Signature: sha512=<HEX>
 * Compute: HMAC-SHA512(rawBody) keyed by the Signature Key.
 *
 * The Signature Key from the AN dashboard is a hex string; the HMAC is
 * keyed by its decoded bytes. (If verification ever fails against a known
 * payload, the fallback is keying by the raw ASCII string — confirm against
 * the first live webhook before trusting in prod.)
 * ──────────────────────────────────────────────────────────── */

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
): boolean {
  if (!env.signatureKey || !signatureHeader) return false;

  const provided = signatureHeader.replace(/^sha512=/i, "").trim().toUpperCase();
  if (!provided) return false;

  const computed = crypto
    .createHmac("sha512", Buffer.from(env.signatureKey, "hex"))
    .update(rawBody, "utf8")
    .digest("hex")
    .toUpperCase();

  // Timing-safe compare (equal-length buffers required).
  const a = Buffer.from(provided);
  const b = Buffer.from(computed);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const _internal = { endpoint, OPAQUE_DESCRIPTOR };
