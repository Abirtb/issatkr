import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  parseEnrollmentWorkbook,
} from "@/lib/parse-upload";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const form = await req.formData();
    const file = form.get("file");
    const replace = form.get("replace") !== "false";
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
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
                cin: student.cin || null,
                firstNameAr: student.firstNameAr || null,
                lastNameAr: student.lastNameAr || null,
                email: student.email || null,
                phone: student.phone || null,
                classId: cls.id,
                active: true,
              },
              update: {
                cin: student.cin || null,
                firstName: student.firstName,
                lastName: student.lastName,
                firstNameAr: student.firstNameAr || null,
                lastNameAr: student.lastNameAr || null,
                email: student.email || null,
                phone: student.phone || null,
                active: true,
              },
            });
            if (existingMatricules.has(student.matricule)) studentsUpdated++;
            else studentsCreated++;
          }
        }

        return {
          classesCreated,
          classesUpdated,
          studentsCreated,
          studentsUpdated,
        };
      },
      { timeout: 30_000 },
    );

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
    console.error(error);
    return NextResponse.json(
      { error: "Import du fichier scolarité échoué" },
      { status: 500 },
    );
  }
}
