import { NextResponse } from "next/server";
import { authFailure, requireAdmin } from "./auth";
import { prisma } from "./db";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  parseReferenceRows,
  parseWorkbook,
} from "./parse-upload";
import { throttleUser } from "./rate-limit";
import { audit, logServerError } from "./security-log";

type Kind = "subjects" | "levels";

// Same rules as the manual forms (src/app/api/admin/{subjects,levels}/route.ts).
const NAME_MAX: Record<Kind, number> = { subjects: 150, levels: 100 };

// CSV / Excel import of subjects or levels. Upsert by code: new codes are
// created, existing ones get the file's label and are reactivated.
export async function importReferences(req: Request, kind: Kind) {
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
      return NextResponse.json({ error: "Format accepté : CSV, XLSX ou XLS" }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: "Fichier trop volumineux (maximum 5 Mo)" }, { status: 413 });
    }

    const rows = parseWorkbook(await file.arrayBuffer());
    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json({ error: `Maximum ${MAX_IMPORT_ROWS} lignes par import` }, { status: 400 });
    }
    const parsed = parseReferenceRows(rows);
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "Aucune ligne trouvée. Colonnes attendues : code, libellé" },
        { status: 400 },
      );
    }

    const errors: string[] = [];
    const byCode = new Map<string, string>();
    // Subjects only: optional "niveau" + "spécialité" columns → programmes.
    const programmes: { line: number; code: string; level: string; specialty: string }[] = [];
    for (const row of parsed) {
      const code = row.code.trim().toUpperCase();
      const name = row.name.trim();
      if (!code || code.length > 30) errors.push(`Ligne ${row.line} : code manquant ou trop long (30 max.)`);
      else if (name.length < 2 || name.length > NAME_MAX[kind]) {
        errors.push(`Ligne ${row.line} : libellé de 2 à ${NAME_MAX[kind]} caractères requis`);
      } else {
        byCode.set(code, name); // a repeated code: the last line wins (for the label)
        if (kind === "subjects" && row.level) {
          programmes.push({ line: row.line, code, level: row.level, specialty: row.specialty });
        }
      }
    }

    const codes = [...byCode.keys()];
    // Same code on several lines (only expected when listing programmes).
    const duplicates = Math.max(0, parsed.length - errors.length - codes.length - programmes.length);
    const existing =
      kind === "subjects"
        ? await prisma.subject.findMany({ where: { code: { in: codes } }, select: { code: true } })
        : await prisma.academicLevel.findMany({ where: { code: { in: codes } }, select: { code: true } });
    const existingCodes = new Set(existing.map((item) => item.code));

    await prisma.$transaction(
      codes.map((code) => {
        const name = byCode.get(code)!;
        const args = {
          where: { code },
          create: { code, name },
          update: { name, active: true },
        };
        return kind === "subjects" ? prisma.subject.upsert(args) : prisma.academicLevel.upsert(args);
      }),
    );

    let linked = 0;
    if (programmes.length) {
      const key = (value: string) =>
        value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "");
      const [levels, subjects] = await Promise.all([
        prisma.academicLevel.findMany({ select: { id: true, code: true, name: true } }),
        prisma.subject.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } }),
      ]);
      const levelByKey = new Map<string, string>();
      for (const level of levels) {
        levelByKey.set(key(level.code), level.id);
        levelByKey.set(key(level.name), level.id);
      }
      const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject.id]));
      for (const programme of programmes) {
        const levelId = levelByKey.get(key(programme.level));
        const specialty = programme.specialty.trim().toUpperCase();
        if (!levelId) {
          errors.push(`Ligne ${programme.line} : niveau inconnu « ${programme.level} »`);
          continue;
        }
        if (!/^[A-ZÀ-Ÿ]{0,20}$/.test(specialty)) {
          errors.push(`Ligne ${programme.line} : spécialité invalide « ${programme.specialty} »`);
          continue;
        }
        const subjectId = subjectByCode.get(programme.code)!;
        await prisma.subjectCurriculum.upsert({
          where: { subjectId_levelId_specialty: { subjectId, levelId, specialty } },
          create: { subjectId, levelId, specialty },
          update: {},
        });
        linked++;
      }
    }

    const created = codes.filter((code) => !existingCodes.has(code)).length;
    const updated = codes.length - created;
    await audit(admin, kind === "subjects" ? "subjects.import" : "levels.import", { type: "workbook" }, {
      created,
      updated,
      rejected: errors.length,
    }, req);
    return NextResponse.json({
      created,
      updated,
      duplicates,
      linked,
      errors: errors.slice(0, 10),
      errorCount: errors.length,
    });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    logServerError(`${kind}.import`, error);
    return NextResponse.json({ error: "Import échoué" }, { status: 500 });
  }
}
