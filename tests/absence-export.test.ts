import assert from "node:assert/strict";
import test from "node:test";
import { eeCodeFor } from "../src/lib/absence-export";

const candidates = [
  { code: "661068143", parcoursId: "eea", subjectId: "ee-algebre-eea", name: "Algèbre" },
  { code: "661294143", parcoursId: "gm", subjectId: "ee-algebre-gm", name: "Algèbre" },
];

test("Identifiant EE: the class's parcours first", () => {
  const cls = { parcoursId: "eea" };
  assert.equal(eeCodeFor(cls, { id: "ee-algebre-eea", code: "661068143", name: "Algèbre" }, candidates), "661068143");
  // A subject created by hand with the same name (accents/case ignored).
  assert.equal(eeCodeFor(cls, { id: "manual", code: "ALG", name: "ALGEBRE" }, candidates), "661068143");
});

test("Identifiant EE: class not linked to a parcours", () => {
  const cls = { parcoursId: null };
  // The subject's own (single) EE.
  assert.equal(eeCodeFor(cls, { id: "ee-algebre-gm", code: "661294143", name: "Algèbre" }, candidates), "661294143");
  // An EE code as subject code, then nothing to guess from.
  assert.equal(eeCodeFor(cls, { id: "x", code: "574498111", name: "Mécanique 1" }, []), "574498111");
  assert.equal(eeCodeFor(cls, { id: "manual", code: "ALG", name: "Algèbre" }, candidates), "");
});
