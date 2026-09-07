/**
 * PR1 test matrix for assessShipment (Axis 1). Plain JS (.mjs) so it stays OUT of `next build`'s
 * typecheck (tsconfig includes all .ts). Run: node --experimental-strip-types assessment.test.mjs
 * (Node >= 22.6). Exits non-zero on any failure.
 */
import { assessShipment } from "./assessment.ts";

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("FAIL  " + name); }
}
function eqSet(a, b) {
  const A = new Set(a), B = new Set(b);
  return A.size === B.size && [...A].every((x) => B.has(x));
}

const ROUTE = { origin: { zip: "03301", state: "NH" }, destination: { zip: "80202", state: "CO" } };

// --- valid cases ---
const vSedan = assessShipment({ ...ROUTE, vehicle: { make: "Toyota", model: "Camry", operable: true }, transportType: "open" });
check("complete sedan -> valid", vSedan.status === "valid");
check("valid carries sdRequest with resolved class", vSedan.status === "valid" && vSedan.sdRequest.vehicleType === "sedan");
check("valid carries a normalizedShipmentHash", vSedan.status === "valid" && /^[0-9a-f]{16}$/.test(vSedan.normalizedShipmentHash));
check("operable:true -> isInoperable:false (no inversion bug)", vSedan.status === "valid" && vSedan.sdRequest.isInoperable === false);

const vSuv = assessShipment({ ...ROUTE, vehicle: { category: "crossover", make: "Chevrolet", model: "Equinox", operable: true }, transportType: "open" });
check("crossover -> suv, valid", vSuv.status === "valid" && vSuv.sdRequest.vehicleType === "suv");

const vPickup = assessShipment({ ...ROUTE, vehicle: { make: "Ford", model: "F-150", operable: true }, transportType: "enclosed" });
check("F-150 -> pickup, enclosed carried truthfully", vPickup.status === "valid" && vPickup.sdRequest.vehicleType === "pickup" && vPickup.sdRequest.trailerType === "enclosed");

const vInop = assessShipment({ ...ROUTE, vehicle: { make: "Honda", model: "Accord", operable: false }, transportType: "open" });
check("operable:false -> valid with isInoperable:true (policy decides review, not Axis 1)", vInop.status === "valid" && vInop.sdRequest.isInoperable === true);

// --- the silent-default regressions (the whole point) ---
const other3 = assessShipment({ ...ROUTE, vehicle: { type: "other", make: "Mazda", model: "3", operable: true }, transportType: "open" });
check('type "other" but a real Mazda 3 -> valid sedan (resolves, not punished)', other3.status === "valid" && other3.sdRequest.vehicleType === "sedan");

const rv = assessShipment({ ...ROUTE, vehicle: { type: "other", make: "Cruiser RV", model: "Hitch 16RD", operable: true }, transportType: "open" });
check("RV typed 'other' -> unsupported RV_TRAILER (never silent sedan)", rv.status === "unsupported" && eqSet(rv.reasons, ["RV_TRAILER"]));

const otherUnknown = assessShipment({ ...ROUTE, vehicle: { type: "other" }, transportType: "open" });
check('type "other" with no make/model -> needs_input vehicle (never silent sedan)', otherUnknown.status === "needs_input" && otherUnknown.missingFields.includes("vehicle"));

const unknownOp = assessShipment({ ...ROUTE, vehicle: { make: "Toyota", model: "Camry" }, transportType: "open" });
check("unknown operability -> needs_input operability (never defaulted operable)", unknownOp.status === "needs_input" && eqSet(unknownOp.missingFields, ["operability"]));

const unknownTransport = assessShipment({ ...ROUTE, vehicle: { make: "Toyota", model: "Camry", operable: true } });
check("unknown transport -> needs_input transport_type (never defaulted open)", unknownTransport.status === "needs_input" && eqSet(unknownTransport.missingFields, ["transport_type"]));

// --- unsupported cases ---
const dually = assessShipment({ ...ROUTE, vehicle: { make: "Ford", model: "F-350 Dually", operable: true }, transportType: "open" });
check("F-350 dually -> unsupported HEAVY_TRUCK_DUALLY", dually.status === "unsupported" && dually.reasons.includes("HEAVY_TRUCK_DUALLY"));

const boat = assessShipment({ ...ROUTE, vehicle: { category: "boat", make: "Sea Ray", model: "230", operable: true }, transportType: "open" });
check("boat category -> unsupported VEHICLE_CLASS_UNSUPPORTED", boat.status === "unsupported" && boat.reasons.includes("VEHICLE_CLASS_UNSUPPORTED"));

const modified = assessShipment({ ...ROUTE, vehicle: { make: "Jeep", model: "Wrangler", operable: true, modified: true }, transportType: "open" });
check("modified vehicle -> unsupported MODIFIED_VEHICLE", modified.status === "unsupported" && modified.reasons.includes("MODIFIED_VEHICLE"));

const multi = assessShipment({ ...ROUTE, vehicle: { make: "Toyota", model: "Camry", operable: true }, transportType: "open", vehicleCount: 2 });
check("vehicleCount 2 -> unsupported MULTIPLE_VEHICLES", multi.status === "unsupported" && multi.reasons.includes("MULTIPLE_VEHICLES"));

// --- needs_input cases ---
const noOrigin = assessShipment({ destination: ROUTE.destination, vehicle: { make: "Toyota", model: "Camry", operable: true }, transportType: "open" });
check("missing origin -> needs_input route", noOrigin.status === "needs_input" && noOrigin.missingFields.includes("route"));

const noVehicle = assessShipment({ ...ROUTE, transportType: "open" });
check("no vehicle identity -> needs_input vehicle", noVehicle.status === "needs_input" && noVehicle.missingFields.includes("vehicle"));

const unresolved = assessShipment({ ...ROUTE, vehicle: { make: "Koenigsegg", model: "Jesko", operable: true }, transportType: "open" });
check("present but unrecognized make/model -> needs_input vehicle (agent can confirm)", unresolved.status === "needs_input" && unresolved.missingFields.includes("vehicle"));

// --- precedence: unsupported is terminal even when other fields are missing ---
const rvNoOp = assessShipment({ ...ROUTE, vehicle: { make: "Jayco", model: "Jay Flight" } });
check("RV with unknown operability+transport -> unsupported (terminal, don't ask)", rvNoOp.status === "unsupported" && rvNoOp.reasons.includes("RV_TRAILER"));

// --- hash discipline ---
const h1 = assessShipment({ ...ROUTE, vehicle: { make: "Toyota", model: "Camry", operable: true }, transportType: "open" });
const h2 = assessShipment({ ...ROUTE, vehicle: { make: "Toyota", model: "Camry", operable: true }, transportType: "open" });
check("identical shipments -> identical hash", h1.status === "valid" && h2.status === "valid" && h1.normalizedShipmentHash === h2.normalizedShipmentHash);
const h3 = assessShipment({ ...ROUTE, vehicle: { make: "Toyota", model: "Camry", operable: false }, transportType: "open" });
check("changing operability -> different hash", h1.status === "valid" && h3.status === "valid" && h1.normalizedShipmentHash !== h3.normalizedShipmentHash);
const h4 = assessShipment({ origin: ROUTE.origin, destination: { zip: "90001", state: "ca" }, vehicle: { make: "Toyota", model: "Camry", operable: true }, transportType: "open" });
check("state case-normalized; different dest -> different hash", h4.status === "valid" && h4.sdRequest.delivery.state === "CA" && h4.normalizedShipmentHash !== h1.normalizedShipmentHash);

// --- fail-closed: garbage never throws and never yields a silent price ---
let threw = false;
try { assessShipment({ vehicle: 12345 }); } catch { threw = true; }
check("malformed input does not throw", threw === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
