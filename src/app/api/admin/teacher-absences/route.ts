import { NextResponse } from "next/server";
import { requireAdmin, authFailure } from "@/lib/auth";
import { findTeacherAbsences, teacherAbsenceWorkbook } from "@/lib/teacher-absences";
import { throttleUser } from "@/lib/rate-limit";
import { audit, logServerError } from "@/lib/security-log";

function dateParam(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Sessions over without roll call (teacher absent). ?format=xlsx: Excel file.
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    const search = new URL(req.url).searchParams;
    const xlsx = search.get("format") === "xlsx";
    const throttled = throttleUser(admin.id, xlsx ? "import" : "read");
    if (throttled) return throttled;
    const rows = await findTeacherAbsences({
      from: dateParam(search.get("from")),
      to: dateParam(search.get("to"), true),
      professorId: search.get("professorId") || undefined,
    });
    if (!xlsx) return NextResponse.json({ rows });
    await audit(admin, "report.view", { type: "export", id: null }, { format: "absences-enseignants.xlsx", rows: rows.length }, req);
    return new NextResponse(new Uint8Array(teacherAbsenceWorkbook(rows)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="absences-enseignants.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    logServerError("reports.teacher-absences", error);
    return NextResponse.json({ error: "Chargement impossible" }, { status: 500 });
  }
}
