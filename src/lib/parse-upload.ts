import * as XLSX from "xlsx";

export type Row = Record<string, string>;
export const MAX_IMPORT_ROWS = 5_000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type EnrollmentStudent = {
  matricule: string;
  cin: string;
  firstName: string;
  lastName: string;
  firstNameAr: string;
  lastNameAr: string;
  email: string;
  phone: string;
};

export type EnrollmentGroup = {
  sheetName: string;
  name: string;
  code: string;
  externalId: string;
  program: string;
  academicYear: string;
  semester: number | null;
  students: EnrollmentStudent[];
};

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function pick(row: Row, keys: string[]) {
  const map = Object.fromEntries(Object.entries(row).map(([k, v]) => [norm(k), String(v ?? "").trim()]));
  for (const k of keys) {
    const v = map[norm(k)];
    if (v) return v;
  }
  return "";
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function findMetadata(
  rows: unknown[][],
  label: string,
  valueOffset = 1,
) {
  const wanted = norm(label);
  for (const row of rows) {
    const index = row.findIndex((cell) => norm(text(cell)) === wanted);
    if (index >= 0) return text(row[index + valueOffset]);
  }
  return "";
}

export function parseEnrollmentWorkbook(buffer: ArrayBuffer): EnrollmentGroup[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  if (workbook.SheetNames.length > 100) {
    throw new Error("Maximum 100 feuilles par fichier");
  }

  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: false,
    });
    const headerIndex = rows.findIndex((row) =>
      row.some((cell) =>
        ["ninscription", "matricule"].includes(norm(text(cell))),
      ),
    );
    if (headerIndex < 0) return [];

    const metadataRows = rows.slice(0, headerIndex);
    const headers = rows[headerIndex].map((cell) => norm(text(cell)));
    const column = (...names: string[]) =>
      headers.findIndex((header) => names.map(norm).includes(header));
    const valueAt = (row: unknown[], index: number) =>
      index >= 0 ? text(row[index]) : "";

    const matriculeColumn = column(
      "N° Inscription",
      "N Inscription",
      "Matricule",
    );
    const cinColumn = column("CIN");
    const lastNameColumn = column("Nom Fr", "Nom");
    const firstNameColumn = column("Prénom Fr", "Prenom Fr", "Prénom");
    const lastNameArColumn = column("Nom Ar");
    const firstNameArColumn = column("Prénom Ar", "Prenom Ar");
    const emailColumn = column("Email", "E-mail");
    const phoneColumn = column("Telephone Portable", "Téléphone Portable");

    const name =
      findMetadata(metadataRows, "Nom Groupe") || sheetName.trim();
    const externalId = findMetadata(metadataRows, "Identifiant Groupe");
    const semesterRaw = Number(findMetadata(metadataRows, "Semestre"));
    const students = rows
      .slice(headerIndex + 1)
      .map((row) => {
        const firstNameAr = valueAt(row, firstNameArColumn);
        const lastNameAr = valueAt(row, lastNameArColumn);
        return {
          matricule: valueAt(row, matriculeColumn),
          cin: valueAt(row, cinColumn),
          firstName: valueAt(row, firstNameColumn) || firstNameAr,
          lastName: valueAt(row, lastNameColumn) || lastNameAr,
          firstNameAr,
          lastNameAr,
          email: valueAt(row, emailColumn).toLowerCase(),
          phone: valueAt(row, phoneColumn),
        };
      })
      .filter(
        (student) =>
          student.matricule && (student.firstName || student.lastName),
      )
      .slice(0, MAX_IMPORT_ROWS + 1);

    return [
      {
        sheetName,
        name,
        code: name.toUpperCase().replace(/\s+/g, ""),
        externalId,
        program: findMetadata(metadataRows, "Parcours"),
        academicYear: findMetadata(metadataRows, "Année"),
        semester: Number.isInteger(semesterRaw) ? semesterRaw : null,
        students,
      },
    ];
  });
}

export function parseWorkbook(buffer: ArrayBuffer): Row[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils
    .sheet_to_json<Row>(sheet, { defval: "" })
    .slice(0, MAX_IMPORT_ROWS + 1);
}

export function parseStudentsRows(rows: Row[]) {
  return rows
    .map((row) => ({
      // Never fall back to the CIN: the matricule is shown to every teacher.
      matricule: pick(row, ["matricule", "numero", "num_inscription", "id"]),
      firstName: pick(row, ["prenom", "firstname", "first_name", "nom_prenom"]),
      lastName: pick(row, ["nom", "lastname", "last_name", "nom_famille"]),
    }))
    .filter((r) => r.matricule && (r.firstName || r.lastName));
}

export function parseEmploiRows(rows: Row[]) {
  return rows
    .map((row) => {
      const classCode = pick(row, ["classe", "groupe", "class", "code_classe", "section"]);
      const courseName = pick(row, ["matiere", "course", "module", "nom_matiere"]);
      const courseCode = pick(row, ["code", "code_matiere", "course_code"]);
      const dateRaw = pick(row, ["date", "jour", "day"]);
      const startTime = pick(row, ["heure_debut", "debut", "start", "start_time", "heure"]);
      const endTime = pick(row, ["heure_fin", "fin", "end", "end_time"]);
      const room = pick(row, ["salle", "room", "local"]);
      const professorEmail = pick(row, [
        "enseignant_email",
        "email_enseignant",
        "professeur_email",
        "prof_email",
        "teacher_email",
      ]).toLowerCase();
      return {
        classCode,
        courseName,
        courseCode,
        dateRaw,
        startTime,
        endTime,
        room,
        professorEmail,
      };
    })
    .filter((r) => r.classCode && r.courseName && r.dateRaw && r.startTime);
}

export function parseDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const fr = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (fr) {
    const y = fr[3].length === 2 ? 2000 + Number(fr[3]) : Number(fr[3]);
    const d = new Date(y, Number(fr[2]) - 1, Number(fr[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// CINs lose leading zeros when Excel stores them as numbers.
export function normalizeCin(value: string) {
  const compact = value.trim().toUpperCase().replace(/[\s.\-]/g, "");
  return /^\d+$/.test(compact) ? compact.replace(/^0+/, "") : compact;
}

export type CinEmailRow = { cin: string; email: string; name: string };

// Reads every sheet looking for a header row with a CIN column and an e-mail column.
export function parseCinEmailWorkbook(buffer: ArrayBuffer): CinEmailRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const result: CinEmailRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: false,
    });
    const headerIndex = rows.findIndex(
      (row) =>
        row.some((cell) => norm(text(cell)) === "cin") &&
        row.some((cell) => norm(text(cell)).includes("mail")),
    );
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex].map((cell) => norm(text(cell)));
    const cinColumn = headers.indexOf("cin");
    const emailColumn = headers.findIndex((header) => header.includes("mail"));
    const nameColumns = headers
      .map((header, index) => ({ header, index }))
      .filter(({ header }) => /^(nom|prenom|name)/.test(header))
      .map(({ index }) => index);
    for (const row of rows.slice(headerIndex + 1)) {
      const cin = text(row[cinColumn]);
      const email = text(row[emailColumn]).toLowerCase();
      if (!cin || !email) continue;
      result.push({
        cin,
        email,
        name: nameColumns.map((index) => text(row[index])).filter(Boolean).join(" "),
      });
      if (result.length > MAX_IMPORT_ROWS) return result;
    }
  }
  return result;
}

export type TeacherRow = {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "DEPARTMENT_HEAD" | "PROF" | null;
};

function parseRole(raw: string): TeacherRow["role"] {
  const value = norm(raw);
  if (!value) return null;
  if (value.startsWith("admin")) return "ADMIN";
  if (value.includes("chef") || value.includes("head")) return "DEPARTMENT_HEAD";
  return "PROF";
}

export function parseTeacherRows(rows: Row[]): TeacherRow[] {
  return rows
    .map((row) => {
      const fullName = pick(row, ["nom_complet", "nom_prenom", "name", "enseignant", "full_name"]);
      const lastName = pick(row, ["nom", "last_name", "lastname"]);
      const firstName = pick(row, ["prenom", "first_name", "firstname"]);
      return {
        name: fullName || [firstName, lastName].filter(Boolean).join(" "),
        email: pick(row, ["email", "e-mail", "mail", "adresse_email"]).toLowerCase(),
        password: pick(row, ["mot_de_passe", "password", "mdp"]),
        role: parseRole(pick(row, ["role", "rôle", "fonction"])),
      };
    })
    .filter((row) => row.email);
}
