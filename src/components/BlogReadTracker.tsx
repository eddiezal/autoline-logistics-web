"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/events";

/**
 * Fires blog_read_deep after 60 seconds on an article page. Used as an
 * engagement signal (deeper than page_view, lighter than form submit).
 *
 * Timer resets on unmount, so quick bounces don't fire. Tab visibility
 * is intentionally not gated — most readers leave a tab open while
 * reading on mobile, and visibilitychange would over-suppress.
 */
const DEEP_READ_THRESHOLD_MS = 60_000;

export function BlogReadTracker({
  slug,
  cluster,
}: {
  slug: string;
  cluster: string;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      track({
        name: "blog_read_deep",
        props: { slug, cluster },
      });
    }, DEEP_READ_THRESHOLD_MS);

    return () => window.clearTimeout(timer);
  }, [slug, cluster]);

  return null;
}
