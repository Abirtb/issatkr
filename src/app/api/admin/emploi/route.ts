import { NextResponse } from "next/server";
import { requireScheduleManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  parseDate,
  parseEmploiRows,
  parseWorkbook,
} from "@/lib/parse-upload";

export async function POST(req: Request) {
  try {
    await requireScheduleManager();
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

    const buffer = await file.arrayBuffer();
    const rows = parseWorkbook(buffer);
    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMPORT_ROWS} lignes par import` },
        { status: 400 },
      );
    }
    const entries = parseEmploiRows(rows);
    if (entries.length === 0) {
      return NextResponse.json(
        {
          error:
            "Aucune séance trouvée. Colonnes: classe, matiere, date, heure_debut (heure_fin, salle optionnels)",
        },
        { status: 400 },
      );
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const professors = await prisma.user.findMany({
      where: {
        active: true,
        role: { in: ["PROF", "DEPARTMENT_HEAD"] },
      },
      select: { id: true, email: true },
    });
    const subjects = await prisma.subject.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true },
    });
    const professorByEmail = new Map(
      professors.map((professor) => [professor.email.toLowerCase(), professor]),
    );

    for (const e of entries) {
      const cls = await prisma.class.findFirst({
        where: {
          OR: [
            { code: e.classCode.toUpperCase() },
            { name: e.classCode },
            { code: e.classCode },
          ],
        },
      });
      if (!cls) {
        skipped++;
        errors.push(`Classe inconnue: ${e.classCode}`);
        continue;
      }
      const date = parseDate(e.dateRaw);
      if (!date) {
        skipped++;
        errors.push(`Date invalide: ${e.dateRaw}`);
        continue;
      }
      date.setHours(12, 0, 0, 0);

      const professor = e.professorEmail
        ? professorByEmail.get(e.professorEmail)
        : professors.length === 1
          ? professors[0]
          : undefined;
      if (!professor) {
        skipped++;
        errors.push(
          e.professorEmail
            ? `Enseignant inconnu: ${e.professorEmail}`
            : `Enseignant requis pour ${e.classCode} (colonne enseignant_email)`,
        );
        continue;
      }
      const subject = subjects.find(
        (item) =>
          item.code.toLowerCase() === e.courseCode.toLowerCase() ||
          item.name.toLowerCase() === e.courseName.toLowerCase(),
      );
      if (!subject) {
        skipped++;
        errors.push(
          `Matière inconnue: ${e.courseCode || e.courseName}`,
        );
        continue;
      }

      const exists = await prisma.session.findFirst({
        where: {
          classId: cls.id,
          courseName: e.courseName,
          date,
          startTime: e.startTime,
        },
      });
      if (exists) {
        await prisma.session.update({
          where: { id: exists.id },
          data: {
            professorId: professor.id,
            subjectId: subject.id,
            courseName: subject.name,
            courseCode: subject.code,
            endTime: e.endTime || exists.endTime,
            room: e.room || exists.room,
          },
        });
        updated++;
        continue;
      }

      await prisma.session.create({
        data: {
          classId: cls.id,
          subjectId: subject.id,
          courseName: subject.name,
          courseCode: subject.code,
          date,
          startTime: e.startTime,
          endTime: e.endTime || null,
          room: e.room || null,
          professorId: professor.id,
        },
      });
      created++;
    }

    return NextResponse.json({
      created,
      updated,
      skipped,
      errors: errors.slice(0, 10),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Import échoué" }, { status: 500 });
  }
}
