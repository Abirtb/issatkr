import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessSession } from "@/lib/access";
import { z } from "zod";
import { recalculateAlertsForStudents } from "@/lib/alerts";
import { sendPendingNotifications } from "@/lib/mail";

const marksSchema = z.object({
  marks: z
    .array(z.object({ studentId: z.string().min(1), present: z.boolean() }))
    .min(1)
    .max(500),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await requireSession();
    const { sessionId } = await params;
    const access = await canAccessSession(user, sessionId);
    if (!access.exists) {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
    }
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        class: true,
        attendances: true,
      },
    });
    if (!session) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    const students = await prisma.student.findMany({
      where: { classId: session.classId, active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const map = Object.fromEntries(session.attendances.map((a) => [a.studentId, a]));
    const rows = students.map((s) => ({
      student: s,
      attendance: map[s.id] ?? null,
    }));

    return NextResponse.json({ session, rows });
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await requireSession();
    const { sessionId } = await params;
    const { marks } = marksSchema.parse(await req.json());

    const access = await canAccessSession(user, sessionId);
    if (!access.exists) {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { classId: true, subjectId: true, finalizedAt: true },
    });
    if (!session) {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }
    if (session.finalizedAt && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Séance déjà finalisée. Contactez l’administration." },
        { status: 409 },
      );
    }

    const uniqueStudentIds = [...new Set(marks.map((mark) => mark.studentId))];
    const validStudentCount = await prisma.student.count({
      where: {
        id: { in: uniqueStudentIds },
        classId: session.classId,
        active: true,
      },
    });
    if (
      validStudentCount !== uniqueStudentIds.length ||
      uniqueStudentIds.length !== marks.length
    ) {
      return NextResponse.json(
        { error: "Liste d’étudiants invalide pour cette classe" },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      ...marks.map((m) =>
        prisma.attendance.upsert({
        where: {
          studentId_sessionId: { studentId: m.studentId, sessionId },
        },
        create: {
          studentId: m.studentId,
          sessionId,
          present: m.present,
        },
          update: {
            present: m.present,
            ...(m.present ? { justification: null } : {}),
          },
        }),
      ),
      prisma.session.update({
        where: { id: sessionId },
        data: { finalizedAt: new Date() },
      }),
    ]);
    if (session.subjectId) {
      const notifications = await recalculateAlertsForStudents(
        uniqueStudentIds,
        session.subjectId,
      );
      if (notifications.length) {
        await sendPendingNotifications(Math.min(notifications.length, 10));
      }
    }

    return NextResponse.json({ ok: true, count: marks.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Enregistrement échoué" }, { status: 400 });
  }
}
