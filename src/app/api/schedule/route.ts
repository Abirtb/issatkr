import { NextResponse } from "next/server";
import { z } from "zod";
import { requireScheduleManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

function scheduleDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_DATE");
  return date;
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
    const sessions = await prisma.session.findMany({
      where:
        from || to
          ? {
              date: {
                ...(from ? { gte: scheduleDate(from) } : {}),
                ...(to ? { lte: scheduleDate(to) } : {}),
              },
            }
          : undefined,
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
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    await requireScheduleManager();
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
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : "Séance invalide ou déjà existante";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireScheduleManager();
    const input = sessionSchema.parse(await req.json());
    if (!input.id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    const { subject } = await resolveReferences(input);
    const session = await prisma.session.update({
      where: { id: input.id },
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
    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: "Modification impossible" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireScheduleManager();
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
    await prisma.session.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Suppression impossible" }, { status: 400 });
  }
}
