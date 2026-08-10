"use client";

import { useEffect } from "react";
import {
  captureGclid,
  captureUtm,
  captureFirstTouchUtm,
  captureLandingPath,
} from "@/lib/analytics/events";

/**
 * Runs attribution capture on ARRIVAL, not just at quote submit.
 *
 * Mounted once in the locale layout. On every full page load it:
 *   - cookies gclid + UTM params if present in the URL (fixes the gap
 *     where a visitor lands with params, navigates client-side, and
 *     submits on a page whose URL no longer carries them),
 *   - cookies the FIRST-touch UTM set once (30 days, first attributed
 *     landing wins — added 2026-08-10 so leads can record the campaign
 *     that STARTED the journey, not just the one that finished it),
 *   - records the first-touch landing path (30-day cookie) so lead docs
 *     can attribute leads to the page that started the journey.
 *
 * Order matters: captureFirstTouchUtm() reads the URL directly, so it
 * must run on the same load where params are present — keep it alongside
 * captureUtm(), not behind any condition.
 *
 * Renders nothing. Added 2026-07-22.
 */
export function AttributionCapture() {
  useEffect(() => {
    captureGclid();
    captureUtm();
    captureFirstTouchUtm();
    captureLandingPath();
  }, []);
  return null;
}
