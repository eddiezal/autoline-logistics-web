import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives.
 *
 * IMPORTANT: import `Link`, `redirect`, `usePathname`, `useRouter`, and
 * `getPathname` from this module instead of from `next/link` or `next/navigation`
 * — these wrappers automatically prefix the active locale where appropriate.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
