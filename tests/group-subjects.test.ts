import assert from "node:assert/strict";
import test from "node:test";
import { groupYear, isGroupSubject, semesterInGroup } from "../src/lib/group-subjects";

const group = { name: "1ENR-1", levelId: "l1", parcoursId: "enr", semester: 1, level: { code: "L1" } };
const subject = (semester: number, parcoursId = "enr") => ({ elements: [{ parcoursId, semester }], curricula: [] });

test("group level: semester first, then level code, then the class name", () => {
  assert.equal(groupYear(group), 1);
  assert.equal(groupYear({ ...group, semester: 4 }), 2);
  assert.equal(groupYear({ ...group, semester: null, level: { code: "L3" } }), 3);
  assert.equal(groupYear({ ...group, semester: null, level: null, name: "2INFO-1" }), 2);
});

test("group subjects: EE of its parcours for its level, plus its programme", () => {
  assert.equal(semesterInGroup(subject(1), group), 1);
  assert.equal(semesterInGroup(subject(2), group), 2); // same year (1st)
  assert.equal(isGroupSubject(subject(3), group), false); // 2nd year
  assert.equal(isGroupSubject(subject(1, "other"), group), false); // other parcours
  assert.equal(isGroupSubject({ elements: [], curricula: [{ levelId: "l1", specialty: "ENR" }] }, group), true);
  assert.equal(isGroupSubject({ elements: [], curricula: [{ levelId: "l1", specialty: "INFO" }] }, group), false);
});
