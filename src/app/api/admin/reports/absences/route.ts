import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { requireAdmin, authFailure } from "@/lib/auth";
import { ABSENCE_EXPORT_HEADER, buildAbsenceExport } from "@/lib/absence-export";
import { throttleUser } from "@/lib/rate-limit";
import { audit, logServerError } from "@/lib/security-log";

function dateParam(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Absence file in the scolarité format (.xls), for one class or all classes.
// Admin only: it contains CINs.
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    const throttled = throttleUser(admin.id, "import");
    if (throttled) return throttled;
    const search = new URL(req.url).searchParams;
    const classId = search.get("classId") || undefined;
    const rows = await buildAbsenceExport({
      classId,
      from: dateParam(search.get("from")),
      to: dateParam(search.get("to"), true),
    });
    const sheet = XLSX.utils.aoa_to_sheet([[...ABSENCE_EXPORT_HEADER], ...rows]);
    // Text cells, so identifiers and CINs keep their leading zeros.
    for (const address of Object.keys(sheet)) {
      const cell = sheet[address];
      if (address.startsWith("!") || cell.t !== "s") continue;
      cell.z = "@";
    }
    sheet["!cols"] = [8, 18, 14, 16, 30, 16, 12, 30, 30, 18].map((wch) => ({ wch }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "new sheet");
    const file = XLSX.write(book, { type: "buffer", bookType: "biff8" }) as Buffer;
    await audit(admin, "report.view", { type: "export", id: classId ?? null }, { format: "absences.xls", rows: rows.length }, req);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": `attachment; filename="absences.xls"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    logServerError("reports.absences", error);
    return NextResponse.json({ error: "Export impossible" }, { status: 500 });
  }
}
