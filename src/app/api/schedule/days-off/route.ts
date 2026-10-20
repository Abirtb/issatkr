import { NextResponse } from "next/server";
import { z } from "zod";
import { requireScheduleManager, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  dateKey,
  describeSync,
  inTransaction,
  scheduleDate,
  syncWeeklySlots,
} from "@/lib/recurrence";
import { audit } from "@/lib/security-log";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dayOffSchema = z
  .object({
    label: z.string().trim().min(2).max(80),
    startDate: day,
    // Empty: a single day.
    endDate: z.union([day, z.literal("")]).optional(),
  })
  .refine((value) => !value.endDate || value.startDate <= value.endDate, {
    message: "La date de fin doit suivre la date de début",
  });

export async function GET() {
  try {
    await requireScheduleManager();
    const daysOff = await prisma.dayOff.findMany({ orderBy: { startDate: "asc" } });
    return NextResponse.json(
      daysOff.map((item) => ({
        id: item.id,
        label: item.label,
        startDate: dateKey(item.startDate),
        endDate: dateKey(item.endDate),
      })),
    );
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

// A new day off removes the weekly-course sessions planned on it (unless
// already marked). One-off sessions on those days are left alone and counted.
export async function POST(req: Request) {
  try {
    const actor = await requireScheduleManager();
    const input = dayOffSchema.parse(await req.json());
    const startDate = scheduleDate(input.startDate);
    const endDate = scheduleDate(input.endDate || input.startDate);
    const { id, result, oneOff } = await inTransaction(async (tx) => {
      const created = await tx.dayOff.create({ data: { label: input.label, startDate, endDate } });
      const synced = await syncWeeklySlots(tx);
      const remaining = await tx.session.count({
        where: { weeklySlotId: null, date: { gte: startDate, lte: endDate } },
      });
      return { id: created.id, result: synced, oneOff: remaining };
    });
    await audit(actor, "schedule.day_off", { type: "dayOff", id }, { action: "create", ...result }, req);
    return NextResponse.json(
      {
        ...result,
        oneOff,
        message: [
          describeSync(result),
          oneOff ? `${oneOff} séance(s) ponctuelle(s) déjà prévue(s) ces jours-là : vérifiez-les.` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
      { status: 201 },
    );
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message : "Jour non travaillé invalide";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Removing a day off brings the weekly-course sessions of those days back.
export async function DELETE(req: Request) {
  try {
    const actor = await requireScheduleManager();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const result = await inTransaction(async (tx) => {
      await tx.dayOff.delete({ where: { id } });
      return syncWeeklySlots(tx);
    });
    await audit(actor, "schedule.day_off", { type: "dayOff", id }, { action: "delete", ...result }, req);
    return NextResponse.json({ ...result, message: describeSync(result) });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Suppression impossible" }, { status: 400 });
  }
}
