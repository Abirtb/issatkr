import { prisma } from "./db";
import { resolveAlertLevel } from "./alert-policy";

export async function countUnjustifiedAbsences(studentId: string) {
  return prisma.attendance.count({
    where: {
      studentId,
      present: false,
      OR: [{ justification: null }, { justification: "" }],
    },
  });
}

export type AttendanceReportFilters = {
  classId?: string;
  subjectId?: string;
  levelId?: string;
  allowedClassIds?: string[];
  from?: Date;
  to?: Date;
};

export async function getAttendanceReport(filters: AttendanceReportFilters) {
  const students = await prisma.student.findMany({
    where: {
      active: true,
      class: {
        ...(filters.classId
          ? { id: filters.classId }
          : filters.allowedClassIds
            ? { id: { in: filters.allowedClassIds } }
            : {}),
        ...(filters.levelId ? { levelId: filters.levelId } : {}),
      },
    },
    // Reports reach teachers too: identity fields only, no CIN/e-mail/phone.
    select: {
      id: true,
      matricule: true,
      firstName: true,
      lastName: true,
      classId: true,
      class: { include: { level: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const levelIds = [
    ...new Set(
      students
        .map((student) => student.class.levelId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const thresholds = await prisma.absenceThreshold.findMany({
    where: {
      levelId: { in: levelIds },
      ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
    },
    include: { subject: true, level: true },
  });
  const subjectIds = [...new Set(thresholds.map((item) => item.subjectId))];
  const attendances = await prisma.attendance.findMany({
    where: {
      studentId: { in: students.map((student) => student.id) },
      session: {
        subjectId: { in: subjectIds },
        ...(filters.from || filters.to
          ? {
              date: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
    },
    include: { session: { select: { subjectId: true } } },
  });
  const stats = new Map<
    string,
    { absences: number; justified: number; present: number; total: number }
  >();
  for (const attendance of attendances) {
    if (!attendance.session.subjectId) continue;
    const key = `${attendance.studentId}:${attendance.session.subjectId}`;
    const current = stats.get(key) ?? {
      absences: 0,
      justified: 0,
      present: 0,
      total: 0,
    };
    current.total++;
    if (attendance.present) {
      current.present++;
    } else if (attendance.justification) {
      current.justified++;
    } else {
      current.absences++;
    }
    stats.set(key, current);
  }

  const rows = students.flatMap((student) =>
    thresholds
      .filter((threshold) => threshold.levelId === student.class.levelId)
      .map((threshold) => {
        const values = stats.get(`${student.id}:${threshold.subjectId}`) ?? {
          absences: 0,
          justified: 0,
          present: 0,
          total: 0,
        };
        const status = resolveAlertLevel(
          values.absences,
          threshold.eliminationCount,
        );
        return {
          student,
          class: student.class,
          subject: threshold.subject,
          level: threshold.level,
          threshold: threshold.eliminationCount,
          ...values,
          status,
          eliminated: status === "ELIMINATED",
        };
      }),
  );
  return { rows, thresholds };
}

export async function getEliminatedStudents(filters: AttendanceReportFilters) {
  const report = await getAttendanceReport(filters);
  return {
    students: report.rows.filter((row) => row.status === "ELIMINATED"),
  };
}
