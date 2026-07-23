"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { sendEvent } from "@/lib/analytics/behavior";

/**
 * First-party page_view beacon. Mounted once in the locale layout; fires
 * on initial load and every client-side route change. Renders nothing.
 *
 * Deliberately uses next/navigation's raw pathname (includes the /es
 * prefix) so EN/ES splits fall out of the path itself.
 */
export function BehaviorTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    last.current = pathname;
    sendEvent("page_view");
  }, [pathname]);

  return null;
}
