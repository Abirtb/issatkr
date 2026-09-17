import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recalculateAlertsForStudents } from "@/lib/alerts";
import { sendPendingNotifications } from "@/lib/mail";

const schema = z.object({
  subjectId: z.string().min(1),
  levelId: z.string().min(1),
  eliminationCount: z.coerce.number().int().min(1).max(100),
});

export async function GET() {
  try {
    await requireAdmin();
    const [subjects, levels, thresholds] = await Promise.all([
      prisma.subject.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
      prisma.academicLevel.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
      prisma.absenceThreshold.findMany({
        include: { subject: true, level: true },
        orderBy: [{ subject: { name: "asc" } }, { level: { name: "asc" } }],
      }),
    ]);
    return NextResponse.json({ subjects, levels, thresholds });
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin();
    const input = schema.parse(await req.json());
    const threshold = await prisma.absenceThreshold.upsert({
      where: {
        subjectId_levelId: {
          subjectId: input.subjectId,
          levelId: input.levelId,
        },
      },
      create: input,
      update: { eliminationCount: input.eliminationCount },
    });
    const students = await prisma.student.findMany({
      where: { active: true, class: { levelId: input.levelId } },
      select: { id: true },
    });
    const notifications = await recalculateAlertsForStudents(
      students.map((student) => student.id),
      input.subjectId,
    );
    if (notifications.length) {
      await sendPendingNotifications(Math.min(notifications.length, 10));
    }
    return NextResponse.json(threshold);
  } catch {
    return NextResponse.json({ error: "Seuil invalide" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const threshold = await prisma.absenceThreshold.findUnique({ where: { id } });
    if (!threshold) {
      return NextResponse.json({ error: "Seuil introuvable" }, { status: 404 });
    }
    await prisma.$transaction([
      prisma.alertState.deleteMany({
        where: {
          subjectId: threshold.subjectId,
          levelId: threshold.levelId,
        },
      }),
      prisma.absenceThreshold.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Suppression impossible" }, { status: 400 });
  }
}
