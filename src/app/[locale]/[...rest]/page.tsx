import { notFound } from "next/navigation";

/**
 * Catch-all under `[locale]/...` so unmatched paths trigger our locale-aware
 * `not-found.tsx` instead of bubbling up to the root default 404.
 *
 * Without this, `/es/anything-bogus` falls back to the Next.js default 404
 * (no locale context, no Header/Footer, no translated copy).
 */
export default function CatchAll() {
  notFound();
}
