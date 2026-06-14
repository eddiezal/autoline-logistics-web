import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/firebase/session";
import { SignOutButton } from "./SignOutButton";

/**
 * Account stub at /portal/account.
 *
 * Phase A stub. Shows who is signed in plus a sign-out control. Full
 * account management (profile, payment methods, communication prefs)
 * is Phase B.
 *
 * Linked from the portal header layout. Previously 404'd, this prevents
 * the broken nav link during launch.
 */

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireSession(locale);
  const t = await getTranslations("portal.account");

  return (
    <div className="space-y-6">
      <Link
        href="/portal"
        className="text-sm hover:underline"
        style={{ color: "var(--color-text-muted)" }}
      >
        ← {t("backToDashboard")}
      </Link>

      <header>
        <h1
          className="text-3xl md:text-4xl font-bold mt-2"
          style={{
            color: "var(--color-text-default)",
            fontFamily: "var(--font-brand-display)",
            letterSpacing: "var(--letter-spacing-display)",
          }}
        >
          {t("heading")}
        </h1>
      </header>

      <section
        className="rounded-2xl p-6 md:p-8"
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-gray-200)",
        }}
      >
        <p
          className="text-xs uppercase tracking-wider mb-2"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("signedInAs")}
        </p>
        <p
          className="text-lg font-semibold break-all"
          style={{ color: "var(--color-text-default)" }}
        >
          {user.email ?? "-"}
        </p>
        {user.name && (
          <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
            {user.name}
          </p>
        )}

        <div className="mt-6">
          <SignOutButton locale={locale} label={t("signOut")} />
        </div>
      </section>

      <section
        className="rounded-2xl border-2 border-dashed p-6 md:p-8"
        style={{
          borderColor: "var(--color-gray-200)",
          background: "transparent",
        }}
      >
        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--color-text-default)" }}
        >
          {t("comingSoonTitle")}
        </h2>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("comingSoonBody")}
        </p>
      </section>
    </div>
  );
}
