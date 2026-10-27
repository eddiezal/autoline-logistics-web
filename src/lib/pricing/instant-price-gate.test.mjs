/**
 * Tests for the instant-price gate, built from the Oct 26 quote study's
 * 12 underpriced booked orders plus ordinary cars that must keep a price.
 * Run: node --experimental-strip-types src/lib/pricing/instant-price-gate.test.mjs
 */
import assert from "node:assert/strict";
import { decideInstantPrice, withholdReasonLabel } from "./instant-price-gate.ts";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "  -> " + (e && e.message)); }
}
const withheld = (input, reason) => {
  const d = decideInstantPrice(input);
  assert.equal(d.withhold, true, "expected withhold for " + JSON.stringify(input));
  if (reason) assert.ok(d.reasons.includes(reason), "missing reason " + reason + " in " + d.reasons);
};
const priced = (input) => {
  const d = decideInstantPrice(input);
  assert.equal(d.withhold, false, "expected a price for " + JSON.stringify(input) + " got " + d.reasons);
};

console.log("Study tail: must go to an agent");
t("2014 Freightliner M2 box truck, inop (AL-10033)", () => withheld({ year: "2014", make: "Freightliner", model: "M2", type: "other", condition: "inoperable" }, "NON_STANDARD_VEHICLE"));
t("2021 Cruiser RV Hitch 16RD trailer (AL-260819-79S4BQ)", () => withheld({ year: "2021", make: "Cruiser RV", model: "Hitch 16RD", type: "other" }, "NON_STANDARD_VEHICLE"));
t("1957 BMW 503, classic (AL-261001-TJ86NN)", () => withheld({ year: "1957", make: "bmw", model: "503", type: "classic" }, "CLASSIC_VEHICLE"));
t("1970 Jeep Wrangler typed as SUV: pre-1981 (AL-260810-MP28G9)", () => withheld({ year: "1970", make: "jeep", model: "Wrangler", type: "suv" }, "CLASSIC_VEHICLE"));
t("2015 Ford Mustang, doesn't run (AL-260922-YQD27O)", () => withheld({ year: "2015", make: "Ford", model: "Mustang", type: "sedan", condition: "inoperable" }, "INOPERABLE"));
t("2017 Ford Mustang GT, doesn't run (AL-10092)", () => withheld({ year: "2017", make: "Ford", model: "Mustang Gt", type: "sedan", condition: "inoperable" }, "INOPERABLE"));

console.log("Ordinary cars: must keep the instant price");
t("2009 Honda Civic, runs", () => priced({ year: "2009", make: "Honda", model: "Civic", type: "sedan", condition: "operable" }));
t("2023 Mazda 3 typed 'other'", () => priced({ year: "2023", make: "mazda", model: "3", type: "other" }));
t("2021 Jeep Wrangler dos puertas", () => priced({ year: "2021", make: "Jeep", model: "Wrangler dos puertas", type: "suv" }));
t("2018 Jeep Grand Cherokee, condition not asked", () => priced({ year: "2018", make: "Jeep", model: "Grand cherokee", type: "suv", condition: null }));
t("2015 Corvette typed 'other' (multi-car can't be seen at quote time)", () => priced({ year: "2015", make: "Corvett", model: "2015", type: "other" }));
t("2022 Ford F-250 heavy pickup stays priced", () => priced({ year: "2022", make: "Ford", model: "F-250 Super Duty", type: "truckStandard" }));
t("2019 Chevrolet Silverado 2500HD stays priced", () => priced({ year: "2019", make: "Chevrolet", model: "Silverado 2500HD", type: "truckLifted" }));
t("2020 Chevrolet Trailblazer does not trip 'trailer'", () => priced({ year: "2020", make: "Chevrolet", model: "Trailblazer", type: "suv" }));
t("1981 is modern enough", () => priced({ year: "1981", make: "Toyota", model: "Corolla", type: "sedan" }));
t("exotic stays priced (no evidence yet)", () => priced({ year: "2021", make: "Porsche", model: "911", type: "exotic" }));
t("Freightliner-badged Sprinter van goes to an agent (make-level match, intended)", () => withheld({ year: "2018", make: "Freightliner", model: "Sprinter", type: "van" }, "NON_STANDARD_VEHICLE"));

console.log("Edge cases");
t("empty input keeps the price", () => priced({}));
t("year text junk is ignored", () => priced({ year: "abc", make: "Toyota", model: "Camry", type: "sedan" }));
t("multiple reasons stack", () => {
  const d = decideInstantPrice({ year: "1965", make: "Ford", model: "Mustang", type: "classic", condition: "inoperable" });
  assert.deepEqual(d.reasons, ["CLASSIC_VEHICLE", "INOPERABLE"]);
});
t("labels exist in both languages", () => {
  for (const r of ["NON_STANDARD_VEHICLE", "CLASSIC_VEHICLE", "INOPERABLE"]) {
    assert.ok(withholdReasonLabel(r, "en").length > 5);
    assert.ok(withholdReasonLabel(r, "es").length > 5);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
