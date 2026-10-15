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

test("window is open for 90 minutes after the start", () => {
  const at = (iso: string) =>
    getAttendanceWindow(day, "08:30", new Date(iso), "Africa/Tunis")?.state;
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
