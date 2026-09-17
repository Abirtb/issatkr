import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAlertEpisode,
  resolveAlertLevel,
  shouldCreateNotification,
} from "../src/lib/alert-policy";

test("resolves warning one absence before elimination", () => {
  assert.equal(resolveAlertLevel(1, 3), "NORMAL");
  assert.equal(resolveAlertLevel(2, 3), "WARNING");
  assert.equal(resolveAlertLevel(3, 3), "ELIMINATED");
  assert.equal(resolveAlertLevel(4, 3), "ELIMINATED");
});

test("starts a new episode only after returning to normal", () => {
  assert.equal(resolveAlertEpisode(null, "WARNING", 0), 1);
  assert.equal(resolveAlertEpisode("WARNING", "ELIMINATED", 1), 1);
  assert.equal(resolveAlertEpisode("ELIMINATED", "NORMAL", 1), 1);
  assert.equal(resolveAlertEpisode("NORMAL", "WARNING", 1), 2);
});

test("creates notifications only on upward or changed alert transitions", () => {
  assert.equal(shouldCreateNotification(null, "WARNING"), true);
  assert.equal(shouldCreateNotification("WARNING", "WARNING"), false);
  assert.equal(shouldCreateNotification("WARNING", "ELIMINATED"), true);
  assert.equal(shouldCreateNotification("ELIMINATED", "NORMAL"), false);
});
