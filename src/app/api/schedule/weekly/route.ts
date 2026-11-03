import { NextResponse } from "next/server";
import { z } from "zod";
import { requireScheduleManager, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  describeSync,
  inTransaction,
  removeFutureSessions,
  syncWeeklySlot,
} from "@/lib/recurrence";
import { audit } from "@/lib/security-log";
import { allowedKinds, kindLabel, SESSION_KINDS } from "@/lib/session-kind";

const time = z.string().regex(/^\d{2}:\d{2}$/);
const slotSchema = z.object({
  id: z.string().min(1).optional(),
  periodId: z.string().min(1),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  professorId: z.string().min(1),
  weekday: z.coerce.number().int().min(1).max(7),
  // 1 = every week, 2 = every other week (weekOffset 0: 1st week, 1: 2nd week).
  intervalWeeks: z.coerce.number().int().min(1).max(2).default(1),
  weekOffset: z.coerce.number().int().min(0).max(1).default(0),
  startTime: time,
  endTime: z.union([time, z.literal("")]).optional(),
  room: z.string().trim().max(80).optional(),
  // "" = the whole class.
  subgroup: z.string().trim().max(20).optional(),
  // Cours, TD or TP: one the EE of the parcours plans hours for.
  kind: z.enum(SESSION_KINDS, { message: "Choisissez le type de séance : Cours, TD ou TP" }),
});
// A Cours / TD / TP the EE plans no hours for.
class KindError extends Error {
  constructor(kind: string) {
    super(`Pas de ${kindLabel(kind)} prévu pour cette matière dans le parcours (0 h dans l’élément d’enseignement).`);
  }
}

async function checkReferences(input: z.infer<typeof slotSchema>) {
  const [period, cls, professor, subject] = await Promise.all([
    prisma.academicPeriod.findUnique({ where: { id: input.periodId }, select: { id: true } }),
    prisma.class.findUnique({ where: { id: input.classId }, select: { id: true, parcoursId: true } }),
    prisma.user.findFirst({
      where: { id: input.professorId, active: true, role: { in: ["PROF", "DEPARTMENT_HEAD"] } },
      select: { id: true },
    }),
    prisma.subject.findFirst({
      where: { id: input.subjectId, active: true },
      select: { id: true, elements: { select: { parcoursId: true, hoursLecture: true, hoursTutorial: true, hoursLab: true } } },
    }),
  ]);
  if (!period || !cls || !professor || !subject) throw new Error("INVALID_REFERENCE");
  if (!allowedKinds(subject.elements, cls.parcoursId).includes(input.kind)) throw new KindError(input.kind);
}

function slotData(input: z.infer<typeof slotSchema>) {
  return {
    periodId: input.periodId,
    classId: input.classId,
    subjectId: input.subjectId,
    professorId: input.professorId,
    weekday: input.weekday,
    intervalWeeks: input.intervalWeeks,
    weekOffset: input.intervalWeeks === 1 ? 0 : input.weekOffset,
    startTime: input.startTime,
    endTime: input.endTime || null,
    room: input.room || null,
    subgroup: input.subgroup ?? "",
    kind: input.kind,
  };
}

export async function GET() {
  try {
    await requireScheduleManager();
    const slots = await prisma.weeklySlot.findMany({
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      include: {
        period: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        professor: { select: { id: true, name: true } },
        _count: { select: { sessions: true } },
      },
    });
    return NextResponse.json(slots);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireScheduleManager();
    const input = slotSchema.parse(await req.json());
    await checkReferences(input);
    const { id, result } = await inTransaction(async (tx) => {
      const slot = await tx.weeklySlot.create({ data: slotData(input) });
      return { id: slot.id, result: await syncWeeklySlot(tx, slot.id) };
    });
    await audit(actor, "schedule.weekly", { type: "weeklySlot", id }, { action: "create", ...result }, req);
    return NextResponse.json({ id, ...result, message: describeSync(result) }, { status: 201 });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : error instanceof KindError
          ? error.message
          : "Cours hebdomadaire invalide";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Changes apply to future, never-marked sessions only.
export async function PATCH(req: Request) {
  try {
    const actor = await requireScheduleManager();
    const input = slotSchema.parse(await req.json());
    if (!input.id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const slotId = input.id;
    await checkReferences(input);
    const result = await inTransaction(async (tx) => {
      await tx.weeklySlot.update({ where: { id: slotId }, data: slotData(input) });
      return syncWeeklySlot(tx, slotId);
    });
    await audit(actor, "schedule.weekly", { type: "weeklySlot", id: slotId }, { action: "update", ...result }, req);
    return NextResponse.json({ ...result, message: describeSync(result) });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : error instanceof KindError
          ? error.message
          : "Modification impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Stops the course: its future, never-marked sessions are removed; past or
// marked ones stay in the history as ordinary sessions.
export async function DELETE(req: Request) {
  try {
    const actor = await requireScheduleManager();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const removed = await inTransaction(async (tx) => {
      const count = await removeFutureSessions(tx, { weeklySlotId: id });
      await tx.weeklySlot.delete({ where: { id } });
      return count;
    });
    await audit(actor, "schedule.weekly", { type: "weeklySlot", id }, { action: "delete", removed }, req);
    return NextResponse.json({ removed });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Suppression impossible" }, { status: 400 });
  }
}
