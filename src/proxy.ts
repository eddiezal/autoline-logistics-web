import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Locale-detection proxy (Next 16+ naming for the request-level interceptor;
 * was called "middleware" in Next 15).
 *
 * Inspects the `Accept-Language` header + URL path to route the request to
 * the right locale. Skips static assets, API routes, and Vercel internals.
 *
 * Note: `next-intl/middleware` is the package import — the naming is
 * historical inside the next-intl SDK. The factory call itself is unchanged.
 */
export default createMiddleware(routing);

export const config = {
  // Match all routes except:
  //   - /api routes
  //   - Next.js internals (_next, _vercel)
  //   - Static files (anything with a dot extension, e.g. /favicon.ico)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
