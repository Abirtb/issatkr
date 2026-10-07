import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { throttleUser } from "@/lib/rate-limit";
import { audit } from "@/lib/security-log";
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
    const admin = await requireAdmin();
    const throttled = throttleUser(admin.id, "search");
    if (throttled) return throttled;
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const classId = url.searchParams.get("classId")?.trim();
    const status = url.searchParams.get("status");
    const unjustified: Prisma.AttendanceWhereInput = {
      OR: [{ justification: null }, { justification: "" }],
    };
    const filters: Prisma.AttendanceWhereInput[] = [];
    if (classId) filters.push({ student: { classId } });
    if (status === "present") filters.push({ present: true });
    if (status === "absent") filters.push({ present: false }, unjustified);
    if (status === "justified") {
      filters.push({ present: false }, { NOT: unjustified });
    }
    if (status === "all-absent") filters.push({ present: false });
    if (q) {
      filters.push({
        OR: [
          { student: { matricule: { contains: q } } },
          // A CIN only matches exactly: no partial-CIN enumeration.
          { student: { cin: q } },
          { student: { lastName: { contains: q } } },
          { student: { firstName: { contains: q } } },
          { session: { courseName: { contains: q } } },
        ],
      });
    }

    const attendances = await prisma.attendance.findMany({
      where: { AND: filters },
      include: {
        // Listing view: identity only, no CIN/phone/e-mail.
        student: { select: { id: true, firstName: true, lastName: true, matricule: true, class: { select: { name: true } } } },
        session: { select: { courseName: true, date: true, startTime: true } },
      },
      orderBy: { session: { date: "desc" } },
      take: 200,
    });
    return NextResponse.json(attendances);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
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
    await audit(admin, "attendance.amend", { type: "attendance", id: att.id }, { present: att.present, justified: Boolean(att.justification) }, req);
    return NextResponse.json(att);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
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
    await audit(admin, "attendance.amend", { type: "attendance", id: att.id }, { present: att.present, justified: Boolean(att.justification) }, req);
    return NextResponse.json(att);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Création échouée" }, { status: 400 });
  }
}
