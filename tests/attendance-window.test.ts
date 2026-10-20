import assert from "node:assert/strict";
import test from "node:test";
import {
  getAttendanceWindow,
  parseStartTime,
  sessionStartsAt,
} from "../src/lib/attendance-window";

const day = new Date("2026-09-14T10:00:00.000Z");

test("session start is wall-clock time in Tunis (UTC+1)", () => {
  const start = sessionStartsAt(day, "08:30", "Africa/Tunis");
  assert.equal(start?.toISOString(), "2026-09-14T07:30:00.000Z");
});

test("without an end time, the window is open for 90 minutes after the start", () => {
  const at = (iso: string) =>
    getAttendanceWindow(day, "08:30", null, new Date(iso), "Africa/Tunis")?.state;
  assert.equal(at("2026-09-14T07:29:00.000Z"), "upcoming");
  assert.equal(at("2026-09-14T07:30:00.000Z"), "open");
  assert.equal(at("2026-09-14T08:59:59.000Z"), "open");
  assert.equal(at("2026-09-14T09:00:01.000Z"), "closed");
});

test("accepts common start time formats", () => {
  assert.deepEqual(parseStartTime("8h30"), { hour: 8, minute: 30 });
  assert.deepEqual(parseStartTime("14:00"), { hour: 14, minute: 0 });
  assert.equal(parseStartTime("matin"), null);
});

test("with an end time, the window is exactly the session time", () => {
  const at = (iso: string) =>
    getAttendanceWindow(day, "08:30", "10:00", new Date(iso), "Africa/Tunis")?.state;
  assert.equal(at("2026-09-14T07:29:59.000Z"), "upcoming"); // 08:29:59
  assert.equal(at("2026-09-14T07:30:00.000Z"), "open"); // 08:30
  assert.equal(at("2026-09-14T09:00:00.000Z"), "open"); // 10:00
  assert.equal(at("2026-09-14T09:00:01.000Z"), "closed"); // 10:00:01
  // A 3-hour session stays open until its end, not just 90 minutes.
  const long = getAttendanceWindow(day, "08:30", "11:30", new Date("2026-09-14T10:00:00.000Z"), "Africa/Tunis");
  assert.equal(long?.state, "open");
  // An end before the start is ignored (90 minutes).
  assert.equal(
    getAttendanceWindow(day, "08:30", "08:00", new Date("2026-09-14T08:30:00.000Z"), "Africa/Tunis")?.state,
    "open",
  );
});
