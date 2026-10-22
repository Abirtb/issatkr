import assert from "node:assert/strict";
import test from "node:test";
import { applyFacets, facetOptions, type Facets } from "../src/lib/facets";

type Cls = { name: string; level: string; specialty: string; semester: string };
const classes: Cls[] = [
  { name: "1ENR-1", level: "L1", specialty: "ENR", semester: "1" },
  { name: "1ENR-2", level: "L1", specialty: "ENR", semester: "1" },
  { name: "1INFO-1", level: "L1", specialty: "INFO", semester: "1" },
  { name: "2INFO-1", level: "L2", specialty: "INFO", semester: "3" },
  { name: "3INFO-1", level: "L3", specialty: "INFO", semester: "5" },
];
const facets: Facets<Cls> = {
  level: (item) => item.level,
  specialty: (item) => item.specialty,
  semester: (item) => item.semester,
};

test("picking a level narrows the other filters, with counts", () => {
  const selected = { level: "L1", specialty: "", semester: "" };
  assert.deepEqual([...facetOptions(classes, facets, selected, "specialty")], [["ENR", 2], ["INFO", 1]]);
  assert.deepEqual([...facetOptions(classes, facets, selected, "semester")], [["1", 3]]);
  // The level list itself is not narrowed by its own value.
  assert.deepEqual([...facetOptions(classes, facets, selected, "level")].map(([value]) => value), ["L1", "L2", "L3"]);
});

test("a filter narrows the levels too, and the selection stays listed", () => {
  const selected = { level: "L1", specialty: "INFO", semester: "" };
  assert.deepEqual([...facetOptions(classes, facets, selected, "level")], [["L1", 1], ["L2", 1], ["L3", 1]]);
  assert.deepEqual(applyFacets(classes, facets, selected).map((item) => item.name), ["1INFO-1"]);
  // A value no longer matching is kept (count 0) so it can be changed back.
  const stale = { level: "L2", specialty: "ENR", semester: "" };
  assert.equal(facetOptions(classes, facets, stale, "specialty").get("ENR"), 0);
});
