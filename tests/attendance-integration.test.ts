import assert from "node:assert/strict";
import test from "node:test";
import { recalculateStudentSubjectAlert } from "../src/lib/alerts";
import { prisma } from "../src/lib/db";

test("creates one notification per threshold transition and episode", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const level = await prisma.academicLevel.create({
    data: { code: `TEST-L-${suffix}`, name: "Niveau test" },
  });
  const subject = await prisma.subject.create({
    data: { code: `TEST-S-${suffix}`, name: "Matière test" },
  });
  const professor = await prisma.user.create({
    data: {
      name: "Prof Test",
      email: `prof-${suffix}@example.tn`,
      password: "not-used-in-test",
      role: "PROF",
    },
  });
  const cls = await prisma.class.create({
    data: {
      name: `Classe ${suffix}`,
      code: `TEST-C-${suffix}`,
      levelId: level.id,
    },
  });
  const student = await prisma.student.create({
    data: {
      matricule: `M-${suffix}`,
      firstName: "Amine",
      lastName: "Test",
      email: `student-${suffix}@example.tn`,
      classId: cls.id,
    },
  });
  await prisma.absenceThreshold.create({
    data: {
      subjectId: subject.id,
      levelId: level.id,
      eliminationCount: 3,
    },
  });

  try {
    const sessions = [];
    for (let index = 0; index < 3; index++) {
      sessions.push(
        await prisma.session.create({
          data: {
            classId: cls.id,
            professorId: professor.id,
            subjectId: subject.id,
            courseName: subject.name,
            courseCode: subject.code,
            date: new Date(2026, 0, index + 1, 12),
            startTime: "08:30",
          },
        }),
      );
    }

    await prisma.attendance.create({
      data: {
        studentId: student.id,
        sessionId: sessions[0].id,
        present: false,
      },
    });
    assert.equal(
      await recalculateStudentSubjectAlert(student.id, subject.id),
      null,
    );

    await prisma.attendance.create({
      data: {
        studentId: student.id,
        sessionId: sessions[1].id,
        present: false,
      },
    });
    await recalculateStudentSubjectAlert(student.id, subject.id);
    await recalculateStudentSubjectAlert(student.id, subject.id);
    assert.equal(
      await prisma.notificationLog.count({
        where: { studentId: student.id },
      }),
      1,
    );

    await prisma.attendance.create({
      data: {
        studentId: student.id,
        sessionId: sessions[2].id,
        present: false,
      },
    });
    await recalculateStudentSubjectAlert(student.id, subject.id);
    assert.equal(
      await prisma.notificationLog.count({
        where: { studentId: student.id },
      }),
      2,
    );

    await prisma.attendance.updateMany({
      where: { studentId: student.id },
      data: { justification: "Justifié" },
    });
    await recalculateStudentSubjectAlert(student.id, subject.id);
    await prisma.attendance.update({
      where: {
        studentId_sessionId: {
          studentId: student.id,
          sessionId: sessions[0].id,
        },
      },
      data: { justification: null },
    });
    await prisma.attendance.update({
      where: {
        studentId_sessionId: {
          studentId: student.id,
          sessionId: sessions[1].id,
        },
      },
      data: { justification: null },
    });
    await recalculateStudentSubjectAlert(student.id, subject.id);
    assert.equal(
      await prisma.notificationLog.count({
        where: { studentId: student.id },
      }),
      3,
    );
  } finally {
    await prisma.notificationLog.deleteMany({
      where: { studentId: student.id },
    });
    await prisma.alertState.deleteMany({ where: { studentId: student.id } });
    await prisma.attendance.deleteMany({ where: { studentId: student.id } });
    await prisma.session.deleteMany({ where: { classId: cls.id } });
    await prisma.student.delete({ where: { id: student.id } });
    await prisma.absenceThreshold.deleteMany({
      where: { subjectId: subject.id, levelId: level.id },
    });
    await prisma.class.delete({ where: { id: cls.id } });
    await prisma.user.delete({ where: { id: professor.id } });
    await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.academicLevel.delete({ where: { id: level.id } });
  }
});
