import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        class: { include: { level: true } },
        attendances: {
          include: {
            session: { include: { subject: true } },
            amendedBy: { select: { name: true } },
          },
          orderBy: { session: { date: "desc" } },
        },
      },
    });
    if (!student) {
      return NextResponse.json({ error: "Étudiant introuvable" }, { status: 404 });
    }

    const summaries = new Map<
      string,
      {
        subject: { id: string; code: string; name: string };
        present: number;
        absences: number;
        justified: number;
      }
    >();
    for (const attendance of student.attendances) {
      const subject = attendance.session.subject;
      if (!subject) continue;
      const summary = summaries.get(subject.id) ?? {
        subject,
        present: 0,
        absences: 0,
        justified: 0,
      };
      if (attendance.present) summary.present++;
      else if (attendance.justification) summary.justified++;
      else summary.absences++;
      summaries.set(subject.id, summary);
    }
    const thresholds = student.class.levelId
      ? await prisma.absenceThreshold.findMany({
          where: { levelId: student.class.levelId },
        })
      : [];
    const thresholdBySubject = new Map(
      thresholds.map((item) => [item.subjectId, item.eliminationCount]),
    );
    return NextResponse.json({
      student,
      summaries: [...summaries.values()].map((summary) => {
        const threshold = thresholdBySubject.get(summary.subject.id) ?? null;
        return {
          ...summary,
          threshold,
          status:
            threshold && summary.absences >= threshold
              ? "ELIMINATED"
              : threshold &&
                  summary.absences >= Math.max(1, threshold - 1)
                ? "WARNING"
                : "NORMAL",
        };
      }),
    });
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}
