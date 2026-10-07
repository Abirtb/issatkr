import { NextResponse } from "next/server";
import { requireSession, authFailure } from "@/lib/auth";
import { getEliminatedStudents } from "@/lib/attendance";
import { canAccessClass, classScope } from "@/lib/access";
import { prisma } from "@/lib/db";
import { throttleUser } from "@/lib/rate-limit";

export async function GET(req: Request) {
  try {
    const user = await requireSession();
    const throttled = throttleUser(user.id, "search");
    if (throttled) return throttled;
    const search = new URL(req.url).searchParams;
    const classId = search.get("classId") ?? undefined;
    const subjectId = search.get("subjectId") ?? undefined;
    const levelId = search.get("levelId") ?? undefined;
    if (classId && !(await canAccessClass(user, classId))) {
      return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
    }
    const allowedClassIds =
      !classId && user.role !== "ADMIN"
        ? (
            await prisma.class.findMany({
              where: classScope(user),
              select: { id: true },
            })
          ).map((item) => item.id)
        : undefined;
    const data = await getEliminatedStudents({
      classId: classId || undefined,
      subjectId: subjectId || undefined,
      levelId: levelId || undefined,
      allowedClassIds,
    });
    return NextResponse.json(data);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
}
