"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/events";

/**
 * Client-side analytics tracker for corridor pages. Fires corridor_view
 * on mount. Mounted as a sibling of the page content so the event fires
 * exactly once per page visit (not on every re-render).
 *
 * Server components (the corridor page.tsx files) can't fire client-side
 * tracking directly — this is the bridge.
 */
export function CorridorAnalytics({
  corridorSlug,
  fromState,
  toState,
}: {
  corridorSlug: string;
  fromState: string;
  toState: string;
}) {
  useEffect(() => {
    track({
      name: "corridor_view",
      props: {
        corridor_slug: corridorSlug,
        from_state: fromState,
        to_state: toState,
      },
    });
  }, [corridorSlug, fromState, toState]);

  return null;
}
