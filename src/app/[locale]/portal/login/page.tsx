"use client";

/**
 * Portal login — `/portal/login`
 *
 * Passwordless magic-link sign-in (Firebase Email Link). Flow:
 *   1. Customer enters email → sendSignInLinkToEmail()
 *   2. We stash the email (+ any returnTo) in localStorage — Firebase needs the
 *      same email to complete sign-in on the callback, and the link may be
 *      opened in a different tab.
 *   3. Customer clicks the link → /portal/login/callback finishes sign-in and
 *      mints the session cookie.
 *
 * SMS OTP was scoped out for Phase A (deferred to Phase B).
 */

import { useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { sendSignInLinkToEmail } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";

type Status = "idle" | "sending" | "sent" | "error";

export default function PortalLogin() {
  const t = useTranslations("portal.login");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    setStatus("sending");
    try {
      const url = `${window.location.origin}/${locale}/portal/login/callback`;
      await sendSignInLinkToEmail(getClientAuth(), addr, {
        url,
        handleCodeInApp: true,
      });
      window.localStorage.setItem("emailForSignIn", addr);
      const returnTo = searchParams.get("returnTo");
      if (returnTo) window.localStorage.setItem("returnTo", returnTo);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  const sending = status === "sending";

  return (
    <div className="max-w-md mx-auto">
      <div
        className="rounded-2xl p-8 md:p-10 shadow-sm border"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-gray-200)",
        }}
      >
        {status === "sent" ? (
          <>
            <h1
              className="text-3xl font-bold"
              style={{
                color: "var(--color-text-default)",
                fontFamily: "var(--font-brand-display)",
                letterSpacing: "var(--letter-spacing-display)",
              }}
            >
              {t("linkSentTitle")}
            </h1>
            <p className="mt-3" style={{ color: "var(--color-text-muted)" }}>
              {t("linkSentBody", { email })}
            </p>
          </>
        ) : (
          <>
            <h1
              className="text-3xl font-bold"
              style={{
                color: "var(--color-text-default)",
                fontFamily: "var(--font-brand-display)",
                letterSpacing: "var(--letter-spacing-display)",
              }}
            >
              {t("title")}
            </h1>
            <p className="mt-2" style={{ color: "var(--color-text-muted)" }}>
              {t("description")}
            </p>

            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "var(--color-text-default)" }}
                >
                  {t("emailLabel")}
                </label>
                <input
                  id="email"
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
                  disabled={sending}
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="w-full px-6 py-3 rounded-full font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: "var(--color-brand-primary)",
                  color: "var(--color-brand-paper)",
                }}
              >
                {sending ? t("sending") : t("submit")}
              </button>

              {status === "error" && (
                <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                  {t("error")}
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
