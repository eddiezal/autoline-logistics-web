import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Locale-detection middleware.
 *
 * Inspects the `Accept-Language` header + URL path to route the request to
 * the right locale. Skips static assets, API routes, and Vercel internals.
 */
export default createMiddleware(routing);

export const config = {
  // Match all routes except:
  //   - /api routes
  //   - Next.js internals (_next, _vercel)
  //   - Static files (anything with a dot extension, e.g. /favicon.ico)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
