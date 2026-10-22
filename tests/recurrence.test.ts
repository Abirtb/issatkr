import assert from "node:assert/strict";
import test from "node:test";
import { addDays, isDayOff, isoWeekday, occurrenceDates } from "../src/lib/recurrence";

const s1 = { startDate: "2026-09-14", endDate: "2026-10-31" }; // Monday 14/09 → Saturday 31/10

test("weekdays: 1 = Monday … 7 = Sunday", () => {
  assert.equal(isoWeekday("2026-09-14"), 1);
  assert.equal(isoWeekday("2026-09-20"), 7);
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
});

test("weekly course: every matching weekday inside the period", () => {
  const mondays = occurrenceDates(s1, 1, [], new Set(), "2026-01-01");
  assert.deepEqual(mondays, [
    "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05",
    "2026-10-12", "2026-10-19", "2026-10-26",
  ]);
  // Period starting mid-week: the first Wednesday is the 16th.
  assert.equal(occurrenceDates(s1, 3, [], new Set(), "2026-01-01")[0], "2026-09-16");
});

test("weekly course: skips days off, vacation ranges and dates removed by hand", () => {
  const daysOff = [
    { startDate: "2026-09-21", endDate: "2026-09-21" }, // one day
    { startDate: "2026-10-03", endDate: "2026-10-11" }, // a vacation week
  ];
  assert.ok(isDayOff("2026-10-05", daysOff));
  assert.ok(!isDayOff("2026-10-12", daysOff));
  const mondays = occurrenceDates(s1, 1, daysOff, new Set(["2026-10-26"]), "2026-01-01");
  assert.deepEqual(mondays, ["2026-09-14", "2026-09-28", "2026-10-12", "2026-10-19"]);
});

test("weekly course: nothing generated before 'from' (the past is never touched)", () => {
  assert.deepEqual(occurrenceDates(s1, 1, [], new Set(), "2026-10-20"), ["2026-10-26"]);
  assert.deepEqual(occurrenceDates(s1, 1, [], new Set(), "2026-11-01"), []);
});

test("every other week: week A / week B counted from the period start", () => {
  const weekA = occurrenceDates(s1, 1, [], new Set(), "2026-01-01", 2, 0);
  const weekB = occurrenceDates(s1, 1, [], new Set(), "2026-01-01", 2, 1);
  assert.deepEqual(weekA, ["2026-09-14", "2026-09-28", "2026-10-12", "2026-10-26"]);
  assert.deepEqual(weekB, ["2026-09-21", "2026-10-05", "2026-10-19"]);
  // A holiday removes its date without shifting the alternation.
  const holiday = [{ startDate: "2026-09-28", endDate: "2026-09-28" }];
  assert.deepEqual(occurrenceDates(s1, 1, holiday, new Set(), "2026-01-01", 2, 0), ["2026-09-14", "2026-10-12", "2026-10-26"]);
  // Starting mid-period keeps the same weeks.
  assert.deepEqual(occurrenceDates(s1, 1, [], new Set(), "2026-10-13", 2, 0), ["2026-10-26"]);
});
