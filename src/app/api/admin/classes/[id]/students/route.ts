import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, authFailure } from "@/lib/auth";
import { cinField, phoneField } from "@/lib/student-fields";
import { prisma } from "@/lib/db";
import { throttleUser } from "@/lib/rate-limit";
import { audit, changedFields, logServerError } from "@/lib/security-log";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  parseStudentsRows,
  parseWorkbook,
} from "@/lib/parse-upload";

const studentSchema = z.object({
  studentId: z.string().min(1).optional(),
  matricule: z.string().trim().min(1).max(50),
  cin: cinField,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  firstNameAr: z.string().trim().max(100).nullable().optional(),
  lastNameAr: z.string().trim().max(100).nullable().optional(),
  email: z
    .union([z.string().trim().email().max(200), z.literal(""), z.null()])
    .optional(),
  phone: phoneField,
  classId: z.string().min(1).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const students = await prisma.student.findMany({
      where: { classId: id, active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return NextResponse.json(students);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const throttled = throttleUser(admin.id, "import");
    if (throttled) return throttled;
    const { id } = await params;
    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });

    if (req.headers.get("content-type")?.includes("application/json")) {
      const student = studentSchema.parse(await req.json());
      const created = await prisma.student.create({
        data: {
          matricule: student.matricule,
          cin: student.cin || null,
          firstName: student.firstName,
          lastName: student.lastName,
          firstNameAr: student.firstNameAr || null,
          lastNameAr: student.lastNameAr || null,
          email: student.email || null,
          phone: student.phone || null,
          classId: id,
        },
      });
      await audit(admin, "student.create", { type: "student", id: created.id }, { classId: id }, req);
      return NextResponse.json(created, { status: 201 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const replace = form.get("replace") === "true";
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

    const buffer = await file.arrayBuffer();
    const rows = parseWorkbook(buffer);
    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMPORT_ROWS} lignes par import` },
        { status: 400 },
      );
    }
    const students = parseStudentsRows(rows);
    if (students.length === 0) {
      return NextResponse.json(
        { error: "Aucun étudiant trouvé. Colonnes: matricule, nom, prénom" },
        { status: 400 },
      );
    }

    const uniqueStudents = [
      ...new Map(students.map((student) => [student.matricule, student])).values(),
    ];
    const existing = await prisma.student.findMany({
      where: {
        classId: id,
        matricule: { in: uniqueStudents.map((student) => student.matricule) },
      },
      select: { matricule: true },
    });
    const existingSet = new Set(existing.map((student) => student.matricule));

    await prisma.$transaction([
      ...(replace
        ? [
            prisma.student.updateMany({
              where: { classId: id },
              data: { active: false },
            }),
          ]
        : []),
      ...uniqueStudents.map((s) =>
        prisma.student.upsert({
          where: {
            matricule_classId: { matricule: s.matricule, classId: id },
          },
          create: {
            matricule: s.matricule,
            firstName: s.firstName || "—",
            lastName: s.lastName || "—",
            active: true,
            classId: id,
          },
          update: {
            firstName: s.firstName || undefined,
            lastName: s.lastName || undefined,
            active: true,
          },
        }),
      ),
    ]);

    await audit(admin, "students.import", { type: "class", id }, {
      rows: uniqueStudents.length,
      replace,
    }, req);
    return NextResponse.json({
      created: uniqueStudents.length - existingSet.size,
      updated: existingSet.size,
      total: uniqueStudents.length,
      duplicatesIgnored: students.length - uniqueStudents.length,
    });
  } catch (e) {
    const denied = authFailure(e);
    if (denied) return denied;
    logServerError("students.import", e);
    return NextResponse.json({ error: "Import échoué" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const student = studentSchema.parse(await req.json());
    if (!student.studentId) {
      return NextResponse.json({ error: "ID étudiant requis" }, { status: 400 });
    }
    const existing = await prisma.student.findFirst({
      where: { id: student.studentId, classId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Étudiant introuvable" }, { status: 404 });
    }
    const targetClassId = student.classId ?? id;
    if (
      targetClassId !== id &&
      !(await prisma.class.findUnique({ where: { id: targetClassId } }))
    ) {
      return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
    }
    const updated = await prisma.student.update({
      where: { id: student.studentId },
      data: {
        classId: targetClassId,
        matricule: student.matricule,
        cin: student.cin || null,
        firstName: student.firstName,
        lastName: student.lastName,
        firstNameAr: student.firstNameAr || null,
        lastNameAr: student.lastNameAr || null,
        email: student.email || null,
        phone: student.phone || null,
      },
    });
    // Field names only (e.g. "cin"), never the old or new values.
    await audit(admin, "student.update", { type: "student", id: updated.id }, {
      fields: changedFields(existing, updated),
    }, req);
    return NextResponse.json(updated);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Données invalides ou matricule déjà utilisé" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const studentId = new URL(req.url).searchParams.get("studentId");
    if (!studentId) {
      return NextResponse.json({ error: "ID étudiant requis" }, { status: 400 });
    }
    const result = await prisma.student.updateMany({
      where: { id: studentId, classId: id },
      data: { active: false },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Étudiant introuvable" }, { status: 404 });
    }
    await audit(admin, "student.deactivate", { type: "student", id: studentId }, { classId: id }, req);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Suppression impossible" }, { status: 400 });
  }
}
