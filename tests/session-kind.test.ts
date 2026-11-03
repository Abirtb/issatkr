import assert from "node:assert/strict";
import test from "node:test";
import { allowedKinds, parseKind } from "../src/lib/session-kind";

const ee = (parcoursId: string, hoursLecture: number, hoursTutorial: number, hoursLab: number) => ({
  parcoursId,
  hoursLecture,
  hoursTutorial,
  hoursLab,
});

test("session type: only what the EE of the parcours has hours for", () => {
  const elements = [ee("P1", 21, 10.5, 0), ee("P2", 0, 0, 21)];
  assert.deepEqual(allowedKinds(elements, "P1"), ["COURS", "TD"]);
  assert.deepEqual(allowedKinds(elements, "P2"), ["TP"]);
  // Group without parcours: any EE of the subject.
  assert.deepEqual(allowedKinds(elements, null), ["COURS", "TD", "TP"]);
  // Subject without EE (created by hand), or EE without hours: free choice.
  assert.deepEqual(allowedKinds([], "P1"), ["COURS", "TD", "TP"]);
  assert.deepEqual(allowedKinds([ee("P1", 0, 0, 0)], "P1"), ["COURS", "TD", "TP"]);
});

test("session type from an import cell", () => {
  assert.equal(parseKind("Cours"), "COURS");
  assert.equal(parseKind(" td "), "TD");
  assert.equal(parseKind("Travaux pratiques"), "TP");
  assert.equal(parseKind("Travaux dirigés"), "TD");
  assert.equal(parseKind("Examen"), "");
});
