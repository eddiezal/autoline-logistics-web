"use client";

/**
 * Magic-link callback — `/portal/login/callback`
 *
 * Firebase redirects here after the customer clicks the email link. We:
 *   1. Confirm this URL is a valid sign-in link
 *   2. Recover the email from localStorage (or ask for it if the link was
 *      opened on a different device)
 *   3. signInWithEmailLink() → get a fresh ID token
 *   4. POST it to /api/auth/session so the server mints the httpOnly session
 *      cookie (the ID token never persists client-side)
 *   5. Hard-navigate to the portal (or the original returnTo) so the proxy
 *      picks up the new cookie on the next request.
 *
 * This route is public (the proxy whitelists /portal/login*) so an
 * unauthenticated visitor can complete sign-in here.
 */

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";

type Phase = "verifying" | "needEmail" | "error";

export default function PortalLoginCallback() {
  const t = useTranslations("portal.login");
  const locale = useLocale();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [email, setEmail] = useState("");

  async function complete(addr: string) {
    setPhase("verifying");
    try {
      const auth = getClientAuth();
      const cred = await signInWithEmailLink(auth, addr, window.location.href);
      window.localStorage.removeItem("emailForSignIn");

      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error("session mint failed");

      const returnTo = window.localStorage.getItem("returnTo");
      window.localStorage.removeItem("returnTo");
      // Hard navigation so the proxy sees the freshly-set __session cookie.
      window.location.assign(returnTo || `/${locale}/portal`);
    } catch {
      setPhase("error");
    }
  }

  useEffect(() => {
    const auth = getClientAuth();
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setPhase("error");
      return;
    }
    const stored = window.localStorage.getItem("emailForSignIn");
    if (stored) {
      void complete(stored);
    } else {
      setPhase("needEmail");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onConfirmEmail(e: FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (addr) void complete(addr);
  }

  return (
    <div className="max-w-md mx-auto">
      <div
        className="rounded-2xl p-8 md:p-10 shadow-sm border text-center"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-gray-200)",
        }}
      >
        {phase === "verifying" && (
          <p style={{ color: "var(--color-text-muted)" }}>{t("verifying")}</p>
        )}

        {phase === "needEmail" && (
          <form className="space-y-4 text-left" onSubmit={onConfirmEmail}>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--color-text-default)" }}
            >
              {t("confirmEmailTitle")}
            </h1>
            <p style={{ color: "var(--color-text-muted)" }}>
              {t("confirmEmailBody")}
            </p>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              className="w-full px-4 py-3 rounded-lg border text-base focus:outline-none focus:ring-2"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-gray-300)",
                color: "var(--color-text-default)",
              }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              className="w-full px-6 py-3 rounded-full font-semibold transition-opacity hover:opacity-90"
              style={{
                background: "var(--color-brand-primary)",
                color: "var(--color-brand-paper)",
              }}
            >
              {t("submit")}
            </button>
          </form>
        )}

        {phase === "error" && (
          <p style={{ color: "var(--color-danger)" }}>{t("callbackError")}</p>
        )}
      </div>
    </div>
  );
}
