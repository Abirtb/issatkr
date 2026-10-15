import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  normalizeCin,
  parseCinEmailWorkbook,
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
    { line: 2, code: "ALGO", name: "Algorithmique" },
    { line: 4, code: "BD", name: "Bases de données" },
  ]);
  const excel = parseReferenceRows(
    parseWorkbook(workbook([["Sigle", "Intitulé"], ["L1", "Licence 1"]])),
  );
  assert.deepEqual(excel, [{ line: 2, code: "L1", name: "Licence 1" }]);
});
