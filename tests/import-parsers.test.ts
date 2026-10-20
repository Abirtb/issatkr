import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { classParts } from "../src/lib/class-name";
import {
  matchLevel,
  normalizeAcademicYear,
  normalizeCin,
  parseCinEmailWorkbook,
  parseEnrollmentWorkbook,
  parseTeacherWorkbook,
  personKey,
  parseTeacherRows,
  parseWorkbook,
} from "../src/lib/parse-upload";

function workbook(rows: unknown[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Feuil1");
  return XLSX.write(book, { type: "array", bookType: "xlsx" });
}

test("CIN matching ignores leading zeros lost by Excel", () => {
  assert.equal(normalizeCin("01234567"), normalizeCin("1234567"));
  assert.equal(normalizeCin(" 0123 4567 "), "1234567");
});

test("reads CIN and e-mail columns below a title row", () => {
  const rows = parseCinEmailWorkbook(
    workbook([
      ["Liste des e-mails"],
      ["CIN", "Nom", "Prénom", "Adresse E-mail"],
      ["01234567", "Ben Ali", "Amine", "Amine@Example.tn"],
      ["", "Sans CIN", "", "x@example.tn"],
    ]),
  );
  assert.deepEqual(rows, [
    { cin: "01234567", email: "amine@example.tn", name: "Ben Ali Amine" },
  ]);
});

test("parses teachers with split or full names and roles", () => {
  const rows = parseTeacherRows(
    parseWorkbook(
      workbook([
        ["Nom", "Prénom", "E-mail", "Rôle"],
        ["Ben Salah", "Mohamed", "M.BenSalah@issatkr.tn", "Chef de département"],
        ["Trabelsi", "Sana", "s.trabelsi@issatkr.tn", ""],
      ]),
    ),
  );
  assert.equal(rows[0].name, "Mohamed Ben Salah");
  assert.equal(rows[0].email, "m.bensalah@issatkr.tn");
  assert.equal(rows[0].role, "DEPARTMENT_HEAD");
  assert.equal(rows[1].role, null);
});

test("parses subjects/levels with accented or alternative headers, keeps line numbers", async () => {
  const { parseReferenceRows } = await import("../src/lib/parse-upload");
  const csv = new TextEncoder().encode("code;libellé\nALGO;Algorithmique\n;\nBD;Bases de données\n");
  const rows = parseReferenceRows(parseWorkbook(csv.buffer as ArrayBuffer));
  assert.deepEqual(rows, [
    { line: 2, code: "ALGO", name: "Algorithmique", level: "", specialty: "" },
    { line: 4, code: "BD", name: "Bases de données", level: "", specialty: "" },
  ]);
  const excel = parseReferenceRows(
    parseWorkbook(workbook([["Sigle", "Intitulé"], ["L1", "Licence 1"]])),
  );
  assert.deepEqual(excel, [{ line: 2, code: "L1", name: "Licence 1", level: "", specialty: "" }]);
});

test("scolarité export: parcours, year, semester and level number from the header", () => {
  const groups = parseEnrollmentWorkbook(
    workbook([
      ["Année:", "2025", "", "Semestre:", "1"],
      ["Parcours", "Génie Energétique : Tronc commun ( ISSAT Kairouan)"],
      ["Identifiant Groupe:", "25186013", "", "Nom Groupe:", "1ENR-1", "Type:", "ob"],
      [],
      ["N° Inscription", "CIN", "Nom Ar", "Prénom Ar", "Nom Fr", "Prénom Fr"],
      ["25100001", "05449214", "الذوادي", "وئام", "DHAOUADI", "Wiem"],
    ]),
  );
  assert.equal(groups.length, 1);
  const [group] = groups;
  assert.equal(group.name, "1ENR-1");
  assert.equal(group.externalId, "25186013");
  assert.equal(group.program, "Génie Energétique : Tronc commun ( ISSAT Kairouan)");
  assert.equal(group.academicYear, "2025-2026");
  assert.equal(group.semester, 1);
  assert.equal(group.levelNumber, 1);
  assert.equal(group.students[0].cin, "05449214");
});

test("academic year: a single year becomes a range, ranges are kept", () => {
  assert.equal(normalizeAcademicYear("2025"), "2025-2026");
  assert.equal(normalizeAcademicYear("2025/2026"), "2025-2026");
  assert.equal(normalizeAcademicYear("2026-2027"), "2026-2027");
  assert.equal(normalizeAcademicYear(""), "");
});

test("level detection: unique number, parcours family, explicit hint, otherwise none", () => {
  const L1 = { id: "l1", code: "L1", name: "Licence 1" };
  const M1 = { id: "m1", code: "M1", name: "Master 1" };
  const ING1 = { id: "i1", code: "ING1", name: "Cycle ingénieur 1" };
  const L2 = { id: "l2", code: "L2", name: "Licence 2" };
  const group = (levelNumber: number | null, program = "", levelHint = "") => ({ levelNumber, program, levelHint });

  assert.equal(matchLevel([L1, L2], group(1, "Génie Energétique"))?.id, "l1");
  assert.equal(matchLevel([L1, L2], group(3)), null);
  assert.equal(matchLevel([L1, M1, ING1], group(1, "Mastère de recherche"))?.id, "m1");
  assert.equal(matchLevel([L1, M1, ING1], group(1, "Cycle Ingénieur Informatique"))?.id, "i1");
  assert.equal(matchLevel([L1, M1, ING1], group(1, "Licence en Génie Energétique"))?.id, "l1");
  // Several families and nothing in the parcours: no guess.
  assert.equal(matchLevel([L1, M1, ING1], group(1, "Génie Energétique")), null);
  assert.equal(matchLevel([L1, M1], group(null, "", "Master 1"))?.id, "m1");
  assert.equal(matchLevel([L1, M1], group(null)), null);
});

test("staff list without header: name in A, grade in B, optional e-mail anywhere", () => {
  const rows = parseTeacherWorkbook(
    workbook([
      ["AMMAR MARWA", "Maitre-assistant"],
      ["Zied GARBOUJ", "Maitre-assistant", "Z.Garbouj@issatkr.tn"],
      ["ABID Hasna", ""],
      ["", ""],
    ]),
  );
  assert.deepEqual(
    rows.map(({ name, grade, email }) => ({ name, grade, email })),
    [
      { name: "AMMAR MARWA", grade: "Maitre-assistant", email: "" },
      { name: "Zied GARBOUJ", grade: "Maitre-assistant", email: "z.garbouj@issatkr.tn" },
      { name: "ABID Hasna", grade: "", email: "" },
    ],
  );
});

test("staff list with header still works, e-mail optional", () => {
  const rows = parseTeacherWorkbook(
    workbook([
      ["Nom", "Prénom", "Grade", "Email"],
      ["Ben Salah", "Mohamed", "PES", ""],
    ]),
  );
  assert.equal(rows[0].name, "Mohamed Ben Salah");
  assert.equal(rows[0].grade, "PES");
  assert.equal(rows[0].email, "");
});

test("same person whatever the case, accents and word order", () => {
  assert.equal(personKey("Zied GARBOUJ"), personKey("garbouj  zied"));
  assert.equal(personKey("Hélà Zorgati"), personKey("ZORGATI Hela"));
  assert.notEqual(personKey("Ali Hamdi"), personKey("Ali Hamdi Ben"));
});

test("class name: year of study, spécialité and group", () => {
  assert.deepEqual(classParts("1ENR1"), { year: 1, specialty: "ENR", group: 1 });
  assert.deepEqual(classParts("2INFO-3"), { year: 2, specialty: "INFO", group: 3 });
  assert.deepEqual(classParts("ING1 INFO"), { year: null, specialty: null, group: null });
});

test("subjects file may list programmes: niveau and spécialité columns", async () => {
  const { parseReferenceRows } = await import("../src/lib/parse-upload");
  const rows = parseReferenceRows(
    parseWorkbook(
      workbook([
        ["code", "libellé", "niveau", "spécialité"],
        ["ALGO", "Algorithmique", "L1", "ENR"],
        ["ALGO", "Algorithmique", "L2", "INFO"],
        ["ANG", "Anglais", "L1", ""],
      ]),
    ),
  );
  assert.deepEqual(
    rows.map(({ code, level, specialty }) => [code, level, specialty]),
    [["ALGO", "L1", "ENR"], ["ALGO", "L2", "INFO"], ["ANG", "L1", ""]],
  );
});
