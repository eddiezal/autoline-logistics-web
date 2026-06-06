/**
 * POST   /api/auth/session  — mint a session cookie from a Firebase ID token
 * DELETE /api/auth/session  — sign out (clear the cookie)
 *
 * The browser sends a fresh ID token (from signInWithEmailLink). We exchange it
 * for a long-lived httpOnly session cookie via firebase-admin. The ID token
 * itself is never stored client-side — only this server-set cookie persists,
 * and the proxy/portal verify it on each request.
 *
 * Session length: 14 days (Firebase's maximum for createSessionCookie).
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";
import {
  checkRateLimit,
  getClientIp,
  tooManyRequestsResponse,
} from "@/lib/ratelimit";

export const runtime = "nodejs";

const EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const COOKIE_NAME = "__session";

export async function POST(req: Request) {
  // Rate limit: 10 session mints per minute per IP. Real users hit this once
  // per sign-in; bots hammering forged ID tokens get throttled.
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `auth-session:${ip}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.success) return tooManyRequestsResponse(rl);

  let idToken: string | undefined;
  try {
    const body = (await req.json()) as { idToken?: string };
    idToken = body.idToken;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken." }, { status: 400 });
  }

  try {
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: EXPIRES_IN_MS,
    });
    const store = await cookies();
    store.set(COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: EXPIRES_IN_MS / 1000,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Most common failure modes when running locally on ADC:
    //   • ID token invalid / expired / older than 5 minutes (user issue)
    //   • Caller lacks `iam.serviceAccounts.signBlob` on the firebase-adminsdk
    //     service account (ADC + missing Service Account Token Creator role)
    // We log here so dev can see the real cause; the response stays generic.
    console.error("[/api/auth/session] createSessionCookie failed:", err);
    return NextResponse.json({ error: "Invalid ID token." }, { status: 401 });
  }
}

export async function DELETE() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
