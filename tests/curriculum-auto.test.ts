import assert from "node:assert/strict";
import test from "node:test";
import { autoProgrammes } from "../src/lib/curriculum-auto";

const levels = [
  { id: "l1", code: "L1" },
  { id: "l2", code: "L2" },
  { id: "m1", code: "M1" },
];
const tronc = {
  code: "LI661294",
  mention: "Génie mécanique",
  specialty: "Tronc commun",
  classes: [],
  elements: [
    { subjectId: "conception1", semester: 1 },
    { subjectId: "conception2", semester: 2 },
    { subjectId: "rdm3", semester: 3 },
  ],
};
const enr = {
  code: "LI574498",
  mention: "Génie Energétique",
  specialty: "Tronc commun ( ISSAT Kairouan)",
  classes: [{ name: "1ENR-1" }, { name: "1ENR-2" }],
  elements: [{ subjectId: "mecanique1", semester: 1 }],
};

const of = (entries: ReturnType<typeof autoProgrammes>, levelId: string, specialty: string) =>
  entries.filter((entry) => entry.levelId === levelId && entry.specialty === specialty).map((entry) => entry.subjectId).sort();

test("programme pre-filled from the parcours: semester → level, tronc commun → all spécialités", () => {
  const entries = autoProgrammes(levels, [tronc, enr]);
  assert.deepEqual(of(entries, "l1", ""), ["conception1", "conception2", "mecanique1"]);
  assert.deepEqual(of(entries, "l2", ""), ["rdm3"]);
  // Spécialité of the linked classes (1ENR-1 → ENR).
  assert.deepEqual(of(entries, "l1", "ENR"), ["mecanique1"]);
  // LI… parcours are Licence: nothing in Master 1.
  assert.deepEqual(of(entries, "m1", ""), []);
  assert.equal(entries.find((entry) => entry.subjectId === "mecanique1")?.parcoursCode, "LI574498");
});

test("a parcours that is neither tronc commun nor linked to a class adds nothing yet", () => {
  const embedded = { ...tronc, code: "LI662692", specialty: "Systèmes Embarqués et Internet des Objets" };
  assert.deepEqual(autoProgrammes(levels, [embedded]), []);
});
