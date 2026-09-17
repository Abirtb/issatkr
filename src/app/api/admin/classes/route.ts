import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const classSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(50),
  program: z.string().trim().max(200).optional(),
  academicYear: z.string().trim().max(20).optional(),
  semester: z.coerce.number().int().min(1).max(3).nullable().optional(),
  levelId: z.string().min(1).nullable().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const classes = await prisma.class.findMany({
      orderBy: { name: "asc" },
      include: {
        level: true,
        _count: {
          select: {
            students: { where: { active: true } },
            sessions: true,
          },
        },
      },
    });
    return NextResponse.json(classes);
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const input = classSchema.parse(await req.json());
    const cls = await prisma.class.create({
      data: {
        name: input.name,
        code: input.code.toUpperCase(),
        program: input.program || null,
        academicYear: input.academicYear || null,
        semester: input.semester ?? null,
        levelId: input.levelId ?? null,
      },
    });
    return NextResponse.json(cls, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur création classe" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const input = classSchema.parse(await req.json());
    if (!input.id) {
      return NextResponse.json({ error: "ID classe requis" }, { status: 400 });
    }
    const cls = await prisma.class.update({
      where: { id: input.id },
      data: {
        name: input.name,
        code: input.code.toUpperCase(),
        program: input.program || null,
        academicYear: input.academicYear || null,
        semester: input.semester ?? null,
        levelId: input.levelId ?? null,
      },
    });
    return NextResponse.json(cls);
  } catch {
    return NextResponse.json(
      { error: "Données invalides ou code déjà utilisé" },
      { status: 400 },
    );
  }
}
