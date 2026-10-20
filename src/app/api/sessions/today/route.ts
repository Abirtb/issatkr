import { NextResponse } from "next/server";
import { requireSession, authFailure } from "@/lib/auth";
import { getAttendanceWindow } from "@/lib/attendance-window";
import { prisma } from "@/lib/db";

// Teacher home: the sessions of the day only, with their attendance window
// (open from the start to the end of the session). Admins (teacher view) see
// every session of the day. Session dates are stored at local noon, so the
// local day boundaries select them.
export async function GET() {
  try {
    const user = await requireSession();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const sessions = await prisma.session.findMany({
      where: {
        date: { gte: start, lt: end },
        ...(user.role === "ADMIN" ? {} : { professorId: user.id }),
      },
      orderBy: [{ startTime: "asc" }],
      select: {
        id: true,
        date: true,
        courseName: true,
        startTime: true,
        endTime: true,
        room: true,
        finalizedAt: true,
        class: { select: { id: true, name: true, _count: { select: { students: { where: { active: true } } } } } },
        ...(user.role === "ADMIN" ? { professor: { select: { name: true } } } : {}),
      },
    });
    const now = new Date();
    return NextResponse.json({
      serverNow: now,
      sessions: sessions.map((session) => ({
        ...session,
        window: getAttendanceWindow(session.date, session.startTime, session.endTime, now),
      })),
    });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
}
