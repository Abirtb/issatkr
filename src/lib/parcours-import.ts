import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { parcoursCodeIn, parcoursKey, parcoursLabel } from "./parcours";
import { MAX_IMPORT_ROWS } from "./parse-upload";

export type ParcoursRow = { line: number; code: string; domain: string; mention: string; specialty: string };
export type ElementRow = {
  line: number;
  // From the "Elements d'enseignements LI661294" title; empty if absent.
  parcoursCode: string;
  semester: number;
  code: string;
  name: string;
  regime: string;
  coefficient: number;
  credits: number;
  hoursLecture: number;
  hoursTutorial: number;
  hoursLab: number;
};

const key = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
// "10,5" (French Excel) or "10.5".
// "10,5" (French Excel), "10.5", "3 crédits", "21h" → the first number.
const number = (value: unknown) => {
  const match = String(value ?? "").match(/-?\d+(?:[.,]\d+)?/);
  const parsed = match ? Number(match[0].replace(",", ".")) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

function sheetsRows(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  return workbook.SheetNames.map((name) =>
    XLSX.utils
      .sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: "", blankrows: false, raw: false })
      .slice(0, MAX_IMPORT_ROWS + 1),
  );
}

// Parcours list: N, Code, Domaine, Mention, Spécialité.
export function parseParcoursList(buffer: ArrayBuffer): ParcoursRow[] {
  const result: ParcoursRow[] = [];
  for (const rows of sheetsRows(buffer)) {
    const headerIndex = rows.findIndex(
      (row) => row.some((cell) => key(cell) === "code") && row.some((cell) => ["mention", "specialite"].includes(key(cell))),
    );
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex].map(key);
    const col = (name: string) => headers.indexOf(name);
    const [code, domain, mention, specialty] = ["code", "domaine", "mention", "specialite"].map(col);
    rows.slice(headerIndex + 1).forEach((row, index) => {
      const value = text(row[code]).toUpperCase().replace(/\s/g, "");
      if (!/^[A-Z]{1,6}\d{3,}$/.test(value)) return;
      result.push({
        line: headerIndex + index + 2,
        code: value,
        domain: domain >= 0 ? text(row[domain]) : "",
        mention: mention >= 0 ? text(row[mention]) : "",
        specialty: specialty >= 0 ? text(row[specialty]) : "",
      });
    });
  }
  return result;
}

// Éléments d'enseignement: a title "Elements d'enseignements LI661294", then
// Semestre | Code EE | Libellé | Rg | Coef | Crédit | TP | TD | Cours. Several
// parcours may follow each other, on one sheet or several.
export function parseCourseElements(buffer: ArrayBuffer): ElementRow[] {
  const result: ElementRow[] = [];
  for (const rows of sheetsRows(buffer)) {
    let parcoursCode = "";
    let columns: Record<string, number> | null = null;
    let semesterColumn = 0;
    rows.forEach((row, index) => {
      const title = row.map(text).join(" ").match(/el[eé]ments?\s+d.?\s*enseignements?\s+([A-Za-z]{1,6}\s*\d{3,})/i);
      if (title) {
        parcoursCode = title[1].replace(/\s/g, "").toUpperCase();
        const semester = row.findIndex((cell) => key(cell) === "semestre");
        if (semester >= 0) semesterColumn = semester;
      }
      const keys = row.map(key);
      if (keys.includes("codeee")) {
        const at = (...names: string[]) => keys.findIndex((cell) => names.includes(cell));
        // Exact header first, else a header that starts with / contains the word
        // ("Crédits ECTS", "Nb crédits", "TP (h)", "Cours intégré"…).
        const like = (exact: string[], test: (cell: string) => boolean) => {
          const index = at(...exact);
          return index >= 0 ? index : keys.findIndex((cell, column) => column !== codeColumn && test(cell));
        };
        const codeColumn = at("codeee");
        columns = {
          code: codeColumn,
          name: like(["libelle", "intitule"], (cell) => cell.startsWith("libelle") || cell.startsWith("intitule")),
          regime: like(["rg", "regime"], (cell) => cell.startsWith("regime")),
          coefficient: like(["coef", "coefficient"], (cell) => cell.startsWith("coef")),
          credits: like(["credit", "credits", "cr", "ects"], (cell) => cell.includes("credit") || cell.includes("ects")),
          lab: like(["tp"], (cell) => cell.startsWith("tp") || cell.includes("travauxpratiques")),
          tutorial: like(["td"], (cell) => cell.startsWith("td") || cell.includes("travauxdiriges")),
          lecture: like(["cours", "c"], (cell) => cell.startsWith("cours")),
          semester: at("semestre") >= 0 ? at("semestre") : semesterColumn,
        };
        return;
      }
      if (!columns) return;
      const code = text(row[columns.code]).replace(/\s/g, "");
      if (!/^\d{6,}$/.test(code)) return;
      const value = (column: number) => (column >= 0 ? row[column] : "");
      result.push({
        line: index + 1,
        parcoursCode,
        semester: Math.trunc(number(value(columns.semester))),
        code,
        name: text(value(columns.name)),
        regime: text(value(columns.regime)).toUpperCase(),
        coefficient: number(value(columns.coefficient)),
        credits: number(value(columns.credits)),
        hoursLecture: number(value(columns.lecture)),
        hoursTutorial: number(value(columns.tutorial)),
        hoursLab: number(value(columns.lab)),
      });
    });
  }
  return result;
}

// Links classes without parcours to the one whose "Mention : Spécialité" is
// their scolarité "Parcours" text. A parcours chosen by hand is never changed.
export async function linkClassesToParcours(tx: Prisma.TransactionClient) {
  const [classes, parcours] = await Promise.all([
    tx.class.findMany({
      where: { program: { not: null } },
      select: { id: true, program: true, parcoursId: true },
    }),
    tx.parcours.findMany({ select: { id: true, code: true, mention: true, specialty: true } }),
  ]);
  const byCode = new Map(parcours.map((item) => [item.code.toUpperCase(), item.id]));
  const byKey = new Map(parcours.map((item) => [parcoursKey(parcoursLabel(item)), item.id]));
  let linked = 0;
  for (const cls of classes) {
    const program = cls.program ?? "";
    // The code ("LI574498") in the scolarité file is authoritative, even over
    // an earlier link. The name only fills classes not linked yet.
    const code = parcoursCodeIn(program);
    const parcoursId = code
      ? byCode.get(code)
      : cls.parcoursId
        ? undefined
        : byKey.get(parcoursKey(program));
    if (!parcoursId || parcoursId === cls.parcoursId) continue;
    await tx.class.update({ where: { id: cls.id }, data: { parcoursId } });
    linked++;
  }
  return linked;
}
