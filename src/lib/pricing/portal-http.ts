/**
 * Auth + CORS for /api/pricing-portal/* (SERVER ONLY).
 *
 * Auth: shared keys in `LANELOCK_API_KEY` (comma-separated: one per person, so a single
 * key can be revoked without rotating everyone), sent by the extension as `X-LaneLock-Key`.
 * This is the pilot stopgap the README names ("Replace temporary agent-name setting with
 * Firebase sign-in; roles per spec") — good enough for a demo on Eddie's machine, not for
 * agent rollout. When Firebase sign-in lands, swap `authorize()` and nothing else changes.
 *
 * CORS: the content script runs on secure.proabd.com and the popup on a chrome-extension://
 * origin. Both send a custom header, so browsers preflight; we answer OPTIONS and reflect
 * only origins we expect.
 */

import "server-only";
import { NextResponse } from "next/server";

const ALLOWED_ORIGIN = /^(https:\/\/([a-z0-9-]+\.)*proabd\.com|chrome-extension:\/\/[a-z]{32})$/i;

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-LaneLock-Key, Authorization",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (ALLOWED_ORIGIN.test(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

export function preflight(req: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/** Returns a 401/503 response when not authorized, or null when the request may proceed. */
export function authorize(req: Request): NextResponse | null {
  const expected = (process.env.LANELOCK_API_KEY ?? "").split(",").map((k) => k.trim()).filter((k) => k.length >= 16);
  if (!expected.length) {
    return NextResponse.json({ error: "pricing portal not configured (LANELOCK_API_KEY unset)" }, { status: 503, headers: corsHeaders(req) });
  }
  const got = req.headers.get("x-lanelock-key")?.trim() || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!got || !expected.includes(got)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders(req) });
  }
  return null;
}

export function json(req: Request, body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}
