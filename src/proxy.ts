import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

/**
 * Request-level proxy (Next 16+ naming for the interceptor that used to
 * be called "middleware" in Next 15).
 *
 * Three concerns, in order:
 *
 *   0. /admin Basic-auth gate — the internal reporting page
 *      (src/app/admin) is protected by HTTP Basic auth against
 *      ADMIN_DASH_PASSWORD, then served WITHOUT locale routing
 *      (it lives outside the [locale] tree; English-only).
 *
 *   1. Portal auth gating — redirect unauthenticated visitors from
 *      /portal/* (except /portal/login) to the login page, preserving
 *      locale prefix and the original intended URL.
 *
 *   2. Locale routing — defer to next-intl/middleware for all other
 *      paths (and for portal paths once auth passes). Inspects the
 *      Accept-Language header + URL path to route the request to the
 *      right locale.
 *
 * Auth check is STUBBED today (returns true). Replaced Monday with
 * Firebase Auth session-cookie verification — see `isAuthenticated`.
 */

const intlProxy = createMiddleware(routing);

/* ─────────────────────────────────────────────────────────────
 * Portal path patterns
 * ──────────────────────────────────────────────────────────── */

// Matches /admin and /admin/anything (never locale-prefixed).
const ADMIN_PATH = /^\/admin(?:\/|$)/;

// Matches /portal, /portal/anything, /es/portal, /es/portal/anything
const PORTAL_PATH = /^\/(?:[a-z]{2}\/)?portal(?:\/|$)/;

// Matches /portal/login, /portal/login/anything, /es/portal/login, etc.
// (Login routes are always public.)
const PORTAL_LOGIN_PATH = /^\/(?:[a-z]{2}\/)?portal\/login(?:\/|$)/;

/* ─────────────────────────────────────────────────────────────
 * Auth gate — Layer 1 (Edge): cookie PRESENCE only.
 *
 * The proxy runs on the Edge runtime, where firebase-admin cannot run, so we
 * only check that a __session cookie exists and bounce to login if it doesn't.
 * The real cryptographic verification (verifySessionCookie, with revocation)
 * runs on the Node side in requireSession() — see src/lib/firebase/session.ts —
 * which the protected portal server components call. A forged or expired
 * cookie slips past this presence check but is rejected there.
 * ──────────────────────────────────────────────────────────── */

function isAuthenticated(request: NextRequest): boolean {
  return Boolean(request.cookies.get("__session")?.value);
}

/* ─────────────────────────────────────────────────────────────
 * Proxy entrypoint
 * ──────────────────────────────────────────────────────────── */

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. Basic-auth gate for the internal /admin report, then bypass
  //    locale routing entirely (the page lives outside [locale]).
  //    Edge runtime: atob() is available; timing-safety is not a
  //    concern worth an Edge-compatible constant-time compare here —
  //    the page is read-only reporting behind HTTPS.
  if (ADMIN_PATH.test(pathname)) {
    const expected = process.env.ADMIN_DASH_PASSWORD;
    if (!expected) {
      return new NextResponse("Admin report not configured", { status: 503 });
    }
    const auth = request.headers.get("authorization") ?? "";
    let ok = false;
    if (auth.startsWith("Basic ")) {
      try {
        const decoded = atob(auth.slice(6));
        const pass = decoded.slice(decoded.indexOf(":") + 1);
        ok = pass === expected;
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="ALL Reports", charset="UTF-8"' },
      });
    }
    return NextResponse.next();
  }

  // 1. Auth-gate portal (except login itself)
  if (PORTAL_PATH.test(pathname) && !PORTAL_LOGIN_PATH.test(pathname)) {
    if (!isAuthenticated(request)) {
      const localeMatch = pathname.match(/^\/([a-z]{2})\//);
      const localePrefix = localeMatch ? `/${localeMatch[1]}` : "";
      const loginUrl = new URL(
        `${localePrefix}/portal/login`,
        request.url,
      );
      loginUrl.searchParams.set("returnTo", pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Defer to next-intl for locale routing on everything else
  return intlProxy(request);
}

/* ─────────────────────────────────────────────────────────────
 * Matcher — paths this proxy runs on.
 *
 * Excludes: API routes, Next.js internals, Vercel internals, the
 * Sentry monitoring tunnel, and static files (anything containing
 * a dot in the path).
 * ──────────────────────────────────────────────────────────── */

export const config = {
  matcher: ["/((?!api|_next|_vercel|monitoring|.*\\..*).*)"],
};
