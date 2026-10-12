/**
 * Hero -> /quote -> /api/lead handoff matrix (Release A, 2026-10-12).
 *
 * Covers every hero option (7 vehicles x 2 conditions x 2 transports x
 * 3 timings) through buildQuoteHref -> parseQuoteSearchParams -> the
 * server normalizers, plus legacy/canonical links, direct entry with no
 * params, the price-checker handoff, and the agent email labels.
 *
 * Run: node --experimental-strip-types src/lib/hero-handoff.test.mjs   (Node >= 22.6)
 * Non-zero exit on failure.
 */
// The email template imports "server-only", which Next provides at build
// time but isn't an installed package. Resolve it to an empty module here.
import { register } from "node:module";
register(
  "data:text/javascript," +
    encodeURIComponent(
      'export async function resolve(s, c, n) { return s === "server-only" ? { url: "data:text/javascript,", shortCircuit: true } : n(s, c); }',
    ),
);
const { buildLeadEmail } = await import("./leads/emailTemplate.ts");
import {
  buildQuoteHref,
  parseQuoteSearchParams,
  normalizeCondition,
  normalizeTiming,
  normalizeTransport,
  normalizeVehicleType,
  QUOTE_VEHICLE_TYPES,
} from "./hero-handoff.ts";

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log("  FAIL " + name); }
}

// The hero's own vocabularies (HeroRouteFinder.tsx).
const HERO_VEHICLES = ["sedan", "suv", "truckStandard", "truckLifted", "van", "classic", "exotic"];
const HERO_CONDITIONS = { drivable: "operable", nonDrivable: "inoperable" };
const HERO_TRANSPORTS = { open: "open", enclosed: "enclosed" };
const HERO_TIMINGS = { flexible: "standby", withinWeek: "priority", asap: "expedited" };

// Simulate the browser: the href's query becomes the /quote searchParams.
function roundTrip(handoff) {
  const href = buildQuoteHref(handoff);
  check("pathname is /quote", href.pathname === "/quote");
  return parseQuoteSearchParams(href.query);
}

// Simulate what QuoteForm posts (hidden inputs + select) and what
// /api/lead derives from it.
function serverSees(parsed) {
  const body = {
    condition: parsed.condition,
    transport: parsed.transportType,
    tier: parsed.timing,
    vehicle_type: parsed.vehicleType,
  };
  const t = normalizeTiming(body.tier);
  return {
    condition: normalizeCondition(body.condition) ?? null,
    transport: normalizeTransport(body.transport) ?? null,
    tier: t ?? "priority",
    timingProvided: t !== undefined,
    vehicleType: body.vehicle_type,
  };
}

// 1. Full matrix: 7 x 2 x 2 x 3 = 84 combinations.
let combos = 0;
for (const v of HERO_VEHICLES) {
  for (const [c, cWant] of Object.entries(HERO_CONDITIONS)) {
    for (const [tr, trWant] of Object.entries(HERO_TRANSPORTS)) {
      for (const [tm, tmWant] of Object.entries(HERO_TIMINGS)) {
        combos++;
        const label = `${v}/${c}/${tr}/${tm}`;
        const parsed = roundTrip({
          originZip: "90630", destinationZip: "33101",
          vehicleType: v, condition: c, transportType: tr, timing: tm,
        });
        check(label + " zips", parsed.originZip === "90630" && parsed.destinationZip === "33101");
        check(label + " vehicle offered by form", QUOTE_VEHICLE_TYPES.includes(parsed.vehicleType));
        check(label + " vehicle preserved", parsed.vehicleType === v);
        const s = serverSees(parsed);
        check(label + " condition", s.condition === cWant);
        check(label + " operable flag", (s.condition !== "inoperable") === (cWant === "operable"));
        check(label + " transport", s.transport === trWant);
        check(label + " tier", s.tier === tmWant && s.timingProvided === true);
      }
    }
  }
}
check("84 hero combinations", combos === 84);

// 2. Canonical values (old links, other producers) still work.
{
  const p = parseQuoteSearchParams({ condition: "inoperable", timing: "expedited", transport: "enclosed", vehicle_type: "classic" });
  check("canonical inoperable", p.condition === "inoperable");
  check("canonical expedited", p.timing === "expedited");
  check("canonical enclosed", p.transportType === "enclosed");
  check("canonical classic", p.vehicleType === "classic");
}

// 3. Direct /quote visit: nothing asked, nothing invented.
{
  const p = parseQuoteSearchParams({});
  check("direct: no condition", p.condition === undefined);
  check("direct: no timing", p.timing === undefined);
  check("direct: no vehicle", p.vehicleType === undefined);
  const s = serverSees(p);
  check("direct: condition null", s.condition === null);
  check("direct: tier defaults to priority", s.tier === "priority");
  check("direct: timing flagged as not provided", s.timingProvided === false);
}

// 4. Price-checker handoff (RoutePriceCheckerForm HANDOFF_VEHICLE).
for (const v of ["sedan", "suv", "truckStandard"]) {
  const p = roundTrip({ originZip: "10001", destinationZip: "33101", vehicleType: v });
  check("price checker " + v, p.vehicleType === v && p.condition === undefined);
}

// 5. Junk and case handling.
check("junk condition dropped", parseQuoteSearchParams({ condition: "maybe" }).condition === undefined);
check("junk timing dropped", parseQuoteSearchParams({ timing: "yesterday" }).timing === undefined);
check("junk vehicle dropped", parseQuoteSearchParams({ vehicle_type: "<script>" }).vehicleType === undefined);
check("case-insensitive condition", normalizeCondition("NonDrivable") === "inoperable");
check("case-insensitive vehicle", normalizeVehicleType("EXOTIC") === "exotic");
check("motorcycle not offered", normalizeVehicleType("motorcycle") === undefined);

// 6. Agent email shows what the customer chose, and "Not asked" otherwise.
function email(extra) {
  return buildLeadEmail({
    leadRef: "AL-TEST",
    customer: { firstName: "Test", email: "t@example.com", phone: "5555555555" },
    origin: { city: "", state: "CA", zip: "90630" },
    destination: { city: "", state: "FL", zip: "33101" },
    vehicle: { year: "2020", make: "Ferrari", model: "Roma", type: "exotic" },
    tier: "priority",
    estimate: null,
    attribution: {},
    submittedAt: "2026-10-12T19:00:00.000Z",
    ...extra,
  });
}
{
  const e = email({ condition: "inoperable", transport: "enclosed", tier: "expedited", timingProvided: true });
  check("email: not running", e.text.includes("Condition: NOT RUNNING (inoperable)"));
  check("email: enclosed", e.text.includes("Transport: Enclosed"));
  check("email: asap", e.text.includes("Timing: ASAP (expedited)"));
  check("email html: not running", e.html.includes("NOT RUNNING (inoperable)"));
  check("email: exotic type", e.text.includes("(exotic)"));
}
{
  const e = email({ condition: null, transport: null, timingProvided: false });
  check("email direct: condition not asked", e.text.includes("Condition: Not asked"));
  check("email direct: timing not asked", e.text.includes("Timing: Not asked"));
  check("email direct: no fake priority", !e.text.includes("Within a week"));
}
{
  const e = email({ attribution: { utmSource: "google", utmMedium: "cpc", utmCampaign: "24034984545" } });
  check("email: S5 name renders in clean UTF-8", e.text.includes("Google Ads - S5 Español"));
}

console.log(`\nhero-handoff: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
