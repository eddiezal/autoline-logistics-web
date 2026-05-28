#!/usr/bin/env node
/**
 * Authorize.Net credential + environment check.
 *
 * SAFE: uses `authenticateTestRequest`, which only validates the API Login ID +
 * Transaction Key. It creates NO transaction and moves NO money — there is no
 * amount, no card, nothing to charge.
 *
 * Run:  node scripts/authnet-verify.mjs
 * Reads .env.local for AUTHNET_API_LOGIN_ID, AUTHNET_TRANSACTION_KEY, AUTHNET_ENV.
 *
 * It prints the exact endpoint so you can SEE it's the sandbox host
 * (apitest.authorize.net). A resultCode of "Ok" against the sandbox endpoint
 * PROVES the credentials are sandbox credentials: production keys fail to
 * authenticate against the sandbox host, so they can never silently charge here.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  if (!(t.slice(0, i).trim() in process.env)) {
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

const NAME = (process.env.AUTHNET_API_LOGIN_ID || "").trim();
const KEY = (process.env.AUTHNET_TRANSACTION_KEY || "").trim();
const MODE = (process.env.AUTHNET_ENV || "sandbox").trim().toLowerCase();

if (!NAME || !KEY) {
  console.error("Missing AUTHNET_API_LOGIN_ID / AUTHNET_TRANSACTION_KEY in .env.local");
  process.exit(1);
}

const URL =
  MODE === "production"
    ? "https://api.authorize.net/xml/v1/request.api"
    : "https://apitest.authorize.net/xml/v1/request.api";

console.log(`AUTHNET_ENV = ${MODE}`);
console.log(`Endpoint    = ${URL}`);
console.log(
  URL.includes("apitest")
    ? ">> SANDBOX endpoint — no real money can move.\n"
    : ">> *** PRODUCTION endpoint — LIVE money. Stop unless you mean it. ***\n",
);

const body = {
  authenticateTestRequest: {
    merchantAuthentication: { name: NAME, transactionKey: KEY },
  },
};

const res = await fetch(URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const text = (await res.text()).replace(/^﻿/, "").trim();

let json;
try {
  json = JSON.parse(text);
} catch {
  console.log("Could not parse response:\n", text);
  process.exit(1);
}

const rc = json?.messages?.resultCode;
const msg = json?.messages?.message?.[0];
console.log(`resultCode: ${rc}`);
console.log(`message:    ${msg?.code ?? ""} ${msg?.text ?? ""}`);

if (rc === "Ok") {
  console.log(`\nOK — credentials authenticate against the ${MODE} endpoint.`);
  if (MODE !== "production") {
    console.log(
      "Because they work on apitest.authorize.net, these ARE sandbox credentials. No real money is reachable.",
    );
  }
} else {
  console.log(`\nFAILED to authenticate on the ${MODE} endpoint.`);
  console.log(
    "If you expected sandbox creds, this most likely means they are NOT sandbox keys (e.g. production keys, which won't auth here). Confirm with Kacy which account she pulled them from.",
  );
}
