/**
 * Tests for the ZIP -> city/state resolver (zipLocation.ts).
 * Plain JS so it stays out of `next build`.
 * Run: node --experimental-strip-types src/lib/leads/zipLocation.test.mjs   (Node >= 22.6)
 *
 * The resolver hook below handles three things plain node can't do with the
 * production source: the "@/..." path alias, the "server-only" guard import
 * (stubbed to an empty module), and JSON imports without an import attribute
 * (loaded and re-exported as a JS module).
 */
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`
  import { existsSync, readFileSync } from "node:fs";
  import { fileURLToPath, pathToFileURL } from "node:url";
  const SRC = ${JSON.stringify(new URL("../../", import.meta.url).href)};
  export async function resolve(spec, ctx, next) {
    if (spec === "server-only") {
      return { url: "data:text/javascript,", shortCircuit: true };
    }
    if (spec.startsWith("@/")) {
      const base = SRC + spec.slice(2);
      for (const cand of [base, base + ".ts"]) {
        if (existsSync(fileURLToPath(cand))) return next(cand, ctx);
      }
    }
    if (spec.startsWith("./") && !/\\.[a-z]+$/.test(spec) && ctx.parentURL) {
      const base = new URL(spec + ".ts", ctx.parentURL);
      if (existsSync(fileURLToPath(base))) return next(base.href, ctx);
    }
    return next(spec, ctx);
  }
  export async function load(url, ctx, next) {
    if (url.endsWith(".json")) {
      const data = readFileSync(fileURLToPath(url), "utf8");
      return {
        format: "module",
        source: "export default " + data + ";",
        shortCircuit: true,
      };
    }
    return next(url, ctx);
  }
`), import.meta.url);

const { lookupZipLocation, stateFromZip, normalizeZip } = await import("./zipLocation.ts");

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log("  ok  " + name); } else { fail++; console.log("FAIL  " + name); } };
const eq = (name, got, want) => check(name + " [" + got + " === " + want + "]", got === want);

// normalizeZip
eq("5-digit passes", normalizeZip("90630"), "90630");
eq("ZIP+4 truncates", normalizeZip("32550-4502"), "32550");
eq("whitespace trimmed", normalizeZip(" 72335 "), "72335");
eq("garbage rejected", normalizeZip("9063"), null);
eq("letters rejected", normalizeZip("ABCDE"), null);
eq("empty rejected", normalizeZip(""), null);
eq("null rejected", normalizeZip(null), null);

// lookupZipLocation — the leads that exposed the bug
let r = lookupZipLocation("72335");
check("72335 resolves (was blank state in [Lead] email 10/13)", r && r.city === "Forrest City" && r.state === "AR");
r = lookupZipLocation("32550-4502");
check("ZIP+4 32550-4502 resolves (8/7 digest incident)", r && r.state === "FL" && r.city.length > 0);
r = lookupZipLocation("34223");
check("34223 resolves (8/7 digest incident, FL gap)", r && r.state === "FL");
// 34010 was called "a Florida ZIP" in the 8/7 digest incident, but it's
// actually a military APO (Armed Forces Americas). Resolving it as AA is
// correct and a useful unserviceable-route signal — not a bug.
r = lookupZipLocation("34010");
check("34010 resolves as APO / AA (8/7 incident misread it as FL)", r && r.state === "AA");
r = lookupZipLocation("90630");
check("90630 Cypress CA (office)", r && r.city === "Cypress" && r.state === "CA");
r = lookupZipLocation("33101");
check("33101 Miami FL (test-lead route)", r && r.state === "FL");
eq("unknown zip returns null", lookupZipLocation("00000"), null);

// stateFromZip — prefix fallback for zips missing from the table
eq("stateFromZip exact", stateFromZip("90630"), "CA");
check("stateFromZip prefix fallback (723xx -> AR, was a zipPrefixToState gap)", stateFromZip("72399") === "AR");
eq("stateFromZip garbage", stateFromZip("XYZ"), null);

// spot-check coverage breadth: every 3-digit mainland prefix family sampled
const samples = ["01001","10001","19103","23220","30301","37201","44101","48201","55401","60601","63101","68102","73101","75201","80202","85001","89101","94102","97201","98101"];
let allHit = true;
for (const z of samples) if (!lookupZipLocation(z)) { allHit = false; console.log("  miss:", z); }
check("20-city national sample all resolve", allHit);

console.log(`\nzipLocation: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
