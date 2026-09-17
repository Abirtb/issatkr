import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { recalculateStudentSubjectAlert } from "@/lib/alerts";
import { sendPendingNotifications } from "@/lib/mail";

const patchSchema = z.object({
  id: z.string().min(1),
  present: z.boolean().optional(),
  justification: z.string().max(500).optional(),
});

const createSchema = z.object({
  studentId: z.string().min(1),
  sessionId: z.string().min(1),
  present: z.boolean().default(false),
  justification: z.string().max(500).optional(),
});

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const classId = url.searchParams.get("classId")?.trim();

    const attendances = await prisma.attendance.findMany({
      where: {
        ...(classId ? { student: { classId } } : {}),
        ...(q
          ? {
              OR: [
                { student: { matricule: { contains: q } } },
                { student: { lastName: { contains: q } } },
                { student: { firstName: { contains: q } } },
                { session: { courseName: { contains: q } } },
              ],
            }
          : {}),
      },
      include: {
        student: { include: { class: true } },
        session: true,
      },
      orderBy: { session: { date: "desc" } },
      take: 100,
    });
    return NextResponse.json(attendances);
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const { id, present, justification } = patchSchema.parse(await req.json());
    const cleanJustification = justification?.trim();

    const att = await prisma.attendance.update({
      where: { id },
      data: {
        ...(typeof present === "boolean" ? { present } : {}),
        ...(present === true && justification === undefined
          ? { justification: null }
          : {}),
        ...(justification !== undefined
          ? { justification: cleanJustification || null }
          : {}),
        amendedAt: new Date(),
        amendedById: admin.id,
      },
      include: { session: { select: { subjectId: true } } },
    });
    if (att.session.subjectId) {
      const notificationId = await recalculateStudentSubjectAlert(
        att.studentId,
        att.session.subjectId,
      );
      if (notificationId) await sendPendingNotifications(1);
    }
    return NextResponse.json(att);
  } catch {
    return NextResponse.json({ error: "Modification échouée" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const { studentId, sessionId, present, justification } = createSchema.parse(
      await req.json(),
    );
    const [student, session] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: { classId: true, active: true },
      }),
      prisma.session.findUnique({
        where: { id: sessionId },
        select: { classId: true, subjectId: true },
      }),
    ]);
    if (
      !student ||
      !student.active ||
      !session ||
      student.classId !== session.classId
    ) {
      return NextResponse.json(
        { error: "Étudiant ou séance invalide" },
        { status: 400 },
      );
    }
    const cleanJustification = justification?.trim() || null;
    const att = await prisma.attendance.upsert({
      where: { studentId_sessionId: { studentId, sessionId } },
      create: {
        studentId,
        sessionId,
        present,
        justification: cleanJustification,
        amendedAt: new Date(),
        amendedById: admin.id,
      },
      update: {
        present,
        justification: cleanJustification,
        amendedAt: new Date(),
        amendedById: admin.id,
      },
    });
    if (session.subjectId) {
      const notificationId = await recalculateStudentSubjectAlert(
        studentId,
        session.subjectId,
      );
      if (notificationId) await sendPendingNotifications(1);
    }
    return NextResponse.json(att);
  } catch {
    return NextResponse.json({ error: "Création échouée" }, { status: 400 });
  }
}
