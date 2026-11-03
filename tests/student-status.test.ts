import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { parseEnrollmentWorkbook } from "../src/lib/parse-upload";
import { isExempt } from "../src/lib/student-status";

test("statut D = dispensé, whatever the case or spaces", () => {
  assert.equal(isExempt("D"), true);
  assert.equal(isExempt(" d "), true);
  assert.equal(isExempt("N"), false);
  assert.equal(isExempt("R"), false);
  assert.equal(isExempt(null), false);
});

test("scolarité import reads the Statut column", () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ["Nom Groupe:", "1ENR-1"],
      ["N° Inscription", "Nom Fr", "Prénom Fr", "Statut"],
      ["25100001", "DHAOUADI", "Wiem", "d"],
      ["25100002", "MABROUK", "Eya", "N"],
    ]),
    "1ENR-1",
  );
  const [group] = parseEnrollmentWorkbook(XLSX.write(book, { type: "array", bookType: "xlsx" }));
  assert.deepEqual(group.students.map((student) => student.status), ["D", "N"]);
});
