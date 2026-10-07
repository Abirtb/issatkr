import { NextResponse } from "next/server";
import { requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { throttleUser } from "@/lib/rate-limit";
import { audit, logServerError } from "@/lib/security-log";
import { MAX_IMPORT_BYTES, parseCinEmailWorkbook } from "@/lib/parse-upload";
import { applyEmailsByCin } from "@/lib/student-emails";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const throttled = throttleUser(admin.id, "import");
    if (throttled) return throttled;
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
    }
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
      return NextResponse.json(
        { error: "Format accepté : CSV, XLSX ou XLS" },
        { status: 400 },
      );
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (maximum 5 Mo)" },
        { status: 413 },
      );
    }
    const rows = parseCinEmailWorkbook(await file.arrayBuffer());
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Aucune ligne trouvée. Colonnes attendues : CIN et E-mail" },
        { status: 400 },
      );
    }
    const result = await prisma.$transaction(
      (tx) => applyEmailsByCin(tx, rows),
      { timeout: 30_000 },
    );
    await audit(admin, "students.emails_import", { type: "workbook" }, {
      rows: rows.length,
      updated: result.updated,
    }, req);
    return NextResponse.json(result);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    logServerError("students.emails", error);
    return NextResponse.json({ error: "Import des e-mails échoué" }, { status: 500 });
  }
}
