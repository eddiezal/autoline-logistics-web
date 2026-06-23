/**
 * CallRail Dynamic Number Insertion (DNI) snippet.
 *
 * Loads CallRail's swap.js asynchronously. The script walks the DOM and
 * replaces phone numbers inside elements with the `cr-trackable` class
 * (configured in the CallRail dashboard under "Source Tracking" → "Swap class").
 *
 * Two env vars required (set in Vercel + .env.local):
 *   NEXT_PUBLIC_CALLRAIL_COMPANY_ID   — your CallRail account ID
 *   NEXT_PUBLIC_CALLRAIL_RESOURCE_ID  — the per-property identifier
 *
 * Both appear in the snippet URL CallRail shows you in their dashboard:
 *   //cdn.callrail.com/companies/{COMPANY_ID}/{RESOURCE_ID}/12/swap.js
 *
 * If either env var is missing, this component renders nothing and logs
 * a warning in dev. That way production-side missing config fails closed
 * instead of throwing a runtime error.
 *
 * Added 2026-06-23 as Phase 1 of the CallRail rollout. See:
 *   CallRail-Kickoff-Plan.md  (the HOW)
 *   CallRail-Strategy.md      (the WHY)
 */
import Script from "next/script";

export function CallRailSnippet() {
  const companyId = process.env.NEXT_PUBLIC_CALLRAIL_COMPANY_ID;
  const resourceId = process.env.NEXT_PUBLIC_CALLRAIL_RESOURCE_ID;

  // Fail closed if env vars are missing. Dev gets a console warning so we
  // notice the misconfiguration; prod stays silent so we don't leak the
  // failure mode to end users.
  if (!companyId || !resourceId) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn(
        "[CallRail] Missing NEXT_PUBLIC_CALLRAIL_COMPANY_ID or NEXT_PUBLIC_CALLRAIL_RESOURCE_ID. " +
          "Snippet not loaded. DNI will not swap phone numbers.",
      );
    }
    return null;
  }

  const src = `//cdn.callrail.com/companies/${companyId}/${resourceId}/12/swap.js`;

  return (
    <Script
      id="callrail-swap"
      src={src}
      strategy="afterInteractive"
    />
  );
}
