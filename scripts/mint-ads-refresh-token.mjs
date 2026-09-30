/**
 * One-shot Google Ads refresh-token mint (2026-08-18).
 *
 * Context: the three GOOGLE_ADS_* OAuth vars in Vercel were 11-char
 * placeholders — production never had Ads API access. The developer token in
 * .env.local is real. This script mints the missing refresh token via the
 * standard loopback OAuth flow, entirely on your machine; nothing leaves it
 * except the exchange with Google.
 *
 * BEFORE running, in Google Cloud Console (console.cloud.google.com — any
 * project you own, the site's Firebase project is fine):
 *   1. APIs & Services → Library → enable "Google Ads API" AND "Data Manager API".
 *   2. APIs & Services → OAuth consent screen: External is fine; add the
 *      Google account you use for the Ads UI as a TEST USER (this matters —
 *      the token must be minted by an account with access to manager
 *      6871495331, and test-user consent screens work immediately).
 *   3. Credentials → Create credentials → OAuth client ID → type
 *      "Desktop app". Copy the client ID and secret.
 *
 * Run:
 *   node scripts/mint-ads-refresh-token.mjs --client-id <ID> --client-secret <SECRET>
 *
 * A browser window opens — sign in with the account that has Ads access,
 * approve, and the script prints the refresh token in your terminal. Then
 * store all three in Vercel (production) and refresh the local copy:
 *
 *   npx vercel env rm GOOGLE_ADS_CLIENT_ID production
 *   npx vercel env add GOOGLE_ADS_CLIENT_ID production
 *   npx vercel env rm GOOGLE_ADS_CLIENT_SECRET production
 *   npx vercel env add GOOGLE_ADS_CLIENT_SECRET production
 *   npx vercel env rm GOOGLE_ADS_REFRESH_TOKEN production
 *   npx vercel env add GOOGLE_ADS_REFRESH_TOKEN production
 *   npx vercel env pull .env.vercel --environment=production
 *
 * Never commit the values anywhere; .env.vercel must stay gitignored.
 */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { exec } from "node:child_process";

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const CLIENT_ID = arg("client-id");
const CLIENT_SECRET = arg("client-secret");
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Usage: node scripts/mint-ads-refresh-token.mjs --client-id <ID> --client-secret <SECRET>");
  process.exit(1);
}
if (!CLIENT_ID.endsWith(".apps.googleusercontent.com")) {
  console.error("That client ID doesn't look right — it should end in .apps.googleusercontent.com");
  process.exit(1);
}

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const STATE = randomBytes(16).toString("hex");
// 2026-09-30: Data Manager API scope added. Google moved offline conversion
// uploads off the Ads API on 2026-06-15; the daily qualified-lead upload now
// goes through datamanager.googleapis.com, which needs its own scope. A token
// minted before this date only has adwords and gets
// ACCESS_TOKEN_SCOPE_INSUFFICIENT from Data Manager. Re-mint after enabling
// "Data Manager API" in the same Cloud project as the Ads API.
const SCOPE = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/datamanager",
].join(" ");

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // force a refresh token even if previously consented
    state: STATE,
  }).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || state !== STATE) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end("Bad state or missing code — close this tab and re-run the script.");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html" }).end("<h2>Done — you can close this tab and return to the terminal.</h2>");
  server.close();

  const tr = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT,
    }),
  });
  const d = await tr.json();
  if (!tr.ok || !d.refresh_token) {
    console.error("\nToken exchange failed:", d.error ?? tr.status, d.error_description ?? "");
    console.error("If error is 'invalid_grant', re-run — codes expire in minutes.");
    process.exit(1);
  }
  console.log("\n================================================================");
  console.log("REFRESH TOKEN (store in Vercel as GOOGLE_ADS_REFRESH_TOKEN):\n");
  console.log(d.refresh_token);
  console.log("\n================================================================");
  console.log("Now run the vercel env commands from this file's header, then:");
  console.log("  npx vercel env pull .env.vercel --environment=production");
  console.log("  node scripts/keyword-final-urls.mjs");
  process.exit(0);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Waiting for Google sign-in… a browser window should open.");
  console.log("If it doesn't, open this URL yourself:\n\n" + authUrl + "\n");
  // best-effort open (Windows)
  exec(`start "" "${authUrl.replace(/&/g, "^&")}"`, () => {});
});
