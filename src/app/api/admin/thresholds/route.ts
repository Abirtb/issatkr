import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/security-log";
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
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin();
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
    await audit(admin, "threshold.update", { type: "threshold", id: threshold.id }, { eliminationCount: threshold.eliminationCount }, req);
    return NextResponse.json(threshold);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Seuil invalide" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
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
    await audit(admin, "threshold.delete", { type: "threshold", id: id }, undefined, req);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Suppression impossible" }, { status: 400 });
  }
}
