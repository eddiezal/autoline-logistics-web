/**
 * Minimum test matrix for the input-integrity gate (spec v3.4).
 * Plain-JS runner (kept out of the Next build's typecheck; imports the .ts module).
 * Run: node --experimental-strip-types src/lib/pricing/eligibility.test.mjs
 */
import assert from "node:assert/strict";
import { evaluateEligibility, DEFAULT_POLICY } from "./eligibility.ts";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "  -> " + (e && e.message)); }
}
const base = (over) => ({
  origin: { zip: "07446", state: "NJ" },
  destination: { zip: "91306", state: "CA" },
  vehicle: { year: "2021", make: "Toyota", model: "Camry", category: "car", operable: true },
  transportType: "open",
  miles: 500,
  ...over,
});

console.log("INPUT-INTEGRITY GATE — matrix");

t("other + Mazda 3 -> auto, resolves sedan", () => {
  const r = evaluateEligibility(base({ vehicle: { make: "Mazda", model: "3", type: "other", operable: true } }));
  assert.equal(r.status, "auto_eligible");
  assert.equal(r.snapshot.resolvedVehicle.cls, "sedan");
});
t("other + Chevrolet Equinox -> auto, resolves suv", () => {
  const r = evaluateEligibility(base({ vehicle: { make: "Chevrolet", model: "Equinox", type: "other", operable: true } }));
  assert.equal(r.status, "auto_eligible");
  assert.equal(r.snapshot.resolvedVehicle.cls, "suv");
});
t("Cruiser RV Hitch 16RD -> specialty_review, unsupported, NEVER sedan", () => {
  const r = evaluateEligibility(base({ vehicle: { make: "Cruiser RV", model: "Hitch 16RD", type: "other", operable: true } }));
  assert.equal(r.status, "specialty_review");
  assert.ok(r.reasons.includes("VEHICLE_CLASS_UNSUPPORTED"));
  assert.equal(r.snapshot.resolvedVehicle.cls, null);
  assert.equal(r.snapshot.sdRequest, null);
});
t("F-350 dually -> specialty_review (unsupported)", () => {
  const r = evaluateEligibility(base({ vehicle: { make: "Ford", model: "F-350 Dually", category: "pickup", operable: true } }));
  assert.equal(r.status, "specialty_review");
  assert.equal(r.snapshot.resolvedVehicle.cls, null);
});
t("unknown operability -> needs_input", () => {
  const r = evaluateEligibility(base({ vehicle: { make: "Toyota", model: "Camry", category: "car" } }));
  assert.equal(r.status, "needs_input");
  assert.ok(r.reasons.includes("OPERABILITY_MISSING"));
});
t("inoperable -> review by default, resolved truthfully", () => {
  const r = evaluateEligibility(base({ vehicle: { make: "Toyota", model: "Camry", category: "car", operable: false } }));
  assert.equal(r.status, "specialty_review");
  assert.ok(r.reasons.includes("INOPERABLE_POLICY_REVIEW"));
  assert.equal(r.snapshot.resolvedOperability, false);
});
t("inoperable + policy off -> auto with truthful isInoperable:true", () => {
  const r = evaluateEligibility(base({ vehicle: { make: "Toyota", model: "Camry", category: "car", operable: false } }), { ...DEFAULT_POLICY, reviewInoperable: false });
  assert.equal(r.status, "auto_eligible");
  assert.equal(r.request.isInoperable, true);
});
t("unknown transport -> needs_input", () => {
  const r = evaluateEligibility(base({ transportType: null }));
  assert.equal(r.status, "needs_input");
  assert.ok(r.reasons.includes("TRANSPORT_TYPE_MISSING"));
});
t("enclosed -> review by default, resolved truthfully", () => {
  const r = evaluateEligibility(base({ transportType: "enclosed" }));
  assert.equal(r.status, "specialty_review");
  assert.ok(r.reasons.includes("ENCLOSED_POLICY_REVIEW"));
  assert.equal(r.snapshot.resolvedTransport, "enclosed");
});
t("lifted modification -> specialty_review", () => {
  const r = evaluateEligibility(base({ vehicle: { make: "Jeep", model: "Wrangler Lifted", category: "suv", operable: true } }));
  assert.equal(r.status, "specialty_review");
  assert.ok(r.reasons.includes("MODIFICATION_REPORTED"));
});
t("pre-1981 classic -> specialty_review", () => {
  const r = evaluateEligibility(base({ vehicle: { year: "1968", make: "Chevrolet", model: "Camaro", category: "car", operable: true } }));
  assert.equal(r.status, "specialty_review");
  assert.ok(r.reasons.includes("PRE_1981_VEHICLE"));
});
t("unknown model -> fail closed (unresolved, never sedan)", () => {
  const r = evaluateEligibility(base({ vehicle: { make: "Zoltan", model: "XR-9000", type: "other", operable: true } }));
  assert.equal(r.status, "specialty_review");
  assert.ok(r.reasons.includes("VEHICLE_UNRESOLVED"));
  assert.equal(r.snapshot.resolvedVehicle.cls, null);
});
t("standard car over 1299 mi -> distance policy review", () => {
  const r = evaluateEligibility(base({ miles: 2500 }));
  assert.equal(r.status, "specialty_review");
  assert.ok(r.reasons.includes("DISTANCE_POLICY_REVIEW"));
});
t("clean short standard car -> auto with full SD request", () => {
  const r = evaluateEligibility(base({}));
  assert.equal(r.status, "auto_eligible");
  assert.equal(r.request.vehicleType, "sedan");
  assert.equal(r.request.trailerType, "open");
  assert.equal(r.request.isInoperable, false);
});
t("missing origin -> needs_input", () => {
  const r = evaluateEligibility(base({ origin: { zip: "", state: "" } }));
  assert.equal(r.status, "needs_input");
  assert.ok(r.reasons.includes("ORIGIN_MISSING"));
});
t("snapshot carries ruleset + expiry + exact request", () => {
  const r = evaluateEligibility(base({}));
  assert.ok(r.snapshot.rulesetVersion.length > 0);
  assert.ok(new Date(r.snapshot.estimateExpiresAt).getTime() > new Date(r.snapshot.evaluatedAt).getTime());
  assert.deepEqual(r.snapshot.sdRequest, r.request);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
