import { classParts } from "./class-name";
import { prisma } from "./db";
import { countedStudent } from "./student-status";

// Official absence file (same columns as the scolarité template): one row per
// student and subject (EE) of each group. "Identifiant EE" comes from the
// class's parcours (imported EE list), "Identifiant Groupe" from the scolarité
// import; both stay empty when unknown. Absences = unjustified absences.
export const ABSENCE_EXPORT_HEADER = [
  "Année",
  "Identifiant Groupe",
  "Nom Groupe",
  "Identifiant EE",
  "Nom EE",
  "N° Inscription",
  "CIN",
  "Nom & Prénom Fr",
  "Prénom & Nom Ar",
  "Nombre d'absences",
] as const;

type EeCandidate = { code: string; parcoursId: string; subjectId: string; name: string };
const fold = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "");

// "Identifiant EE" of a subject for a class, most precise first:
// 1. EE of the class's parcours for this subject;
// 2. EE of the class's parcours with the same name ("Algèbre" created by hand);
// 3. the subject's own EE when it has only one (class not linked yet);
// 4. the subject code itself when it is an EE code (digits only).
export function eeCodeFor(
  cls: { parcoursId: string | null },
  subject: { id: string; code: string; name: string },
  candidates: EeCandidate[],
) {
  const inParcours = candidates.filter((item) => cls.parcoursId && item.parcoursId === cls.parcoursId);
  const exact = inParcours.find((item) => item.subjectId === subject.id);
  if (exact) return exact.code;
  const byName = inParcours.filter((item) => fold(item.name) === fold(subject.name));
  if (byName.length === 1) return byName[0].code;
  const own = [...new Set(candidates.filter((item) => item.subjectId === subject.id).map((item) => item.code))];
  if (own.length === 1) return own[0];
  return /^\d{6,}$/.test(subject.code) ? subject.code : "";
}

// "2025-2026" → "2025" (the scolarité file writes the first year).
export function academicStartYear(value: string | null) {
  return value?.match(/\d{4}/)?.[0] ?? "";
}

export async function buildAbsenceExport(filters: { classId?: string; from?: Date; to?: Date }) {
  const classes = await prisma.class.findMany({
    where: filters.classId ? { id: filters.classId } : {},
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      externalId: true,
      academicYear: true,
      levelId: true,
      parcoursId: true,
      semester: true,
      students: {
        where: { active: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          id: true,
          matricule: true,
          cin: true,
          firstName: true,
          lastName: true,
          firstNameAr: true,
          lastNameAr: true,
        },
      },
    },
  });
  const dateFilter =
    filters.from || filters.to
      ? { date: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
      : {};
  const [sessions, curricula, elements] = await Promise.all([
    prisma.session.findMany({
      where: { classId: { in: classes.map((item) => item.id) }, subjectId: { not: null }, ...dateFilter },
      select: { classId: true, subjectId: true },
    }),
    prisma.subjectCurriculum.findMany({ select: { subjectId: true, levelId: true, specialty: true } }),
    prisma.courseElement.findMany({
      where: { parcoursId: { in: classes.map((item) => item.parcoursId).filter((id): id is string => Boolean(id)) } },
      select: { code: true, parcoursId: true, subjectId: true, semester: true },
    }),
  ]);
  const absences = await prisma.attendance.findMany({
    where: {
      present: false,
      justification: null,
      // Dispensé (statut D): always 0.
      student: countedStudent,
      session: { classId: { in: classes.map((item) => item.id) }, subjectId: { not: null }, ...dateFilter },
    },
    select: { studentId: true, session: { select: { subjectId: true } } },
  });
  // "studentId:subjectId" → unjustified absences.
  const counts = new Map<string, number>();
  for (const row of absences) {
    const key = `${row.studentId}:${row.session.subjectId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Subjects of a group: those planned for it, plus its programme (level +
  // spécialité), so a subject with no session yet still gets its rows.
  const subjectIds = new Set<string>();
  const subjectsByClass = new Map<string, Set<string>>();
  for (const cls of classes) {
    const specialty = classParts(cls.name).specialty ?? "";
    const ids = new Set(
      sessions.filter((session) => session.classId === cls.id).map((session) => session.subjectId!),
    );
    for (const entry of curricula) {
      if (entry.levelId === cls.levelId && (entry.specialty === "" || entry.specialty === specialty)) {
        ids.add(entry.subjectId);
      }
    }
    // EE of its parcours for its semester (every semester if not set).
    for (const element of elements) {
      if (element.parcoursId === cls.parcoursId && (!cls.semester || element.semester === cls.semester)) {
        ids.add(element.subjectId);
      }
    }
    subjectsByClass.set(cls.id, ids);
    ids.forEach((id) => subjectIds.add(id));
  }
  const subjects = await prisma.subject.findMany({
    where: { id: { in: [...subjectIds] } },
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });
  const parcoursIds = classes.map((item) => item.parcoursId).filter((id): id is string => Boolean(id));
  const candidates: EeCandidate[] = (
    await prisma.courseElement.findMany({
      where: { OR: [{ parcoursId: { in: parcoursIds } }, { subjectId: { in: [...subjectIds] } }] },
      select: { code: true, parcoursId: true, subjectId: true, subject: { select: { name: true } } },
    })
  ).map(({ subject, ...element }) => ({ ...element, name: subject.name }));

  const rows: (string | number)[][] = [];
  for (const cls of classes) {
    const ids = subjectsByClass.get(cls.id)!;
    for (const subject of subjects.filter((item) => ids.has(item.id))) {
      for (const student of cls.students) {
        rows.push([
          academicStartYear(cls.academicYear),
          cls.externalId ?? "",
          cls.name,
          eeCodeFor(cls, subject, candidates),
          subject.name,
          student.matricule,
          student.cin ?? "",
          `${student.lastName} ${student.firstName}`.trim(),
          `${student.firstNameAr ?? ""} ${student.lastNameAr ?? ""}`.trim(),
          counts.get(`${student.id}:${subject.id}`) ?? 0,
        ]);
      }
    }
  }
  return rows;
}
