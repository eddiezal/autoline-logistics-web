/**
 * Single source of truth for ProABD timestamp parsing.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * ProABD sends Create_Date and Booked_Date as NAIVE datetimes — "2026-07-20 14:32:00",
 * no zone, no offset. Six scripts independently guessed Pacific by appending "-07:00".
 * All six were wrong by three hours, for five weeks, because the guess was copied
 * rather than tested.
 *
 * It is EASTERN. That is measured, not assumed:
 *
 *   scripts/attribution-order.mjs calibrates against the ProABD records our own
 *   createLead integration created. For those, our Firestore lead doc (serverTimestamp,
 *   authoritative UTC) and the ProABD Create_Date describe the same instant BY
 *   CONSTRUCTION — our API call is what made the record. On 2026-08-17, across 10
 *   such records:
 *
 *       observed median gap  -3.00h
 *       observed range       -3.00h to -3.00h
 *       spread                0.00h
 *
 *   Zero spread across ten independent records is a timezone offset. Latency,
 *   clock drift or human behaviour would scatter. Eastern minus Pacific is exactly
 *   3h, and stays 3h through DST because both zones shift together.
 *
 * WHY NOT JUST HARDCODE "-04:00"
 * ------------------------------
 * Because that is the same class of mistake one notch smaller. -04:00 is Eastern
 * DAYLIGHT time; from 2026-11-01 it is -05:00, and scripts/import-orders.mjs handles
 * February data where it is already -05:00. We resolve the wall clock through the
 * IANA zone instead, so the offset is looked up per timestamp rather than assumed.
 *
 * SELF-TEST
 * ---------
 *   node scripts/lib/proabd-time.mjs
 */

export const PROABD_TZ = "America/New_York";
export const PT = "America/Los_Angeles";

/**
 * Milliseconds to ADD to a wall clock read as if it were UTC, to get the true instant.
 * For New York in July this is +4h; in December, +5h.
 */
function zoneShiftMs(instant, timeZone) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(instant).reduce((a, x) => ((a[x.type] = x.value), a), {});
  const wallAsUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return instant.getTime() - wallAsUTC;
}

/**
 * Parse a ProABD datetime string to a real Date.
 *
 * - A string that already carries "Z" or an explicit offset is trusted as-is.
 * - A naive string is resolved as a wall clock in PROABD_TZ.
 * - Anything unparseable returns null. Never throws, never returns Invalid Date.
 */
export function parseProabdDate(s) {
  const v = s === undefined || s === null ? "" : String(s).trim();
  if (!v) return null;

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(v);
  if (!m) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const [Y, Mo, D, H, Mi, S] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(Number);
  const wallAsUTC = Date.UTC(Y, Mo - 1, D, H, Mi, S);

  // Two passes converge even when the first guess lands on the far side of a DST edge.
  let ts = wallAsUTC;
  for (let i = 0; i < 2; i++) ts = wallAsUTC + zoneShiftMs(new Date(ts), PROABD_TZ);

  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Pacific calendar day, for bucketing. Never use toISOString().slice(0,10) — that is UTC. */
export const ptYmd = (d) => (d ? d.toLocaleDateString("en-CA", { timeZone: PT }) : "—");

/** Pacific hour-of-day / weekday / date, for clock-shape tests. */
export function ptParts(d) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: PT, hour: "2-digit", hour12: false,
    weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d).reduce((a, p) => ((a[p.type] = p.value), a), {});
  return { hour: Number(f.hour) % 24, dow: f.weekday, ymd: `${f.year}-${f.month}-${f.day}` };
}

/* ------------------------------------------------------------------ self-test */
if (import.meta.url === `file://${process.argv[1]}`) {
  const cases = [
    // [ProABD naive string, expected UTC ISO, what it is testing]
    ["2026-07-20 14:32:00", "2026-07-20T18:32:00.000Z", "summer, EDT = UTC-4"],
    ["2026-01-15 09:00:00", "2026-01-15T14:00:00.000Z", "winter, EST = UTC-5 (the reason we do not hardcode -04:00)"],
    ["2026-02-11 23:30:00", "2026-02-12T04:30:00.000Z", "winter late-evening, rolls to the next UTC day"],
    ["2026-11-05 08:00:00", "2026-11-05T13:00:00.000Z", "after the Nov 1 fallback"],
    ["2026-07-20T14:32:00-07:00", "2026-07-20T21:32:00.000Z", "explicit offset is trusted, not overridden"],
    ["2026-07-20T18:32:00Z", "2026-07-20T18:32:00.000Z", "explicit Z is trusted"],
  ];
  let bad = 0;
  console.log("\nproabd-time self-test\n" + "-".repeat(78));
  for (const [input, want, why] of cases) {
    const got = parseProabdDate(input)?.toISOString() ?? "null";
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${input.padEnd(26)} -> ${got.padEnd(26)} ${why}`);
  }
  for (const junk of ["", null, undefined, "not a date"]) {
    const got = parseProabdDate(junk);
    const ok = got === null;
    if (!ok) bad++;
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${String(junk).padEnd(26)} -> ${got === null ? "null" : got.toISOString()}  junk returns null, never Invalid Date`);
  }
  // The calibration itself, restated as an assertion.
  const pacificWay = new Date("2026-07-20T14:32:00-07:00");
  const easternWay = parseProabdDate("2026-07-20 14:32:00");
  const deltaH = (pacificWay.getTime() - easternWay.getTime()) / 3600000;
  const ok = deltaH === 3;
  if (!ok) bad++;
  console.log(`\n  ${ok ? "ok  " : "FAIL"}  old Pacific parse minus new Eastern parse = ${deltaH}h`);
  console.log(`        attribution-order.mjs measured -3.00h against id-linked records, spread 0.00h.`);
  console.log(bad ? `\n  ${bad} FAILURES\n` : `\n  all pass\n`);
  process.exit(bad ? 1 : 0);
}
