import { NextResponse } from "next/server";
import { requireScheduleManager } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await requireScheduleManager();
    const [classes, professors, subjects] = await Promise.all([
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
      }),
    ]);
    return NextResponse.json({ classes, professors, subjects });
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}
