"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * Two-state language toggle (EN / ES).
 *
 * Preserves the current path when switching locales — `/about` in EN goes to
 * `/es/about` in ES, etc. Uses `next-intl`'s navigation primitives so the
 * locale prefix is handled correctly per the routing config.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchTo(nextLocale: "en" | "es") {
    if (nextLocale === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <div
      className="flex items-center gap-1 text-xs font-semibold"
      aria-label="Language switcher"
    >
      <button
        type="button"
        onClick={() => switchTo("en")}
        disabled={isPending}
        className={`px-2 py-1 rounded transition ${
          locale === "en"
            ? "bg-white text-orange"
            : "text-white/80 hover:text-white"
        }`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
      <span className="text-white/50" aria-hidden>
        |
      </span>
      <button
        type="button"
        onClick={() => switchTo("es")}
        disabled={isPending}
        className={`px-2 py-1 rounded transition ${
          locale === "es"
            ? "bg-white text-orange"
            : "text-white/80 hover:text-white"
        }`}
        aria-pressed={locale === "es"}
      >
        ES
      </button>
    </div>
  );
}
