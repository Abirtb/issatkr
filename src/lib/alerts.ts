import type { AlertLevel, NotificationType } from "@prisma/client";
import { prisma } from "./db";
import {
  resolveAlertEpisode,
  resolveAlertLevel,
  shouldCreateNotification,
} from "./alert-policy";

export async function recalculateStudentSubjectAlert(
  studentId: string,
  subjectId: string,
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { class: { include: { level: true } } },
  });
  const level = student?.class.level;
  if (!student || !level) return null;

  const threshold = await prisma.absenceThreshold.findUnique({
    where: {
      subjectId_levelId: { subjectId, levelId: level.id },
    },
  });
  if (!threshold) return null;

  const absenceCount = await prisma.attendance.count({
    where: {
      studentId,
      present: false,
      OR: [{ justification: null }, { justification: "" }],
      session: { subjectId },
    },
  });
  const nextLevel: AlertLevel = resolveAlertLevel(
    absenceCount,
    threshold.eliminationCount,
  );
  const current = await prisma.alertState.findUnique({
    where: {
      studentId_subjectId_levelId: {
        studentId,
        subjectId,
        levelId: level.id,
      },
    },
  });
  const episode = resolveAlertEpisode(
    current?.level ?? null,
    nextLevel,
    current?.episode ?? 0,
  );
  const transition =
    shouldCreateNotification(current?.level ?? null, nextLevel) &&
    student.email;
  const type: NotificationType | null =
    nextLevel === "WARNING"
      ? "WARNING"
      : nextLevel === "ELIMINATED"
        ? "ELIMINATION"
        : null;

  return prisma.$transaction(async (tx) => {
    await tx.alertState.upsert({
      where: {
        studentId_subjectId_levelId: {
          studentId,
          subjectId,
          levelId: level.id,
        },
      },
      create: {
        studentId,
        subjectId,
        levelId: level.id,
        level: nextLevel,
        lastAbsenceCount: absenceCount,
        episode,
      },
      update: {
        level: nextLevel,
        lastAbsenceCount: absenceCount,
        episode,
      },
    });

    if (!transition || !type || !student.email) return null;
    const dedupKey = [
      studentId,
      subjectId,
      level.id,
      type,
      episode,
    ].join(":");
    const notification = await tx.notificationLog.upsert({
      where: { dedupKey },
      create: {
        studentId,
        subjectId,
        levelId: level.id,
        type,
        recipient: student.email,
        absenceCount,
        threshold: threshold.eliminationCount,
        episode,
        dedupKey,
      },
      update: {},
      select: { id: true },
    });
    return notification.id;
  });
}

export async function recalculateAlertsForStudents(
  studentIds: string[],
  subjectId: string,
) {
  const notificationIds: string[] = [];
  for (const studentId of [...new Set(studentIds)]) {
    const notificationId = await recalculateStudentSubjectAlert(
      studentId,
      subjectId,
    );
    if (notificationId) notificationIds.push(notificationId);
  }
  return notificationIds;
}
