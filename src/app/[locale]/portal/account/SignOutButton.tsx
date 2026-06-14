"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { getClientAuth } from "@/lib/firebase/client";
import { signOut as fbSignOut } from "firebase/auth";

/**
 * Sign-out button. Client island for /portal/account.
 *
 * Clears both the Firebase Auth client session AND the server-side
 * __session cookie (DELETE /api/auth/session), then hard-navigates to
 * /portal/login so server components re-read the now-empty cookie.
 */
export function SignOutButton({
  locale,
  label,
}: {
  locale: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    try {
      await Promise.allSettled([
        fbSignOut(getClientAuth()),
        fetch("/api/auth/session", { method: "DELETE" }),
      ]);
    } finally {
      router.push("/portal/login", { locale });
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
      style={{
        background: "var(--color-text-default)",
        color: "var(--color-surface-elevated)",
      }}
    >
      {pending ? "..." : label}
    </button>
  );
}
