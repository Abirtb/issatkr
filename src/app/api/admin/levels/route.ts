import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  id: z.string().min(1).optional(),
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(2).max(100),
  active: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(
      await prisma.academicLevel.findMany({
        include: { _count: { select: { classes: true } } },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      }),
    );
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const input = schema.parse(await req.json());
    return NextResponse.json(
      await prisma.academicLevel.create({
        data: { code: input.code.toUpperCase(), name: input.name },
      }),
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Code déjà utilisé ou données invalides" },
      { status: 400 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const input = schema.parse(await req.json());
    if (!input.id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    return NextResponse.json(
      await prisma.academicLevel.update({
        where: { id: input.id },
        data: {
          code: input.code.toUpperCase(),
          name: input.name,
          active: input.active ?? true,
        },
      }),
    );
  } catch {
    return NextResponse.json({ error: "Modification impossible" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    await prisma.academicLevel.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Désactivation impossible" }, { status: 400 });
  }
}
