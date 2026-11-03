import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, authFailure } from "@/lib/auth";
import { classParts } from "@/lib/class-name";
import { autoProgrammes } from "@/lib/curriculum-auto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/security-log";

// Spécialité as written in class names ("1ENR1" → "ENR"); "" = every spécialité.
const specialty = z
  .string()
  .trim()
  .max(20)
  .regex(/^[A-Za-zÀ-ÿ]*$/, "Spécialité : lettres uniquement")
  .transform((value) => value.toUpperCase());

const putSchema = z.object({
  levelId: z.string().min(1),
  specialty,
  subjectIds: z.array(z.string().min(1)).max(500),
});

// Programmes: which subjects are taught for a level + spécialité.
export async function GET() {
  try {
    await requireAdmin();
    const [levels, subjects, classes, entries, parcours] = await Promise.all([
      prisma.academicLevel.findMany({
        where: { active: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }),
      prisma.subject.findMany({
        where: { active: true },
        select: { id: true, code: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.class.findMany({ select: { name: true } }),
      prisma.subjectCurriculum.findMany({ select: { subjectId: true, levelId: true, specialty: true } }),
      prisma.parcours.findMany({
        select: {
          code: true,
          mention: true,
          specialty: true,
          classes: { select: { name: true } },
          elements: { select: { subjectId: true, semester: true } },
        },
      }),
    ]);
    // Pre-filled from the parcours files (EE semester → level): shown ticked,
    // not stored; the manual entries are the extra subjects.
    const auto = autoProgrammes(levels, parcours);
    const specialties = [
      ...new Set([
        ...classes.map((item) => classParts(item.name).specialty),
        ...entries.map((entry) => entry.specialty),
      ]),
    ]
      .filter((value): value is string => Boolean(value))
      .sort();
    return NextResponse.json({ levels, subjects, specialties, entries, auto });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

// Replaces the subject list of one programme (level + spécialité).
export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin();
    const input = putSchema.parse(await req.json());
    const wanted = [...new Set(input.subjectIds)];
    const where = { levelId: input.levelId, specialty: input.specialty };
    const result = await prisma.$transaction(async (tx) => {
      const removed = await tx.subjectCurriculum.deleteMany({
        where: { ...where, subjectId: { notIn: wanted } },
      });
      const present = new Set(
        (await tx.subjectCurriculum.findMany({ where, select: { subjectId: true } })).map(
          (entry) => entry.subjectId,
        ),
      );
      const missing = wanted.filter((id) => !present.has(id));
      if (missing.length) {
        await tx.subjectCurriculum.createMany({
          data: missing.map((subjectId) => ({ ...where, subjectId })),
        });
      }
      return { added: missing.length, removed: removed.count };
    });
    await audit(admin, "curriculum.update", { type: "level", id: input.levelId }, {
      specialty: input.specialty,
      ...result,
    }, req);
    return NextResponse.json(result);
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message : "Programme invalide";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
