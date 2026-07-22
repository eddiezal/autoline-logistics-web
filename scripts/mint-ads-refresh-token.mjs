/**
 * One-time Google Ads OAuth refresh-token mint.
 *
 * Prereq: an OAuth "Desktop app" client in Google Cloud console
 * (project auto-line-logistics → APIs & Services → Credentials →
 * Create credentials → OAuth client ID → Desktop app), with the
 * "Google Ads API" enabled for the project (APIs & Services → Library).
 *
 * Usage (PowerShell):
 *   node scripts/mint-ads-refresh-token.mjs CLIENT_ID CLIENT_SECRET
 *
 * Opens a consent URL (printed — paste in browser), sign in as
 * eddie@zaldivarlabs.com (the MCC login), approve, and the local
 * listener catches the redirect and prints the refresh token.
 *
 * Then set in Vercel (Production env) and redeploy:
 *   GOOGLE_ADS_DEVELOPER_TOKEN  (MCC → Tools → API Center → View token)
 *   GOOGLE_ADS_CLIENT_ID
 *   GOOGLE_ADS_CLIENT_SECRET
 *   GOOGLE_ADS_REFRESH_TOKEN    (printed by this script)
 */

import http from "node:http";
import crypto from "node:crypto";

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error("Usage: node scripts/mint-ads-refresh-token.mjs CLIENT_ID CLIENT_SECRET");
  process.exit(1);
}

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/adwords";
const state = crypto.randomBytes(16).toString("hex");

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // force a refresh_token even if previously granted
    state,
  }).toString();

console.log("\n1. Open this URL in your browser (sign in as eddie@zaldivarlabs.com):\n");
console.log(authUrl);
console.log("\n2. Approve access. This window is listening on " + REDIRECT + " ...\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  const code = url.searchParams.get("code");
  const gotState = url.searchParams.get("state");
  if (!code) {
    res.writeHead(404).end();
    return;
  }
  if (gotState !== state) {
    res.writeHead(400).end("State mismatch - run the script again.");
    console.error("State mismatch; aborting.");
    process.exit(1);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT,
    }),
  });
  const data = await tokenRes.json();

  if (!data.refresh_token) {
    res.writeHead(500, { "Content-Type": "text/plain" }).end("Token exchange failed - see terminal.");
    console.error("Token exchange failed:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  res
    .writeHead(200, { "Content-Type": "text/html" })
    .end("<h2>Done - refresh token printed in your terminal. You can close this tab.</h2>");

  console.log("SUCCESS. Set this in Vercel:\n");
  console.log("GOOGLE_ADS_REFRESH_TOKEN=" + data.refresh_token + "\n");
  console.log("(Access token also minted OK - expires in " + data.expires_in + "s; not needed.)");
  server.close();
  process.exit(0);
});

server.listen(PORT, "127.0.0.1");
