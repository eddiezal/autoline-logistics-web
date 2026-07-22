"use client";

import { useEffect } from "react";
import {
  captureGclid,
  captureUtm,
  captureLandingPath,
} from "@/lib/analytics/events";

/**
 * Runs attribution capture on ARRIVAL, not just at quote submit.
 *
 * Mounted once in the locale layout. On every full page load it:
 *   - cookies gclid + UTM params if present in the URL (fixes the gap
 *     where a visitor lands with params, navigates client-side, and
 *     submits on a page whose URL no longer carries them),
 *   - records the first-touch landing path (30-day cookie) so lead docs
 *     can attribute leads to the page that started the journey.
 *
 * Renders nothing. Added 2026-07-22.
 */
export function AttributionCapture() {
  useEffect(() => {
    captureGclid();
    captureUtm();
    captureLandingPath();
  }, []);
  return null;
}
