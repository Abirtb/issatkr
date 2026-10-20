import { NextResponse } from "next/server";
import { z } from "zod";
import { requireScheduleManager, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dateKey, isDayOff, scheduleDate } from "@/lib/recurrence";
import { audit } from "@/lib/security-log";

const sessionSchema = z.object({
  id: z.string().min(1).optional(),
  classId: z.string().min(1),
  professorId: z.string().min(1),
  subjectId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z
    .union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")])
    .optional(),
  room: z.string().trim().max(80).optional(),
});

// A one-off session on a holiday is allowed (e.g. a make-up class), with a warning.
async function dayOffWarning(date: string) {
  const daysOff = await prisma.dayOff.findMany({
    where: { startDate: { lte: scheduleDate(date) }, endDate: { gte: scheduleDate(date) } },
  });
  const ranges = daysOff.map((item) => ({ startDate: dateKey(item.startDate), endDate: dateKey(item.endDate) }));
  return isDayOff(date, ranges) ? `Attention : ${daysOff[0].label} (jour non travaillé).` : null;
}

// Moving or deleting one occurrence of a weekly course: it must not come back
// at the next re-generation.
async function excludeOccurrence(weeklySlotId: string, date: Date) {
  const slot = await prisma.weeklySlot.findUnique({
    where: { id: weeklySlotId },
    select: { excludedDates: true },
  });
  if (!slot) return;
  const dates = new Set(slot.excludedDates.split(",").filter(Boolean));
  dates.add(dateKey(date));
  await prisma.weeklySlot.update({
    where: { id: weeklySlotId },
    data: { excludedDates: [...dates].sort().join(",") },
  });
}

async function resolveReferences(input: z.infer<typeof sessionSchema>) {
  const [cls, professor, subject] = await Promise.all([
    prisma.class.findUnique({ where: { id: input.classId } }),
    prisma.user.findFirst({
      where: {
        id: input.professorId,
        active: true,
        role: { in: ["PROF", "DEPARTMENT_HEAD"] },
      },
    }),
    prisma.subject.findFirst({
      where: { id: input.subjectId, active: true },
    }),
  ]);
  if (!cls || !professor || !subject) throw new Error("INVALID_REFERENCE");
  return { cls, professor, subject };
}

export async function GET(req: Request) {
  try {
    await requireScheduleManager();
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const classId = url.searchParams.get("classId");
    const sessions = await prisma.session.findMany({
      where: {
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: scheduleDate(from) } : {}),
                ...(to ? { lte: scheduleDate(to) } : {}),
              },
            }
          : {}),
        ...(classId ? { classId } : {}),
      },
      include: {
        class: { include: { level: true } },
        professor: { select: { id: true, name: true, email: true } },
        subject: true,
        _count: { select: { attendances: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 500,
    });
    return NextResponse.json(sessions);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireScheduleManager();
    const input = sessionSchema.parse(await req.json());
    const { subject } = await resolveReferences(input);
    const session = await prisma.session.create({
      data: {
        classId: input.classId,
        professorId: input.professorId,
        subjectId: input.subjectId,
        courseName: subject.name,
        courseCode: subject.code,
        date: scheduleDate(input.date),
        startTime: input.startTime,
        endTime: input.endTime || null,
        room: input.room || null,
      },
    });
    // Actor = the logged-in user (never the request body); professorId = assigned teacher.
    await audit(actor, "schedule.create", { type: "session", id: session.id }, {
      classId: session.classId,
      professorId: session.professorId,
      selfAssigned: session.professorId === actor.id,
    }, req);
    return NextResponse.json(
      { ...session, warning: await dayOffWarning(input.date) },
      { status: 201 },
    );
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : "Séance invalide ou déjà existante";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await requireScheduleManager();
    const input = sessionSchema.parse(await req.json());
    if (!input.id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    const { subject } = await resolveReferences(input);
    const before = await prisma.session.findUnique({
      where: { id: input.id },
      select: { weeklySlotId: true, date: true },
    });
    // An occurrence edited by hand leaves its weekly course (becomes one-off).
    if (before?.weeklySlotId) await excludeOccurrence(before.weeklySlotId, before.date);
    const session = await prisma.session.update({
      where: { id: input.id },
      data: {
        weeklySlotId: null,
        classId: input.classId,
        professorId: input.professorId,
        subjectId: input.subjectId,
        courseName: subject.name,
        courseCode: subject.code,
        date: scheduleDate(input.date),
        startTime: input.startTime,
        endTime: input.endTime || null,
        room: input.room || null,
      },
    });
    await audit(actor, "schedule.update", { type: "session", id: session.id }, {
      classId: session.classId,
      professorId: session.professorId,
      selfAssigned: session.professorId === actor.id,
    }, req);
    return NextResponse.json({ ...session, warning: await dayOffWarning(input.date) });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Modification impossible" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requireScheduleManager();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const attendanceCount = await prisma.attendance.count({
      where: { sessionId: id },
    });
    if (attendanceCount) {
      return NextResponse.json(
        { error: "Impossible de supprimer une séance déjà pointée" },
        { status: 409 },
      );
    }
    const deleted = await prisma.session.delete({ where: { id } });
    if (deleted.weeklySlotId) await excludeOccurrence(deleted.weeklySlotId, deleted.date);
    await audit(actor, "schedule.delete", { type: "session", id }, undefined, req);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Suppression impossible" }, { status: 400 });
  }
}
