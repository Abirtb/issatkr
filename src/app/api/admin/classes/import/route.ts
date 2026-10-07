import { NextResponse } from "next/server";
import { requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { throttleUser } from "@/lib/rate-limit";
import { audit, logServerError } from "@/lib/security-log";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  parseCinEmailWorkbook,
  parseEnrollmentWorkbook,
} from "@/lib/parse-upload";
import { applyEmailsByCin } from "@/lib/student-emails";
import { cleanCin } from "@/lib/student-fields";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const throttled = throttleUser(admin.id, "import");
    if (throttled) return throttled;
    const form = await req.formData();
    const file = form.get("file");
    const emailsFile = form.get("emailsFile");
    const replace = form.get("replace") !== "false";
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
    }
    const hasEmailsFile = emailsFile instanceof File && emailsFile.size > 0;
    if (
      hasEmailsFile &&
      (!/\.(csv|xlsx|xls)$/i.test(emailsFile.name) ||
        emailsFile.size > MAX_IMPORT_BYTES)
    ) {
      return NextResponse.json(
        { error: "Fichier e-mails : CSV, XLSX ou XLS de 5 Mo maximum" },
        { status: 400 },
      );
    }
    const emailRows = hasEmailsFile
      ? parseCinEmailWorkbook(await emailsFile.arrayBuffer())
      : [];
    if (hasEmailsFile && emailRows.length === 0) {
      return NextResponse.json(
        { error: "Fichier e-mails : colonnes CIN et E-mail introuvables" },
        { status: 400 },
      );
    }
    if (!/\.(xls|xlsx)$/i.test(file.name)) {
      return NextResponse.json(
        { error: "Ce modèle doit être un fichier XLS ou XLSX" },
        { status: 400 },
      );
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (maximum 5 Mo)" },
        { status: 413 },
      );
    }

    const groups = parseEnrollmentWorkbook(await file.arrayBuffer());
    if (groups.length === 0) {
      return NextResponse.json(
        {
          error:
            "Aucune feuille de groupe reconnue. En-tête attendu : N° Inscription, Nom Fr, Prénom Fr.",
        },
        { status: 400 },
      );
    }
    const totalRows = groups.reduce(
      (total, group) => total + group.students.length,
      0,
    );
    if (totalRows > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMPORT_ROWS} étudiants par fichier` },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        let classesCreated = 0;
        let classesUpdated = 0;
        let studentsCreated = 0;
        let studentsUpdated = 0;

        for (const group of groups) {
          let cls = group.externalId
            ? await tx.class.findUnique({
                where: { externalId: group.externalId },
              })
            : null;
          cls ??= await tx.class.findUnique({ where: { code: group.code } });

          if (cls) {
            cls = await tx.class.update({
              where: { id: cls.id },
              data: {
                name: group.name,
                externalId: group.externalId || cls.externalId,
                program: group.program || cls.program,
                academicYear: group.academicYear || cls.academicYear,
                semester: group.semester ?? cls.semester,
              },
            });
            classesUpdated++;
          } else {
            cls = await tx.class.create({
              data: {
                name: group.name,
                code: group.code,
                externalId: group.externalId || null,
                program: group.program || null,
                academicYear: group.academicYear || null,
                semester: group.semester,
              },
            });
            classesCreated++;
          }

          const uniqueStudents = [
            ...new Map(
              group.students.map((student) => [student.matricule, student]),
            ).values(),
          ];
          const existing = await tx.student.findMany({
            where: {
              classId: cls.id,
              matricule: {
                in: uniqueStudents.map((student) => student.matricule),
              },
            },
            select: { matricule: true },
          });
          const existingMatricules = new Set(
            existing.map((student) => student.matricule),
          );

          if (replace) {
            await tx.student.updateMany({
              where: { classId: cls.id },
              data: { active: false },
            });
          }

          for (const student of uniqueStudents) {
            await tx.student.upsert({
              where: {
                matricule_classId: {
                  matricule: student.matricule,
                  classId: cls.id,
                },
              },
              create: {
                ...student,
                cin: cleanCin(student.cin),
                firstNameAr: student.firstNameAr || null,
                lastNameAr: student.lastNameAr || null,
                email: student.email || null,
                phone: student.phone || null,
                classId: cls.id,
                active: true,
              },
              update: {
                cin: cleanCin(student.cin),
                firstName: student.firstName,
                lastName: student.lastName,
                firstNameAr: student.firstNameAr || null,
                lastNameAr: student.lastNameAr || null,
                // Keep values filled in earlier (e.g. e-mails merged by CIN).
                email: student.email || undefined,
                phone: student.phone || undefined,
                active: true,
              },
            });
            if (existingMatricules.has(student.matricule)) studentsUpdated++;
            else studentsCreated++;
          }
        }

        const emails = emailRows.length
          ? await applyEmailsByCin(tx, emailRows)
          : null;

        return {
          classesCreated,
          classesUpdated,
          studentsCreated,
          studentsUpdated,
          emails,
        };
      },
      { timeout: 30_000 },
    );

    await audit(admin, "students.import", { type: "workbook" }, {
      sheets: groups.length,
      rows: totalRows,
      emailRows: emailRows.length,
      replace,
    }, req);
    return NextResponse.json({
      ...result,
      groups: groups.map((group) => ({
        sheet: group.sheetName,
        className: group.name,
        students: group.students.length,
      })),
      warnings: groups
        .filter((group) => group.students.length === 0)
        .map(
          (group) =>
            `${group.sheetName}: classe créée, mais aucune identité étudiante n’est renseignée`,
        ),
    });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    logServerError("classes.import", error);
    return NextResponse.json(
      { error: "Import du fichier scolarité échoué" },
      { status: 500 },
    );
  }
}
