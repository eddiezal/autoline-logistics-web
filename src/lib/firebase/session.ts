/**
 * Portal session verification (SERVER ONLY).
 *
 * Layer 2 of the auth gate. The proxy (Edge) only checks that a __session
 * cookie is present; the real cryptographic verification happens here on the
 * Node runtime via firebase-admin's verifySessionCookie (with revocation
 * check). Protected portal server components call requireSession() — login and
 * callback pages deliberately do not, so they stay reachable while signed out.
 */

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth } from "./admin";

const COOKIE_NAME = "__session";

/** Returns the decoded session claims, or null if missing/invalid/revoked. */
export async function getSessionUser(): Promise<DecodedIdToken | null> {
  const store = await cookies();
  const session = store.get(COOKIE_NAME)?.value;
  if (!session) return null;
  try {
    // Second arg = checkRevoked: reject sessions revoked server-side.
    return await getAdminAuth().verifySessionCookie(session, true);
  } catch {
    return null;
  }
}

/**
 * Guard for protected portal pages. Redirects to the localized login page if
 * there is no valid session. Returns the decoded claims when authenticated.
 */
export async function requireSession(locale: string): Promise<DecodedIdToken> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/portal/login`);
  }
  return user;
}
