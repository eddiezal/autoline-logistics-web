import { useTranslations } from "next-intl";

/**
 * Portal login — `/portal/login`
 *
 * MVP UI: magic link email form + SMS OTP fallback link.
 *
 * When Firebase Auth is wired:
 * - Email submit → Firebase Auth `sendSignInLinkToEmail()` → check email
 * - Redirect to /portal on successful link click
 * - SMS link → /portal/login/sms (phone number entry)
 *
 * Currently a UI stub — form submit does nothing.
 */

export default function PortalLogin() {
  const t = useTranslations("portal.login");

  return (
    <div className="max-w-md mx-auto">
      <div
        className="rounded-2xl p-8 md:p-10 shadow-sm border"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-gray-200)",
        }}
      >
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

        {/* Build-status note */}
        <div
          className="mt-4 text-xs border rounded-lg px-3 py-2"
          style={{
            color: "color-mix(in oklab, var(--color-warning) 90%, black)",
            background: "color-mix(in oklab, var(--color-warning) 12%, white)",
            borderColor: "color-mix(in oklab, var(--color-warning) 35%, white)",
          }}
        >
          {t("buildBanner")}
        </div>

        <form className="mt-6 space-y-4">
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
              placeholder={t("emailPlaceholder")}
              className="w-full px-4 py-3 rounded-lg border text-base focus:outline-none focus:ring-2"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-gray-300)",
                color: "var(--color-text-default)",
              }}
              disabled
            />
          </div>
          <button
            type="submit"
            className="w-full px-6 py-3 rounded-full font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: "var(--color-brand-primary)",
              color: "var(--color-brand-paper)",
            }}
            disabled
          >
            {t("submit")}
          </button>
        </form>

        {/* SMS alternative */}
        <div
          className="mt-6 pt-6 border-t"
          style={{ borderColor: "var(--color-gray-200)" }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-default)" }}
          >
            {t("altSmsTitle")}
          </p>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            {t("altSmsDescription")}
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold hover:underline"
            style={{ color: "var(--color-brand-primary)" }}
            disabled
          >
            {t("altSmsLink")}
          </button>
        </div>
      </div>
    </div>
  );
}
