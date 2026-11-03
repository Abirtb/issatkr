import { NextResponse } from "next/server";
import { requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Admin home: a few counts, what needs attention, and today's sessions.
// Session dates are stored at local noon (see the schedule import), so the
// local day boundaries select them.
export async function GET() {
  try {
    await requireAdmin();
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const weekAgo = new Date(startOfToday);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      classes,
      students,
      teachers,
      classesWithoutLevel,
      studentsWithoutEmail,
      pendingInvitations,
      missedRollCalls,
      failedNotifications,
      today,
    ] = await Promise.all([
      prisma.class.count(),
      prisma.student.count({ where: { active: true } }),
      prisma.user.count({ where: { active: true, role: { in: ["PROF", "DEPARTMENT_HEAD"] } } }),
      prisma.class.count({ where: { levelId: null } }),
      prisma.student.count({ where: { active: true, OR: [{ email: null }, { email: "" }] } }),
      prisma.user.count({ where: { active: true, awaitingActivation: true } }),
      prisma.session.count({ where: { finalizedAt: null, date: { gte: weekAgo, lt: startOfToday } } }),
      prisma.notificationLog.count({ where: { status: "FAILED" } }),
      prisma.session.findMany({
        where: { date: { gte: startOfToday, lt: endOfToday } },
        orderBy: [{ startTime: "asc" }],
        take: 50,
        select: {
          id: true,
          courseName: true,
          startTime: true,
          endTime: true,
          room: true,
          finalizedAt: true,
          class: { select: { name: true } },
          professor: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      counts: { classes, students, teachers, sessionsToday: today.length },
      todo: {
        classesWithoutLevel,
        studentsWithoutEmail,
        pendingInvitations,
        missedRollCalls,
        failedNotifications,
      },
      today: today.map((session) => ({
        id: session.id,
        courseName: session.courseName,
        startTime: session.startTime,
        endTime: session.endTime,
        room: session.room,
        done: Boolean(session.finalizedAt),
        className: session.class.name,
        professor: session.professor?.name ?? null,
      })),
    });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}
