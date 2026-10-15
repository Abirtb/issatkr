import { NextResponse } from "next/server";
import { requireSession, authFailure } from "@/lib/auth";
import { getAttendanceReport } from "@/lib/attendance";
import { prisma } from "@/lib/db";
import { throttleUser } from "@/lib/rate-limit";
import { canAccessClass, classScope } from "@/lib/access";

function dateParam(value: string | null, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(req: Request) {
  try {
    const user = await requireSession();
    const throttled = throttleUser(user.id, "search");
    if (throttled) return throttled;
    const search = new URL(req.url).searchParams;
    const classId = search.get("classId") || undefined;
    const subjectId = search.get("subjectId") || undefined;
    const levelId = search.get("levelId") || undefined;
    if (classId && !(await canAccessClass(user, classId))) {
      return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
    }
    const [classes, subjects, levels] = await Promise.all([
      prisma.class.findMany({
        where: classScope(user),
        include: { level: true },
        orderBy: { name: "asc" },
      }),
      prisma.subject.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
      prisma.academicLevel.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const allowedClassIds =
      user.role === "ADMIN" ? undefined : classes.map((item) => item.id);
    const report = classId
      ? await getAttendanceReport({
          classId,
          subjectId,
          levelId,
          allowedClassIds,
          from: dateParam(search.get("from")),
          to: dateParam(search.get("to"), true),
        })
      : { rows: [], thresholds: [] };
    return NextResponse.json({ classes, subjects, levels, ...report });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
}
