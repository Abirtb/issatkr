import { NextResponse } from "next/server";
import { requireScheduleManager, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireScheduleManager();
    const [classes, professors, subjects, subgroups] = await Promise.all([
      prisma.class.findMany({
        include: { level: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: {
          active: true,
          role: { in: ["PROF", "DEPARTMENT_HEAD"] },
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.subject.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        // Programmes, to list a class's own subjects first.
        include: {
          curricula: { select: { levelId: true, specialty: true } },
          elements: { select: { parcoursId: true, semester: true } },
        },
      }),
      // Sub-groups (TP1, TP2…) found among each class's students.
      prisma.student.findMany({
        where: { active: true, subgroup: { not: "" } },
        distinct: ["classId", "subgroup"],
        select: { classId: true, subgroup: true },
        orderBy: { subgroup: "asc" },
      }),
    ]);
    return NextResponse.json({
      classes: classes.map((item) => ({
        ...item,
        subgroups: subgroups.filter((row) => row.classId === item.id).map((row) => row.subgroup),
      })),
      professors,
      subjects,
    });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}
