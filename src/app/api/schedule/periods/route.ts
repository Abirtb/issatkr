import { NextResponse } from "next/server";
import { z } from "zod";
import { requireScheduleManager, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  dateKey,
  describeSync,
  inTransaction,
  removeFutureSessions,
  scheduleDate,
  syncWeeklySlots,
} from "@/lib/recurrence";
import { audit } from "@/lib/security-log";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const periodSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().trim().min(2).max(60),
    startDate: day,
    endDate: day,
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "La date de fin doit suivre la date de début",
  });

function errorMessage(error: unknown, fallback: string) {
  return error instanceof z.ZodError ? (error.issues[0]?.message ?? fallback) : fallback;
}

export async function GET() {
  try {
    await requireScheduleManager();
    const periods = await prisma.academicPeriod.findMany({
      orderBy: { startDate: "desc" },
      include: { _count: { select: { weeklySlots: true } } },
    });
    return NextResponse.json(
      periods.map((period) => ({
        ...period,
        startDate: dateKey(period.startDate),
        endDate: dateKey(period.endDate),
      })),
    );
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireScheduleManager();
    const input = periodSchema.parse(await req.json());
    const period = await prisma.academicPeriod.create({
      data: {
        name: input.name,
        startDate: scheduleDate(input.startDate),
        endDate: scheduleDate(input.endDate),
      },
    });
    await audit(actor, "schedule.period", { type: "period", id: period.id }, { action: "create" }, req);
    return NextResponse.json(period, { status: 201 });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: errorMessage(error, "Semestre invalide") }, { status: 400 });
  }
}

// New dates: the weekly courses of this period are re-generated.
export async function PATCH(req: Request) {
  try {
    const actor = await requireScheduleManager();
    const input = periodSchema.parse(await req.json());
    if (!input.id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const periodId = input.id;
    const result = await inTransaction(async (tx) => {
      await tx.academicPeriod.update({
        where: { id: periodId },
        data: {
          name: input.name,
          startDate: scheduleDate(input.startDate),
          endDate: scheduleDate(input.endDate),
        },
      });
      return syncWeeklySlots(tx, { periodId });
    });
    await audit(actor, "schedule.period", { type: "period", id: periodId }, { action: "update", ...result }, req);
    return NextResponse.json({ ...result, message: describeSync(result) });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: errorMessage(error, "Modification impossible") }, { status: 400 });
  }
}

// Deletes the period and its weekly courses. Their future, never-marked
// sessions go too; past or marked sessions are kept.
export async function DELETE(req: Request) {
  try {
    const actor = await requireScheduleManager();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const removed = await inTransaction(async (tx) => {
      const count = await removeFutureSessions(tx, { weeklySlot: { periodId: id } });
      await tx.academicPeriod.delete({ where: { id } });
      return count;
    });
    await audit(actor, "schedule.period", { type: "period", id }, { action: "delete", removed }, req);
    return NextResponse.json({ removed });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Suppression impossible" }, { status: 400 });
  }
}
