import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { parcoursCodeIn, parcoursDigits, parcoursKey, parcoursLabel, sessionsFor } from "../src/lib/parcours";
import { parseCourseElements, parseParcoursList } from "../src/lib/parcours-import";

function workbook(rows: unknown[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Feuil1");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

test("parcours list: N, Code, Domaine, Mention, Spécialité", () => {
  const rows = parseParcoursList(
    workbook([
      ["N", "Code", "Domaine", "Mention", "Spécialité"],
      [1, "LI574498", "Sciences Exactes et Technologies", "Génie Energétique", "Tronc commun ( ISSAT Kairouan)"],
      [2, "", "", "", ""],
    ]),
  );
  assert.deepEqual(rows, [
    {
      line: 2,
      code: "LI574498",
      domain: "Sciences Exactes et Technologies",
      mention: "Génie Energétique",
      specialty: "Tronc commun ( ISSAT Kairouan)",
    },
  ]);
});

test("EE list: parcours from the title, semester in column A, decimal hours", () => {
  const rows = parseCourseElements(
    workbook([
      ["Semestre", "Elements d'enseignements LI661294"],
      [1, "Code EE", "Libellé", "Rg", "Coef", "Crédit", "TP", "TD", "Cours"],
      [1, 661294111, "Conception 1", "MX", 1.5, 3, 0, 21, 21],
      [1, 661294132, "Science des matériaux 1", "mx", 1, 2, 0, "10,5", 21],
      [2, 661294211, "Conception 2", "MX", 1.5, 3, 0, 21, 21],
    ]),
  );
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], {
    line: 4,
    parcoursCode: "LI661294",
    semester: 1,
    code: "661294132",
    name: "Science des matériaux 1",
    regime: "MX",
    coefficient: 1,
    credits: 2,
    hoursLecture: 21,
    hoursTutorial: 10.5,
    hoursLab: 0,
  });
  assert.equal(rows[2].semester, 2);
});

test("scolarité 'Parcours' text matches the list's Mention : Spécialité", () => {
  const list = { mention: "Génie Energétique", specialty: "Tronc commun ( ISSAT Kairouan)" };
  assert.equal(parcoursKey("Génie Energétique : Tronc commun ( ISSAT Kairouan)"), parcoursKey(parcoursLabel(list)));
  assert.notEqual(parcoursKey("Génie Energétique : Energies Renouvelables( ISSAT Kairouan)"), parcoursKey(parcoursLabel(list)));
});

test("EE codes start with the parcours digits; hours become 1h30 sessions", () => {
  assert.ok("574498111".startsWith(parcoursDigits("LI574498")));
  assert.equal(sessionsFor(21), 14);
  assert.equal(sessionsFor(10.5), 7);
  assert.equal(sessionsFor(42), 28);
});

test("parcours code in the scolarité 'Parcours' cell", () => {
  assert.equal(parcoursCodeIn("LI574498"), "LI574498");
  assert.equal(parcoursCodeIn(" li 574498 "), "LI574498");
  assert.equal(parcoursCodeIn("LI574498 - Génie Energétique : Tronc commun"), "LI574498");
  assert.equal(parcoursCodeIn("Génie Energétique : Tronc commun ( ISSAT Kairouan)"), null);
});
