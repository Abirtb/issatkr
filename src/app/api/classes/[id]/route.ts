import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessClass } from "@/lib/access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSession();
    const { id } = await params;
    if (!(await canAccessClass(user, id))) {
      return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        students: {
          where: { active: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        },
        sessions: {
          where: {
            date: { gte: start, lt: end },
            ...(user.role !== "ADMIN" ? { professorId: user.id } : {}),
          },
          orderBy: [{ startTime: "asc" }],
        },
      },
    });
    if (!cls) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    const history = await prisma.session.findMany({
      where: {
        classId: id,
        date: { lt: start },
        ...(user.role !== "ADMIN" ? { professorId: user.id } : {}),
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: 20,
    });
    return NextResponse.json({ ...cls, history });
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
}
