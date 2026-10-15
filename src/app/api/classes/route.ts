import { NextResponse } from "next/server";
import { requireSession, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { classScope } from "@/lib/access";

export async function GET() {
  try {
    const user = await requireSession();
    const classes = await prisma.class.findMany({
      where: classScope(user),
      orderBy: { name: "asc" },
      include: {
        _count: { select: { students: { where: { active: true } } } },
        sessions: {
          where: {
            date: { gte: startOfToday() },
            ...(user.role !== "ADMIN" ? { professorId: user.id } : {}),
          },
          orderBy: { date: "asc" },
          take: 1,
        },
      },
    });
    return NextResponse.json(classes);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
