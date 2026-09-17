import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { parseEnrollmentWorkbook } from "../src/lib/parse-upload";

test("parses one class per enrollment sheet", () => {
  const workbook = XLSX.utils.book_new();
  const rows = [
    ["Année:", "2026", "", "Semestre:", "1"],
    ["Parcours", "Génie informatique"],
    ["Identifiant Groupe:", "G-101", "", "Nom Groupe:", "1INFO-1"],
    ["N° Inscription", "CIN", "Nom Ar", "Prénom Ar", "Nom Fr", "Prénom Fr", "", "", "", "", "", "", "", "", "", "", "Email", "", "Telephone Portable"],
    ["2026001", "12345678", "", "", "Ben Ali", "Amine", "", "", "", "", "", "", "", "", "", "", "amine@example.tn", "", "22111222"],
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    "GP1_1INFO1",
  );
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const groups = parseEnrollmentWorkbook(bytes);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "1INFO-1");
  assert.equal(groups[0].externalId, "G-101");
  assert.equal(groups[0].program, "Génie informatique");
  assert.equal(groups[0].students.length, 1);
  assert.equal(groups[0].students[0].matricule, "2026001");
  assert.equal(groups[0].students[0].email, "amine@example.tn");
});
