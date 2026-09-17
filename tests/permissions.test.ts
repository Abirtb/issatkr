import assert from "node:assert/strict";
import test from "node:test";
import { isAdminRole, isScheduleManagerRole } from "../src/lib/auth";

test("limits administration and schedule management by role", () => {
  assert.equal(isAdminRole("ADMIN"), true);
  assert.equal(isAdminRole("DEPARTMENT_HEAD"), false);
  assert.equal(isAdminRole("PROF"), false);
  assert.equal(isScheduleManagerRole("ADMIN"), true);
  assert.equal(isScheduleManagerRole("DEPARTMENT_HEAD"), true);
  assert.equal(isScheduleManagerRole("PROF"), false);
});
