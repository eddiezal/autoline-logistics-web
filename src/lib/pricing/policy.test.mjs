/**
 * PR2 test matrix. Plain JS (.mjs) so it stays out of `next build`'s typecheck.
 * Run: node --experimental-strip-types policy.test.mjs   (Node >= 22.6). Non-zero exit on failure.
 */
import {
  evaluatePolicy, DEFAULT_POLICY,
  canonicalizeSdEstimate, buildQuoteFingerprint,
} from "./policy.ts";

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("FAIL  " + name); }
}
function eqSet(a, b) { const A = new Set(a), B = new Set(b); return A.size === B.size && [...A].every((x) => B.has(x)); }

const OPEN_OP = { isInoperable: false, trailerType: "open" };

// --- evaluatePolicy: defaults (distance OFF, inop/enclosed review ON) ---
check("operable+open, default policy -> auto_allowed",
  evaluatePolicy(OPEN_OP, 500, DEFAULT_POLICY).status === "auto_allowed");

const inop = evaluatePolicy({ isInoperable: true, trailerType: "open" }, 500, DEFAULT_POLICY);
check("inoperable -> manual_review INOPERABLE_POLICY_REVIEW",
  inop.status === "manual_review" && inop.reasons.includes("INOPERABLE_POLICY_REVIEW"));

const enc = evaluatePolicy({ isInoperable: false, trailerType: "enclosed" }, 500, DEFAULT_POLICY);
check("enclosed -> manual_review ENCLOSED_POLICY_REVIEW",
  enc.status === "manual_review" && enc.reasons.includes("ENCLOSED_POLICY_REVIEW"));

// --- distance flag behavior ---
const flagOn = { ...DEFAULT_POLICY, distanceReviewEnabled: true };
check("distance flag ON, miles > 1299 -> DISTANCE_POLICY_REVIEW",
  eqSet(evaluatePolicy(OPEN_OP, 2000, flagOn).reasons ?? [], ["DISTANCE_POLICY_REVIEW"]));
check("distance flag ON, miles <= 1299 -> auto_allowed",
  evaluatePolicy(OPEN_OP, 1299, flagOn).status === "auto_allowed");
check("distance flag OFF, miles huge -> auto_allowed (reversible, distance ignored)",
  evaluatePolicy(OPEN_OP, 9999, DEFAULT_POLICY).status === "auto_allowed");
check("distance flag ON, miles null, reviewUnknownDistance false -> auto_allowed",
  evaluatePolicy(OPEN_OP, null, flagOn).status === "auto_allowed");
check("distance flag ON, miles null, reviewUnknownDistance true -> DISTANCE_POLICY_REVIEW",
  evaluatePolicy(OPEN_OP, null, { ...flagOn, reviewUnknownDistance: true }).reasons?.includes("DISTANCE_POLICY_REVIEW"));

// --- combined + config toggles ---
const combined = evaluatePolicy({ isInoperable: true, trailerType: "enclosed" }, 3000, flagOn);
check("inoperable + enclosed + long-haul (flag on) -> all three reasons",
  combined.status === "manual_review" &&
  eqSet(combined.reasons, ["DISTANCE_POLICY_REVIEW", "INOPERABLE_POLICY_REVIEW", "ENCLOSED_POLICY_REVIEW"]));
check("reviewInoperable=false -> inoperable no longer routes to review",
  evaluatePolicy({ isInoperable: true, trailerType: "open" }, 500, { ...DEFAULT_POLICY, reviewInoperable: false }).status === "auto_allowed");

// --- canonicalizeSdEstimate ---
const c1 = canonicalizeSdEstimate({ carrierEstimate: 1454, currency: "usd" });
check("dollars -> cents; currency uppercased", c1.carrierEstimateCents === 145400 && c1.currency === "USD");
check("currency defaults to USD when absent", canonicalizeSdEstimate({ carrierEstimate: 100 }).currency === "USD");
check("rounds to nearest cent", canonicalizeSdEstimate({ carrierEstimate: 1454.005 }).carrierEstimateCents === 145401 ||
  canonicalizeSdEstimate({ carrierEstimate: 1454.006 }).carrierEstimateCents === 145401);

// --- buildQuoteFingerprint ---
const base = {
  normalizedShipmentHash: "abc0000000000001",
  sdEstimate: canonicalizeSdEstimate({ carrierEstimate: 1454, currency: "USD" }),
  sdPricingVersion: "sd-2026-09",
  formulaVersion: "markup-v1",
  policyVersion: "policy-v1",
  policyConfig: DEFAULT_POLICY,
};
const fp = buildQuoteFingerprint(base);
check("fingerprint is 16 hex chars", /^[0-9a-f]{16}$/.test(fp));
check("deterministic: same input -> same fingerprint", buildQuoteFingerprint(base) === fp);
check("change normalizedShipmentHash -> different fingerprint",
  buildQuoteFingerprint({ ...base, normalizedShipmentHash: "abc0000000000002" }) !== fp);
check("change price-affecting SD estimate -> different fingerprint",
  buildQuoteFingerprint({ ...base, sdEstimate: canonicalizeSdEstimate({ carrierEstimate: 1500 }) }) !== fp);
check("change formulaVersion -> different fingerprint",
  buildQuoteFingerprint({ ...base, formulaVersion: "markup-v2" }) !== fp);
check("change policyVersion -> different fingerprint",
  buildQuoteFingerprint({ ...base, policyVersion: "policy-v2" }) !== fp);
check("change policyConfig (distance flag) -> different fingerprint",
  buildQuoteFingerprint({ ...base, policyConfig: { ...DEFAULT_POLICY, distanceReviewEnabled: true } }) !== fp);

// --- the hole-#2 gate: volatile raw-SD fields must NOT change the fingerprint ---
const rawA = { carrierEstimate: 1454, currency: "USD", requestId: "req-AAA", timestamp: "2026-09-06T10:00:00Z", confidence: 84 };
const rawB = { carrierEstimate: 1454, currency: "USD", requestId: "req-ZZZ", timestamp: "2026-09-06T23:59:59Z", confidence: 12 };
const fpA = buildQuoteFingerprint({ ...base, sdEstimate: canonicalizeSdEstimate(rawA) });
const fpB = buildQuoteFingerprint({ ...base, sdEstimate: canonicalizeSdEstimate(rawB) });
check("same economics, different volatile SD metadata -> IDENTICAL fingerprint", fpA === fpB);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
