"use client";

/**
 * Portal login — `/portal/login`
 *
 * Two sign-in paths:
 *
 *   1. **Google sign-in (primary)** — `signInWithPopup` with GoogleAuthProvider.
 *      Customers with Gmail click "Continue with Google" → instant login.
 *      Bypasses the email-deliverability problem (Firebase email links often
 *      land in spam, see [[autoline_ben_silence_2026_06]] comms record).
 *
 *   2. **Magic link (fallback)** — `sendSignInLinkToEmail` for customers
 *      without Google accounts. Flow:
 *        a. Customer enters email → sendSignInLinkToEmail()
 *        b. Email + returnTo stashed in localStorage — Firebase needs the same
 *           email to complete sign-in, and the link may open in a new tab.
 *        c. Customer clicks the link → /portal/login/callback finishes sign-in.
 *
 * Both paths POST the resulting ID token to /api/auth/session so the server
 * mints the httpOnly session cookie; the ID token never persists client-side.
 *
 * SMS OTP was scoped out for Phase A (deferred to Phase B).
 */

import { useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  signInWithPopup,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import { track } from "@/lib/analytics/events";

type EmailStatus = "idle" | "sending" | "sent" | "error";
type GoogleStatus = "idle" | "signing-in" | "error";

export default function PortalLogin() {
  const t = useTranslations("portal.login");
  const locale = useLocale();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>("idle");

  const sendingEmail = emailStatus === "sending";
  const signingInWithGoogle = googleStatus === "signing-in";
  const anyInFlight = sendingEmail || signingInWithGoogle;

  /**
   * Google sign-in handler. Pops the Google account chooser, mints a session
   * cookie server-side, then hard-navigates to the portal so the proxy reads
   * the new __session cookie on the next request.
   */
  async function onGoogleSignIn() {
    if (anyInFlight) return;
    setGoogleStatus("signing-in");
    try {
      const auth = getClientAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const cred = await signInWithPopup(auth, provider);
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
      track({ name: "lead_portal_signin", props: { method: "google" } });
      window.location.assign(returnTo || `/${locale}/portal`);
    } catch {
      setGoogleStatus("error");
    }
  }

  /**
   * Magic-link sign-in fallback. Sends the email + stashes context for the
   * callback page to pick up after the user clicks the link.
   */
  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (anyInFlight) return;
    const addr = email.trim();
    if (!addr) return;
    setEmailStatus("sending");
    try {
      const url = `${window.location.origin}/${locale}/portal/login/callback`;
      await sendSignInLinkToEmail(getClientAuth(), addr, {
        url,
        handleCodeInApp: true,
      });
      window.localStorage.setItem("emailForSignIn", addr);
      const returnTo = searchParams.get("returnTo");
      if (returnTo) window.localStorage.setItem("returnTo", returnTo);
      setEmailStatus("sent");
    } catch {
      setEmailStatus("error");
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div
        className="rounded-2xl p-8 md:p-10 shadow-sm border"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-gray-200)",
        }}
      >
        {emailStatus === "sent" ? (
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

            {/* Google sign-in (primary path) */}
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={anyInFlight}
              className="mt-6 w-full flex items-center justify-center gap-3 px-6 py-3 rounded-full font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 border"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-gray-300)",
                color: "var(--color-text-default)",
              }}
            >
              <GoogleLogo />
              <span>
                {signingInWithGoogle ? t("googleSigningIn") : t("continueWithGoogle")}
              </span>
            </button>

            {googleStatus === "error" && (
              <p className="mt-3 text-sm" style={{ color: "var(--color-danger)" }}>
                {t("googleError")}
              </p>
            )}

            {/* "or" divider */}
            <div className="my-6 flex items-center gap-3">
              <div
                className="flex-1 h-px"
                style={{ background: "var(--color-gray-200)" }}
              />
              <span
                className="text-xs uppercase tracking-wider"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t("orDivider")}
              </span>
              <div
                className="flex-1 h-px"
                style={{ background: "var(--color-gray-200)" }}
              />
            </div>

            {/* Email magic-link (fallback path) */}
            <form className="space-y-4" onSubmit={onEmailSubmit}>
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
                  disabled={anyInFlight}
                />
              </div>
              <button
                type="submit"
                disabled={anyInFlight}
                className="w-full px-6 py-3 rounded-full font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: "var(--color-brand-primary)",
                  color: "var(--color-brand-paper)",
                }}
              >
                {sendingEmail ? t("sending") : t("submit")}
              </button>

              {emailStatus === "error" && (
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

/**
 * Official Google "G" logo (multi-color SVG). Inlined so we don't pull a
 * dependency for a single icon.
 */
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
