/**
 * hCaptcha server-side verification.
 *
 * Verifies the captcha token submitted by the client against hCaptcha's
 * siteverify endpoint. Returns true if the token is valid, false otherwise.
 *
 * Uses HCAPTCHA_SECRET env var. Falls back to the official hCaptcha test
 * secret (`0x0000000000000000000000000000000000000000`) when env is not
 * set, so dev flows still work without provisioning a real hCaptcha account.
 */

import "server-only";

const TEST_SECRET = "0x0000000000000000000000000000000000000000";

export async function verifyHcaptcha(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const secret = process.env.HCAPTCHA_SECRET ?? TEST_SECRET;

  try {
    const params = new URLSearchParams();
    params.set("secret", secret);
    params.set("response", token);

    const res = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      console.error("[hcaptcha] siteverify HTTP", res.status);
      return false;
    }
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      // Diagnostic (2026-07-24 form-down incident): surface WHY hCaptcha
      // rejected the token. Expected values: expired-input-response,
      // invalid-or-already-seen-response, sitekey-secret-mismatch,
      // invalid-input-secret. No user data logged.
      console.error("[hcaptcha] rejected:", (data["error-codes"] ?? []).join(",") || "(no codes)");
    }
    return Boolean(data.success);
  } catch (err) {
    console.error("[hcaptcha] verification failed (network)", err);
    return false;
  }
}
