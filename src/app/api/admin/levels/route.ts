import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, authFailure } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/security-log";

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
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
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
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
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
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Modification impossible" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    // ?permanent=1: delete for good, only if no class uses it and no absence
    // alert history depends on it. Otherwise: deactivate.
    if (url.searchParams.get("permanent") === "1") {
      const used = await prisma.academicLevel.findUnique({
        where: { id },
        select: { _count: { select: { classes: true, alertStates: true, notifications: true } } },
      });
      if (!used) return NextResponse.json({ error: "Niveau introuvable" }, { status: 404 });
      const { classes, alertStates, notifications } = used._count;
      if (classes || alertStates || notifications) {
        return NextResponse.json(
          {
            error: classes
              ? `Suppression impossible : ${classes} classe(s) utilisent ce niveau. Changez-leur de niveau ou désactivez-le.`
              : "Suppression impossible : des alertes d’absence dépendent de ce niveau. Désactivez-le plutôt.",
          },
          { status: 409 },
        );
      }
      await prisma.academicLevel.delete({ where: { id } });
      await audit(admin, "level.delete", { type: "level", id }, undefined, req);
      return NextResponse.json({ ok: true, deleted: true });
    }
    await prisma.academicLevel.update({
      where: { id },
      data: { active: false },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const denied = authFailure(error);
    if (denied) return denied;
    return NextResponse.json({ error: "Désactivation impossible" }, { status: 400 });
  }
}
